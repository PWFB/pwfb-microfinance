const DEFAULT_PRODUCTION_ORIGIN = 'https://pwfb-frontend.onrender.com';
const DEFAULT_PRODUCTION_RP_ID = 'pwfb-frontend.onrender.com';
const PLACEHOLDER_RP_IDS = new Set(['your-frontend-domain.com', 'example.com', 'localhost']);

export function normalizeOrigin(value?: string | null): string {
  return String(value || '').trim().replace(/\/$/, '');
}

function configuredOrigin(): string {
  const value = normalizeOrigin(process.env.WEBAUTHN_ORIGIN);
  return value === 'https://your-frontend-domain.com' || value === 'your-frontend-domain.com' ? '' : value;
}

export function getWebAuthnOrigin(requestOrigin?: string | null): string {
  const configured = configuredOrigin();
  if (configured) return configured;
  if (process.env.NODE_ENV === 'production') return DEFAULT_PRODUCTION_ORIGIN;
  const request = normalizeOrigin(requestOrigin);
  return request || 'http://localhost:3000';
}

export function getWebAuthnRpId(requestOrigin?: string | null): string {
  const configured = String(process.env.WEBAUTHN_RP_ID || '').trim().toLowerCase();
  if (configured && !PLACEHOLDER_RP_IDS.has(configured)) {
    const hostname = new URL(getWebAuthnOrigin(requestOrigin)).hostname;
    // Never allow a configured RP ID to point at an unrelated/placeholder domain.
    if (configured === hostname || hostname.endsWith(`.${configured}`)) return configured;
  }
  return new URL(getWebAuthnOrigin(requestOrigin)).hostname || DEFAULT_PRODUCTION_RP_ID;
}

export function assertAllowedWebAuthnOrigin(requestOrigin?: string | null): string {
  const origin = normalizeOrigin(requestOrigin);
  if (!origin) throw new Error('WebAuthn request origin is missing');

  const configured = (process.env.WEBAUTHN_ALLOWED_ORIGINS || process.env.WEBAUTHN_ORIGIN || '')
    .split(',').map(normalizeOrigin).filter(Boolean)
    .filter(value => value !== 'https://your-frontend-domain.com' && value !== 'your-frontend-domain.com');

  const allowed = Array.from(new Set([
    ...configured,
    ...(process.env.NODE_ENV === 'production' ? [DEFAULT_PRODUCTION_ORIGIN] : []),
  ]));
  if (!allowed.length) allowed.push('http://localhost:3000');
  if (!allowed.includes(origin)) throw new Error(`WebAuthn origin is not allowed: ${origin}`);
  return origin;
}
