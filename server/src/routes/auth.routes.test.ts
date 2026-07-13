import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { pool } from '../db.js';
import { hashPassword } from '../services/auth.service.js';
import { authRouter } from './auth.routes.js';

const sendPasswordResetEmailMock = vi.fn().mockResolvedValue(true);
vi.mock('../services/email.service.js', () => ({
  sendPasswordResetEmail: (...args: unknown[]) => sendPasswordResetEmailMock(...args),
}));

function buildApp() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  return app;
}

describe('auth routes', () => {
  const app = buildApp();
  let cookie: string;

  beforeAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'auth-test@example.com'");
    const passwordHash = await hashPassword('testpass123');
    await pool.query(
      `INSERT INTO users (email, password_hash, username, avatar_url) VALUES ($1, $2, $3, $4)`,
      ['auth-test@example.com', passwordHash, 'Tester', 'https://example.com/avatar.png']
    );
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'auth-test@example.com'");
    await pool.end();
  });

  it('returns a camelCase avatarUrl (not the raw avatar_url column) on login', async () => {
    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'auth-test@example.com', password: 'testpass123' });
    expect(res.status).toBe(200);
    expect(res.body.user.avatarUrl).toBe('https://example.com/avatar.png');
    expect(res.body.user.avatar_url).toBeUndefined();
    cookie = res.headers['set-cookie'][0];
  });

  it('returns a camelCase avatarUrl on /me', async () => {
    const res = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(res.status).toBe(200);
    expect(res.body.user.avatarUrl).toBe('https://example.com/avatar.png');
  });

  it('lets the logged-in user update their own avatar', async () => {
    const res = await request(app)
      .put('/api/auth/me/avatar')
      .set('Cookie', cookie)
      .send({ avatarUrl: 'data:image/png;base64,AAAA' });
    expect(res.status).toBe(200);
    expect(res.body.user.avatarUrl).toBe('data:image/png;base64,AAAA');

    const me = await request(app).get('/api/auth/me').set('Cookie', cookie);
    expect(me.body.user.avatarUrl).toBe('data:image/png;base64,AAAA');
  });

  it('rejects an oversized avatar payload', async () => {
    const res = await request(app)
      .put('/api/auth/me/avatar')
      .set('Cookie', cookie)
      .send({ avatarUrl: 'a'.repeat(600_000) });
    expect(res.status).toBe(413);
  });

  it('rejects avatar updates without a session', async () => {
    const res = await request(app).put('/api/auth/me/avatar').send({ avatarUrl: 'x' });
    expect(res.status).toBe(401);
  });

  it('always returns ok for forgot-password, whether or not the email exists (no enumeration)', async () => {
    const existing = await request(app).post('/api/auth/forgot-password').send({ email: 'auth-test@example.com' });
    expect(existing.status).toBe(200);
    expect(existing.body.ok).toBe(true);

    const missing = await request(app).post('/api/auth/forgot-password').send({ email: 'nobody@example.com' });
    expect(missing.status).toBe(200);
    expect(missing.body.ok).toBe(true);

    expect(sendPasswordResetEmailMock).toHaveBeenCalledTimes(1);
    expect(sendPasswordResetEmailMock).toHaveBeenCalledWith('auth-test@example.com', 'Tester', expect.any(String));
  });

  it('resets the password with a valid token and lets the user log in with the new password', async () => {
    sendPasswordResetEmailMock.mockClear();
    await request(app).post('/api/auth/forgot-password').send({ email: 'auth-test@example.com' });
    const rawToken = sendPasswordResetEmailMock.mock.calls[0][2];

    const resetRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'brandNewPass123' });
    expect(resetRes.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: 'auth-test@example.com', password: 'brandNewPass123' });
    expect(loginRes.status).toBe(200);

    // The token is single-use.
    const reuseRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'anotherPass456' });
    expect(reuseRes.status).toBe(400);
  });

  it('rejects an invalid or expired reset token', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'not-a-real-token', newPassword: 'somePass123' });
    expect(res.status).toBe(400);
  });

  it('rejects a reset password shorter than 8 characters', async () => {
    const res = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: 'whatever', newPassword: 'short' });
    expect(res.status).toBe(400);
  });
});
