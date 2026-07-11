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
    locations: row.locations,
    tags: row.tags,
    sslStatus: row.ssl_status,
    sslExpiryDays: row.ssl_expiry_days,
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

websitesRouter.post('/', asyncHandler(async (req, res) => {
  const { name, url, checkInterval, locations, tags } = req.body ?? {};
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
    `INSERT INTO websites (user_id, name, url, check_interval, locations, tags)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.userId, name, url, checkInterval || 60, JSON.stringify(locations || []), JSON.stringify(tags || [])]
  );
  res.status(201).json({ website: toWebsiteDto(result.rows[0], EMPTY_STATS) });
}));

websitesRouter.put('/:id', asyncHandler(async (req, res) => {
  const { name, url, checkInterval, locations, tags } = req.body ?? {};
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
       check_interval = COALESCE($3, check_interval),
       locations = COALESCE($4, locations), tags = COALESCE($5, tags)
     WHERE id = $6 AND user_id = $7 RETURNING *`,
    [name, url, checkInterval, locations ? JSON.stringify(locations) : null, tags ? JSON.stringify(tags) : null, req.params.id, req.userId]
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
