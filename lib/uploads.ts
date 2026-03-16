import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const workspaceRoot = '/Users/caleblarson/.openclaw/workspace';
const uploadRoot = path.join(workspaceRoot, 'uploads', 'chat');

function sanitizeFilename(filename: string) {
  const base = path.basename(filename || 'upload');
  return base.replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/-+/g, '-');
}

export type SavedUpload = {
  originalName: string;
  savedName: string;
  absolutePath: string;
  relativePath: string;
  mimeType: string;
  size: number;
};

export async function saveUploads(files: File[]): Promise<SavedUpload[]> {
  if (!files.length) return [];

  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const batchDir = path.join(uploadRoot, stamp);
  await mkdir(batchDir, { recursive: true });

  const saved: SavedUpload[] = [];

  for (const [index, file] of files.entries()) {
    const safeName = `${String(index + 1).padStart(2, '0')}-${sanitizeFilename(file.name)}`;
    const absolutePath = path.join(batchDir, safeName);
    const relativePath = path.relative(workspaceRoot, absolutePath);
    const buffer = Buffer.from(await file.arrayBuffer());
    await writeFile(absolutePath, buffer);

    saved.push({
      originalName: file.name,
      savedName: safeName,
      absolutePath,
      relativePath,
      mimeType: file.type || 'application/octet-stream',
      size: file.size,
    });
  }

  return saved;
}

export function buildAttachmentContext(saved: SavedUpload[]) {
  if (!saved.length) return '';

  const lines = saved.map(
    (file) =>
      `- ${file.originalName} (${file.mimeType}, ${file.size} bytes) saved at ${file.absolutePath}`,
  );

  return [
    'Attached files for this message:',
    ...lines,
    'Use the available file-reading tools to inspect these files directly when relevant.',
  ].join('\n');
}
