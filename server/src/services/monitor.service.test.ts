import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { pool } from '../db.js';
import { checkWebsite } from './monitor.service.js';

// Avoid real TLS handshakes against example.com during tests — SSL checking is covered
// separately by ssl.service.test.ts.
const checkSslMock = vi.fn().mockResolvedValue({ status: 'none', expiryDays: 0, issuer: '' });
vi.mock('./ssl.service.js', () => ({
  checkSsl: (...args: unknown[]) => checkSslMock(...args),
}));

const sendIncidentEmailMock = vi.fn().mockResolvedValue(undefined);
const sendSslExpiryEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock('./email.service.js', () => ({
  sendIncidentEmail: (...args: unknown[]) => sendIncidentEmailMock(...args),
  sendSslExpiryEmail: (...args: unknown[]) => sendSslExpiryEmailMock(...args),
}));

// safeRequest replaced the raw fetch() call in pingOnce (see ssrf-guard.ts) to close the
// redirect/DNS-rebinding SSRF gaps, so these tests mock it directly instead of stubbing
// global fetch.
const safeRequestMock = vi.fn();
vi.mock('./ssrf-guard.js', () => ({
  assertSafeUrl: vi.fn().mockResolvedValue(undefined),
  safeRequest: (...args: unknown[]) => safeRequestMock(...args),
}));

describe('monitor.service', () => {
  let websiteId: string;
  let userId: string;

  beforeEach(async () => {
    checkSslMock.mockClear().mockResolvedValue({ status: 'none', expiryDays: 0, issuer: '' });
    sendIncidentEmailMock.mockClear();
    sendSslExpiryEmailMock.mockClear();

    await pool.query("DELETE FROM users WHERE email = 'monitor-test@example.com'");
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, username) VALUES ('monitor-test@example.com', 'x', 'Tester') RETURNING id`
    );
    userId = userRes.rows[0].id;
    await pool.query(
      "INSERT INTO notification_settings (user_id, email_enabled, email_addresses) VALUES ($1, true, $2)",
      [userId, JSON.stringify(['a@example.com', 'b@example.com'])]
    );
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
    safeRequestMock.mockResolvedValue({ statusCode: 200, body: '' });
    await checkWebsite(pool, { id: websiteId, url: 'https://example.com', status: 'up', thresholdResponseTime: 500, thresholdSslDays: 7 });

    const checks = await pool.query('SELECT value_ms FROM response_time_checks WHERE website_id = $1', [websiteId]);
    expect(checks.rows.length).toBe(1);
    expect(checks.rows[0].value_ms).toBeGreaterThanOrEqual(0);

    const site = await pool.query('SELECT status FROM websites WHERE id = $1', [websiteId]);
    expect(site.rows[0].status).toBe('up');
    safeRequestMock.mockReset();
  });

  it('creates a critical incident, marks the site down, and emails all configured addresses', async () => {
    safeRequestMock.mockRejectedValue(new Error('connection refused'));
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

    expect(sendIncidentEmailMock).toHaveBeenCalledTimes(1);
    expect(sendIncidentEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['a@example.com', 'b@example.com'], kind: 'created', severity: 'critical' })
    );
    safeRequestMock.mockReset();
  });

  it('creates a latency warning incident without sending an email', async () => {
    safeRequestMock.mockImplementation(() => new Promise((resolve) => {
      setTimeout(() => resolve({ statusCode: 200, body: '' }), 20);
    }));
    await checkWebsite(pool, { id: websiteId, url: 'https://example.com', status: 'up', thresholdResponseTime: 5, thresholdSslDays: 7 });

    const incidents = await pool.query(
      "SELECT severity FROM incidents WHERE website_id = $1 AND status = 'active'",
      [websiteId]
    );
    expect(incidents.rows.length).toBe(1);
    expect(incidents.rows[0].severity).toBe('warning');
    expect(sendIncidentEmailMock).not.toHaveBeenCalled();
    safeRequestMock.mockReset();
  });

  it('auto-resolves the active incident once the site recovers', async () => {
    await pool.query(
      `INSERT INTO incidents (website_id, title, severity, status, description)
       VALUES ($1, 'Site down', 'critical', 'active', 'auto')`,
      [websiteId]
    );
    await pool.query("UPDATE websites SET status = 'down' WHERE id = $1", [websiteId]);

    safeRequestMock.mockResolvedValue({ statusCode: 200, body: '' });
    await checkWebsite(pool, { id: websiteId, url: 'https://example.com', status: 'down', thresholdResponseTime: 500, thresholdSslDays: 7 });

    const site = await pool.query('SELECT status FROM websites WHERE id = $1', [websiteId]);
    expect(site.rows[0].status).toBe('up');

    const incidents = await pool.query(
      "SELECT * FROM incidents WHERE website_id = $1 AND status = 'resolved'",
      [websiteId]
    );
    expect(incidents.rows.length).toBe(1);
    expect(incidents.rows[0].resolved_at).not.toBeNull();
    expect(sendIncidentEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({ to: ['a@example.com', 'b@example.com'], kind: 'resolved' })
    );
    safeRequestMock.mockReset();
  });

  it('emails once when SSL first becomes expiring, then stays quiet on the next check', async () => {
    checkSslMock.mockResolvedValue({ status: 'expiring', expiryDays: 5, issuer: 'Let\'s Encrypt' });
    safeRequestMock.mockResolvedValue({ statusCode: 200, body: '' });

    await checkWebsite(pool, { id: websiteId, url: 'https://example.com', status: 'up', thresholdResponseTime: 500, thresholdSslDays: 7 });
    expect(sendSslExpiryEmailMock).toHaveBeenCalledTimes(1);
    expect(sendSslExpiryEmailMock).toHaveBeenCalledWith(['a@example.com', 'b@example.com'], 'Monitor Test', 'expiring', 5);

    // Still expiring on the next check — should not re-send.
    await checkWebsite(pool, { id: websiteId, url: 'https://example.com', status: 'up', thresholdResponseTime: 500, thresholdSslDays: 7 });
    expect(sendSslExpiryEmailMock).toHaveBeenCalledTimes(1);

    safeRequestMock.mockReset();
  });

  it('re-alerts once the certificate goes from expiring to fully expired', async () => {
    checkSslMock.mockResolvedValue({ status: 'expiring', expiryDays: 5, issuer: '' });
    safeRequestMock.mockResolvedValue({ statusCode: 200, body: '' });
    await checkWebsite(pool, { id: websiteId, url: 'https://example.com', status: 'up', thresholdResponseTime: 500, thresholdSslDays: 7 });
    expect(sendSslExpiryEmailMock).toHaveBeenCalledTimes(1);

    checkSslMock.mockResolvedValue({ status: 'expired', expiryDays: -1, issuer: '' });
    await checkWebsite(pool, { id: websiteId, url: 'https://example.com', status: 'up', thresholdResponseTime: 500, thresholdSslDays: 7 });
    expect(sendSslExpiryEmailMock).toHaveBeenCalledTimes(2);
    expect(sendSslExpiryEmailMock).toHaveBeenLastCalledWith(['a@example.com', 'b@example.com'], 'Monitor Test', 'expired', -1);

    safeRequestMock.mockReset();
  });
});
