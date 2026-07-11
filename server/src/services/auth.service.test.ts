import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, signToken, verifyToken } from './auth.service.js';

describe('auth.service', () => {
  it('hashes and verifies a password correctly', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('signs and verifies a JWT round-trip', () => {
    const token = signToken('user-123');
    const decoded = verifyToken(token);
    expect(decoded?.userId).toBe('user-123');
  });

  it('rejects a tampered token', () => {
    const token = signToken('user-123');
    expect(verifyToken(token + 'tampered')).toBeNull();
  });
});
