import { Router } from 'express';
import { pool } from '../db.js';
import { verifyPassword, signToken } from '../services/auth.service.js';
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
  delete user.password_hash;
  res.json({ user });
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
  res.json({ user: result.rows[0] });
}));
