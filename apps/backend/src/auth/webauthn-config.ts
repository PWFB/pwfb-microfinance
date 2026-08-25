const DEFAULT_PRODUCTION_ORIGIN = 'https://pwfb-frontend.onrender.com';

export function normalizeOrigin(value?: string | null): string {
  return String(value || '').trim().replace(/\/$/, '');
}

export function getWebAuthnOrigin(requestOrigin?: string | null): string {
  const configured = normalizeOrigin(process.env.WEBAUTHN_ORIGIN);
  if (configured) return configured;

  if (process.env.NODE_ENV === 'production') return DEFAULT_PRODUCTION_ORIGIN;

  const request = normalizeOrigin(requestOrigin);
  return request || 'http://localhost:3000';
}

export function getWebAuthnRpId(requestOrigin?: string | null): string {
  const configured = process.env.WEBAUTHN_RP_ID?.trim();
  if (configured) return configured;
  return new URL(getWebAuthnOrigin(requestOrigin)).hostname;
}

export function assertAllowedWebAuthnOrigin(requestOrigin?: string | null): string {
  const origin = normalizeOrigin(requestOrigin);
  if (!origin) throw new Error('WebAuthn request origin is missing');

  const configured = (process.env.WEBAUTHN_ALLOWED_ORIGINS || process.env.WEBAUTHN_ORIGIN || '')
    .split(',')
    .map(normalizeOrigin)
    .filter(Boolean);

  const allowed = configured.length
    ? configured
    : process.env.NODE_ENV === 'production'
      ? [DEFAULT_PRODUCTION_ORIGIN]
      : ['http://localhost:3000'];

  if (!allowed.includes(origin)) {
    throw new Error(`WebAuthn origin is not allowed: ${origin}`);
  }

  return origin;
}
