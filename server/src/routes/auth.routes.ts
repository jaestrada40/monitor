import { Router } from 'express';
import { pool } from '../db.js';
import { hashPassword, verifyPassword, signToken } from '../services/auth.service.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const authRouter = Router();
const COOKIE_NAME = process.env.COOKIE_NAME || 'monitorpro_session';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

authRouter.post('/register', async (req, res) => {
  const { email, password, username } = req.body ?? {};
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'invalid_email' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'password_too_short' });
    return;
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'email_taken' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3)
     RETURNING id, email, username, avatar_url, role`,
    [email, passwordHash, username || email.split('@')[0]]
  );
  const user = result.rows[0];

  await pool.query('INSERT INTO notification_settings (user_id, email_address) VALUES ($1, $2)', [user.id, email]);
  await pool.query('INSERT INTO workspace_settings (user_id) VALUES ($1)', [user.id]);

  const token = signToken(user.id);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.status(201).json({ user });
});

authRouter.post('/login', async (req, res) => {
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
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT id, email, username, avatar_url, role FROM users WHERE id = $1',
    [req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ user: result.rows[0] });
});
