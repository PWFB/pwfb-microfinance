import { UnauthorizedException } from '@nestjs/common';
import { generateRegistrationOptions, verifyRegistrationResponse, generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';
import { AuthService } from './auth.service';
import { assertLoginModeRole } from './auth-login-mode';
import { assertAllowedWebAuthnOrigin, getWebAuthnExpectedOrigins, getWebAuthnRpId } from './webauthn-config';

declare module './auth.service' {
  interface AuthService { passkeyRegisterOptions(authUser:any, origin?:string, replaceExisting?:boolean):Promise<any>; passkeyRegisterVerify(authUser:any, body:any, origin?:string):Promise<any>; passkeyLoginOptions(identifier?:string, loginMode?:string, origin?:string):Promise<any>; passkeyLoginVerify(body:any, origin?:string):Promise<any>; passkeyUnregisterAll(authUser:any):Promise<any>; }
}
const tableReady=new WeakSet<object>();
async function ensureTables(service:any){
  if(tableReady.has(service))return;
  await service.prisma.$executeRawUnsafe(`CREATE TABLE IF NOT EXISTS "PasskeyChallenge" ("challenge" TEXT PRIMARY KEY,"userId" TEXT,"kind" TEXT NOT NULL,"expiresAt" TIMESTAMP(3) NOT NULL)`);
  await service.prisma.$executeRawUnsafe(`ALTER TABLE "PasskeyChallenge" ADD COLUMN IF NOT EXISTS "loginMode" TEXT`);
  tableReady.add(service);
}
async function saveChallenge(service:any,challenge:string,userId:string|null,kind:string,loginMode:string|null=null){
  await service.prisma.$executeRawUnsafe(
    `DELETE FROM "PasskeyChallenge" WHERE "expiresAt" < CURRENT_TIMESTAMP OR ("userId" IS NOT DISTINCT FROM $1 AND "kind"=$2 AND "loginMode" IS NOT DISTINCT FROM $3)`,
    userId,kind,loginMode,
  );
  await service.prisma.$executeRawUnsafe(
    `INSERT INTO "PasskeyChallenge" ("challenge","userId","kind","expiresAt","loginMode") VALUES ($1,$2,$3,CURRENT_TIMESTAMP + INTERVAL '5 minutes',$4)`,
    challenge,userId,kind,loginMode,
  );
}
async function takeChallenge(service:any,challenge:string,userId:string|null,kind:string,loginMode:string|null=null){
  if(!challenge)throw new Error('Passkey challenge is missing');
  const rows=await service.prisma.$queryRawUnsafe(
    `SELECT "challenge" FROM "PasskeyChallenge" WHERE "challenge"=$1 AND "kind"=$2 AND "expiresAt">CURRENT_TIMESTAMP AND "userId"=$3 AND "loginMode" IS NOT DISTINCT FROM $4 LIMIT 1`,
    challenge,kind,userId,loginMode,
  ) as any[];
  if(!rows.length)throw new Error('Passkey challenge is missing, expired or belongs to a different login type. Please try again.');
  await service.prisma.$executeRawUnsafe(`DELETE FROM "PasskeyChallenge" WHERE "challenge"=$1`,challenge);
  return rows[0].challenge;
}
function credentialOf(body:any){return body?.credential||body}function credentialIdOf(body:any){const c=credentialOf(body);return String(c?.id||c?.rawId||'')}function challengeOf(body:any){return String(body?.challenge||'')}function parseTransports(v:any){try{return v?JSON.parse(v):undefined}catch{return undefined}}
async function resolveAuthUser(service:any,authUser:any){const id=authUser?.sub||authUser?.id||authUser?.userId||authUser?.user?.id;if(id){const user=await service.prisma.user.findUnique({where:{id}});if(user)return user}const email=authUser?.email||authUser?.user?.email;if(email){const user=await service.prisma.user.findUnique({where:{email:String(email).trim().toLowerCase()}});if(user)return user}const staffId=authUser?.staffId||authUser?.user?.staffId;if(staffId){const user=await service.prisma.user.findUnique({where:{staffId}});if(user)return user}const customerId=authUser?.customerId||authUser?.user?.customerId;if(customerId){const user=await service.prisma.user.findUnique({where:{customerId}});if(user)return user}throw new UnauthorizedException('Your signed-in PWFB account could not be identified. Please sign out and sign in again.')}
AuthService.prototype.passkeyUnregisterAll=async function(this:any,authUser:any){try{await ensureTables(this);const user=await resolveAuthUser(this,authUser);const result=await this.prisma.$executeRawUnsafe(`DELETE FROM "Passkey" WHERE "userId"=$1`,user.id);await this.prisma.$executeRawUnsafe(`DELETE FROM "PasskeyChallenge" WHERE "userId"=$1 OR "userId" IS NULL`,user.id);return{verified:true,removed:Number(result||0),message:'Existing PWFB passkeys removed. This device can now register a fresh passkey.'}}catch(e){throw new UnauthorizedException(e instanceof Error?e.message:'Unable to remove the existing passkey')}};
AuthService.prototype.passkeyRegisterOptions=async function(this:any,authUser:any,origin?:string,replaceExisting=false){try{const expectedOrigin=assertAllowedWebAuthnOrigin(origin);await ensureTables(this);const user=await resolveAuthUser(this,authUser);const credentials=replaceExisting?[]:await this.prisma.$queryRawUnsafe(`SELECT "credentialId" FROM "Passkey" WHERE "userId"=$1`,user.id) as any[];const options=await generateRegistrationOptions({rpName:process.env.WEBAUTHN_RP_NAME||'PWFB Microfinance',rpID:getWebAuthnRpId(expectedOrigin),userName:user.email,userID:replaceExisting?Buffer.from(`pwfb-${user.id}-${Date.now()}-${Math.random().toString(36).slice(2)}`,'utf8'):Buffer.from(user.id,'utf8'),userDisplayName:`${user.firstName} ${user.lastName}`.trim()||user.email,attestationType:'none',excludeCredentials:credentials.map(c=>({id:c.credentialId})),authenticatorSelection:{residentKey:'required',userVerification:'required'}} as any);await saveChallenge(this,options.challenge,user.id,'register');return options}catch(e){throw new UnauthorizedException(e instanceof Error?e.message:'Unable to create passkey registration options')}};
AuthService.prototype.passkeyRegisterVerify=async function(this:any,authUser:any,body:any,origin?:string){try{const expectedOrigin=assertAllowedWebAuthnOrigin(origin);const expectedOrigins=getWebAuthnExpectedOrigins(expectedOrigin);await ensureTables(this);const user=await resolveAuthUser(this,authUser);const response=credentialOf(body);const challenge=await takeChallenge(this,challengeOf(body),user.id,'register');const verification=await verifyRegistrationResponse({response,expectedChallenge:challenge,expectedOrigin:expectedOrigins,expectedRPID:getWebAuthnRpId(expectedOrigin),requireUserVerification:true} as any);if(!verification.verified||!verification.registrationInfo)throw new Error('Passkey registration failed');const info:any=verification.registrationInfo;const id=String(info.credential?.id||info.credentialID||credentialIdOf(response));const key=info.credential?.publicKey||info.credentialPublicKey;const publicKey=key?Buffer.from(key).toString('base64url'):'';const counter=Number(info.credential?.counter??info.counter??0);const transports=JSON.stringify(response?.response?.transports||response?.transports||[]);if(!id||!publicKey)throw new Error('Passkey credential data is incomplete');const passkeyId=`pk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2,12)}`;await this.prisma.$executeRawUnsafe(`INSERT INTO "Passkey" ("id","userId","credentialId","publicKey","counter","transports","createdAt","updatedAt") VALUES ($1,$2,$3,$4,$5,$6,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) ON CONFLICT ("credentialId") DO UPDATE SET "userId"=EXCLUDED."userId","publicKey"=EXCLUDED."publicKey","counter"=EXCLUDED."counter","transports"=EXCLUDED."transports","updatedAt"=CURRENT_TIMESTAMP`,passkeyId,user.id,id,publicKey,counter,transports);return{verified:true,message:'Passkey registered successfully'}}catch(e){throw new UnauthorizedException(e instanceof Error?e.message:'Passkey registration failed')}};
async function resolvePasskeyLoginUser(service: any, identifierValue: string, modeValue: string) {
  const identifier = String(identifierValue || '').trim();
  const mode = String(modeValue || '').trim().toUpperCase();
  if (!identifier) throw new Error('Enter your PWFB customer ID, email, phone number or staff email first.');
  if (!['SUPER_ADMIN', 'ADMIN', 'STAFF', 'CUSTOMER'].includes(mode)) throw new Error('Choose a valid PWFB login type.');

  let user: any = null;
  if (mode === 'CUSTOMER') {
    // Accept 11-digit public customer login IDs where that optional column exists.
    const publicIdColumn = await service.prisma.$queryRawUnsafe(
      `SELECT 1 FROM information_schema.columns
        WHERE table_schema = current_schema()
          AND table_name = 'User'
          AND column_name = 'publicUserId'
        LIMIT 1`,
    ) as any[];
    if (publicIdColumn.length) {
      const byPublicId = await service.prisma.$queryRawUnsafe(
        `SELECT "id" FROM "User" WHERE "publicUserId" = $1 LIMIT 1`,
        identifier,
      ) as any[];
      if (byPublicId.length) user = await service.prisma.user.findUnique({ where: { id: byPublicId[0].id } });
    }
    const customer = user
      ? await service.prisma.customer.findFirst({
          where: {
            OR: [
              { userId: user.id },
              ...(user.customerId ? [{ id: user.customerId }] : []),
              ...(user.email ? [{ email: { equals: String(user.email).trim(), mode: 'insensitive' as const } }] : []),
            ],
          },
        })
      : await service.prisma.customer.findFirst({
          where: { OR: [{ id: identifier }, { email: identifier.toLowerCase() }, { phone: identifier }] },
          include: { user: true },
        });
    if (!customer) throw new Error('No PWFB customer profile matches that customer ID, email or phone number.');
    user = user || customer.user || await service.prisma.user.findUnique({ where: { customerId: customer.id } }) || (customer.email ? await service.prisma.user.findUnique({ where: { email: String(customer.email).trim().toLowerCase() } }) : null);
    if (!user) throw new Error('Your PWFB customer profile is not linked to a login account. Sign in with your password or contact your branch.');
    if ((customer.userId && customer.userId !== user.id) || (user.customerId && user.customerId !== customer.id)) {
      throw new Error('Your PWFB customer profile and login account do not match.');
    }
  } else {
    if (!identifier.includes('@')) throw new Error('Enter the email address registered to this staff or admin account.');
    user = await service.prisma.user.findUnique({ where: { email: identifier.toLowerCase() } });
  }
  if (!user) throw new Error('PWFB account not found. Check the identifier and login type.');
  const configuredAdmin = String(process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
  if (configuredAdmin && String(user.email || '').trim().toLowerCase() === configuredAdmin && user.role !== 'SUPER_ADMIN') {
    user = await service.prisma.user.update({ where: { id: user.id }, data: { role: 'SUPER_ADMIN' } });
  }
  assertLoginModeRole(mode, user.role);
  return user;
}

AuthService.prototype.passkeyLoginOptions = async function(this: any, identifier?: string, loginMode?: string, origin?: string) {
  try {
    const expectedOrigin = assertAllowedWebAuthnOrigin(origin);
    await ensureTables(this);
    const mode = String(loginMode || '').trim().toUpperCase();
    const user = await resolvePasskeyLoginUser(this, String(identifier || ''), mode);
    const credentials = await this.prisma.$queryRawUnsafe(
      `SELECT "credentialId", "transports" FROM "Passkey" WHERE "userId" = $1`,
      user.id,
    ) as any[];
    if (!credentials.length) throw new Error('No passkey is registered for this account. Sign in with your password and register a fingerprint/passkey first.');
    const options: any = await generateAuthenticationOptions({
      rpID: getWebAuthnRpId(expectedOrigin),
      userVerification: 'required',
      allowCredentials: credentials.map((credential) => ({
        id: credential.credentialId,
        transports: parseTransports(credential.transports),
      })),
    } as any);
    options.hints = ['client-device'];
    await saveChallenge(this, options.challenge, user.id, 'login', mode);
    return options;
  } catch (error) {
    throw new UnauthorizedException(error instanceof Error ? error.message : 'Unable to create passkey login options');
  }
};

AuthService.prototype.passkeyLoginVerify = async function(this: any, body: any, origin?: string) {
  try {
    const expectedOrigin = assertAllowedWebAuthnOrigin(origin);
    const expectedOrigins = getWebAuthnExpectedOrigins(expectedOrigin);
    await ensureTables(this);
    const mode = String(body?.loginMode || '').trim().toUpperCase();
    if (!['SUPER_ADMIN', 'ADMIN', 'STAFF', 'CUSTOMER'].includes(mode)) throw new Error('The selected PWFB login type is missing. Please try again.');
    const response = credentialOf(body);
    const credentialId = credentialIdOf(response);
    if (!credentialId) throw new Error('Passkey credential ID is missing.');
    const rows = await this.prisma.$queryRawUnsafe(
      `SELECT "credentialId", "userId", "publicKey", "counter" FROM "Passkey" WHERE "credentialId" = $1 LIMIT 1`,
      credentialId,
    ) as any[];
    if (!rows.length) throw new Error('This passkey is not registered with PWFB.');
    const credential = rows[0];
    const challenge = await takeChallenge(this, challengeOf(body), credential.userId, 'login', mode);
    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: expectedOrigins,
      expectedRPID: getWebAuthnRpId(expectedOrigin),
      credential: {
        id: credential.credentialId,
        publicKey: Buffer.from(credential.publicKey, 'base64url'),
        counter: Number(credential.counter),
      },
      requireUserVerification: true,
    } as any);
    if (!verification.verified) throw new Error('Passkey authentication failed.');
    const newCounter = Number(verification.authenticationInfo?.newCounter ?? credential.counter);
    await this.prisma.$executeRawUnsafe(
      `UPDATE "Passkey" SET "counter" = $2, "updatedAt" = CURRENT_TIMESTAMP WHERE "credentialId" = $1`,
      credential.credentialId,
      newCounter,
    );
    let user = await this.prisma.user.findUnique({ where: { id: credential.userId } });
    if (!user) throw new Error('PWFB account not found.');
    const configuredAdmin = String(process.env.SUPER_ADMIN_EMAIL || '').trim().toLowerCase();
    if (configuredAdmin && String(user.email || '').trim().toLowerCase() === configuredAdmin && user.role !== 'SUPER_ADMIN') {
      user = await this.prisma.user.update({ where: { id: user.id }, data: { role: 'SUPER_ADMIN' } });
    }
    assertLoginModeRole(mode, user.role);
    if (mode === 'CUSTOMER') {
      const customer = await this.prisma.customer.findFirst({
        where: { OR: [{ userId: user.id }, ...(user.customerId ? [{ id: user.customerId }] : []), ...(user.email ? [{ email: { equals: String(user.email).trim().toLowerCase(), mode: 'insensitive' as const } }] : [])] },
        select: { id: true, userId: true },
      });
      if (!customer || (customer.userId && customer.userId !== user.id)) {
        throw new Error('Your PWFB customer profile is not linked to this passkey account.');
      }
    }
    const accessToken = await this.jwtService.signAsync({ sub: user.id, email: user.email, role: user.role });
    const { password, ...safeUser } = user;
    return { message: 'Passkey login successful', access_token: accessToken, user: safeUser };
  } catch (error) {
    throw new UnauthorizedException(error instanceof Error ? error.message : 'Passkey authentication failed');
  }
};
