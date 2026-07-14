import { describe, it, expect } from 'vitest';
import { encryptSecret, decryptSecret } from './encryption.service.js';

describe('encryption.service', () => {
  it('round-trips a secret', () => {
    const encrypted = encryptSecret('JBSWY3DPEHPK3PXP');
    expect(encrypted).not.toBe('JBSWY3DPEHPK3PXP');
    expect(decryptSecret(encrypted)).toBe('JBSWY3DPEHPK3PXP');
  });

  it('produces a different ciphertext each time (random IV)', () => {
    const a = encryptSecret('same-secret');
    const b = encryptSecret('same-secret');
    expect(a).not.toBe(b);
    expect(decryptSecret(a)).toBe('same-secret');
    expect(decryptSecret(b)).toBe('same-secret');
  });

  it('rejects a tampered ciphertext', () => {
    const encrypted = encryptSecret('JBSWY3DPEHPK3PXP');
    const tampered = encrypted.slice(0, -4) + 'abcd';
    expect(() => decryptSecret(tampered)).toThrow();
  });
});
