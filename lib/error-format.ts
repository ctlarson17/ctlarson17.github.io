export function formatUserFacingError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Something went wrong.';
  if (message.includes('502') || message.includes('<!DOCTYPE html>') || message.includes('<html')) {
    return 'The chat backend was temporarily unavailable (502 bad gateway). Please try again.';
  }
  return message;
}

export function normalizeMessageContent(content: string) {
  const trimmed = String(content || '').trim();
  if (!trimmed) return trimmed;

  const lower = trimmed.toLowerCase();
  if (lower.includes('<!doctype html') || lower.includes('<html') || (lower.includes('502') && lower.includes('bad gateway'))) {
    return 'The chat backend was temporarily unavailable (502 bad gateway). Please try again.';
  }

  return trimmed;
}
