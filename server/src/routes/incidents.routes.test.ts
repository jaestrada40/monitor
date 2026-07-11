import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { pool } from '../db.js';
import { authRouter } from './auth.routes.js';
import { websitesRouter } from './websites.routes.js';
import { incidentsRouter } from './incidents.routes.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/websites', websitesRouter);
  app.use('/api/incidents', incidentsRouter);
  return app;
}

describe('incidents routes', () => {
  const app = buildApp();
  let cookie: string;
  let websiteId: string;
  let incidentId: string;

  beforeAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'incidents-test@example.com'");
    const registerRes = await request(app)
      .post('/api/auth/register')
      .send({ email: 'incidents-test@example.com', password: 'testpass123', username: 'Tester' });
    cookie = registerRes.headers['set-cookie'][0];

    const websiteRes = await request(app)
      .post('/api/websites')
      .set('Cookie', cookie)
      .send({ name: 'Incident Test Site', url: 'https://example.com' });
    websiteId = websiteRes.body.website.id;

    const incidentInsert = await pool.query(
      `INSERT INTO incidents (website_id, title, severity, status, description)
       VALUES ($1, 'Test incident', 'critical', 'active', 'desc') RETURNING id`,
      [websiteId]
    );
    incidentId = incidentInsert.rows[0].id;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'incidents-test@example.com'");
    await pool.end();
  });

  it('lists incidents scoped to the user', async () => {
    const res = await request(app).get('/api/incidents').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.incidents.some((i: any) => i.id === incidentId)).toBe(true);
  });

  it('acknowledges then resolves an incident, computing duration', async () => {
    const ackRes = await request(app).post(`/api/incidents/${incidentId}/acknowledge`).set('Cookie', cookie);
    expect(ackRes.status).toBe(200);
    expect(ackRes.body.incident.status).toBe('acknowledged');
    expect(ackRes.body.incident.acknowledgedAt).not.toBeNull();

    const resolveRes = await request(app).post(`/api/incidents/${incidentId}/resolve`).set('Cookie', cookie);
    expect(resolveRes.status).toBe(200);
    expect(resolveRes.body.incident.status).toBe('resolved');
    expect(resolveRes.body.incident.duration).toBeTruthy();
  });
});
