import { BadRequestException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { createDecipheriv, createHash, createHmac } from 'crypto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class TwoFactorService {
  private tablesReady = false;

  constructor(private readonly prisma: PrismaService, private readonly jwtService: JwtService) {}

  private async ensureTables() {
    if (this.tablesReady) return;
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "UserAuthenticator" ("userId" TEXT PRIMARY KEY REFERENCES "User"("id") ON DELETE CASCADE, "secretEnc" TEXT NOT NULL, "enabled" BOOLEAN NOT NULL DEFAULT FALSE, "recoveryCodes" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    await this.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "UserTwoFactorSession" ("tokenHash" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "verifiedUntil" TIMESTAMP(3) NOT NULL, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
    this.tablesReady = true;
  }

  private encryptionKey() {
    const seed = process.env.AUTHENTICATOR_ENCRYPTION_KEY || process.env.JWT_SECRET;
    if (!seed || seed === 'pwfb-secret-key') throw new BadRequestException('Authenticator encryption key is not configured on the server');
    return createHash('sha256').update(seed).digest();
  }

  private decryptSecret(value: string) {
    const [ivText, tagText, dataText] = value.split('.');
    if (!ivText || !tagText || !dataText) throw new BadRequestException('Stored authenticator secret is invalid');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey(), Buffer.from(ivText, 'base64url'));
    decipher.setAuthTag(Buffer.from(tagText, 'base64url'));
    return Buffer.concat([decipher.update(Buffer.from(dataText, 'base64url')), decipher.final()]).toString('utf8');
  }

  private base32Decode(input: string) {
    const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
    const clean = input.toUpperCase().replace(/[^A-Z2-7]/g, '');
    let bits = 0; let value = 0; const out: number[] = [];
    for (const char of clean) {
      const index = alphabet.indexOf(char);
      if (index < 0) continue;
      value = (value << 5) | index; bits += 5;
      if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
    }
    return Buffer.from(out);
  }

  private totp(secret: string, timestamp = Date.now()) {
    const counter = Math.floor(timestamp / 1000 / 30);
    const counterBuffer = Buffer.alloc(8);
    counterBuffer.writeBigUInt64BE(BigInt(counter));
    const digest = createHmac('sha1', this.base32Decode(secret)).update(counterBuffer).digest();
    const offset = digest[digest.length - 1] & 0x0f;
    const binary = ((digest[offset] & 0x7f) << 24) | ((digest[offset + 1] & 0xff) << 16) | ((digest[offset + 2] & 0xff) << 8) | (digest[offset + 3] & 0xff);
    return String(binary % 1000000).padStart(6, '0');
  }

  private verifyTotp(secret: string, code: string) {
    const normalized = String(code || '').replace(/\s/g, '');
    if (!/^\d{6}$/.test(normalized)) return false;
    const now = Date.now();
    return [-1, 0, 1].some((window) => this.totp(secret, now + window * 30000) === normalized);
  }

  async verify(token: string, code?: string, recoveryCode?: string) {
    await this.ensureTables();
    if (!token) throw new UnauthorizedException('Two-factor login session is missing');

    let payload: any;
    try {
      payload = await this.jwtService.verifyAsync(token);
    } catch {
      throw new UnauthorizedException('Two-factor login session has expired. Please sign in again.');
    }
    if (!payload?.sub) throw new UnauthorizedException('Invalid two-factor login session');

    const rows = await this.prisma.$queryRawUnsafe<Array<{ secretEnc: string; enabled: boolean; recoveryCodes: string | null }>>(`SELECT "secretEnc", "enabled", "recoveryCodes" FROM "UserAuthenticator" WHERE "userId" = $1 LIMIT 1`, payload.sub);
    if (!rows[0]?.enabled) {
      await this.prisma.$executeRawUnsafe(`INSERT INTO "UserTwoFactorSession" ("tokenHash", "userId", "verifiedUntil") VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '1 day') ON CONFLICT ("tokenHash") DO UPDATE SET "verifiedUntil" = EXCLUDED."verifiedUntil"`, createHash('sha256').update(token).digest('hex'), payload.sub);
      return { verified: true, message: 'Two-factor verification is not required for this account.' };
    }

    const secret = this.decryptSecret(rows[0].secretEnc);
    let valid = this.verifyTotp(secret, code || '');

    if (!valid && recoveryCode) {
      const normalizedRecovery = recoveryCode.trim().toUpperCase();
      const hashes: string[] = rows[0].recoveryCodes ? JSON.parse(rows[0].recoveryCodes) : [];
      let matched = false;
      const remaining: string[] = [];
      for (const hash of hashes) {
        if (!matched && await bcrypt.compare(normalizedRecovery, hash)) matched = true;
        else remaining.push(hash);
      }
      if (matched) {
        valid = true;
        await this.prisma.$executeRawUnsafe(`UPDATE "UserAuthenticator" SET "recoveryCodes" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE "userId" = $1`, payload.sub, JSON.stringify(remaining));
      }
    }

    if (!valid) throw new UnauthorizedException('Invalid authenticator code');

    const tokenHash = createHash('sha256').update(token).digest('hex');
    await this.prisma.$executeRawUnsafe(`INSERT INTO "UserTwoFactorSession" ("tokenHash", "userId", "verifiedUntil") VALUES ($1, $2, CURRENT_TIMESTAMP + INTERVAL '1 day') ON CONFLICT ("tokenHash") DO UPDATE SET "verifiedUntil" = EXCLUDED."verifiedUntil"`, tokenHash, payload.sub);
    await this.prisma.$executeRawUnsafe(`DELETE FROM "UserTwoFactorSession" WHERE "verifiedUntil" < CURRENT_TIMESTAMP`);
    return { verified: true, message: 'Two-factor verification successful' };
  }

  async isVerified(userId: string, token: string) {
    await this.ensureTables();
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const rows = await this.prisma.$queryRawUnsafe<Array<{ verifiedUntil: Date }>>(`SELECT "verifiedUntil" FROM "UserTwoFactorSession" WHERE "tokenHash" = $1 AND "userId" = $2 AND "verifiedUntil" > CURRENT_TIMESTAMP LIMIT 1`, tokenHash, userId);
    return Boolean(rows.length);
  }
}
