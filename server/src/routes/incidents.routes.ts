import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const incidentsRouter = Router();
incidentsRouter.use(requireAuth);

function formatDuration(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const rem = minutes % 60;
  return `${hours}h ${rem}m`;
}

function toIncidentDto(row: any) {
  return {
    id: row.id,
    websiteId: row.website_id,
    websiteName: row.website_name,
    title: row.title,
    severity: row.severity,
    status: row.status,
    createdAt: row.created_at,
    acknowledgedAt: row.acknowledged_at,
    resolvedAt: row.resolved_at,
    duration:
      row.resolved_at && row.created_at
        ? formatDuration(new Date(row.resolved_at).getTime() - new Date(row.created_at).getTime())
        : undefined,
    description: row.description,
  };
}

const SELECT_WITH_WEBSITE_NAME = `
  SELECT i.*, w.name AS website_name
  FROM incidents i
  JOIN websites w ON w.id = i.website_id
`;

incidentsRouter.get('/', async (req, res) => {
  const result = await pool.query(
    `${SELECT_WITH_WEBSITE_NAME} WHERE w.user_id = $1 ORDER BY i.created_at DESC`,
    [req.userId]
  );
  res.json({ incidents: result.rows.map(toIncidentDto) });
});

incidentsRouter.post('/:id/acknowledge', async (req, res) => {
  const result = await pool.query(
    `UPDATE incidents SET status = 'acknowledged', acknowledged_at = now()
     WHERE id = $1 AND website_id IN (SELECT id FROM websites WHERE user_id = $2)
     RETURNING *`,
    [req.params.id, req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const withName = await pool.query(`${SELECT_WITH_WEBSITE_NAME} WHERE i.id = $1`, [req.params.id]);
  res.json({ incident: toIncidentDto(withName.rows[0]) });
});

incidentsRouter.post('/:id/resolve', async (req, res) => {
  const result = await pool.query(
    `UPDATE incidents SET status = 'resolved', resolved_at = now()
     WHERE id = $1 AND website_id IN (SELECT id FROM websites WHERE user_id = $2)
     RETURNING *`,
    [req.params.id, req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  await pool.query("UPDATE websites SET status = 'up' WHERE id = $1", [result.rows[0].website_id]);
  const withName = await pool.query(`${SELECT_WITH_WEBSITE_NAME} WHERE i.id = $1`, [req.params.id]);
  res.json({ incident: toIncidentDto(withName.rows[0]) });
});
