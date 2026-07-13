import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { pool } from '../db.js';
import { hashPassword } from '../services/auth.service.js';
import { authRouter } from './auth.routes.js';
import { websitesRouter } from './websites.routes.js';
import { incidentsRouter } from './incidents.routes.js';
import { reportsRouter } from './reports.routes.js';

async function createTestUser(email: string, username: string) {
  const passwordHash = await hashPassword('testpass123');
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3) RETURNING id`,
    [email, passwordHash, username]
  );
  const userId = result.rows[0].id;
  await pool.query('INSERT INTO notification_settings (user_id, email_address) VALUES ($1, $2)', [userId, email]);
  await pool.query('INSERT INTO workspace_settings (user_id) VALUES ($1)', [userId]);
  return userId;
}

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/websites', websitesRouter);
  app.use('/api/incidents', incidentsRouter);
  app.use('/api/reports', reportsRouter);
  return app;
}

describe('reports routes', () => {
  const app = buildApp();
  let cookie: string;
  let userId: string;
  let websiteId: string;

  beforeAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'reports-test@example.com'");
    userId = await createTestUser('reports-test@example.com', 'Tester');
    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'reports-test@example.com', password: 'testpass123' });
    cookie = loginRes.headers['set-cookie'][0];

    const websiteRes = await request(app)
      .post('/api/websites')
      .set('Cookie', cookie)
      .send({ name: 'Report Test Site', url: 'https://example.com' });
    websiteId = websiteRes.body.website.id;

    await pool.query(
      `INSERT INTO response_time_checks (website_id, value_ms) VALUES ($1, 100), ($1, 200), ($1, -1)`,
      [websiteId]
    );
    await pool.query(
      `INSERT INTO incidents (website_id, title, severity, status, description, created_at, resolved_at)
       VALUES ($1, 'Sitio no responde', 'critical', 'resolved', 'desc', now() - interval '1 hour', now() - interval '45 minutes')`,
      [websiteId]
    );
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'reports-test@example.com'");
    await pool.end();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/reports/summary');
    expect(res.status).toBe(401);
  });

  it('computes a real summary scoped to the user from checks and incidents', async () => {
    const res = await request(app).get('/api/reports/summary?days=30').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.totalCount).toBe(1);
    expect(res.body.resolvedCount).toBe(1);
    expect(res.body.mttrMinutes).toBe(15);
    const site = res.body.perSiteUptime.find((s: any) => s.id === websiteId);
    expect(site).toBeTruthy();
    expect(site.uptime).toBeCloseTo((2 / 3) * 100, 1);
  });

  it('defaults the schedule to disabled when none has been configured, then saves and reads it back', async () => {
    const getRes = await request(app).get('/api/reports/schedule').set('Cookie', cookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body.schedule.enabled).toBe(false);

    const putRes = await request(app)
      .put('/api/reports/schedule')
      .set('Cookie', cookie)
      .send({ enabled: true, frequency: 'weekly', recipientEmail: 'team@example.com' });
    expect(putRes.status).toBe(200);
    expect(putRes.body.schedule).toEqual({
      enabled: true,
      frequency: 'weekly',
      recipientEmail: 'team@example.com',
      lastSentAt: null,
    });

    const getAfter = await request(app).get('/api/reports/schedule').set('Cookie', cookie);
    expect(getAfter.body.schedule.enabled).toBe(true);
    expect(getAfter.body.schedule.recipientEmail).toBe('team@example.com');
  });

  it('rejects enabling the schedule with an invalid email', async () => {
    const res = await request(app)
      .put('/api/reports/schedule')
      .set('Cookie', cookie)
      .send({ enabled: true, frequency: 'weekly', recipientEmail: 'not-an-email' });
    expect(res.status).toBe(400);
  });
});
