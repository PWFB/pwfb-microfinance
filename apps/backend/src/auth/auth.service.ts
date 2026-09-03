import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createCipheriv, createDecipheriv, createHash, createHmac, randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';
import { assertAllowedWebAuthnOrigin, getWebAuthnRpId } from './webauthn-config';

const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'PWFB Microfinance';

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();
  private googleIdentityTableReady = false;
  private authenticatorTableReady = false;

  constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService) {}

  private issueToken(user: any) { return this.jwtService.signAsync({ sub: user.id, email: user.email, role: user.role }); }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) throw new UnauthorizedException('User already exists');
    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({ data: { email: dto.email, password: hashedPassword, firstName: dto.firstName, lastName: dto.lastName, phone: dto.phone, passportPhoto: dto.passportPhoto, role: 'CUSTOMER' } });
    const accessToken = await this.issueToken(user); const { password, ...safeUser } = user;
    return { message: 'Registration successful', access_token: accessToken, user: safeUser };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid email or password');
    if (!await bcrypt.compare(dto.password, user.password)) throw new UnauthorizedException('Invalid email or password');
    const accessToken = await this.issueToken(user); const { password, ...safeUser } = user;
    return { message: 'Login successful', access_token: accessToken, user: safeUser };
  }

  googleConfig() {
    const clientId = process.env.GOOGLE_CLIENT_ID?.trim();
    const androidClientId = (process.env.GOOGLE_ANDROID_CLIENT_ID || clientId || '').trim();
    if (!clientId) throw new BadRequestException('Google login is not configured on the server');
    return { client_id: clientId, android_client_id: androidClientId };
  }

  private async ensureGoogleIdentityTable() {
    if (this.googleIdentityTableReady) return;
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "GoogleIdentity" ("userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE, "googleSub" TEXT NOT NULL UNIQUE, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    this.googleIdentityTableReady = true;
  }

  async googleLogin(idToken?: string, requestOrigin?: string, requestClientId?: string, expectedNonce?: string) {
    const clientId = (requestOrigin === 'android-app' ? (process.env.GOOGLE_ANDROID_CLIENT_ID || process.env.GOOGLE_CLIENT_ID) : process.env.GOOGLE_CLIENT_ID)?.trim();
    if (!clientId) throw new BadRequestException('Google login is not configured on the server');
    if (!idToken) throw new BadRequestException('Google credential is required');
    const googleOrigin = requestOrigin?.trim().replace(/\/$/, '');
    const configuredOrigins = [process.env.GOOGLE_ALLOWED_ORIGINS, process.env.WEBAUTHN_ORIGIN]
      .filter(Boolean).flatMap((value) => String(value).split(','));
    const googleAllowed = [...configuredOrigins, 'https://pwfb-frontend.onrender.com', 'android-app']
      .map((value) => value.trim().replace(/\/$/, '')).filter(Boolean);
    if (!googleOrigin || !googleAllowed.includes(googleOrigin)) throw new UnauthorizedException('Google login origin is not allowed');
    if (requestClientId && requestClientId !== clientId) throw new UnauthorizedException('Google client ID mismatch');
    try {
      const ticket = await this.googleClient.verifyIdToken({ idToken, audience: clientId });
      const payload = ticket.getPayload();
      if (payload?.iss !== 'accounts.google.com' && payload?.iss !== 'https://accounts.google.com') throw new UnauthorizedException('Invalid Google token issuer');
      if (!payload?.sub) throw new UnauthorizedException('Google account identifier is missing');
      if (!payload.email || payload.email_verified !== true) throw new UnauthorizedException('Google account email is not verified');
      if (googleOrigin !== 'android-app' && (!expectedNonce || payload.nonce !== expectedNonce)) throw new UnauthorizedException('Google authentication nonce mismatch');
      const email = payload.email.toLowerCase().trim(); const googleAuthoritative = email.endsWith('@gmail.com') || Boolean(payload.hd);
      await this.ensureGoogleIdentityTable(); const googleSub = payload.sub;
      const linkedRows = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(`SELECT "userId" FROM "GoogleIdentity" WHERE "googleSub" = $1 LIMIT 1`, googleSub);
      let user = linkedRows[0] ? await this.prisma.user.findUnique({ where: { id: linkedRows[0].userId } }) : null;
      if (!user && !googleAuthoritative) throw new UnauthorizedException('Google does not control this email domain. Sign in with your PWFB password first to link this Google account.');
      if (!user) user = await this.prisma.user.findUnique({ where: { email } });
      if (!user) { const randomPassword = await bcrypt.hash(randomBytes(32).toString('hex'), 12); user = await this.prisma.user.create({ data: { email, password: randomPassword, firstName: payload.given_name || payload.name?.split(' ')[0] || 'Google', lastName: payload.family_name || payload.name?.split(' ').slice(1).join(' ') || 'User', passportPhoto: payload.picture || null, role: 'CUSTOMER' } }); }
      const existingLink = await this.prisma.$queryRawUnsafe<Array<{ userId: string }>>(`SELECT "userId" FROM "GoogleIdentity" WHERE "userId" = $1 OR "googleSub" = $2 LIMIT 1`, user.id, googleSub);
      if (!existingLink.length) await this.prisma.$executeRawUnsafe(`INSERT INTO "GoogleIdentity" ("userId", "googleSub") VALUES ($1, $2)`, user.id, googleSub);
      else if (existingLink[0].userId !== user.id) throw new UnauthorizedException('Google account is already linked to another PWFB account');
      const accessToken = await this.issueToken(user); const { password, ...safeUser } = user;
      return { message: 'Google login successful', access_token: accessToken, user: safeUser };
    } catch (error) { if (error instanceof UnauthorizedException || error instanceof BadRequestException) throw error; throw new UnauthorizedException('Google authentication failed'); }
  }

  private async ensureAuthenticatorTable() {
    if (this.authenticatorTableReady) return;
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "UserAuthenticator" ("userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE, "secretEnc" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT FALSE, "recoveryCodes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    this.authenticatorTableReady = true;
  }

  private authenticatorKey() {
    const seed = process.env.AUTHENTICATOR_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!seed || seed === 'pwfb-secret-key') throw new BadRequestException('Authenticator encryption key is not configured on the server');
    return createHash('sha256').update(seed).digest();
  }

  private encryptAuthenticatorSecret(secret: string) {
    const iv = randomBytes(12); const cipher = createCipheriv('aes-256-gcm', this.authenticatorKey(), iv);
    const encrypted = Buffer.concat([cipher.update(secret, 'utf8'), cipher.final()]);
    return `${iv.toString('base64url')}.${cipher.getAuthTag().toString('base64url')}.${encrypted.toString('base64url')}`;
  }

  private decryptAuthenticatorSecret(value: string) {
    const [ivText, tagText, dataText] = value.split('.');
    if (!ivText || !tagText || !dataText) throw new BadRequestException('Stored authenticator secret is invalid');
    const decipher = createDecipheriv('aes-256-gcm', this.authenticatorKey(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64url')), decipher.final()]).toString('utf8');
  }

  private base32Encode(buffer: Buffer) { const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; let bits = 0; let value = 0; let output = ''; for (const byte of buffer) { value = (value << 8) | byte; bits += 8; while (bits >= 5) { output += alphabet[(value >>> (bits - 5)) & 31]; bits -= 5; } } if (bits > 0) output += alphabet[(value << (5 - bits)) & 31]; return output; }
  private base32Decode(input: string) { const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'; const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, ''); let bits = 0; let value = 0; const out: number[] = []; for (const char of clean) { const index = alphabet.indexOf(char); if (index < 0) continue; value = (value << 5) | index; bits += 5; if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; } } return Buffer.from(out); }
  private totp(secret: string, timestamp = Date.now()) { const counter = Math.floor(timestamp / 1000 / 30); const counterBuffer = Buffer.alloc(8); counterBuffer.writeBigUInt64BE(BigInt(counter)); const digest = createHmac('sha1', this.base32Decode(secret)).update(counterBuffer).digest(); const offset = digest[digest.length - 1] & 0x0f; const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff); return String(binary % 1000000).padStart(6, '0'); }
  private verifyTotp(secret: string, code: string) { const normalized = String(code || '').replace(/\s/g, ''); if (!/^\d{6}$/.test(normalized)) return false; const now = Date.now(); return [-1, 0, 1].some((window) => this.totp(secret, now + window * 30000) === normalized); }
  private generateRecoveryCodes() { return Array.from({ length: 8 }, () => randomBytes(5).toString('hex').toUpperCase().match(/.{1,5}/g)!.join('-')); }
  private buildOtpUri(secret: string, email: string) { const issuer = 'PWFB Microfinance'; const label = `${issuer}:${email}`; return `otpauth://totp/${encodeURIComponent(label)}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=30`; }
  async authenticatorStatus(authUser: any) { await this.ensureAuthenticatorTable(); const rows = await this.prisma.$queryRawUnsafe<Array<{ enabled: boolean; createdAt: Date; updatedAt: Date }>>(`SELECT "enabled", "createdAt", "updatedAt" FROM "UserAuthenticator" WHERE "userId" = $1 LIMIT 1`, authUser.sub); return { enabled: Boolean(rows[0]?.enabled), configured: Boolean(rows.length), createdAt: rows[0]?.createdAt || null }; }
  async authenticatorSetup(authUser: any) { const user = await this.prisma.user.findUnique({ where: { id: authUser.sub } }); if (!user) throw new UnauthorizedException('User not found'); await this.ensureAuthenticatorTable(); const existing = await this.prisma.$queryRawUnsafe<Array<{ enabled: boolean }>>(`SELECT "enabled" FROM "UserAuthenticator" WHERE "userId" = $1 LIMIT 1`, user.id); if (existing[0]?.enabled) throw new BadRequestException('Authenticator is already enabled'); const secret = this.base32Encode(randomBytes(20)); const encrypted = this.encryptAuthenticatorSecret(secret); await this.prisma.$executeRawUnsafe(`INSERT INTO "UserAuthenticator" ("userId", "secretEnc", "enabled") VALUES ($1, $2, FALSE) ON CONFLICT ("userId") DO UPDATE SET "secretEnc" = EXCLUDED."secretEnc", "enabled" = FALSE, "recoveryCodes" = NULL, "updatedAt" = CURRENT_TIMESTAMP`, user.id, encrypted); return { configured: true, enabled: false, secret, otpauthUri: this.buildOtpUri(secret, user.email), message: 'Scan the QR code in your authenticator app or enter the setup key manually, then enter the 6-digit code.' }; }
  async authenticatorVerify(authUser: any, code: string) { await this.ensureAuthenticatorTable(); const rows = await this.prisma.$queryRawUnsafe<Array<{ secretEnc: string; enabled: boolean }>>(`SELECT "secretEnc", "enabled" FROM "UserAuthenticator" WHERE "userId" = $1 LIMIT 1`, authUser.sub); if (!rows[0]) throw new BadRequestException('Start authenticator setup first'); if (rows[0].enabled) return { enabled: true, message: 'Authenticator is already enabled' }; const secret = this.decryptAuthenticatorSecret(rows[0].secretEnc); if (!this.verifyTotp(secret, code)) throw new UnauthorizedException('Invalid authenticator code'); const recoveryCodes = this.generateRecoveryCodes(); const hashes = await Promise.all(recoveryCodes.map((value) => bcrypt.hash(value, 10))); await this.prisma.$executeRawUnsafe(`UPDATE "UserAuthenticator" SET "enabled" = TRUE, "recoveryCodes" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = $1`, authUser.sub, JSON.stringify(hashes)); return { enabled: true, recoveryCodes, message: 'Google Authenticator has been enabled successfully. Save your recovery codes somewhere secure.' }; }
  async authenticatorDisable(authUser: any, code: string) { await this.ensureAuthenticatorTable(); const rows = await this.prisma.$queryRawUnsafe<Array<{ secretEnc: string; enabled: boolean }>>(`SELECT "secretEnc", "enabled" FROM "UserAuthenticator" WHERE "userId" = $1 LIMIT 1`, authUser.sub); if (!rows[0]?.enabled) return { enabled: false, message: 'Authenticator is already disabled' }; const secret = this.decryptAuthenticatorSecret(rows[0].secretEnc); if (!this.verifyTotp(secret, code)) throw new UnauthorizedException('Invalid authenticator code'); await this.prisma.$executeRawUnsafe(`DELETE FROM "UserAuthenticator" WHERE "userId" = $1`, authUser.sub); return { enabled: false, message: 'Authenticator has been disabled' }; }
}
