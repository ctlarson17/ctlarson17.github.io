const MAX_INLINE_TEXT_CHARS = 12000;
const MAX_FILES = 8;
const MAX_FILE_BYTES = 8 * 1024 * 1024;

export type ParsedUpload = {
  originalName: string;
  mimeType: string;
  size: number;
  extractedText?: string;
  note?: string;
};

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

async function parseFile(file: File): Promise<ParsedUpload> {
  const base = {
    originalName: file.name,
    mimeType: file.type || 'application/octet-stream',
    size: file.size,
  };

  if (file.size > MAX_FILE_BYTES) {
    return {
      ...base,
      note: `File too large to inline safely (${file.size} bytes). Describe it or upload a smaller excerpt.`,
    };
  }

  if (isTextLike(file)) {
    const text = await file.text();
    return {
      ...base,
      extractedText: text.slice(0, MAX_INLINE_TEXT_CHARS),
      note:
        text.length > MAX_INLINE_TEXT_CHARS
          ? `Text truncated to ${MAX_INLINE_TEXT_CHARS} characters for chat context.`
          : undefined,
    };
  }

  if ((file.type || '').startsWith('image/')) {
    return {
      ...base,
      note:
        'Image uploaded. Binary image analysis is not yet wired through this deployed upload path, so ask for a description/excerpt or use a follow-up image-specific workflow.',
    };
  }

  if ((file.type || '').includes('pdf') || file.name.toLowerCase().endsWith('.pdf')) {
    return {
      ...base,
      note:
        'PDF uploaded. Direct PDF text extraction is not yet wired through this deployed upload path, so provide a smaller text excerpt or we can add dedicated PDF parsing next.',
    };
  }

  return {
    ...base,
    note: 'Binary file uploaded, but this file type is not yet directly extractable in the current deployed upload path.',
  };
}

export async function parseUploads(files: File[]): Promise<ParsedUpload[]> {
  const limited = files.slice(0, MAX_FILES);
  return Promise.all(limited.map((file) => parseFile(file)));
}

export function buildAttachmentContext(files: ParsedUpload[]) {
  if (!files.length) return '';

  const chunks: string[] = ['Attached files for this message:'];

  for (const file of files) {
    chunks.push(`- ${file.originalName} (${file.mimeType}, ${file.size} bytes)`);
    if (file.note) {
      chunks.push(`  Note: ${file.note}`);
    }
    if (file.extractedText) {
      chunks.push(`  Extracted text from ${file.originalName}:`);
      chunks.push('  ```text');
      chunks.push(file.extractedText);
      chunks.push('  ```');
    }
  }

  chunks.push('Use the attached context directly when responding.');
  return chunks.join('\n');
}
