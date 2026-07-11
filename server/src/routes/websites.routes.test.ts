import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { pool } from '../db.js';
import { authRouter } from './auth.routes.js';
import { websitesRouter } from './websites.routes.js';

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/websites', websitesRouter);
  return app;
}

describe('websites routes', () => {
  const app = buildApp();
  let cookie: string;

  let otherCookie: string;

  beforeAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'websites-test@example.com'");
    await pool.query("DELETE FROM users WHERE email = 'websites-test-2@example.com'");
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'websites-test@example.com', password: 'testpass123', username: 'Tester' });
    cookie = res.headers['set-cookie'][0];

    const res2 = await request(app)
      .post('/api/auth/register')
      .send({ email: 'websites-test-2@example.com', password: 'testpass123', username: 'Tester2' });
    otherCookie = res2.headers['set-cookie'][0];
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'websites-test@example.com'");
    await pool.query("DELETE FROM users WHERE email = 'websites-test-2@example.com'");
    await pool.end();
  });

  it('creates and lists a website scoped to the authenticated user', async () => {
    const createRes = await request(app)
      .post('/api/websites')
      .set('Cookie', cookie)
      .send({ name: 'Test Site', url: 'https://example.com', checkInterval: 60 });
    expect(createRes.status).toBe(201);
    expect(createRes.body.website.name).toBe('Test Site');

    const listRes = await request(app).get('/api/websites').set('Cookie', cookie);
    expect(listRes.status).toBe(200);
    expect(listRes.body.websites.some((w: any) => w.name === 'Test Site')).toBe(true);
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/websites');
    expect(res.status).toBe(401);
  });

  it('prevents cross-user write access to another user\'s website', async () => {
    const createRes = await request(app)
      .post('/api/websites')
      .set('Cookie', cookie)
      .send({ name: 'Owner Site', url: 'https://owner.example.com', checkInterval: 60 });
    expect(createRes.status).toBe(201);
    const websiteId = createRes.body.website.id;

    const toggleRes = await request(app)
      .post(`/api/websites/${websiteId}/toggle-status`)
      .set('Cookie', otherCookie);
    expect(toggleRes.status).toBe(404);

    const putRes = await request(app)
      .put(`/api/websites/${websiteId}`)
      .set('Cookie', otherCookie)
      .send({ name: 'Hijacked' });
    expect(putRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/websites/${websiteId}`)
      .set('Cookie', otherCookie);
    expect(deleteRes.status).toBe(404);
  });
});
