// Shared field validators — request bodies were passed almost directly to SQL with only
// ad-hoc checks on a couple of fields, letting a user store an oversized string, an
// out-of-range interval/threshold, or garbage in the fields (webhook URL, phone, chat id)
// that a future notification dispatcher would eventually act on.

export function isNonEmptyString(value: unknown, maxLength: number): value is string {
  return typeof value === 'string' && value.trim().length > 0 && value.length <= maxLength;
}

export function isOptionalString(value: unknown, maxLength: number): boolean {
  return value === undefined || value === '' || (typeof value === 'string' && value.length <= maxLength);
}

export function isIntInRange(value: unknown, min: number, max: number): value is number {
  return typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max;
}

const PHONE_RE = /^\+?[1-9]\d{1,14}$/; // E.164
export function isValidPhone(value: string): boolean {
  return PHONE_RE.test(value);
}

const TELEGRAM_CHAT_ID_RE = /^-?\d{1,20}$/;
export function isValidTelegramChatId(value: string): boolean {
  return TELEGRAM_CHAT_ID_RE.test(value);
}
