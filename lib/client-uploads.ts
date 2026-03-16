import type { ClientAttachment } from '@/lib/types';

const MAX_INLINE_TEXT_CHARS = 12000;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

function isTextLike(file: File) {
  const type = file.type || '';
  const name = file.name.toLowerCase();

  return (
    type.startsWith('text/') ||
    type.includes('json') ||
    type.includes('xml') ||
    type.includes('javascript') ||
    type.includes('typescript') ||
    type.includes('markdown') ||
    name.endsWith('.md') ||
    name.endsWith('.txt') ||
    name.endsWith('.csv') ||
    name.endsWith('.json') ||
    name.endsWith('.ts') ||
    name.endsWith('.tsx') ||
    name.endsWith('.js') ||
    name.endsWith('.jsx') ||
    name.endsWith('.html') ||
    name.endsWith('.css') ||
    name.endsWith('.xml') ||
    name.endsWith('.yml') ||
    name.endsWith('.yaml')
  );
}

export async function prepareClientAttachments(files: File[]): Promise<ClientAttachment[]> {
  return Promise.all(
    files.map(async (file) => {
      const base: ClientAttachment = {
        name: file.name,
        size: file.size,
        type: file.type || 'application/octet-stream',
      };

      if (file.size > MAX_FILE_BYTES) {
        return {
          ...base,
          note: `File too large to inline safely (${file.size} bytes). Upload a smaller excerpt.`,
        };
      }

      if (isTextLike(file)) {
        const text = await file.text();
        return {
          ...base,
          extractedText: text.slice(0, MAX_INLINE_TEXT_CHARS),
          note:
            text.length > MAX_INLINE_TEXT_CHARS
              ? `Text truncated to ${MAX_INLINE_TEXT_CHARS} characters.`
              : undefined,
        };
      }

      if ((file.type || '').startsWith('image/')) {
        return {
          ...base,
          note: 'Image attached. Image parsing is not wired into this stable upload path yet.',
        };
      }

      if ((file.type || '').includes('pdf') || file.name.toLowerCase().endsWith('.pdf')) {
        return {
          ...base,
          note: 'PDF attached. Direct PDF extraction is not wired into this stable upload path yet.',
        };
      }

      return {
        ...base,
        note: 'Binary attachment noted, but this file type is not yet directly extractable here.',
      };
    }),
  );
}
