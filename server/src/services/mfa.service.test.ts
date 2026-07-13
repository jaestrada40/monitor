import { describe, it, expect } from 'vitest';
import { generate } from 'otplib';
import { generateMfaSecret, verifyMfaToken } from './mfa.service.js';

describe('mfa.service', () => {
  it('generates a secret and a matching otpauth URL for the given account', () => {
    const { secret, otpauthUrl } = generateMfaSecret('user@example.com');
    expect(secret).toMatch(/^[A-Z2-7]+$/);
    expect(otpauthUrl).toContain('otpauth://totp/');
    expect(otpauthUrl).toContain(encodeURIComponent('user@example.com'));
    expect(otpauthUrl).toContain('MonitorPro');
  });

  it('accepts a valid current TOTP code for the secret', async () => {
    const { secret } = generateMfaSecret('user@example.com');
    const validToken = await generate({ secret });
    expect(await verifyMfaToken(secret, validToken)).toBe(true);
  });

  it('rejects an incorrect code', async () => {
    const { secret } = generateMfaSecret('user@example.com');
    expect(await verifyMfaToken(secret, '000000')).toBe(false);
  });

  it('rejects a code generated from a different secret', async () => {
    const { secret: secretA } = generateMfaSecret('a@example.com');
    const { secret: secretB } = generateMfaSecret('b@example.com');
    const tokenForB = await generate({ secret: secretB });
    expect(await verifyMfaToken(secretA, tokenForB)).toBe(false);
  });

  it('does not throw on malformed input', async () => {
    expect(await verifyMfaToken('not-a-real-secret', 'abc')).toBe(false);
  });
});
