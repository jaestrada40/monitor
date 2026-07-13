import { Router } from 'express';
import { pool } from '../db.js';
import { verifyPassword, signToken, hashPassword, generatePasswordResetToken, hashResetToken } from '../services/auth.service.js';
import { sendPasswordResetEmail } from '../services/email.service.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

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
  };
}

authRouter.post('/login', asyncHandler(async (req, res) => {
  const { email, password } = req.body ?? {};
  const result = await pool.query(
    'SELECT id, email, username, avatar_url, role, password_hash FROM users WHERE email = $1',
    [email]
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(password ?? '', user.password_hash))) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }

  const token = signToken(user.id);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.json({ user: toUserDto(user) });
}));

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, asyncHandler(async (req, res) => {
  const result = await pool.query(
    'SELECT id, email, username, avatar_url, role FROM users WHERE id = $1',
    [req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ user: toUserDto(result.rows[0]) });
}));

authRouter.post('/forgot-password', asyncHandler(async (req, res) => {
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

authRouter.post('/reset-password', asyncHandler(async (req, res) => {
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
    'UPDATE users SET avatar_url = $1 WHERE id = $2 RETURNING id, email, username, avatar_url, role',
    [avatarUrl, req.userId]
  );
  res.json({ user: toUserDto(result.rows[0]) });
}));
