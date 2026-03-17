import type { UploadedFile } from '@/lib/types';

export type UploadedAsset = UploadedFile & {
  id: string;
  path: string;
};

export async function uploadAssets(files: File[]): Promise<UploadedAsset[]> {
  if (!files.length) return [];

  const form = new FormData();
  files.forEach((file) => form.append('files', file, file.name));

  const res = await fetch('https://chat.calebtlarson.com/site-upload', {
    method: 'POST',
    body: form,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(typeof json.error === 'string' ? json.error : 'Upload failed');
  }

  return Array.isArray(json.assets) ? json.assets : [];
}
