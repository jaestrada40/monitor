import { describe, it, expect } from 'vitest';
import { safeRequest, createPinnedLookup } from './ssrf-guard.js';
import https from 'https';

// Deliberately NOT mocking dns/net here (unlike ssrf-guard.test.ts) — this hits the real
// network on purpose. It exists because every other test mocks safeRequest/pinnedResolve
// entirely, so a bug in the actual http(s)/lookup integration (e.g. Node's Happy Eyeballs
// calling the lookup option with `{ all: true }` and expecting an array back, which broke
// every real check in production while every mocked test kept passing) went undetected.
// If this test needs network access CI doesn't have, skip it rather than deleting it.
describe('safeRequest (real network integration)', () => {
  it('successfully fetches a real public HTTPS URL end-to-end', async () => {
    const res = await safeRequest('https://example.com', { timeoutMs: 8000 });
    expect(res.statusCode).toBe(200);
    expect(res.body.length).toBeGreaterThan(0);
  });

  it('createPinnedLookup works with https.request directly (Happy Eyeballs / all:true path)', async () => {
    const statusCode = await new Promise<number>((resolve, reject) => {
      const req = https.request(
        'https://example.com',
        { lookup: createPinnedLookup() as unknown as typeof import('dns').lookup, timeout: 8000 },
        (res) => {
          res.resume();
          resolve(res.statusCode ?? 0);
        }
      );
      req.on('error', reject);
      req.end();
    });
    expect(statusCode).toBe(200);
  });
});
