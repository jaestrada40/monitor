import { Router } from 'express';
import { pool } from '../db.js';
import {
  verifyPassword,
  signToken,
  hashPassword,
  generatePasswordResetToken,
  hashResetToken,
  signMfaPendingToken,
  verifyMfaPendingToken,
} from '../services/auth.service.js';
import { sendPasswordResetEmail } from '../services/email.service.js';
import { generateMfaSecret, verifyMfaToken, generateQrCodeDataUrl } from '../services/mfa.service.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { loginLimiter, forgotPasswordLimiter, resetPasswordLimiter, mfaVerifyLimiter } from '../middleware/rateLimit.js';

export const authRouter = Router();
const COOKIE_NAME = process.env.COOKIE_NAME || 'monitorpro_session';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

// Data-URL avatars are stored directly in the column (no file storage set up), capped well
// under Postgres' TEXT limits — a 128x128 JPEG comfortably fits in a few hundred KB.
const MAX_AVATAR_LENGTH = 500_000;

function toUserDto(row: any) {
  return {
    id: row.id,
    email: row.email,
    username: row.username,
    avatarUrl: row.avatar_url,
    role: row.role,
    mfaEnabled: row.mfa_enabled,
  };
}

authRouter.post('/login', loginLimiter, asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};
  const result = await pool.query(
    'SELECT id, email, username, avatar_url, role, password_hash, mfa_enabled FROM users WHERE email = $1',
    [email]
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(password ?? '', user.password_hash))) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }

  if (user.mfa_enabled) {
    res.json({ mfaRequired: true, pendingToken: signMfaPendingToken(user.id) });
    return;
  }

  const token = signToken(user.id);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.json({ user: toUserDto(user) });
}));

authRouter.post('/login/mfa', mfaVerifyLimiter, asyncHandler(async (req, res) => {
  const { pendingToken, token } = req.body ?? {};
  if (typeof pendingToken !== 'string' || typeof token !== 'string') {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  const pending = verifyMfaPendingToken(pendingToken);
  if (!pending) {
    res.status(401).json({ error: 'invalid_or_expired_pending_token' });
    return;
  }

  const result = await pool.query(
    'SELECT id, email, username, avatar_url, role, mfa_enabled, mfa_secret FROM users WHERE id = $1',
    [pending.userId]
  );
  const user = result.rows[0];
  if (!user || !user.mfa_enabled || !user.mfa_secret || !(await verifyMfaToken(user.mfa_secret, token))) {
    res.status(401).json({ error: 'invalid_code' });
    return;
  }

  const sessionToken = signToken(user.id);
  res.cookie(COOKIE_NAME, sessionToken, COOKIE_OPTS);
  res.json({ user: toUserDto(user) });
}));

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT id, email, username, avatar_url, role, mfa_enabled FROM users WHERE id = $1',
    [req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ user: toUserDto(result.rows[0]) });
}));

authRouter.post('/forgot-password', forgotPasswordLimiter, asyncHandler(async (req, res) => {
  const { email } = req.body ?? {};
  // Always respond the same way regardless of whether the account exists, so this
  // endpoint can't be used to enumerate registered emails.
  if (typeof email !== 'string' || !email) {
    res.json({ ok: true });
    return;
  }

  const result = await pool.query('SELECT id, username FROM users WHERE email = $1', [email]);
  const user = result.rows[0];
  if (user) {
    const { rawToken, tokenHash } = generatePasswordResetToken();
    const expires = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
    await pool.query('UPDATE users SET reset_token_hash = $1, reset_token_expires = $2 WHERE id = $3', [
      tokenHash,
      expires,
      user.id,
    ]);
    try {
      await sendPasswordResetEmail(email, user.username, rawToken);
    } catch (err) {
      console.error(`Failed to send password reset email to ${email}:`, err);
    }
  }

  res.json({ ok: true });
}));

