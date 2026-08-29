import { UnauthorizedException } from '@nestjs/common';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { AuthService } from './auth.service';
import { assertAllowedWebAuthnOrigin, getWebAuthnRpId } from './webauthn-config';

declare module './auth.service' {
  interface AuthService {
    passkeyRegisterOptions(authUser: any, origin?: string): Promise<any>;
    passkeyRegisterVerify(authUser: any, body: any, origin?: string): Promise<any>;
    passkeyLoginOptions(email: string, origin?: string): Promise<any>;
    passkeyLoginVerify(body: any, origin?: string): Promise<any>;
  }
}

const tableReady = new WeakSet<object>();

async function ensureTables(service: any) {
  if (tableReady.has(service)) return;
  await service.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PasskeyCredential" ("credentialId" TEXT PRIMARY KEY, "userId" TEXT NOT NULL REFERENCES "User"("id") ON DELETE CASCADE, "publicKey" TEXT NOT NULL, "counter" BIGINT NOT NULL DEFAULT 0, "transports" TEXT, "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP)`);
  await service.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PasskeyChallenge" ("challenge" TEXT PRIMARY KEY, "userId" TEXT, "kind" TEXT NOT NULL, "expiresAt" TIMESTAMP(3) NOT NULL)`);
  tableReady.add(service);
}

async function saveChallenge(service: any, challenge: string, userId: string | null, kind: string) {
  await service.prisma.$executeRawUnsafe(`DELETE FROM "PasskeyChallenge" WHERE "expiresAt" < CURRENT_TIMESTAMP OR ("userId" IS NOT DISTINCT FROM $1 AND "kind" = $2)`, userId, kind);
  await service.prisma.$executeRawUnsafe(`INSERT INTO "PasskeyChallenge" ("challenge", "userId", "kind", "expiresAt") VALUES ($1, $2, $3, CURRENT_TIMESTAMP + INTERVAL '5 minutes')`, challenge, userId, kind);
}

async function takeChallenge(service: any, challenge: string, userId: string | null, kind: string) {
  if (!challenge) throw new Error('Passkey challenge is missing');
  const rows = await service.prisma.$queryRawUnsafe(`SELECT "challenge" FROM "PasskeyChallenge" WHERE "challenge" = $1 AND "kind" = $2 AND "expiresAt" > CURRENT_TIMESTAMP AND ("userId" = $3 OR "userId" IS NULL) LIMIT 1`, challenge, kind, userId) as Array<{ challenge: string }>;
  if (!rows.length) throw new Error('Passkey challenge is missing or expired. Please try again.');
  await service.prisma.$executeRawUnsafe(`DELETE FROM "PasskeyChallenge" WHERE "challenge" = $1`, challenge);
  return rows[0].challenge;
}

// The WebAuthn response sent by @simplewebauthn/browser is the complete
// PublicKeyCredential JSON object. Do not strip its id/type fields: the
// server verifier needs the complete object.
function credentialOf(body: any) { return body?.credential || body; }
function credentialIdOf(body: any) {
  const credential = credentialOf(body);
  return String(credential?.id || credential?.rawId || '');
}
function challengeOf(body: any) { return String(body?.challenge || ''); }

AuthService.prototype.passkeyRegisterOptions = async function(this: any, authUser: any, origin?: string) {
  try {
    const expectedOrigin = assertAllowedWebAuthnOrigin(origin);
    await ensureTables(this);
    const user = await this.prisma.user.findUnique({ where: { id: authUser.sub } });
    if (!user) throw new Error('User not found');
    const credentials = await this.prisma.$queryRawUnsafe(`SELECT "credentialId" FROM "PasskeyCredential" WHERE "userId" = $1`, user.id) as Array<{ credentialId: string }>;
    const options = await generateRegistrationOptions({
      rpName: process.env.WEBAUTHN_RP_NAME || 'PWFB Microfinance',
      rpID: getWebAuthnRpId(expectedOrigin),
      userName: user.email,
      userID: user.id,
      attestationType: 'none',
      excludeCredentials: credentials.map((c) => ({ id: c.credentialId })),
      authenticatorSelection: { residentKey: 'preferred', userVerification: 'preferred' },
    } as any);
    await saveChallenge(this, options.challenge, user.id, 'register');
    return options;
  } catch (error) { throw new UnauthorizedException(error instanceof Error ? error.message : 'Unable to create passkey registration options'); }
};

