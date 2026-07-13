import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { computeUptimeStats } from '../services/uptime.service.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const websitesRouter = Router();
websitesRouter.use(requireAuth);

const EMPTY_STATS = { uptime24h: 100, uptime30d: 100, latestResponseTime: 0, history: [] };

function toWebsiteDto(row: any, stats: { uptime24h: number; uptime30d: number; latestResponseTime: number; history: { timestamp: string; value: number }[] }) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    status: row.status,
    checkInterval: row.check_interval,
    tags: row.tags,
    sslStatus: row.ssl_status,
    sslExpiryDays: row.ssl_expiry_days,
    sslIssuer: row.ssl_issuer,
    lastChecked: row.last_checked,
    uptime24h: stats.uptime24h,
    uptime30d: stats.uptime30d,
    responseTime: stats.latestResponseTime,
    responseTimeHistory: stats.history,
  };
}

websitesRouter.get('/', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM websites WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]);
  const websites = await Promise.all(
    result.rows.map(async (row) => toWebsiteDto(row, await computeUptimeStats(pool, row.id)))
  );
  res.json({ websites });
}));

websitesRouter.get('/latency-history', asyncHandler(async (req, res) => {
  const result = await pool.query(
    `SELECT date_trunc('hour', c."timestamp") AS bucket, AVG(c.value_ms) AS avg_ms
     FROM response_time_checks c
     JOIN websites w ON w.id = c.website_id
     WHERE w.user_id = $1 AND c.value_ms >= 0 AND c."timestamp" > now() - interval '24 hours'
     GROUP BY bucket
     ORDER BY bucket ASC`,
    [req.userId]
  );
  const points = result.rows.map((row) => ({
    timestamp: new Date(row.bucket).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    value: Math.round(Number(row.avg_ms)),
  }));
  res.json({ points });
}));

websitesRouter.post('/', asyncHandler(async (req, res) => {
  const { name, url, checkInterval, tags } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'invalid_name' });
    return;
  }
  try {
    new URL(url);
  } catch {
    res.status(400).json({ error: 'invalid_url' });
    return;
  }
  const result = await pool.query(
    `INSERT INTO websites (user_id, name, url, check_interval, tags)
     VALUES ($1, $2, $3, $4, $5) RETURNING *`,
    [req.userId, name, url, checkInterval || 60, JSON.stringify(tags || [])]
  );
  res.status(201).json({ website: toWebsiteDto(result.rows[0], EMPTY_STATS) });
}));

websitesRouter.put('/:id', asyncHandler(async (req, res) => {
  const { name, url, checkInterval, tags } = req.body ?? {};
  if (url !== undefined) {
    try {
      new URL(url);
    } catch {
      res.status(400).json({ error: 'invalid_url' });
      return;
    }
  }
  const result = await pool.query(
    `UPDATE websites SET name = COALESCE($1, name), url = COALESCE($2, url),
       check_interval = COALESCE($3, check_interval), tags = COALESCE($4, tags)
     WHERE id = $5 AND user_id = $6 RETURNING *`,
    [name, url, checkInterval, tags ? JSON.stringify(tags) : null, req.params.id, req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ website: toWebsiteDto(result.rows[0], EMPTY_STATS) });
}));

websitesRouter.delete('/:id', asyncHandler(async (req, res) => {
  const result = await pool.query('DELETE FROM websites WHERE id = $1 AND user_id = $2 RETURNING id', [
    req.params.id,
    req.userId,
  ]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ ok: true });
}));

websitesRouter.post('/:id/toggle-status', asyncHandler(async (req, res) => {
  const current = await pool.query('SELECT status FROM websites WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.userId,
  ]);
  if (current.rows.length === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const nextStatus = current.rows[0].status === 'maintenance' ? 'up' : 'maintenance';
  const result = await pool.query('UPDATE websites SET status = $1 WHERE id = $2 AND user_id = $3 RETURNING *', [
    nextStatus,
    req.params.id,
    req.userId,
  ]);
  res.json({ website: toWebsiteDto(result.rows[0], EMPTY_STATS) });
}));
