const DEFAULT_PRODUCTION_ORIGIN = 'https://pwfb-microfinance-1.onrender.com';
const DEFAULT_VERCEL_ORIGIN = 'https://pwfb-microfinance-33ne.vercel.app';
const DEFAULT_PRODUCTION_RP_ID = 'pwfb-microfinance-1.onrender.com';
const DEFAULT_ANDROID_APP_ORIGIN = 'android:apk-key-hash:EydDY6N2lLaxOLlvx4Qks583zlW5-AaZP5_8vsNy7TU';
const CURRENT_ANDROID_APP_ORIGIN = 'android:apk-key-hash:EydbDY6N21LaX0LLvx4Qks583zIW5-AaZP5_8vsNy7TU';
const ACTUAL_ANDROID_APP_ORIGIN = 'android:apk-key-hash:EydbY6N21LaX0LLvx4Qks583zIW5-AaZP5_8vsNy7TU';
const PLACEHOLDER_RP_IDS = new Set(['your-frontend-domain.com', 'example.com', 'localhost']);

export function normalizeOrigin(value?: string | null): string {
  return String(value || '').trim().replace(/\/$/, '');
}

export function isAndroidAppOrigin(value?: string | null): boolean {
  return /^android:apk-key-hash:[A-Za-z0-9_-]+$/.test(normalizeOrigin(value));
}

function configuredOrigin(): string {
  const value = normalizeOrigin(process.env.WEBAUTHN_ORIGIN);
  return value === 'https://your-frontend-domain.com' || value === 'your-frontend-domain.com' ? '' : value;
}

function configuredAndroidOrigins(): string[] {
  return Array.from(new Set([
    DEFAULT_ANDROID_APP_ORIGIN,
    CURRENT_ANDROID_APP_ORIGIN,
    ACTUAL_ANDROID_APP_ORIGIN,
    ...(process.env.WEBAUTHN_ANDROID_ORIGINS || '').split(',').map(normalizeOrigin),
  ])).filter(isAndroidAppOrigin);
}

export function getWebAuthnExpectedOrigins(requestOrigin?: string | null): string[] {
  const configured = [
    ...(process.env.WEBAUTHN_ALLOWED_ORIGINS || '').split(','),
    ...(process.env.WEBAUTHN_ORIGIN || '').split(','),
  ]
    .map(normalizeOrigin)
    .filter(Boolean)
    .filter(value => value !== 'https://your-frontend-domain.com' && value !== 'your-frontend-domain.com');

  const allowed = Array.from(new Set([
    ...configured,
    ...(process.env.NODE_ENV === 'production' ? [DEFAULT_PRODUCTION_ORIGIN] : []),
    DEFAULT_VERCEL_ORIGIN,
    ...configuredAndroidOrigins(),
  ]));
  if (!allowed.length) allowed.push('http://localhost:3000');

  const request = normalizeOrigin(requestOrigin);
  if (request && !allowed.includes(request)) {
    throw new Error(`WebAuthn origin is not allowed: ${request}`);
  }
  return allowed;
}

export function getWebAuthnOrigin(requestOrigin?: string | null): string {
  const request = normalizeOrigin(requestOrigin);
  if (request && !isAndroidAppOrigin(request) && getWebAuthnExpectedOrigins(request).includes(request)) {
    return request;
  }

  const configured = configuredOrigin();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') return DEFAULT_PRODUCTION_ORIGIN;
  return 'http://localhost:3000';
}

export function getWebAuthnRpId(requestOrigin?: string | null): string {
  const baseOrigin = getWebAuthnOrigin(isAndroidAppOrigin(requestOrigin) ? undefined : requestOrigin);
  const hostname = new URL(baseOrigin).hostname.toLowerCase();
  const configured = String(process.env.WEBAUTHN_RP_ID || '').trim().toLowerCase();

  // A configured RP ID is valid only when it is the requesting hostname or
  // one of its DNS parents. Otherwise use the exact HTTPS host so Vercel and
  // Render each get a valid, origin-scoped passkey RP.
  if (configured && !PLACEHOLDER_RP_IDS.has(configured) &&
      (configured === hostname || hostname.endsWith(`.${configured}`))) {
    return configured;
  }
  return hostname || DEFAULT_PRODUCTION_RP_ID;
}
