import { NextResponse } from 'next/server';
import { sendMessage } from '@/lib/openclaw';
import { isAuthenticated } from '@/lib/auth';
import { buildAttachmentContext } from '@/lib/uploads';
import { buildAssetContext } from '@/lib/attachment-context';
import type { ClientAttachment } from '@/lib/types';
import type { UploadedAsset } from '@/lib/upload-assets';

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
    const uploadedAssets = Array.isArray(body.uploadedAssets)
      ? (body.uploadedAssets as UploadedAsset[])
      : [];

    const uploadedFiles = [
      ...attachments.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        note: file.note,
      })),
      ...uploadedAssets.map((file) => ({
        name: file.name,
        size: file.size,
        type: file.type,
        note: file.path,
        path: file.path,
      })),
    ];

    const attachmentContext = buildAttachmentContext(attachments);
    const assetContext = buildAssetContext(uploadedAssets);
    const extraContext = [attachmentContext, assetContext].filter(Boolean).join('\n\n');
    if (extraContext) {
      message = `${message.trim()}\n\n${extraContext}`.trim();
    }

    if (!message.trim()) {
      return NextResponse.json({ error: 'Message is required' }, { status: 400 });
    }

    const reply = await sendMessage(message, attachments);
    return NextResponse.json({ ok: true, reply, uploadedFiles });
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Chat request failed' },
      { status: 500 },
    );
  }
}
