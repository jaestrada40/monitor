import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const sql = readFileSync(join(__dirname, 'migrations', '001_init.sql'), 'utf-8');
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await pool.query(sql);
  console.log('Migration applied successfully.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
