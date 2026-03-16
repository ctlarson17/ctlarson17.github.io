import { NextResponse } from 'next/server';
import { sendMessage } from '@/lib/openclaw';
import { isAuthenticated } from '@/lib/auth';
import { buildAttachmentContext, parseUploads } from '@/lib/uploads';

export async function POST(request: Request) {
  const authed = await isAuthenticated();
  if (!authed) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const contentType = request.headers.get('content-type') || '';

    let message = '';
    let uploadedFiles: { name: string; size: number; type: string }[] = [];

    if (contentType.includes('multipart/form-data')) {
      const form = await request.formData();
      message = typeof form.get('message') === 'string' ? String(form.get('message')) : '';
      const files = form
        .getAll('files')
        .filter((value): value is File => value instanceof File && value.size > 0);

      const parsed = await parseUploads(files);
      uploadedFiles = parsed.map((file) => ({
        name: file.originalName,
        size: file.size,
        type: file.mimeType,
      }));

      const attachmentContext = buildAttachmentContext(parsed);
      if (attachmentContext) {
        message = `${message.trim()}\n\n${attachmentContext}`.trim();
      }
    } else {
      const body = await request.json().catch(() => ({}));
      message = typeof body.message === 'string' ? body.message : '';
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
