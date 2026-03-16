import { NextResponse } from 'next/server';
import { sendMessage } from '@/lib/openclaw';
import { isAuthenticated } from '@/lib/auth';
import { buildAttachmentContext } from '@/lib/uploads';
import type { ClientAttachment } from '@/lib/types';

export async function POST(request: Request) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const body = await request.json().catch(() => ({}));
    let message = typeof body.message === 'string' ? body.message : '';
    const attachments = Array.isArray(body.attachments)
      ? (body.attachments as ClientAttachment[])
      : [];

    const uploadedFiles = attachments.map((file) => ({
      name: file.name,
      size: file.size,
      type: file.type,
      note: file.note,
    }));

    const attachmentContext = buildAttachmentContext(attachments);
    if (attachmentContext) {
      message = `${message.trim()}\n\n${attachmentContext}`.trim();
    }

    if (!message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const reply = await sendMessage(message);
    return NextResponse.json({ ok: true, reply, uploadedFiles });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat request failed' },
      { status: 500 },
    );
  }
}
