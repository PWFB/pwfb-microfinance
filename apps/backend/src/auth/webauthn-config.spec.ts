import {
  assertAllowedWebAuthnOrigin,
  getWebAuthnExpectedOrigins,
  getWebAuthnRpId,
} from './webauthn-config';

describe('WebAuthn deployment origins', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    delete process.env.WEBAUTHN_ALLOWED_ORIGINS;
    delete process.env.WEBAUTHN_ORIGIN;
    delete process.env.WEBAUTHN_RP_ID;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it('allows the stable Vercel frontend and the production Render frontend', () => {
    const origins = getWebAuthnExpectedOrigins();

    expect(origins).toContain('https://pwfb-microfinance-33ne.vercel.app');
    expect(origins).toContain('https://pwfb-microfinance-1.onrender.com');
  });

  it('uses the host of each requesting frontend for its RP ID', () => {
    process.env.WEBAUTHN_ORIGIN = 'https://pwfb-microfinance-1.onrender.com';
    process.env.WEBAUTHN_RP_ID = 'pwfb-microfinance-1.onrender.com';

    expect(getWebAuthnRpId('https://pwfb-microfinance-33ne.vercel.app'))
      .toBe('pwfb-microfinance-33ne.vercel.app');
    expect(getWebAuthnRpId('https://pwfb-microfinance-1.onrender.com'))
      .toBe('pwfb-microfinance-1.onrender.com');
  });

  it('retains additional configured WebAuthn origins without dropping the primary origin', () => {
    process.env.WEBAUTHN_ORIGIN = 'https://pwfb-microfinance-1.onrender.com';
    process.env.WEBAUTHN_ALLOWED_ORIGINS = 'https://pwfb-microfinance-staging.onrender.com';

    const origins = getWebAuthnExpectedOrigins();

    expect(origins).toContain('https://pwfb-microfinance-1.onrender.com');
    expect(origins).toContain('https://pwfb-microfinance-staging.onrender.com');
    expect(origins).toContain('https://pwfb-microfinance-33ne.vercel.app');
  });
  it('rejects an unapproved host rather than allowing its own RP ID', () => {
    expect(() => assertAllowedWebAuthnOrigin('https://untrusted.example'))
      .toThrow('WebAuthn origin is not allowed');
  });
});
