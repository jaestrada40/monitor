import type { Pool } from 'pg';
import { hashPassword } from './services/auth.service.js';

export async function seedAdminIfNeeded(pool: Pool): Promise<void> {
  const countResult = await pool.query('SELECT COUNT(*) FROM users');
  if (Number(countResult.rows[0].count) > 0) {
    console.log('Users already exist — skipping admin seed.');
    return;
  }

  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (!email || !password) {
    console.warn(
      'No users exist and ADMIN_EMAIL/ADMIN_PASSWORD are not set — no admin account was created. Set these env vars and restart to seed one.'
    );
    return;
  }

  const passwordHash = await hashPassword(password);

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO users (email, password_hash, username, role) VALUES ($1, $2, $3, 'super-admin')
       RETURNING id`,
      [email, passwordHash, 'Admin']
    );
    const userId = result.rows[0].id;
    await client.query('INSERT INTO notification_settings (user_id, email_address) VALUES ($1, $2)', [userId, email]);
    await client.query('INSERT INTO workspace_settings (user_id) VALUES ($1)', [userId]);
    await client.query('INSERT INTO scheduled_reports (user_id, recipient_email) VALUES ($1, $2)', [userId, email]);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }

  console.log(`Seeded admin user: ${email}`);
}
