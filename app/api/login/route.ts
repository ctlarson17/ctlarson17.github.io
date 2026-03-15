import { NextResponse } from 'next/server';
import { passwordMatches, setSessionCookie } from '@/lib/auth';

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === 'string' ? body.password : '';

  if (!password || !passwordMatches(password)) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  await setSessionCookie();
  return NextResponse.json({ ok: true });
}
