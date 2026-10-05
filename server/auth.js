// Guest login always works. Google and Apple verify ID tokens when the owner
// has set the client ids. Native Capacitor builds post the same tokens here.

import { createPublicKey, verify as cryptoVerify } from 'crypto';

let appleKeys = { at: 0, keys: [] };

export function authConfig() {
  return {
    guest: true,
    google: !!process.env.GOOGLE_CLIENT_ID,
    apple: !!process.env.APPLE_CLIENT_ID,
    googleClientId: process.env.GOOGLE_CLIENT_ID || '',
    appleClientId: process.env.APPLE_CLIENT_ID || '',
  };
}

export async function verifyGoogle(idToken) {
  const clientId = process.env.GOOGLE_CLIENT_ID;
  if (!clientId) return { error: 'Google sign-in is not configured on this server.', status: 501 };
  if (!idToken) return { error: 'Missing Google ID token.', status: 400 };
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) return { error: 'Google rejected that sign-in.', status: 401 };
  const info = await res.json();
  const aud = info.aud || info.azp;
  if (aud !== clientId) return { error: 'Google token was not issued for this app.', status: 401 };
  if (!info.sub) return { error: 'Google token had no subject.', status: 401 };
  const suggested = (info.email || info.name || 'player').split('@')[0];
  return { provider: 'google', sub: info.sub, suggested };
}

export async function verifyApple(identityToken) {
  const clientId = process.env.APPLE_CLIENT_ID;
  if (!clientId) return { error: 'Apple sign-in is not configured on this server.', status: 501 };
  if (!identityToken) return { error: 'Missing Apple identity token.', status: 400 };
  const parts = String(identityToken).split('.');
  if (parts.length !== 3) return { error: 'Apple token was not a JWT.', status: 401 };
  const header = JSON.parse(Buffer.from(parts[0], 'base64url').toString());
  const payload = JSON.parse(Buffer.from(parts[1], 'base64url').toString());
  if (payload.iss !== 'https://appleid.apple.com') return { error: 'Apple token issuer mismatch.', status: 401 };
  const aud = Array.isArray(payload.aud) ? payload.aud : [payload.aud];
  if (!aud.includes(clientId)) return { error: 'Apple token was not issued for this app.', status: 401 };
  if (payload.exp && payload.exp * 1000 < Date.now()) return { error: 'Apple token expired.', status: 401 };
  const keys = await appleJwks();
  const jwk = keys.find((k) => k.kid === header.kid);
  if (!jwk) return { error: 'Apple signing key not found.', status: 401 };
  const key = createPublicKey({ key: jwk, format: 'jwk' });
  const data = Buffer.from(`${parts[0]}.${parts[1]}`);
  const sig = Buffer.from(parts[2], 'base64url');
  const ok = cryptoVerify('sha256', data, { key, dsaEncoding: 'ieee-p1363' }, sig);
  if (!ok) return { error: 'Apple token signature failed.', status: 401 };
  const suggested = (payload.email || 'player').split('@')[0];
  return { provider: 'apple', sub: payload.sub, suggested };
}

async function appleJwks() {
  if (Date.now() - appleKeys.at < 60 * 60 * 1000 && appleKeys.keys.length) return appleKeys.keys;
  const res = await fetch('https://appleid.apple.com/auth/keys');
  if (!res.ok) throw new Error('Could not load Apple signing keys');
  const body = await res.json();
  appleKeys = { at: Date.now(), keys: body.keys || [] };
  return appleKeys.keys;
}
