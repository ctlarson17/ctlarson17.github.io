import { NextResponse } from 'next/server';
import { echoReply } from '@/lib/openclaw';
import { isAuthenticated } from '@/lib/auth';

export async function POST(request: Request) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const message = typeof body.message === 'string' ? body.message : '';

  if (!message.trim()) {
    return NextResponse.json({ error: 'Message is required' }, { status: 400 });
  }

  const reply = await echoReply(message);
  return NextResponse.json({ ok: true, reply });
}
