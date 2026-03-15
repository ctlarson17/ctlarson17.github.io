import crypto from 'crypto';
import { cookies } from 'next/headers';

const COOKIE_NAME = 'vince_session';

function getSecret() {
  return process.env.SESSION_COOKIE_SECRET || 'dev-secret-change-me';
}

function sign(value: string) {
  return crypto.createHmac('sha256', getSecret()).update(value).digest('hex');
}

export function createSessionValue() {
  const payload = JSON.stringify({ t: Date.now() });
  const raw = Buffer.from(payload).toString('base64url');
  return `${raw}.${sign(raw)}`;
}

export function isValidSessionValue(value?: string) {
  if (!value) return false;
  const [raw, sig] = value.split('.');
  if (!raw || !sig) return false;
  return sign(raw) === sig;
}

export async function isAuthenticated() {
  const store = await cookies();
  return isValidSessionValue(store.get(COOKIE_NAME)?.value);
}

export async function setSessionCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, createSessionValue(), {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });
}

export async function clearSessionCookie() {
  const store = await cookies();
  store.set(COOKIE_NAME, '', { path: '/', maxAge: 0 });
}

function safeEqual(input: string, expected?: string) {
  if (!expected) return false;
  const a = Buffer.from(input);
  const b = Buffer.from(expected);
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(a, b);
}

export function credentialsMatch(username: string, password: string) {
  return safeEqual(username, process.env.APP_USERNAME) && safeEqual(password, process.env.APP_PASSWORD);
}
