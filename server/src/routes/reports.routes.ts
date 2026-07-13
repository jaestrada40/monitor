import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';
import { computeReportSummary } from '../services/report.service.js';

export const reportsRouter = Router();
reportsRouter.use(requireAuth);

const VALID_FREQUENCIES = ['weekly', 'monthly'];

function toScheduleDto(row: any) {
  return {
    enabled: row.enabled,
    frequency: row.frequency,
    recipientEmail: row.recipient_email,
    lastSentAt: row.last_sent_at,
  };
}

reportsRouter.get('/summary', asyncHandler(async (req, res) => {
  const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);
  const summary = await computeReportSummary(pool, req.userId as string, days);
  res.json(summary);
}));

reportsRouter.get('/schedule', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM scheduled_reports WHERE user_id = $1', [req.userId]);
  if (result.rows.length === 0) {
    res.json({ schedule: { enabled: false, frequency: 'weekly', recipientEmail: '', lastSentAt: null } });
    return;
  }
  res.json({ schedule: toScheduleDto(result.rows[0]) });
}));

reportsRouter.put('/schedule', asyncHandler(async (req, res) => {
  const { enabled, frequency, recipientEmail } = req.body ?? {};
  if (typeof enabled !== 'boolean') {
    res.status(400).json({ error: 'invalid_enabled' });
    return;
  }
  if (!VALID_FREQUENCIES.includes(frequency)) {
    res.status(400).json({ error: 'invalid_frequency' });
    return;
  }
  if (enabled && (typeof recipientEmail !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipientEmail))) {
    res.status(400).json({ error: 'invalid_email' });
    return;
  }

  await pool.query(
    `INSERT INTO scheduled_reports (user_id, enabled, frequency, recipient_email)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (user_id) DO UPDATE SET enabled = $2, frequency = $3, recipient_email = $4`,
    [req.userId, enabled, frequency, recipientEmail || '']
  );
  const result = await pool.query('SELECT * FROM scheduled_reports WHERE user_id = $1', [req.userId]);
  res.json({ schedule: toScheduleDto(result.rows[0]) });
}));
