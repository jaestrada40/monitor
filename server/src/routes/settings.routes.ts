import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';
import { asyncHandler } from '../middleware/asyncHandler.js';

export const settingsRouter = Router();
settingsRouter.use(requireAuth);

function toNotificationsDto(row: any) {
  return {
    email: row.email_enabled,
    emailAddress: row.email_address,
    slack: row.slack_enabled,
    slackWebhook: row.slack_webhook,
    sms: row.sms_enabled,
    smsPhone: row.sms_phone,
    telegram: row.telegram_enabled,
    telegramChatId: row.telegram_chat_id,
    thresholdResponseTime: row.threshold_response_time,
    thresholdSslDays: row.threshold_ssl_days,
  };
}

function toWorkspaceDto(row: any) {
  return {
    companyName: row.company_name,
    plan: row.plan,
    timezone: row.timezone,
    apiKey: row.api_key,
    members: [] as { id: string; name: string; email: string; role: string }[],
  };
}

settingsRouter.get('/notifications', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM notification_settings WHERE user_id = $1', [req.userId]);
  res.json({ notifications: toNotificationsDto(result.rows[0]) });
}));

settingsRouter.put('/notifications', asyncHandler(async (req, res) => {
  const b = req.body ?? {};
  const result = await pool.query(
    `UPDATE notification_settings SET
       email_enabled = $1, email_address = $2, slack_enabled = $3, slack_webhook = $4,
       sms_enabled = $5, sms_phone = $6, telegram_enabled = $7, telegram_chat_id = $8,
       threshold_response_time = $9, threshold_ssl_days = $10
     WHERE user_id = $11 RETURNING *`,
    [
      b.email, b.emailAddress, b.slack, b.slackWebhook,
      b.sms, b.smsPhone, b.telegram, b.telegramChatId,
      b.thresholdResponseTime, b.thresholdSslDays, req.userId,
    ]
  );
  res.json({ notifications: toNotificationsDto(result.rows[0]) });
}));

settingsRouter.get('/settings', asyncHandler(async (req, res) => {
  const result = await pool.query('SELECT * FROM workspace_settings WHERE user_id = $1', [req.userId]);
  res.json({ settings: toWorkspaceDto(result.rows[0]) });
}));

settingsRouter.put('/settings', asyncHandler(async (req, res) => {
  const b = req.body ?? {};
  const result = await pool.query(
    `UPDATE workspace_settings SET company_name = $1, plan = $2, timezone = $3
     WHERE user_id = $4 RETURNING *`,
    [b.companyName, b.plan, b.timezone, req.userId]
  );
  res.json({ settings: toWorkspaceDto(result.rows[0]) });
}));
