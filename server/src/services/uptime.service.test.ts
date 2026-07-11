import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../db.js';
import { computeUptimeStats } from './uptime.service.js';

describe('uptime.service', () => {
  let websiteId: string;

  beforeAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'uptime-test@example.com'");
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, username) VALUES ('uptime-test@example.com', 'x', 'Tester') RETURNING id`
    );
    const userId = userRes.rows[0].id;
    const webRes = await pool.query(
      `INSERT INTO websites (user_id, name, url) VALUES ($1, 'Uptime Test', 'https://example.com') RETURNING id`,
      [userId]
    );
    websiteId = webRes.rows[0].id;

    await pool.query(`INSERT INTO response_time_checks (website_id, value_ms) VALUES ($1, 100), ($1, 120), ($1, -1)`, [
      websiteId,
    ]);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'uptime-test@example.com'");
    await pool.end();
  });

  it('computes uptime percentage excluding down checks and returns latest response time', async () => {
    const stats = await computeUptimeStats(pool, websiteId);
    expect(stats.uptime24h).toBeCloseTo((2 / 3) * 100, 1);
    expect(stats.latestResponseTime).toBe(-1);
    expect(stats.history.length).toBe(3);
  });
});
