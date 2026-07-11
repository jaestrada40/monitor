import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';
import { hashPassword } from '../services/auth.service.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const adminRouter = Router();

const VALID_ROLES = ['owner', 'admin', 'viewer'];

adminRouter.use(requireAuth);
adminRouter.use(requireRole(['owner', 'admin']));

adminRouter.get('/', asyncHandler(async (_req, res) => {
  const result = await pool.query(
    'SELECT id, email, username, role FROM users ORDER BY created_at ASC'
  );
  res.json({ users: result.rows });
}));

adminRouter.post('/', asyncHandler(async (req, res) => {
  const { email, username, role } = req.body ?? {};
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'invalid_email' });
    return;
  }
  if (typeof role !== 'string' || !VALID_ROLES.includes(role)) {
    res.status(400).json({ error: 'invalid_role' });
    return;
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'email_taken' });
    return;
  }

  const temporaryPassword = crypto.randomBytes(9).toString('base64url');
  const passwordHash = await hashPassword(temporaryPassword);

  const client = await pool.connect();
  let user;
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO users (email, password_hash, username, role) VALUES ($1, $2, $3, $4)
       RETURNING id, email, username, role`,
      [email, passwordHash, username || email.split('@')[0], role]
    );
    user = result.rows[0];

    await client.query('INSERT INTO notification_settings (user_id, email_address) VALUES ($1, $2)', [user.id, email]);
    await client.query('INSERT INTO workspace_settings (user_id) VALUES ($1)', [user.id]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  res.status(201).json({ user, temporaryPassword });
}));

adminRouter.delete('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  if (id === req.userId) {
    res.status(400).json({ error: 'cannot_delete_self' });
    return;
  }

  const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ ok: true });
}));
