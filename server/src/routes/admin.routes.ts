import { Router } from 'express';
import crypto from 'crypto';
import { pool } from '../db.js';
import { hashPassword } from '../services/auth.service.js';
import { sendWelcomeEmail } from '../services/email.service.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { requireRole } from '../middleware/requireRole.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const adminRouter = Router();

const VALID_ROLES = ['super-admin', 'editor'];

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

adminRouter.use(requireAuth);
adminRouter.use(requireRole(['super-admin']));

adminRouter.get('/', asyncHandler(async (_req, res) => {
  const result = await pool.query(
    'SELECT id, email, username, avatar_url, role, mfa_enabled FROM users ORDER BY created_at ASC'
  );
  res.json({ users: result.rows.map(toUserDto) });
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
       RETURNING id, email, username, avatar_url, role`,
      [email, passwordHash, username || email.split('@')[0], role]
    );
    user = toUserDto(result.rows[0]);

    await client.query('INSERT INTO notification_settings (user_id, email_address, email_addresses) VALUES ($1, $2, $3)', [
      user.id,
      email,
      JSON.stringify([email]),
    ]);
    await client.query('INSERT INTO workspace_settings (user_id) VALUES ($1)', [user.id]);
    await client.query('INSERT INTO scheduled_reports (user_id, recipient_email) VALUES ($1, $2)', [user.id, email]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  let emailSent = false;
  try {
    emailSent = await sendWelcomeEmail(email, user.username, temporaryPassword);
  } catch (err) {
    console.error(`Failed to send welcome email to ${email}:`, err);
  }

  res.status(201).json({ user, temporaryPassword, emailSent });
}));

adminRouter.put('/:id', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { username, role } = req.body ?? {};

  if (role !== undefined && (typeof role !== 'string' || !VALID_ROLES.includes(role))) {
    res.status(400).json({ error: 'invalid_role' });
    return;
  }
  if (id === req.userId && role && role !== 'super-admin') {
    res.status(400).json({ error: 'cannot_demote_self' });
    return;
  }

  const result = await pool.query(
    `UPDATE users SET
       username = COALESCE($2, username),
       role = COALESCE($3, role)
     WHERE id = $1
     RETURNING id, email, username, avatar_url, role`,
    [id, username ?? null, role ?? null]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ user: toUserDto(result.rows[0]) });
}));

// Rescue path for a teammate locked out after losing their authenticator device/codes —
// only a super-admin can do this, and only for someone else's account (if you're locked
// out of your own MFA, you can't reach this endpoint since it requires an active session).
adminRouter.post('/:id/mfa/disable', asyncHandler(async (req, res) => {
  const { id } = req.params;
  const result = await pool.query(
    // token_version + 1 forces any of this user's existing sessions to re-authenticate,
    // in case the MFA loss scenario also involved a compromised session token.
    'UPDATE users SET mfa_enabled = false, mfa_secret = NULL, token_version = token_version + 1 WHERE id = $1 RETURNING id, email, username, avatar_url, role',
    [id]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ user: toUserDto(result.rows[0]) });
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
