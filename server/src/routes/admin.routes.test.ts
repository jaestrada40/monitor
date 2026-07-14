import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { pool } from '../db.js';
import { hashPassword } from '../services/auth.service.js';
import { authRouter } from './auth.routes.js';
import { adminRouter } from './admin.routes.js';

const sendWelcomeActivationEmailMock = vi.fn().mockResolvedValue(true);
vi.mock('../services/email.service.js', () => ({
  sendWelcomeActivationEmail: (...args: unknown[]) => sendWelcomeActivationEmailMock(...args),
}));

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use('/api/auth', authRouter);
  app.use('/api/admin/users', adminRouter);
  return app;
}

async function createTestUser(email: string, username: string, role: string) {
  const passwordHash = await hashPassword('testpass123');
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, username, role) VALUES ($1, $2, $3, $4)
     RETURNING id, email, username, role`,
    [email, passwordHash, username, role]
  );
  const user = result.rows[0];
  await pool.query('INSERT INTO notification_settings (user_id, email_address) VALUES ($1, $2)', [user.id, email]);
  await pool.query('INSERT INTO workspace_settings (user_id) VALUES ($1)', [user.id]);
  return user;
}

async function loginAs(app: express.Express, email: string) {
  const res = await request(app).post('/api/auth/login').send({ email, password: 'testpass123' });
  return res.headers['set-cookie'][0];
}

const OWNER_EMAIL = 'admin-test-owner@example.com';
const VIEWER_EMAIL = 'admin-test-viewer@example.com';
const NEW_USER_EMAIL = 'admin-test-newuser@example.com';

describe('admin routes', () => {
  const app = buildApp();
  let ownerCookie: string;
  let viewerCookie: string;
  let ownerId: string;

  beforeAll(async () => {
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[OWNER_EMAIL, VIEWER_EMAIL, NEW_USER_EMAIL]]);
    const owner = await createTestUser(OWNER_EMAIL, 'Owner', 'super-admin');
    ownerId = owner.id;
    await createTestUser(VIEWER_EMAIL, 'Viewer', 'editor');
    ownerCookie = await loginAs(app, OWNER_EMAIL);
    viewerCookie = await loginAs(app, VIEWER_EMAIL);
  });

  afterAll(async () => {
    await pool.query('DELETE FROM users WHERE email = ANY($1)', [[OWNER_EMAIL, VIEWER_EMAIL, NEW_USER_EMAIL]]);
    await pool.end();
  });

  it('rejects unauthenticated requests', async () => {
    const res = await request(app).get('/api/admin/users');
    expect(res.status).toBe(401);
  });

  it('allows an owner to list users without exposing password_hash', async () => {
    const res = await request(app).get('/api/admin/users').set('Cookie', ownerCookie);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
    const found = res.body.users.find((u: any) => u.email === OWNER_EMAIL);
    expect(found).toBeTruthy();
    expect(found.password_hash).toBeUndefined();
    expect(found).toHaveProperty('id');
    expect(found).toHaveProperty('username');
    expect(found).toHaveProperty('role');
  });

  it('rejects a viewer trying to list users', async () => {
    const res = await request(app).get('/api/admin/users').set('Cookie', viewerCookie);
    expect(res.status).toBe(403);
  });

  it('rejects a viewer trying to create a user', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Cookie', viewerCookie)
      .send({ email: 'should-not-be-created@example.com', username: 'Nope', role: 'editor' });
    expect(res.status).toBe(403);
  });

  it('allows an owner to create a user and the activation link sets a working password', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Cookie', ownerCookie)
      .send({ email: NEW_USER_EMAIL, username: 'NewUser', role: 'editor' });
    expect(res.status).toBe(201);
    expect(res.body.user.email).toBe(NEW_USER_EMAIL);
    expect(res.body.user.role).toBe('editor');
    expect(res.body.user.password_hash).toBeUndefined();
    expect(res.body.emailSent).toBe(true);
    // Never returned in the response once the email succeeded — only as a fallback when
    // emailSent is false.
    expect(res.body.activationUrl).toBeUndefined();
    expect(sendWelcomeActivationEmailMock).toHaveBeenCalledWith(NEW_USER_EMAIL, 'NewUser', expect.any(String));

    // No password works yet — the account only has an unguessable, never-revealed one.
    const blockedLoginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: NEW_USER_EMAIL, password: 'guessed-password' });
    expect(blockedLoginRes.status).toBe(401);

    const rawToken = sendWelcomeActivationEmailMock.mock.calls[0][2];
    const activateRes = await request(app)
      .post('/api/auth/reset-password')
      .send({ token: rawToken, newPassword: 'myOwnNewPassword123' });
    expect(activateRes.status).toBe(200);

    const loginRes = await request(app)
      .post('/api/auth/login')
      .send({ email: NEW_USER_EMAIL, password: 'myOwnNewPassword123' });
    expect(loginRes.status).toBe(200);
  });

  it('rejects creating a user with an invalid role', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Cookie', ownerCookie)
      .send({ email: 'bad-role@example.com', username: 'Bad', role: 'superuser' });
    expect(res.status).toBe(400);
  });

  it('rejects creating a user with an invalid email', async () => {
    const res = await request(app)
      .post('/api/admin/users')
      .set('Cookie', ownerCookie)
      .send({ email: 'not-an-email', username: 'Bad', role: 'editor' });
    expect(res.status).toBe(400);
  });

  it('allows an owner to update another user\'s role', async () => {
    const created = await createTestUser('admin-test-updateme@example.com', 'UpdateMe', 'editor');
    const res = await request(app)
      .put(`/api/admin/users/${created.id}`)
      .set('Cookie', ownerCookie)
      .send({ role: 'super-admin' });
    expect(res.status).toBe(200);
    expect(res.body.user.role).toBe('super-admin');
    await pool.query('DELETE FROM users WHERE id = $1', [created.id]);
  });

  it('rejects an owner demoting their own role', async () => {
    const res = await request(app)
      .put(`/api/admin/users/${ownerId}`)
      .set('Cookie', ownerCookie)
      .send({ role: 'editor' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('cannot_demote_self');
  });

  it('prevents a user from deleting their own account', async () => {
    const res = await request(app).delete(`/api/admin/users/${ownerId}`).set('Cookie', ownerCookie);
    expect(res.status).toBe(400);
    expect(res.body.error).toBe('cannot_delete_self');
  });

  it('returns 404 when deleting a non-existent user', async () => {
    const res = await request(app)
      .delete('/api/admin/users/00000000-0000-0000-0000-000000000000')
      .set('Cookie', ownerCookie);
    expect(res.status).toBe(404);
  });

  it('allows an owner to delete another user', async () => {
    const created = await createTestUser('admin-test-deleteme@example.com', 'DeleteMe', 'editor');
    const res = await request(app).delete(`/api/admin/users/${created.id}`).set('Cookie', ownerCookie);
    expect(res.status).toBe(200);
    expect(res.body.ok).toBe(true);
  });
});
