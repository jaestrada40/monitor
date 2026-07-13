import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { pool } from '../db.js';
import { hashPassword } from '../services/auth.service.js';
import { authRouter } from './auth.routes.js';
import { settingsRouter } from './settings.routes.js';

const sendTestEmailMock = vi.fn().mockResolvedValue(undefined);
vi.mock('../services/email.service.js', () => ({ sendTestEmail: (...args: unknown[]) => sendTestEmailMock(...args) }));

async function createTestUser(email: string, username: string) {
  const passwordHash = await hashPassword('testpass123');
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id`,
    [email, passwordHash, username]
  );
  const userId = result.rows[0].id;
  await pool.query(
    'INSERT INTO notification_settings (user_id, email_address, email_addresses) VALUES ($1, $2, $3)',
    [userId, email, JSON.stringify([email])]
  );
  await pool.query('INSERT INTO workspace_settings (user_id) VALUES ($1)', [userId]);
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api', settingsRouter);
  return app;
}

describe('settings routes', () => {
  const app = buildApp();
  let cookie: string;

  beforeAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'settings-test@example.com'");
    await createTestUser('settings-test@example.com', 'Tester');
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'settings-test@example.com', password: 'testpass123' });
    cookie = res.headers['set-cookie'][0];
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'settings-test@example.com'");
    await pool.end();
  });

  it('reads and updates notification settings', async () => {
    const getRes = await request(app).get('/api/notifications').set('Cookie', cookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body.notifications.emailAddresses).toEqual(['settings-test@example.com']);

    const putRes = await request(app)
      .put('/api/notifications')
      .set('Cookie', cookie)
      .send({ ...getRes.body.notifications, thresholdResponseTime: 750, emailAddresses: ['a@example.com', 'b@example.com'] });
    expect(putRes.status).toBe(200);
    expect(putRes.body.notifications.thresholdResponseTime).toBe(750);
    expect(putRes.body.notifications.emailAddresses).toEqual(['a@example.com', 'b@example.com']);
  });

  it('drops invalid entries when saving multiple email addresses', async () => {
    const res = await request(app)
      .put('/api/notifications')
      .set('Cookie', cookie)
      .send({
        email: true,
        emailAddresses: ['valid@example.com', 'not-an-email', ''],
        slack: false,
        slackWebhook: '',
        sms: false,
        smsPhone: '',
        telegram: false,
        telegramChatId: '',
        thresholdResponseTime: 500,
        thresholdSslDays: 7,
      });
    expect(res.status).toBe(200);
    expect(res.body.notifications.emailAddresses).toEqual(['valid@example.com']);
  });

  it('rejects an invalid email for the test-email endpoint', async () => {
    const res = await request(app)
      .post('/api/notifications/test-email')
      .set('Cookie', cookie)
      .send({ emailAddress: 'not-an-email' });
    expect(res.status).toBe(400);
    expect(sendTestEmailMock).not.toHaveBeenCalled();
  });

  it('sends a real test email when SMTP is configured', async () => {
    const original = process.env.SMTP_HOST;
    process.env.SMTP_HOST = 'smtp.example.com';
    const res = await request(app)
      .post('/api/notifications/test-email')
      .set('Cookie', cookie)
      .send({ emailAddress: 'alerts@example.com' });
    expect(res.status).toBe(200);
    expect(sendTestEmailMock).toHaveBeenCalledWith('alerts@example.com');
    process.env.SMTP_HOST = original;
  });

  it('returns 503 when SMTP is not configured', async () => {
    const original = process.env.SMTP_HOST;
    delete process.env.SMTP_HOST;
    const res = await request(app)
      .post('/api/notifications/test-email')
      .set('Cookie', cookie)
      .send({ emailAddress: 'alerts@example.com' });
    expect(res.status).toBe(503);
    process.env.SMTP_HOST = original;
  });

  it('reads and updates workspace settings', async () => {
    const getRes = await request(app).get('/api/settings').set('Cookie', cookie);
    expect(getRes.status).toBe(200);

    const putRes = await request(app)
      .put('/api/settings')
      .set('Cookie', cookie)
      .send({ ...getRes.body.settings, companyName: 'Acme Corp' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.settings.companyName).toBe('Acme Corp');
  });
});
