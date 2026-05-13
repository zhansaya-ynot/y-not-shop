import { createHmac, timingSafeEqual } from 'node:crypto';

/**
 * HMAC-signed unsubscribe tokens for newsletter emails. Encodes the
 * subscriber's email so the public /newsletter/unsubscribe route can
 * verify and act without a database lookup table for tokens. Uses
 * ORDER_TOKEN_SECRET (already required, 32+ chars) as the signing key
 * — reusing avoids introducing a new env var the operator has to
 * provision.
 *
 * Wire format: base64url(email).base64url(hmacSha256(email)).
 */

function getSecret(): string {
  const s = process.env.ORDER_TOKEN_SECRET;
  if (!s || s.length < 32) {
    throw new Error('ORDER_TOKEN_SECRET missing or too short');
  }
  return s;
}

function b64url(buf: Buffer): string {
  return buf.toString('base64url');
}

export function signUnsubscribeToken(email: string): string {
  const normalized = email.trim().toLowerCase();
  const mac = createHmac('sha256', getSecret()).update(normalized).digest();
  return `${b64url(Buffer.from(normalized, 'utf8'))}.${b64url(mac)}`;
}

export function verifyUnsubscribeToken(token: string): string | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [emailB64, macB64] = parts;
  let email: string;
  let mac: Buffer;
  try {
    email = Buffer.from(emailB64, 'base64url').toString('utf8');
    mac = Buffer.from(macB64, 'base64url');
  } catch {
    return null;
  }
  const expected = createHmac('sha256', getSecret()).update(email).digest();
  if (mac.length !== expected.length) return null;
  return timingSafeEqual(mac, expected) ? email : null;
}