AuthService.prototype.passkeyRegisterVerify = async function(this: any, authUser: any, body: any, origin?: string) {
  try {
    const expectedOrigin = assertAllowedWebAuthnOrigin(origin);
    await ensureTables(this);
    const user = await this.prisma.user.findUnique({ where: { id: authUser.sub } });
    if (!user) throw new Error('User not found');
    const response = credentialOf(body);
    const challenge = await takeChallenge(this, challengeOf(body), user.id, 'register');
    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin,
      expectedRPID: getWebAuthnRpId(expectedOrigin),
      requireUserVerification: false,
    } as any);
    if (!verification.verified || !verification.registrationInfo) throw new Error('Passkey registration failed');
    const info: any = verification.registrationInfo;
    const id = String(info.credential?.id || info.credentialID || credentialIdOf(response));
    const publicKeyBytes = info.credential?.publicKey || info.credentialPublicKey;
    const publicKey = publicKeyBytes ? Buffer.from(publicKeyBytes).toString('base64url') : '';
    const counter = Number(info.credential?.counter ?? info.counter ?? 0);
    const transports = JSON.stringify(response?.response?.transports || response?.transports || []);
    if (!id || !publicKey) throw new Error('Passkey credential data is incomplete');
    await this.prisma.$executeRawUnsafe(`INSERT INTO "PasskeyCredential" ("credentialId", "userId", "publicKey", "counter", "transports") VALUES ($1, $2, $3, $4, $5) ON CONFLICT ("credentialId") DO UPDATE SET "userId" = EXCLUDED."userId", "publicKey" = EXCLUDED."publicKey", "counter" = EXCLUDED."counter", "transports" = EXCLUDED."transports", "updatedAt" = CURRENT_TIMESTAMP`, id, user.id, publicKey, counter, transports);
    return { verified: true, message: 'Passkey registered successfully' };
  } catch (error) { throw new UnauthorizedException(error instanceof Error ? error.message : 'Passkey registration failed'); }
};

AuthService.prototype.passkeyLoginOptions = async function(this: any, email: string, origin?: string) {
  try {
    const expectedOrigin = assertAllowedWebAuthnOrigin(origin);
    await ensureTables(this);
    const user = await this.prisma.user.findUnique({ where: { email: String(email || '').toLowerCase().trim() } });
    if (!user) throw new Error('Invalid email or passkey');
    const credentials = await this.prisma.$queryRawUnsafe(`SELECT "credentialId", "transports" FROM "PasskeyCredential" WHERE "userId" = $1`, user.id) as Array<{ credentialId: string; transports: string | null }>;
    if (!credentials.length) throw new Error('No passkey is registered for this account. Sign in with Google first, then register a passkey.');
    const options = await generateAuthenticationOptions({
      rpID: getWebAuthnRpId(expectedOrigin),
      userVerification: 'preferred',
      allowCredentials: credentials.map((c) => ({ id: c.credentialId, transports: c.transports ? JSON.parse(c.transports) : undefined })),
    } as any);
    await saveChallenge(this, options.challenge, user.id, 'login');
    return options;
  } catch (error) { throw new UnauthorizedException(error instanceof Error ? error.message : 'Unable to create passkey login options'); }
};

AuthService.prototype.passkeyLoginVerify = async function(this: any, body: any, origin?: string) {
  try {
    const expectedOrigin = assertAllowedWebAuthnOrigin(origin);
    await ensureTables(this);
    const response = credentialOf(body);
    const credentialId = credentialIdOf(response);
    if (!credentialId) throw new Error('Passkey credential ID is missing');
    const credentials = await this.prisma.$queryRawUnsafe(`SELECT "credentialId", "userId", "publicKey", "counter" FROM "PasskeyCredential" WHERE "credentialId" = $1 LIMIT 1`, credentialId) as Array<{ credentialId: string; userId: string; publicKey: string; counter: string }>;
    if (!credentials.length) throw new Error('Passkey is not registered');
    const credential = credentials[0];
    const challenge = await takeChallenge(this, challengeOf(body), credential.userId, 'login');
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin,
      expectedRPID: getWebAuthnRpId(expectedOrigin),
      credential: { id: credential.credentialId, publicKey: Buffer.from(credential.publicKey, 'base64url'), counter: Number(credential.counter) },
      requireUserVerification: false,
    } as any);
    if (!verification.verified) throw new Error('Passkey authentication failed');
    const newCounter = Number(verification.authenticationInfo?.newCounter ?? credential.counter);
    await this.prisma.$executeRawUnsafe(`UPDATE "PasskeyCredential" SET "counter" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE "credentialId" = $1`, credential.credentialId, newCounter);
    const user = await this.prisma.user.findUnique({ where: { id: credential.userId } });
    if (!user) throw new Error('User not found');
    const accessToken = await this.jwtService.signAsync({ sub: user.id, email: user.email, role: user.role });
    const { password, ...safeUser } = user;
    return { message: 'Passkey login successful', access_token: accessToken, user: safeUser };
  } catch (error) { throw new UnauthorizedException(error instanceof Error ? error.message : 'Passkey authentication failed'); }
};
