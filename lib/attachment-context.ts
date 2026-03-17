import type { UploadedAsset } from '@/lib/upload-assets';

export function buildAssetContext(assets: UploadedAsset[]) {
  if (!assets.length) return '';

  const lines = assets.map(
    (asset) => `- ${asset.name} (${asset.type}, ${asset.size} bytes) saved at ${asset.path}`,
  );

  return [
    'Attached files for this message:',
    ...lines,
    'These files are available on the OpenClaw host. Inspect them directly with file/image tools when relevant before answering.',
  ].join('\n');
}
