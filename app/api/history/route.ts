import { NextResponse } from 'next/server';
import { isAuthenticated } from '@/lib/auth';
import { fetchHistory } from '@/lib/openclaw';

export async function GET() {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const messages = await fetchHistory(100);
    return NextResponse.json({ ok: true, messages });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'History request failed' },
      { status: 500 },
    );
  }
}
