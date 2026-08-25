import { Injectable, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { OAuth2Client } from 'google-auth-library';
import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import { PrismaService } from '../prisma/prisma.service';
import { RegisterDto } from './dto/register.dto';
import { LoginDto } from './dto/login.dto';

const RP_NAME = process.env.WEBAUTHN_RP_NAME || 'PWFB Microfinance';
const ORIGIN = process.env.WEBAUTHN_ORIGIN || 'http://localhost:3000';
const RP_ID = process.env.WEBAUTHN_RP_ID || new URL(ORIGIN).hostname;

@Injectable()
export class AuthService {
  private readonly googleClient = new OAuth2Client();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  private issueToken(user: any) {
    return this.jwtService.signAsync({
      sub: user.id,
      email: user.email,
      role: user.role,
    });
  }

  async register(dto: RegisterDto) {
    const existingUser = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (existingUser) throw new UnauthorizedException('User already exists');

    const hashedPassword = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        phone: dto.phone,
        passportPhoto: dto.passportPhoto,
        role: 'CUSTOMER',
      },
    });

    const accessToken = await this.issueToken(user);
    const { password, ...safeUser } = user;
    return { message: 'Registration successful', access_token: accessToken, user: safeUser };
  }

  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({ where: { email: dto.email } });
    if (!user) throw new UnauthorizedException('Invalid email or password');

    const passwordValid = await bcrypt.compare(dto.password, user.password);
    if (!passwordValid) throw new UnauthorizedException('Invalid email or password');

    const accessToken = await this.issueToken(user);
    const { password, ...safeUser } = user;
    return { message: 'Login successful', access_token: accessToken, user: safeUser };
  }

  /**
   * Google Identity Services sends a signed Google ID token to this endpoint.
   * The token is verified server-side before PWFB issues its own JWT.
   */
  async googleLogin(idToken?: string) {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    if (!clientId) {
      throw new BadRequestException('Google login is not configured on the server');
    }
    if (!idToken) {
      throw new BadRequestException('Google credential is required');
    }

    try {
      const ticket = await this.googleClient.verifyIdToken({
        idToken,
        audience: clientId,
      });
      const payload = ticket.getPayload();

      if (!payload?.email || payload.email_verified !== true) {
        throw new UnauthorizedException('Google account email is not verified');
      }

      const email = payload.email.toLowerCase().trim();
      let user = await this.prisma.user.findUnique({ where: { email } });

      if (!user) {
        const randomPassword = await bcrypt.hash(randomBytes(32).toString('hex'), 12);
        user = await this.prisma.user.create({
          data: {
            email,
            password: randomPassword,
            firstName: payload.given_name || payload.name?.split(' ')[0] || 'Google',
            lastName: payload.family_name || payload.name?.split(' ').slice(1).join(' ') || 'User',
            passportPhoto: payload.picture || null,
            role: 'CUSTOMER',
          },
        });
      }

      const accessToken = await this.issueToken(user);
      const { password, ...safeUser } = user;
      return {
        message: 'Google login successful',
        access_token: accessToken,
        user: safeUser,
      };
    } catch (error) {
      if (error instanceof UnauthorizedException || error instanceof BadRequestException) {
        throw error;
      }
      throw new UnauthorizedException('Google authentication failed');
    }
  }

  async passkeyRegisterOptions(authUser: any) {
    const user = await this.prisma.user.findUnique({
      where: { id: authUser.sub },
      include: { passkeys: true },
    });
    if (!user) throw new UnauthorizedException('User not found');

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID: RP_ID,
      userName: user.email,
      userDisplayName: `${user.firstName} ${user.lastName}`.trim() || user.email,
      userID: new TextEncoder().encode(user.id),
      attestationType: 'none',
      excludeCredentials: user.passkeys.map((passkey) => ({ id: passkey.credentialId })),
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'required',
        authenticatorAttachment: 'platform',
      },
    });

    await this.storeWebAuthnChallenge(user.id, options.challenge, 'REGISTRATION');
    return options;
  }

  async passkeyRegisterVerify(authUser: any, response: any) {
    const user = await this.prisma.user.findUnique({ where: { id: authUser.sub } });
    if (!user) throw new UnauthorizedException('User not found');

    const challenge = await this.getWebAuthnChallenge(user.id, 'REGISTRATION');
    if (!challenge) throw new BadRequestException('Passkey registration session expired');

    const verification = await verifyRegistrationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
    });

    if (!verification.verified || !verification.registrationInfo) {
      throw new UnauthorizedException('Fingerprint/passkey registration failed');
    }

    const credential = verification.registrationInfo.credential;
    await this.prisma.passkey.create({
      data: {
        userId: user.id,
        credentialId: credential.id,
        publicKey: Buffer.from(credential.publicKey).toString('base64url'),
        counter: Number(verification.registrationInfo.credential.counter),
        deviceType: verification.registrationInfo.credentialDeviceType,
        backedUp: verification.registrationInfo.credentialBackedUp,
      },
    });

    await this.deleteWebAuthnChallenge(user.id, 'REGISTRATION');
    return { verified: true, message: 'Fingerprint/passkey registered successfully' };
  }

  async passkeyLoginOptions(email: string) {
    const normalizedEmail = email?.toLowerCase().trim();
    if (!normalizedEmail) throw new BadRequestException('Email is required for fingerprint login');

    const user = await this.prisma.user.findUnique({
      where: { email: normalizedEmail },
      include: { passkeys: true },
    });
    if (!user) throw new UnauthorizedException('No account found for this email');
    if (!user.passkeys.length) throw new BadRequestException('No fingerprint/passkey is registered for this account');

    const options = await generateAuthenticationOptions({
      rpID: RP_ID,
      userVerification: 'required',
      allowCredentials: user.passkeys.map((passkey) => ({ id: passkey.credentialId })),
    });

    await this.storeWebAuthnChallenge(user.id, options.challenge, 'AUTHENTICATION');
    return options;
  }

  async passkeyLoginVerify(response: any) {
    const credentialId = this.extractCredentialId(response);
    if (!credentialId) throw new BadRequestException('Missing passkey credential ID');

    const passkey = await this.prisma.passkey.findUnique({
      where: { credentialId },
      include: { user: true },
    });
    if (!passkey) throw new UnauthorizedException('Fingerprint/passkey not recognized');

    const challenge = await this.getWebAuthnChallenge(passkey.userId, 'AUTHENTICATION');
    if (!challenge) throw new BadRequestException('Fingerprint login session expired');

    const verification = await verifyAuthenticationResponse({
      response,
      expectedChallenge: challenge,
      expectedOrigin: ORIGIN,
      expectedRPID: RP_ID,
      requireUserVerification: true,
      credential: {
        id: passkey.credentialId,
        publicKey: Buffer.from(passkey.publicKey, 'base64url'),
        counter: passkey.counter,
      },
    });

    if (!verification.verified) throw new UnauthorizedException('Fingerprint authentication failed');

    await this.prisma.passkey.update({
      where: { id: passkey.id },
      data: { counter: verification.authenticationInfo.newCounter },
    });
    await this.deleteWebAuthnChallenge(passkey.userId, 'AUTHENTICATION');

    const accessToken = await this.issueToken(passkey.user);
    const { password, ...safeUser } = passkey.user;
    return {
      message: 'Fingerprint login successful',
      access_token: accessToken,
      user: safeUser,
    };
  }

  private webAuthnChallenges = new Map<string, {
    challenge: string;
    type: 'REGISTRATION' | 'AUTHENTICATION';
    expiresAt: number;
  }>();

  private challengeKey(userId: string, type: 'REGISTRATION' | 'AUTHENTICATION') {
    return `${type}:${userId}`;
  }

  private async storeWebAuthnChallenge(
    userId: string,
    challenge: string,
    type: 'REGISTRATION' | 'AUTHENTICATION',
  ) {
    this.webAuthnChallenges.set(this.challengeKey(userId, type), {
      challenge,
      type,
      expiresAt: Date.now() + 5 * 60 * 1000,
    });
  }

  private async getWebAuthnChallenge(
    userId: string,
    type: 'REGISTRATION' | 'AUTHENTICATION',
  ) {
    const key = this.challengeKey(userId, type);
    const stored = this.webAuthnChallenges.get(key);
    if (!stored) return null;
    if (stored.expiresAt < Date.now()) {
      this.webAuthnChallenges.delete(key);
      return null;
    }
    return stored.challenge;
  }

  private async deleteWebAuthnChallenge(
    userId: string,
    type: 'REGISTRATION' | 'AUTHENTICATION',
  ) {
    this.webAuthnChallenges.delete(this.challengeKey(userId, type));
  }

  private extractCredentialId(response: any): string | null {
    return response?.id || response?.rawId || response?.credentialId || null;
  }
}
