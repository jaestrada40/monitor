import { describe, it, expect } from 'vitest';
import { isIntInRange, isValidPhone, isValidTelegramChatId, isOptionalString } from './validators.js';

describe('validators', () => {
  it('isIntInRange enforces bounds and integer-ness', () => {
    expect(isIntInRange(500, 50, 60000)).toBe(true);
    expect(isIntInRange(49, 50, 60000)).toBe(false);
    expect(isIntInRange(60001, 50, 60000)).toBe(false);
    expect(isIntInRange(5.5, 1, 100)).toBe(false);
    expect(isIntInRange('500', 50, 60000)).toBe(false);
  });

  it('isValidPhone accepts E.164 and rejects garbage', () => {
    expect(isValidPhone('+15551234567')).toBe(true);
    expect(isValidPhone('not-a-phone')).toBe(false);
    expect(isValidPhone('0123456')).toBe(false);
  });

  it('isValidTelegramChatId accepts numeric ids (including negative group ids)', () => {
    expect(isValidTelegramChatId('123456789')).toBe(true);
    expect(isValidTelegramChatId('-100123456789')).toBe(true);
    expect(isValidTelegramChatId('abc')).toBe(false);
  });

  it('isOptionalString allows empty/undefined but enforces max length', () => {
    expect(isOptionalString(undefined, 10)).toBe(true);
    expect(isOptionalString('', 10)).toBe(true);
    expect(isOptionalString('a'.repeat(11), 10)).toBe(false);
    expect(isOptionalString('short', 10)).toBe(true);
  });
});
