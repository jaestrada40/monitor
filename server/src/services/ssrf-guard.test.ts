import { describe, it, expect } from 'vitest';
import { assertSafeUrl, UnsafeUrlError } from './ssrf-guard.js';

describe('ssrf-guard', () => {
  it('allows a normal public HTTPS URL', async () => {
    await expect(assertSafeUrl('https://example.com')).resolves.toBeUndefined();
  });

  it('rejects non-HTTP(S) schemes', async () => {
    await expect(assertSafeUrl('file:///etc/passwd')).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl('ftp://example.com')).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects localhost', async () => {
    await expect(assertSafeUrl('http://localhost:4000')).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl('http://localhost')).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects loopback and private IPv4 literals', async () => {
    await expect(assertSafeUrl('http://127.0.0.1')).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl('http://10.0.0.5')).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl('http://192.168.1.1')).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl('http://172.16.0.1')).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects the cloud metadata address', async () => {
    await expect(assertSafeUrl('http://169.254.169.254/latest/meta-data/')).rejects.toThrow(UnsafeUrlError);
  });

  it('rejects IPv6 loopback and unique-local literals', async () => {
    await expect(assertSafeUrl('http://[::1]')).rejects.toThrow(UnsafeUrlError);
    await expect(assertSafeUrl('http://[fd00::1]')).rejects.toThrow(UnsafeUrlError);
  });

  it('allows a public IPv4 literal', async () => {
    await expect(assertSafeUrl('http://93.184.216.34')).resolves.toBeUndefined();
  });

  it('rejects a malformed URL', async () => {
    await expect(assertSafeUrl('not a url')).rejects.toThrow(UnsafeUrlError);
  });
});
