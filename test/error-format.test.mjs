import test from 'node:test';
import assert from 'node:assert/strict';
import { formatUserFacingError, normalizeMessageContent } from '../lib/error-format.ts';

test('formatUserFacingError collapses html 502 pages', () => {
  const input = 'Gateway request failed (502): <!DOCTYPE html><html><body>Bad gateway</body></html>';
  assert.equal(
    formatUserFacingError(new Error(input)),
    'The chat backend was temporarily unavailable (502 bad gateway). Please try again.',
  );
});

test('normalizeMessageContent collapses cached html error blobs', () => {
  const input = '<!DOCTYPE html><html><body><h1>502 Bad gateway</h1></body></html>';
  assert.equal(
    normalizeMessageContent(input),
    'The chat backend was temporarily unavailable (502 bad gateway). Please try again.',
  );
});

test('normalizeMessageContent leaves normal text alone', () => {
  assert.equal(normalizeMessageContent('Hello there'), 'Hello there');
});
