import { randomBytes } from 'node:crypto';

/** Stable, collision-resistant human-readable references for PWFB financial records. */
// References are generated server-side and are never accepted as proof of payment.
export function createFinancialReference(prefix: string): string {
  const safePrefix = String(prefix || 'PWFB').toUpperCase().replace(/[^A-Z0-9]+/g, '-').replace(/^-|-$/g, '');
  const timestamp = new Date().toISOString().replace(/[-:.TZ]/g, '').slice(0, 14);
  return `${safePrefix}-${timestamp}-${randomBytes(6).toString('hex').toUpperCase()}`;
}
