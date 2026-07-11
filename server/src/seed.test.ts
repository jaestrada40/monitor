import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import type { Pool, PoolClient } from 'pg';
import { verifyPassword } from './services/auth.service.js';
import { seedAdminIfNeeded } from './seed.js';

const ADMIN_EMAIL = 'seed-test-admin@example.com';
const ADMIN_PASSWORD = 'seed-test-password-123';

function makeMockClient() {
  const query = vi.fn();
  const release = vi.fn();
  return { query, release };
}

function makeMockPool(client: ReturnType<typeof makeMockClient>) {
  const query = vi.fn();
  const connect = vi.fn().mockResolvedValue(client);
  return { query, connect } as unknown as Pool & {
    query: ReturnType<typeof vi.fn>;
    connect: ReturnType<typeof vi.fn>;
  };
}

describe('seedAdminIfNeeded', () => {
  const originalEmail = process.env.ADMIN_EMAIL;
  const originalPassword = process.env.ADMIN_PASSWORD;

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    if (originalEmail === undefined) delete process.env.ADMIN_EMAIL;
    else process.env.ADMIN_EMAIL = originalEmail;
    if (originalPassword === undefined) delete process.env.ADMIN_PASSWORD;
    else process.env.ADMIN_PASSWORD = originalPassword;
  });

  it('creates an admin user with role owner and a valid password hash when the users table is empty', async () => {
    process.env.ADMIN_EMAIL = ADMIN_EMAIL;
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;

    const client = makeMockClient();
    const pool = makeMockPool(client);

    // Count query on the pool.
    pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

    // Transactional sequence on the dedicated client.
    client.query
      .mockResolvedValueOnce(undefined) // BEGIN
      .mockResolvedValueOnce({ rows: [{ id: 'user-1' }] }) // INSERT INTO users ... RETURNING id
      .mockResolvedValueOnce(undefined) // INSERT INTO notification_settings
      .mockResolvedValueOnce(undefined) // INSERT INTO workspace_settings
      .mockResolvedValueOnce(undefined); // COMMIT

    await seedAdminIfNeeded(pool);

    expect(pool.query).toHaveBeenCalledWith('SELECT COUNT(*) FROM users');
    expect(pool.connect).toHaveBeenCalledTimes(1);

    const calls = client.query.mock.calls;
    expect(calls[0][0]).toBe('BEGIN');

    const insertUserCall = calls[1];
    expect(insertUserCall[0]).toMatch(/INSERT INTO users/);
    expect(insertUserCall[0]).toMatch(/'owner'/);
    const [insertedEmail, insertedHash, insertedUsername] = insertUserCall[1];
    expect(insertedEmail).toBe(ADMIN_EMAIL);
    expect(insertedUsername).toBe('Admin');

    // Verify the hash actually passed to the INSERT is a valid bcrypt-style hash
    // that verifies against ADMIN_PASSWORD.
    const valid = await verifyPassword(ADMIN_PASSWORD, insertedHash);
    expect(valid).toBe(true);

    expect(calls[2][0]).toMatch(/INSERT INTO notification_settings/);
    expect(calls[2][1]).toEqual(['user-1', ADMIN_EMAIL]);

    expect(calls[3][0]).toMatch(/INSERT INTO workspace_settings/);
    expect(calls[3][1]).toEqual(['user-1']);

    expect(calls[4][0]).toBe('COMMIT');

    expect(client.release).toHaveBeenCalledTimes(1);
  });

  it('skips seeding and issues no insert when the users table already has rows', async () => {
    process.env.ADMIN_EMAIL = ADMIN_EMAIL;
    process.env.ADMIN_PASSWORD = ADMIN_PASSWORD;

    const client = makeMockClient();
    const pool = makeMockPool(client);

    pool.query.mockResolvedValueOnce({ rows: [{ count: '3' }] });

    await seedAdminIfNeeded(pool);

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT COUNT(*) FROM users');
    expect(pool.connect).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
  });

  it('warns and does not throw or insert when ADMIN_EMAIL/ADMIN_PASSWORD are unset', async () => {
    delete process.env.ADMIN_EMAIL;
    delete process.env.ADMIN_PASSWORD;

    const client = makeMockClient();
    const pool = makeMockPool(client);

    pool.query.mockResolvedValueOnce({ rows: [{ count: '0' }] });

    await expect(seedAdminIfNeeded(pool)).resolves.toBeUndefined();

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.connect).not.toHaveBeenCalled();
    expect(client.query).not.toHaveBeenCalled();
  });
});
