import type { ClientAttachment } from '@/lib/types';

export function buildAttachmentContext(files: ClientAttachment[]) {
  const nonImageFiles = files.filter((file) => file.kind !== 'image');
  if (!nonImageFiles.length) return '';

  const chunks: string[] = ['Attached files for this message:'];

  for (const file of nonImageFiles) {
    chunks.push(`- ${file.name} (${file.type}, ${file.size} bytes)`);
    if (file.note) chunks.push(`  Note: ${file.note}`);
    if (file.extractedText) {
      chunks.push(`  Extracted text from ${file.name}:`);
      chunks.push('  ```text');
      chunks.push(file.extractedText);
      chunks.push('  ```');
    }
  }

  chunks.push('Use the attached context directly when responding.');
  return chunks.join('\n');
}
