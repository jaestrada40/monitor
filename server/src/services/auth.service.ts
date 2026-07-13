import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
if (process.env.NODE_ENV === 'production' && !process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET must be set in production');
}
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}

// The raw token goes in the email link; only its hash is stored, so a DB read alone
// can't be used to reset someone's password.
export function generatePasswordResetToken(): { rawToken: string; tokenHash: string } {
  const rawToken = crypto.randomBytes(32).toString('base64url');
  const tokenHash = crypto.createHash('sha256').update(rawToken).digest('hex');
  return { rawToken, tokenHash };
}

export function hashResetToken(rawToken: string): string {
  return crypto.createHash('sha256').update(rawToken).digest('hex');
}

// Issued after password verification when MFA is enabled — proves the password step
// passed without yet granting a real session, and can only be redeemed for the second
// factor (never accepted by requireAuth) thanks to the distinct `purpose` claim.
export function signMfaPendingToken(userId: string): string {
  return jwt.sign({ userId, purpose: 'mfa-pending' }, JWT_SECRET, { expiresIn: '5m' });
}

export function verifyMfaPendingToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string; purpose: string };
    if (decoded.purpose !== 'mfa-pending') return null;
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}
