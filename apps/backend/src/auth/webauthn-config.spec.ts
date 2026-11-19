import {
  getWebAuthnExpectedOrigins,
  getWebAuthnOrigin,
  getWebAuthnRpId,
} from './webauthn-config';

describe('PWFB WebAuthn portal origins', () => {
  const oldNodeEnv = process.env.NODE_ENV;
  const oldOrigin = process.env.WEBAUTHN_ORIGIN;
  const oldAllowed = process.env.WEBAUTHN_ALLOWED_ORIGINS;
  const oldRpId = process.env.WEBAUTHN_RP_ID;

  beforeEach(() => {
    process.env.NODE_ENV = 'production';
    delete process.env.WEBAUTHN_ORIGIN;
    delete process.env.WEBAUTHN_ALLOWED_ORIGINS;
    delete process.env.WEBAUTHN_RP_ID;
  });

  afterEach(() => {
    if (oldNodeEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = oldNodeEnv;
    if (oldOrigin === undefined) delete process.env.WEBAUTHN_ORIGIN; else process.env.WEBAUTHN_ORIGIN = oldOrigin;
    if (oldAllowed === undefined) delete process.env.WEBAUTHN_ALLOWED_ORIGINS; else process.env.WEBAUTHN_ALLOWED_ORIGINS = oldAllowed;
    if (oldRpId === undefined) delete process.env.WEBAUTHN_RP_ID; else process.env.WEBAUTHN_RP_ID = oldRpId;
  });

  it('uses the staging portal origin and matching relying-party ID', () => {
    const origin = 'https://pwfb-microfinance-staging.onrender.com';
    expect(getWebAuthnExpectedOrigins(origin)).toContain(origin);
    expect(getWebAuthnOrigin(origin)).toBe(origin);
    expect(getWebAuthnRpId(origin)).toBe('pwfb-microfinance-staging.onrender.com');
  });

  it('uses the live portal origin instead of a hard-coded legacy host', () => {
    const origin = 'https://pwfb-financial-portal-web-live.onrender.com';
    expect(getWebAuthnOrigin(origin)).toBe(origin);
    expect(getWebAuthnRpId(origin)).toBe('pwfb-financial-portal-web-live.onrender.com');
  });

  it('rejects an unlisted origin', () => {
    expect(() => getWebAuthnExpectedOrigins('https://malicious.example')).toThrow('WebAuthn origin is not allowed');
  });
});
