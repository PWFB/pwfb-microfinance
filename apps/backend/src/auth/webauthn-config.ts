const DEFAULT_PRODUCTION_ORIGIN = 'https://pwfb-frontend.onrender.com';
const DEFAULT_PRODUCTION_RP_ID = 'pwfb-frontend.onrender.com';
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

export function getWebAuthnOrigin(requestOrigin?: string | null): string {
  const configured = configuredOrigin();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') return DEFAULT_PRODUCTION_ORIGIN;
  const request = normalizeOrigin(requestOrigin);
  return request && !isAndroidAppOrigin(request) ? request : 'http://localhost:3000';
}

export function getWebAuthnRpId(requestOrigin?: string | null): string {
  const baseOrigin = getWebAuthnOrigin(isAndroidAppOrigin(requestOrigin) ? undefined : requestOrigin);
  const configured = String(process.env.WEBAUTHN_RP_ID || '').trim().toLowerCase();
  if (configured && !PLACEHOLDER_RP_IDS.has(configured)) {
    const hostname = new URL(baseOrigin).hostname;
    if (configured === hostname || hostname.endsWith(`.${configured}`)) return configured;
  }
  return new URL(baseOrigin).hostname || DEFAULT_PRODUCTION_RP_ID;
}

export function getWebAuthnExpectedOrigins(requestOrigin?: string | null): string[] {
  const configured = (process.env.WEBAUTHN_ALLOWED_ORIGINS || process.env.WEBAUTHN_ORIGIN || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean)
    .filter(value => value !== 'https://your-frontend-domain.com' && value !== 'your-frontend-domain.com');

  const allowed = Array.from(new Set([
    ...configured,
    ...(process.env.NODE_ENV === 'production' ? [DEFAULT_PRODUCTION_ORIGIN] : []),
    ...configuredAndroidOrigins(),
  ]));
  if (!allowed.length) allowed.push('http://localhost:3000');

  const request = normalizeOrigin(requestOrigin);
  if (request && !allowed.includes(request)) {
    throw new Error(`WebAuthn origin is not allowed: ${request}`);
  }
  return allowed;
}

export function assertAllowedWebAuthnOrigin(requestOrigin?: string | null): string {
  const origin = normalizeOrigin(requestOrigin);
  if (!origin) throw new Error('WebAuthn request origin is missing');
  getWebAuthnExpectedOrigins(origin);
  return origin;
}
