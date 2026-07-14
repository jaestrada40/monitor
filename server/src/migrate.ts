import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool } from './db.js';
import { encryptSecret } from './services/encryption.service.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Encrypted secrets are stored as "iv:authTag:ciphertext" (all base64) — anything else
// in this column is a plaintext secret from before encryption was introduced.
const ENCRYPTED_FORMAT = /^[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+:[A-Za-z0-9+/=]+$/;

// One-time backfill: any mfa_secret written before encryption was added is plaintext.
// Runs on every deploy but is a no-op once all rows are already encrypted.
async function encryptLegacyMfaSecrets() {
  const result = await pool.query('SELECT id, mfa_secret FROM users WHERE mfa_secret IS NOT NULL');
  for (const row of result.rows) {
    if (ENCRYPTED_FORMAT.test(row.mfa_secret)) continue;
    await pool.query('UPDATE users SET mfa_secret = $1 WHERE id = $2', [encryptSecret(row.mfa_secret), row.id]);
    console.log(`Encrypted legacy plaintext MFA secret for user ${row.id}`);
  }
}

async function migrate() {
  const sql = readFileSync(join(__dirname, 'migrations', '001_init.sql'), 'utf-8');
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await pool.query(sql);
  await encryptLegacyMfaSecrets();
  console.log('Migration applied successfully.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
