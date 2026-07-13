import { describe, it, expect } from 'vitest';
import { classifySslExpiry } from './ssl.service.js';

describe('classifySslExpiry', () => {
  const now = new Date('2026-01-01T00:00:00Z');

  it('classifies a far-future expiry as valid', () => {
    const expiry = new Date('2026-06-01T00:00:00Z');
    const result = classifySslExpiry(expiry, now, 7);
    expect(result.status).toBe('valid');
    expect(result.expiryDays).toBeGreaterThan(7);
  });

  it('classifies an expiry within the warning window as expiring', () => {
    const expiry = new Date('2026-01-05T00:00:00Z');
    const result = classifySslExpiry(expiry, now, 7);
    expect(result.status).toBe('expiring');
    expect(result.expiryDays).toBe(4);
  });

  it('classifies a past expiry date as expired', () => {
    const expiry = new Date('2025-12-01T00:00:00Z');
    const result = classifySslExpiry(expiry, now, 7);
    expect(result.status).toBe('expired');
    expect(result.expiryDays).toBeLessThan(0);
  });

  it('treats the exact warning boundary as expiring, not valid', () => {
    const expiry = new Date('2026-01-08T00:00:00Z');
    const result = classifySslExpiry(expiry, now, 7);
    expect(result.status).toBe('expiring');
    expect(result.expiryDays).toBe(7);
  });
});
