import { NextResponse } from 'next/server';
import { sendMessage } from '@/lib/openclaw';
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

  try {
    const reply = await sendMessage(message);
    return NextResponse.json({ ok: true, reply });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat request failed' },
      { status: 500 },
    );
  }
}
