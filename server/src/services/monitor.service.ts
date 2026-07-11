import type { Pool } from 'pg';
import { sendIncidentEmail } from './email.service.js';

interface WebsiteCheckTarget {
  id: string;
  url: string;
  status: string;
  thresholdResponseTime: number;
}

async function pingOnce(url: string): Promise<{ ok: boolean; ms: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return { ok: response.ok, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: -1 };
  }
}

export async function createIncidentIfNeeded(
  pool: Pool,
  websiteId: string,
  severity: 'critical' | 'warning',
  description: string
) {
  const existing = await pool.query(
    "SELECT id FROM incidents WHERE website_id = $1 AND status != 'resolved'",
    [websiteId]
  );
  if (existing.rows.length > 0) return;

  const websiteResult = await pool.query('SELECT name FROM websites WHERE id = $1', [websiteId]);
  const title = severity === 'critical' ? 'Sitio no responde' : 'Latencia elevada detectada';
  await pool.query(
    `INSERT INTO incidents (website_id, title, severity, status, description)
     VALUES ($1, $2, $3, 'active', $4)`,
    [websiteId, title, severity, description]
  );
  void websiteResult;

  const notifyResult = await pool.query(
    `SELECT n.email_enabled, n.email_address, w.name AS website_name
     FROM notification_settings n JOIN websites w ON w.user_id = n.user_id
     WHERE w.id = $1`,
    [websiteId]
  );
  const notify = notifyResult.rows[0];
  if (notify?.email_enabled) {
    await sendIncidentEmail({
      to: notify.email_address,
      websiteName: notify.website_name,
      kind: 'created',
      severity,
      description,
    });
  }
}

export async function resolveActiveIncidentIfAny(pool: Pool, websiteId: string) {
  const active = await pool.query(
    "SELECT id FROM incidents WHERE website_id = $1 AND status != 'resolved' ORDER BY created_at DESC LIMIT 1",
    [websiteId]
  );
  if (active.rows.length === 0) return;

  await pool.query("UPDATE incidents SET status = 'resolved', resolved_at = now() WHERE id = $1", [active.rows[0].id]);
  await pool.query("UPDATE websites SET status = 'up' WHERE id = $1", [websiteId]);

  const notifyResult = await pool.query(
    `SELECT n.email_enabled, n.email_address, w.name AS website_name
     FROM notification_settings n JOIN websites w ON w.user_id = n.user_id
     WHERE w.id = $1`,
    [websiteId]
  );
  const notify = notifyResult.rows[0];
  if (notify?.email_enabled) {
    await sendIncidentEmail({ to: notify.email_address, websiteName: notify.website_name, kind: 'resolved' });
  }
}

export async function checkWebsite(pool: Pool, website: WebsiteCheckTarget) {
  let result = await pingOnce(website.url);
  if (!result.ok) {
    result = await pingOnce(website.url);
  }

  const valueMs = result.ok ? result.ms : -1;
  await pool.query('INSERT INTO response_time_checks (website_id, value_ms) VALUES ($1, $2)', [website.id, valueMs]);
  await pool.query('UPDATE websites SET last_checked = now() WHERE id = $1', [website.id]);

  if (!result.ok) {
    await pool.query("UPDATE websites SET status = 'down' WHERE id = $1", [website.id]);
    await createIncidentIfNeeded(pool, website.id, 'critical', 'El sitio no respondió tras dos intentos de conexión.');
    return;
  }

  if (result.ms > website.thresholdResponseTime) {
    await pool.query("UPDATE websites SET status = 'degraded' WHERE id = $1", [website.id]);
    await createIncidentIfNeeded(
      pool,
      website.id,
      'warning',
      `Latencia de ${result.ms}ms supera el umbral de ${website.thresholdResponseTime}ms.`
    );
    return;
  }

  if (website.status === 'down' || website.status === 'degraded') {
    await resolveActiveIncidentIfAny(pool, website.id);
  }
}
