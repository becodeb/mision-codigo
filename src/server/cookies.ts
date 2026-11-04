import { createHmac, timingSafeEqual } from 'node:crypto';

export type CookiePurpose = 'child' | 'admin';

function mac(secret: string, purpose: CookiePurpose, body: string): string {
  // The purpose is part of the signed text so a token minted for one cookie never validates as another.
  return createHmac('sha256', secret).update(`${purpose}.${body}`).digest('base64url');
}

export function signToken(secret: string, purpose: CookiePurpose, payload: object): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `${body}.${mac(secret, purpose, body)}`;
}

/** Returns the decoded payload, or null when the token is malformed or its signature does not match. */
export function verifyToken(secret: string, purpose: CookiePurpose, token: string): unknown {
  const dot = token.indexOf('.');
  if (dot < 1) return null;
  const body = token.slice(0, dot);
  const given = Buffer.from(token.slice(dot + 1));
  const expected = Buffer.from(mac(secret, purpose, body));
  if (given.length !== expected.length || !timingSafeEqual(given, expected)) return null;
  try {
    return JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

export function parseCookies(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(';')) {
    const eq = part.indexOf('=');
    if (eq < 1) continue;
    const name = part.slice(0, eq).trim();
    if (!(name in result)) result[name] = part.slice(eq + 1).trim();
  }
  return result;
}

export function serializeCookie(name: string, value: string, maxAgeSeconds: number, secure: boolean): string {
  const parts = [`${name}=${value}`, 'Path=/', 'HttpOnly', 'SameSite=Strict', `Max-Age=${maxAgeSeconds}`];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}
