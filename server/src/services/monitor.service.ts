import type { Pool } from 'pg';
import { chromium, type Browser } from 'playwright';
import { sendIncidentEmail, sendSslExpiryEmail } from './email.service.js';
import { checkSsl } from './ssl.service.js';

interface WebsiteCheckTarget {
  id: string;
  url: string;
  status: string;
  thresholdResponseTime: number;
  thresholdSslDays: number;
}

const BROWSER_USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36';

// Status codes commonly returned by WAF/bot-protection (Cloudflare, etc.) rather than a
// genuinely broken site — worth a second check with a real browser before alerting.
const LIKELY_BOT_BLOCK_STATUS_CODES = new Set([401, 403, 429]);

async function pingOnce(url: string): Promise<{ ok: boolean; ms: number; statusCode?: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        'User-Agent': BROWSER_USER_AGENT,
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
      },
    });
    clearTimeout(timeout);
    return { ok: response.ok, ms: Date.now() - start, statusCode: response.status };
  } catch {
    return { ok: false, ms: -1 };
  }
}

let browserInstance: Browser | null = null;

async function getBrowser(): Promise<Browser> {
  if (browserInstance && browserInstance.isConnected()) return browserInstance;
  browserInstance = await chromium.launch({ headless: true });
  return browserInstance;
}

// Renders the page in a real (headless) browser so JS-based WAF challenges (e.g. Cloudflare)
// resolve the same way they would for a real visitor. Only used as a fallback for likely
// bot-block status codes — too slow/heavy to run on every check.
async function browserCheck(url: string): Promise<{ ok: boolean; ms: number }> {
  const start = Date.now();
  let context;
  try {
    const browser = await getBrowser();
    context = await browser.newContext({ userAgent: BROWSER_USER_AGENT });
    const page = await context.newPage();
    const response = await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 15000 });
    return { ok: !!response && response.ok(), ms: Date.now() - start };
  } catch {
    return { ok: false, ms: -1 };
  } finally {
    await context?.close().catch(() => {});
  }
}

interface AlertRecipients {
  emailEnabled: boolean;
  emails: string[];
  websiteName: string;
}

async function getAlertRecipients(pool: Pool, websiteId: string): Promise<AlertRecipients | undefined> {
  const result = await pool.query(
    `SELECT n.email_enabled, n.email_addresses, w.name AS website_name
     FROM notification_settings n JOIN websites w ON w.user_id = n.user_id
     WHERE w.id = $1`,
    [websiteId]
  );
  const row = result.rows[0];
  if (!row) return undefined;
  const emails: string[] = Array.isArray(row.email_addresses) ? row.email_addresses.filter(Boolean) : [];
  return { emailEnabled: row.email_enabled, emails, websiteName: row.website_name };
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

  const title = severity === 'critical' ? 'Sitio no responde' : 'Latencia elevada detectada';
  await pool.query(
    `INSERT INTO incidents (website_id, title, severity, status, description)
     VALUES ($1, $2, $3, 'active', $4)`,
    [websiteId, title, severity, description]
  );

  // Only "site is down" is worth an email — latency warnings stay visible in the UI but
  // don't page anyone, to avoid alert fatigue over non-critical slowness.
  if (severity !== 'critical') return;

  const notify = await getAlertRecipients(pool, websiteId);
  if (notify?.emailEnabled && notify.emails.length > 0) {
    try {
      await sendIncidentEmail({
        to: notify.emails,
        websiteName: notify.websiteName,
        kind: 'created',
        severity,
        description,
      });
    } catch (err) {
      console.error('Failed to send incident creation email:', err);
    }
  }
}

export async function resolveActiveIncidentIfAny(pool: Pool, websiteId: string) {
  const active = await pool.query(
    "SELECT id, severity FROM incidents WHERE website_id = $1 AND status != 'resolved' ORDER BY created_at DESC LIMIT 1",
    [websiteId]
  );
  if (active.rows.length === 0) return;

  await pool.query("UPDATE incidents SET status = 'resolved', resolved_at = now() WHERE id = $1", [active.rows[0].id]);
  await pool.query("UPDATE websites SET status = 'up' WHERE id = $1", [websiteId]);

  // Mirror createIncidentIfNeeded: only email about recovery from a real outage, not from
  // a latency warning that was never emailed in the first place.
  if (active.rows[0].severity !== 'critical') return;

  const notify = await getAlertRecipients(pool, websiteId);
  if (notify?.emailEnabled && notify.emails.length > 0) {
    try {
      await sendIncidentEmail({ to: notify.emails, websiteName: notify.websiteName, kind: 'resolved' });
    } catch (err) {
      console.error('Failed to send incident resolution email:', err);
    }
  }
}

async function checkSslAndAlert(pool: Pool, website: WebsiteCheckTarget) {
  const previous = await pool.query('SELECT ssl_alerted_status FROM websites WHERE id = $1', [website.id]);
  const previousAlerted: string = previous.rows[0]?.ssl_alerted_status ?? '';

  const ssl = await checkSsl(website.url, website.thresholdSslDays);
  await pool.query('UPDATE websites SET ssl_status = $1, ssl_expiry_days = $2, ssl_issuer = $3 WHERE id = $4', [
    ssl.status,
    ssl.expiryDays,
    ssl.issuer,
    website.id,
  ]);

  if (ssl.status !== 'expiring' && ssl.status !== 'expired') {
    // Cert is valid again (renewed) — clear so a future re-expiry alerts again.
    if (previousAlerted !== '') {
      await pool.query("UPDATE websites SET ssl_alerted_status = '' WHERE id = $1", [website.id]);
    }
    return;
  }
  const alertStatus: 'expiring' | 'expired' = ssl.status;

  // Only email once per transition (e.g. the check where it first becomes "expiring"),
  // not on every check while it remains in that state.
  if (alertStatus === previousAlerted) return;

  await pool.query('UPDATE websites SET ssl_alerted_status = $1 WHERE id = $2', [alertStatus, website.id]);

  const notify = await getAlertRecipients(pool, website.id);
  if (notify?.emailEnabled && notify.emails.length > 0) {
    try {
      await sendSslExpiryEmail(notify.emails, notify.websiteName, alertStatus, ssl.expiryDays);
    } catch (err) {
      console.error('Failed to send SSL expiry email:', err);
    }
  }
}

export async function checkWebsite(pool: Pool, website: WebsiteCheckTarget) {
  let result = await pingOnce(website.url);
  if (!result.ok) {
    result = await pingOnce(website.url);
  }

  // Full browser page loads take much longer than a plain HTTP ping, so their timing
  // isn't comparable to the latency threshold — track separately and skip that check below.
  let usedBrowserFallback = false;
  if (!result.ok && result.statusCode !== undefined && LIKELY_BOT_BLOCK_STATUS_CODES.has(result.statusCode)) {
    const browserResult = await browserCheck(website.url);
    if (browserResult.ok) {
      result = browserResult;
      usedBrowserFallback = true;
    }
  }

  const valueMs = result.ok ? result.ms : -1;
  await pool.query('INSERT INTO response_time_checks (website_id, value_ms) VALUES ($1, $2)', [website.id, valueMs]);
  await pool.query('UPDATE websites SET last_checked = now() WHERE id = $1', [website.id]);

  await checkSslAndAlert(pool, website);

  if (!result.ok) {
    await pool.query("UPDATE websites SET status = 'down' WHERE id = $1", [website.id]);
    await createIncidentIfNeeded(pool, website.id, 'critical', 'El sitio no respondió tras dos intentos de conexión.');
    return;
  }

  if (!usedBrowserFallback && result.ms > website.thresholdResponseTime) {
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
