import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { pool } from '../db.js';
import { checkWebsite } from './monitor.service.js';

// Avoid real TLS handshakes against example.com during tests — SSL checking is covered
// separately by ssl.service.test.ts.
vi.mock('./ssl.service.js', () => ({
  checkSsl: vi.fn().mockResolvedValue({ status: 'none', expiryDays: 0, issuer: '' }),
}));

describe('monitor.service', () => {
  let websiteId: string;
  let userId: string;

  beforeEach(async () => {
    await pool.query("DELETE FROM users WHERE email = 'monitor-test@example.com'");
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, username) VALUES ('monitor-test@example.com', 'x', 'Tester') RETURNING id`
    );
    userId = userRes.rows[0].id;
    const webRes = await pool.query(
      `INSERT INTO websites (user_id, name, url, status) VALUES ($1, 'Monitor Test', 'https://example.com', 'up') RETURNING id`,
      [userId]
    );
    websiteId = webRes.rows[0].id;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'monitor-test@example.com'");
    await pool.end();
  });

  it('records a successful check and keeps the site up', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    await checkWebsite(pool, { id: websiteId, url: 'https://example.com', status: 'up', thresholdResponseTime: 500, thresholdSslDays: 7 });

    const checks = await pool.query('SELECT value_ms FROM response_time_checks WHERE website_id = $1', [websiteId]);
    expect(checks.rows.length).toBe(1);
    expect(checks.rows[0].value_ms).toBeGreaterThanOrEqual(0);

    const site = await pool.query('SELECT status FROM websites WHERE id = $1', [websiteId]);
    expect(site.rows[0].status).toBe('up');
    vi.unstubAllGlobals();
  });

  it('creates a critical incident and marks the site down after a failed check with retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    await checkWebsite(pool, { id: websiteId, url: 'https://example.com', status: 'up', thresholdResponseTime: 500, thresholdSslDays: 7 });

    const site = await pool.query('SELECT status FROM websites WHERE id = $1', [websiteId]);
    expect(site.rows[0].status).toBe('down');

    const incidents = await pool.query(
      "SELECT * FROM incidents WHERE website_id = $1 AND status = 'active'",
      [websiteId]
    );
    expect(incidents.rows.length).toBe(1);
    expect(incidents.rows[0].severity).toBe('critical');

    const checks = await pool.query('SELECT value_ms FROM response_time_checks WHERE website_id = $1', [websiteId]);
    expect(checks.rows[0].value_ms).toBe(-1);
    vi.unstubAllGlobals();
  });

  it('auto-resolves the active incident once the site recovers', async () => {
    await pool.query(
      `INSERT INTO incidents (website_id, title, severity, status, description)
       VALUES ($1, 'Site down', 'critical', 'active', 'auto')`,
      [websiteId]
    );
    await pool.query("UPDATE websites SET status = 'down' WHERE id = $1", [websiteId]);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    await checkWebsite(pool, { id: websiteId, url: 'https://example.com', status: 'down', thresholdResponseTime: 500, thresholdSslDays: 7 });

    const site = await pool.query('SELECT status FROM websites WHERE id = $1', [websiteId]);
    expect(site.rows[0].status).toBe('up');

    const incidents = await pool.query(
      "SELECT * FROM incidents WHERE website_id = $1 AND status = 'resolved'",
      [websiteId]
    );
    expect(incidents.rows.length).toBe(1);
    expect(incidents.rows[0].resolved_at).not.toBeNull();
    vi.unstubAllGlobals();
  });
});