authRouter.post('/reset-password', resetPasswordLimiter, asyncHandler(async (req, res) => {
  const { token, newPassword } = req.body ?? {};
  if (typeof token !== 'string' || !token || typeof newPassword !== 'string' || newPassword.length < 8) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  const tokenHash = hashResetToken(token);
  const result = await pool.query(
    'SELECT id FROM users WHERE reset_token_hash = $1 AND reset_token_expires > now()',
    [tokenHash]
  );
  if (result.rows.length === 0) {
    res.status(400).json({ error: 'invalid_or_expired_token' });
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await pool.query(
    'UPDATE users SET password_hash = $1, reset_token_hash = NULL, reset_token_expires = NULL WHERE id = $2',
    [passwordHash, result.rows[0].id]
  );
  res.json({ ok: true });
}));

authRouter.put('/me/avatar', requireAuth, asyncHandler(async (req, res) => {
  const { avatarUrl } = req.body ?? {};
  if (typeof avatarUrl !== 'string' || avatarUrl.length === 0) {
    res.status(400).json({ error: 'invalid_avatar' });
    return;
  }
  if (avatarUrl.length > MAX_AVATAR_LENGTH) {
    res.status(413).json({ error: 'avatar_too_large' });
    return;
  }
  const result = await pool.query(
    'UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING id, email, username, avatar_url, role, mfa_enabled',
    [avatarUrl, req.userId]
  );
  res.json({ user: toUserDto(result.rows[0]) });
}));

authRouter.put('/me/password', requireAuth, asyncHandler(async (req, res) => {
  const { currentPassword, newPassword } = req.body ?? {};
  if (typeof currentPassword !== 'string' || typeof newPassword !== 'string' || newPassword.length < 8) {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }

  const result = await pool.query('SELECT password_hash FROM users WHERE id = $1', [req.userId]);
  const user = result.rows[0];
  if (!user || !(await verifyPassword(currentPassword, user.password_hash))) {
    res.status(401).json({ error: 'invalid_current_password' });
    return;
  }

  const passwordHash = await hashPassword(newPassword);
  await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.userId]);
  res.json({ ok: true });
}));

// --- MFA setup/management (self-service, requires an existing session) ---

authRouter.post('/mfa/setup', requireAuth, asyncHandler(async (req, res) => {
  const userResult = await pool.query('SELECT email FROM users WHERE id = $1', [req.userId]);
  const { secret, otpauthUrl } = generateMfaSecret(userResult.rows[0].email);
  // Stored but mfa_enabled stays false until verify-setup succeeds, so an abandoned
  // setup never locks the account out.
  await pool.query('UPDATE users SET mfa_secret = $1 WHERE id = $2', [secret, req.userId]);
  const qrCodeDataUrl = await generateQrCodeDataUrl(otpauthUrl);
  res.json({ secret, qrCodeDataUrl });
}));

authRouter.post('/mfa/verify-setup', requireAuth, mfaVerifyLimiter, asyncHandler(async (req, res) => {
  const { token } = req.body ?? {};
  if (typeof token !== 'string') {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }
  const result = await pool.query('SELECT mfa_secret FROM users WHERE id = $1', [req.userId]);
  const secret = result.rows[0]?.mfa_secret;
  if (!secret || !(await verifyMfaToken(secret, token))) {
    res.status(401).json({ error: 'invalid_code' });
    return;
  }
  await pool.query('UPDATE users SET mfa_enabled = true WHERE id = $1', [req.userId]);
  res.json({ ok: true });
}));

authRouter.post('/mfa/disable', requireAuth, mfaVerifyLimiter, asyncHandler(async (req, res) => {
  const { token } = req.body ?? {};
  if (typeof token !== 'string') {
    res.status(400).json({ error: 'invalid_request' });
    return;
  }
  const result = await pool.query('SELECT mfa_secret, mfa_enabled FROM users WHERE id = $1', [req.userId]);
  const row = result.rows[0];
  if (!row?.mfa_enabled || !row.mfa_secret || !(await verifyMfaToken(row.mfa_secret, token))) {
    res.status(401).json({ error: 'invalid_code' });
    return;
  }
  await pool.query("UPDATE users SET mfa_enabled = false, mfa_secret = NULL WHERE id = $1", [req.userId]);
  res.json({ ok: true });
}));
