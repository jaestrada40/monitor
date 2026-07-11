# MonitorPro Real Backend & Monitoring Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace MonitorPro's localStorage-mock data layer with a real Express + PostgreSQL backend that authenticates real users, runs a `node-cron` HTTP monitoring engine against user-registered websites, auto-creates/resolves incidents from real check results, and emails the user on incident create/resolve.

**Architecture:** A single Node/TypeScript process (`server/`) exposes a REST API under `/api/*` and runs an in-process `node-cron` scheduler that pings due websites, writes results to Postgres, and drives incident state transitions. The existing Vite/React frontend (`src/`) is unchanged in UI; its data layer (`src/data.ts` localStorage helpers) is replaced by a `src/api.ts` fetch client, and the two "playground" simulation handlers are removed from `App.tsx` and their trigger UI removed from `IncidentsView.tsx` / `DetailsView.tsx`.

**Tech Stack:** Node.js, Express, TypeScript, `pg` (node-postgres), `bcrypt`, `jsonwebtoken`, `cookie-parser`, `node-cron`, `nodemailer`, Vitest for tests. Frontend stays on Vite/React/Tailwind as-is.

## Global Constraints

- No UI/visual redesign — reuse existing component markup and Tailwind classes exactly as they are today.
- No Slack/SMS/Telegram delivery in this pass — those `notification_settings` columns exist but are not wired to any sender.
- No migration off Vite for the frontend build.
- Passwords: `bcrypt` only. Sessions: JWT in `httpOnly` + `secure` cookies, never `localStorage`.
- Every DB query for `websites`, `incidents`, `notification_settings`, `workspace_settings` must be scoped by the authenticated `user_id` — no cross-user data leakage.
- Playground simulation handlers (`handleInjectIncident`, `handleTriggerPingTest`) and their UI triggers are removed, not just hidden.

---

### Task 1: Server project scaffolding

**Files:**
- Create: `server/package.json`
- Create: `server/tsconfig.json`
- Create: `server/.env.example`
- Create: `server/src/index.ts`
- Create: `server/src/db.ts`
- Modify: `.gitignore` (add `server/node_modules`, `server/dist`, `server/.env`)

**Interfaces:**
- Produces: `pool` — a `pg.Pool` singleton exported from `server/src/db.ts` as `export const pool: Pool`, used by every later task that talks to Postgres.
- Produces: an Express `app` listening on `process.env.PORT || 4000`, exported from `server/src/index.ts` is not required (it's the entrypoint) but must mount a `GET /api/health` route returning `{ ok: true }`.

- [ ] **Step 1: Create `server/package.json`**

```json
{
  "name": "monitorpro-server",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js",
    "test": "vitest run"
  },
  "dependencies": {
    "express": "^4.21.2",
    "cookie-parser": "^1.4.7",
    "cors": "^2.8.5",
    "dotenv": "^17.2.3",
    "pg": "^8.13.1",
    "bcrypt": "^5.1.1",
    "jsonwebtoken": "^9.0.2",
    "node-cron": "^3.0.3",
    "nodemailer": "^6.9.16"
  },
  "devDependencies": {
    "@types/express": "^4.17.21",
    "@types/cookie-parser": "^1.4.8",
    "@types/cors": "^2.8.17",
    "@types/pg": "^8.11.10",
    "@types/bcrypt": "^5.0.2",
    "@types/jsonwebtoken": "^9.0.7",
    "@types/node-cron": "^3.0.11",
    "@types/nodemailer": "^6.4.16",
    "@types/node": "^22.14.0",
    "typescript": "~5.8.2",
    "tsx": "^4.21.0",
    "vitest": "^2.1.8"
  }
}
```

- [ ] **Step 2: Create `server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "lib": ["ES2022"],
    "outDir": "dist",
    "rootDir": "src",
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

- [ ] **Step 3: Create `server/.env.example`**

```
PORT=4000
DATABASE_URL=postgres://monitorpro:changeme@localhost:5432/monitorpro
JWT_SECRET=change-this-to-a-long-random-string
COOKIE_NAME=monitorpro_session
FRONTEND_ORIGIN=http://localhost:3000
SMTP_HOST=
SMTP_PORT=587
SMTP_USER=
SMTP_PASS=
SMTP_FROM=alerts@monitorpro.io
```

- [ ] **Step 4: Create `server/src/db.ts`**

```typescript
import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});
```

- [ ] **Step 5: Create `server/src/index.ts`**

```typescript
import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`MonitorPro API listening on port ${port}`);
});
```

- [ ] **Step 6: Update `.gitignore`**

Add these lines to the repo root `.gitignore` (create the file if it doesn't exist):

```
server/node_modules
server/dist
server/.env
```

- [ ] **Step 7: Install and verify it boots**

```bash
cd server && npm install
cp .env.example .env
npm run dev
```

Expected: console prints `MonitorPro API listening on port 4000` with no errors. In a second terminal: `curl http://localhost:4000/api/health` returns `{"ok":true}`. Stop the dev server (Ctrl+C) before continuing.

- [ ] **Step 8: Commit**

```bash
cd .. && git add server package.json .gitignore 2>/dev/null; git add server .gitignore
git commit -m "chore: scaffold Express/TypeScript server project"
```

---

### Task 2: Database schema migration

**Files:**
- Create: `server/src/migrations/001_init.sql`
- Create: `server/src/migrate.ts`
- Test: manual (schema apply verification, no unit test framework needed for raw SQL)

**Interfaces:**
- Produces: tables `users`, `websites`, `response_time_checks`, `incidents`, `notification_settings`, `workspace_settings` — exact column names below are relied on by every subsequent task's SQL.

- [ ] **Step 1: Create `server/src/migrations/001_init.sql`**

```sql
CREATE TABLE users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  username TEXT NOT NULL,
  avatar_url TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'owner',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE websites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  url TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'up',
  check_interval INTEGER NOT NULL DEFAULT 60,
  locations JSONB NOT NULL DEFAULT '[]',
  tags JSONB NOT NULL DEFAULT '[]',
  ssl_status TEXT NOT NULL DEFAULT 'none',
  ssl_expiry_days INTEGER NOT NULL DEFAULT 0,
  last_checked TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE response_time_checks (
  id BIGSERIAL PRIMARY KEY,
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  "timestamp" TIMESTAMPTZ NOT NULL DEFAULT now(),
  value_ms INTEGER NOT NULL
);
CREATE INDEX idx_response_time_checks_website_id ON response_time_checks(website_id, "timestamp" DESC);

CREATE TABLE incidents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  website_id UUID NOT NULL REFERENCES websites(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  severity TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'active',
  description TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  acknowledged_at TIMESTAMPTZ,
  resolved_at TIMESTAMPTZ
);
CREATE INDEX idx_incidents_website_id ON incidents(website_id);

CREATE TABLE notification_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  email_enabled BOOLEAN NOT NULL DEFAULT true,
  email_address TEXT NOT NULL DEFAULT '',
  slack_enabled BOOLEAN NOT NULL DEFAULT false,
  slack_webhook TEXT NOT NULL DEFAULT '',
  sms_enabled BOOLEAN NOT NULL DEFAULT false,
  sms_phone TEXT NOT NULL DEFAULT '',
  telegram_enabled BOOLEAN NOT NULL DEFAULT false,
  telegram_chat_id TEXT NOT NULL DEFAULT '',
  threshold_response_time INTEGER NOT NULL DEFAULT 500,
  threshold_ssl_days INTEGER NOT NULL DEFAULT 7
);

CREATE TABLE workspace_settings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID UNIQUE NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL DEFAULT '',
  plan TEXT NOT NULL DEFAULT 'starter',
  timezone TEXT NOT NULL DEFAULT 'UTC',
  api_key TEXT NOT NULL DEFAULT ''
);
```

- [ ] **Step 2: Create `server/src/migrate.ts`**

```typescript
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { pool } from './db.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

async function migrate() {
  const sql = readFileSync(join(__dirname, 'migrations', '001_init.sql'), 'utf-8');
  await pool.query('CREATE EXTENSION IF NOT EXISTS pgcrypto');
  await pool.query(sql);
  console.log('Migration applied successfully.');
  await pool.end();
}

migrate().catch((err) => {
  console.error('Migration failed:', err);
  process.exit(1);
});
```

- [ ] **Step 3: Create the local database and run the migration**

```bash
createdb monitorpro
cd server
node --experimental-strip-types --no-warnings src/migrate.ts || npx tsx src/migrate.ts
```

Expected: `Migration applied successfully.` printed, no errors. If `createdb` isn't on PATH, use `psql -c "CREATE DATABASE monitorpro;"` instead.

- [ ] **Step 4: Verify schema with psql**

```bash
psql monitorpro -c "\dt"
```

Expected: lists `users`, `websites`, `response_time_checks`, `incidents`, `notification_settings`, `workspace_settings`.

- [ ] **Step 5: Commit**

```bash
git add server/src/migrations server/src/migrate.ts
git commit -m "feat: add initial Postgres schema migration"
```

---

### Task 3: Auth service — register, login, logout

**Files:**
- Create: `server/src/services/auth.service.ts`
- Create: `server/src/routes/auth.routes.ts`
- Create: `server/src/middleware/requireAuth.ts`
- Modify: `server/src/index.ts` (mount auth routes)
- Test: `server/src/services/auth.service.test.ts`

**Interfaces:**
- Consumes: `pool` from `server/src/db.ts` (Task 1).
- Produces: `hashPassword(password: string): Promise<string>`, `verifyPassword(password: string, hash: string): Promise<boolean>`, `signToken(userId: string): string`, `verifyToken(token: string): { userId: string } | null` — all exported from `auth.service.ts`, used by `requireAuth` middleware and by every later route file.
- Produces: `requireAuth` Express middleware exported from `server/src/middleware/requireAuth.ts` that reads the JWT cookie, sets `req.userId: string` on success, or responds `401 { error: 'unauthorized' }`.
- Produces: routes `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`, `GET /api/auth/me`.

- [ ] **Step 1: Write the failing test for password hashing and token round-trip**

Create `server/src/services/auth.service.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword, signToken, verifyToken } from './auth.service.js';

describe('auth.service', () => {
  it('hashes and verifies a password correctly', async () => {
    const hash = await hashPassword('correct-horse-battery-staple');
    expect(await verifyPassword('correct-horse-battery-staple', hash)).toBe(true);
    expect(await verifyPassword('wrong-password', hash)).toBe(false);
  });

  it('signs and verifies a JWT round-trip', () => {
    const token = signToken('user-123');
    const decoded = verifyToken(token);
    expect(decoded?.userId).toBe('user-123');
  });

  it('rejects a tampered token', () => {
    const token = signToken('user-123');
    expect(verifyToken(token + 'tampered')).toBeNull();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run src/services/auth.service.test.ts
```

Expected: FAIL — `Cannot find module './auth.service.js'`.

- [ ] **Step 3: Create `server/src/services/auth.service.ts`**

```typescript
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import dotenv from 'dotenv';

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || 'dev-secret-change-me';
const SALT_ROUNDS = 12;

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, SALT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

export function signToken(userId: string): string {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
}

export function verifyToken(token: string): { userId: string } | null {
  try {
    const decoded = jwt.verify(token, JWT_SECRET) as { userId: string };
    return { userId: decoded.userId };
  } catch {
    return null;
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/services/auth.service.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Create `server/src/middleware/requireAuth.ts`**

```typescript
import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.service.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const cookieName = process.env.COOKIE_NAME || 'monitorpro_session';
  const token = req.cookies?.[cookieName];
  if (!token) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  const decoded = verifyToken(token);
  if (!decoded) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }
  req.userId = decoded.userId;
  next();
}
```

- [ ] **Step 6: Create `server/src/routes/auth.routes.ts`**

```typescript
import { Router } from 'express';
import { pool } from '../db.js';
import { hashPassword, verifyPassword, signToken } from '../services/auth.service.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const authRouter = Router();
const COOKIE_NAME = process.env.COOKIE_NAME || 'monitorpro_session';
const COOKIE_OPTS = {
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  maxAge: 7 * 24 * 60 * 60 * 1000,
};

authRouter.post('/register', async (req, res) => {
  const { email, password, username } = req.body ?? {};
  if (typeof email !== 'string' || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    res.status(400).json({ error: 'invalid_email' });
    return;
  }
  if (typeof password !== 'string' || password.length < 8) {
    res.status(400).json({ error: 'password_too_short' });
    return;
  }

  const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email]);
  if (existing.rows.length > 0) {
    res.status(409).json({ error: 'email_taken' });
    return;
  }

  const passwordHash = await hashPassword(password);
  const result = await pool.query(
    `INSERT INTO users (email, password_hash, username) VALUES ($1, $2, $3)
     RETURNING id, email, username, avatar_url, role`,
    [email, passwordHash, username || email.split('@')[0]]
  );
  const user = result.rows[0];

  await pool.query('INSERT INTO notification_settings (user_id, email_address) VALUES ($1, $2)', [user.id, email]);
  await pool.query('INSERT INTO workspace_settings (user_id) VALUES ($1)', [user.id]);

  const token = signToken(user.id);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  res.status(201).json({ user });
});

authRouter.post('/login', async (req, res) => {
  const { email, password } = req.body ?? {};
  const result = await pool.query(
    'SELECT id, email, username, avatar_url, role, password_hash FROM users WHERE email = $1',
    [email]
  );
  const user = result.rows[0];
  if (!user || !(await verifyPassword(password ?? '', user.password_hash))) {
    res.status(401).json({ error: 'invalid_credentials' });
    return;
  }

  const token = signToken(user.id);
  res.cookie(COOKIE_NAME, token, COOKIE_OPTS);
  delete user.password_hash;
  res.json({ user });
});

authRouter.post('/logout', (_req, res) => {
  res.clearCookie(COOKIE_NAME);
  res.json({ ok: true });
});

authRouter.get('/me', requireAuth, async (req, res) => {
  const result = await pool.query(
    'SELECT id, email, username, avatar_url, role FROM users WHERE id = $1',
    [req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ user: result.rows[0] });
});
```

- [ ] **Step 7: Mount the auth router in `server/src/index.ts`**

Add near the top with other imports:

```typescript
import { authRouter } from './routes/auth.routes.js';
```

Add after the `app.get('/api/health', ...)` block:

```typescript
app.use('/api/auth', authRouter);
```

- [ ] **Step 8: Manual verification**

```bash
npm run dev
```

In another terminal:

```bash
curl -i -c /tmp/cookies.txt -X POST http://localhost:4000/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"testpass123","username":"Test User"}'
curl -i -b /tmp/cookies.txt http://localhost:4000/api/auth/me
```

Expected: register returns `201` with a `user` object (no `password_hash` field); `/me` returns `200` with the same user. Stop the dev server before continuing.

- [ ] **Step 9: Commit**

```bash
git add server/src/services/auth.service.ts server/src/services/auth.service.test.ts server/src/routes/auth.routes.ts server/src/middleware/requireAuth.ts server/src/index.ts
git commit -m "feat: add register/login/logout auth with JWT cookie sessions"
```

---

### Task 4: Websites CRUD API

**Files:**
- Create: `server/src/routes/websites.routes.ts`
- Modify: `server/src/index.ts` (mount websites routes)
- Test: `server/src/routes/websites.routes.test.ts`

**Interfaces:**
- Consumes: `pool` (Task 1), `requireAuth` (Task 3).
- Produces: `GET /api/websites`, `POST /api/websites`, `PUT /api/websites/:id`, `DELETE /api/websites/:id`, `POST /api/websites/:id/toggle-status` — all behind `requireAuth`, all scoped by `user_id`. Response shape for a website row: `{ id, name, url, status, checkInterval, locations, tags, sslStatus, sslExpiryDays, lastChecked, uptime24h, uptime30d, responseTime, responseTimeHistory }` (camelCase, matching `src/types.ts` `Website`). `uptime24h`/`uptime30d`/`responseTime`/`responseTimeHistory` are computed by the `computeUptimeStats` helper from Task 6 — Task 4 stubs them as `0`/`0`/`0`/`[]` until Task 6 wires the real computation in.

- [ ] **Step 1: Write the failing test**

Create `server/src/routes/websites.routes.test.ts`. This uses a real test database connection (same Postgres instance, requires the schema from Task 2 to already be applied):

```typescript
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

  beforeAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'websites-test@example.com'");
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'websites-test@example.com', password: 'testpass123', username: 'Tester' });
    cookie = res.headers['set-cookie'][0];
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'websites-test@example.com'");
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
});
```

Add `supertest` to `server/package.json` devDependencies: `"supertest": "^7.0.0"`, `"@types/supertest": "^6.0.2"`. Run `npm install` in `server/` after adding.

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run src/routes/websites.routes.test.ts
```

Expected: FAIL — `Cannot find module './websites.routes.js'`.

- [ ] **Step 3: Create `server/src/routes/websites.routes.ts`**

```typescript
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

export const websitesRouter = Router();
websitesRouter.use(requireAuth);

function toWebsiteDto(row: any) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    status: row.status,
    checkInterval: row.check_interval,
    locations: row.locations,
    tags: row.tags,
    sslStatus: row.ssl_status,
    sslExpiryDays: row.ssl_expiry_days,
    lastChecked: row.last_checked,
    uptime24h: 0,
    uptime30d: 0,
    responseTime: 0,
    responseTimeHistory: [] as { timestamp: string; value: number }[],
  };
}

websitesRouter.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM websites WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]);
  res.json({ websites: result.rows.map(toWebsiteDto) });
});

websitesRouter.post('/', async (req, res) => {
  const { name, url, checkInterval, locations, tags } = req.body ?? {};
  if (typeof name !== 'string' || !name.trim()) {
    res.status(400).json({ error: 'invalid_name' });
    return;
  }
  try {
    new URL(url);
  } catch {
    res.status(400).json({ error: 'invalid_url' });
    return;
  }
  const result = await pool.query(
    `INSERT INTO websites (user_id, name, url, check_interval, locations, tags)
     VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
    [req.userId, name, url, checkInterval || 60, JSON.stringify(locations || []), JSON.stringify(tags || [])]
  );
  res.status(201).json({ website: toWebsiteDto(result.rows[0]) });
});

websitesRouter.put('/:id', async (req, res) => {
  const { name, url, checkInterval, locations, tags } = req.body ?? {};
  const result = await pool.query(
    `UPDATE websites SET name = COALESCE($1, name), url = COALESCE($2, url),
       check_interval = COALESCE($3, check_interval),
       locations = COALESCE($4, locations), tags = COALESCE($5, tags)
     WHERE id = $6 AND user_id = $7 RETURNING *`,
    [name, url, checkInterval, locations ? JSON.stringify(locations) : null, tags ? JSON.stringify(tags) : null, req.params.id, req.userId]
  );
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ website: toWebsiteDto(result.rows[0]) });
});

websitesRouter.delete('/:id', async (req, res) => {
  const result = await pool.query('DELETE FROM websites WHERE id = $1 AND user_id = $2 RETURNING id', [
    req.params.id,
    req.userId,
  ]);
  if (result.rows.length === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  res.json({ ok: true });
});

websitesRouter.post('/:id/toggle-status', async (req, res) => {
  const current = await pool.query('SELECT status FROM websites WHERE id = $1 AND user_id = $2', [
    req.params.id,
    req.userId,
  ]);
  if (current.rows.length === 0) {
    res.status(404).json({ error: 'not_found' });
    return;
  }
  const nextStatus = current.rows[0].status === 'maintenance' ? 'up' : 'maintenance';
  const result = await pool.query('UPDATE websites SET status = $1 WHERE id = $2 RETURNING *', [
    nextStatus,
    req.params.id,
  ]);
  res.json({ website: toWebsiteDto(result.rows[0]) });
});
```

- [ ] **Step 4: Mount the router in `server/src/index.ts`**

Add import: `import { websitesRouter } from './routes/websites.routes.js';`
Add mount: `app.use('/api/websites', websitesRouter);`

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/routes/websites.routes.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/websites.routes.ts server/src/routes/websites.routes.test.ts server/src/index.ts server/package.json server/package-lock.json
git commit -m "feat: add websites CRUD API scoped to authenticated user"
```

---

### Task 5: Incidents API

**Files:**
- Create: `server/src/routes/incidents.routes.ts`
- Modify: `server/src/index.ts` (mount incidents routes)
- Test: `server/src/routes/incidents.routes.test.ts`

**Interfaces:**
- Consumes: `pool`, `requireAuth`.
- Produces: `GET /api/incidents`, `POST /api/incidents/:id/acknowledge`, `POST /api/incidents/:id/resolve`. DTO shape: `{ id, websiteId, websiteName, title, severity, status, createdAt, acknowledgedAt, resolvedAt, duration, description }` matching `src/types.ts` `Incident`. All queries join through `websites` to enforce `user_id` scoping (an incident belongs to a website, which belongs to a user).

- [ ] **Step 1: Write the failing test**

Create `server/src/routes/incidents.routes.test.ts`:

```typescript
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run src/routes/incidents.routes.test.ts
```

Expected: FAIL — `Cannot find module './incidents.routes.js'`.

- [ ] **Step 3: Create `server/src/routes/incidents.routes.ts`**

```typescript
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
```

- [ ] **Step 4: Mount the router in `server/src/index.ts`**

Add import: `import { incidentsRouter } from './routes/incidents.routes.js';`
Add mount: `app.use('/api/incidents', incidentsRouter);`

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/routes/incidents.routes.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/incidents.routes.ts server/src/routes/incidents.routes.test.ts server/src/index.ts
git commit -m "feat: add incidents list/acknowledge/resolve API"
```

---

### Task 6: Uptime computation and response-time history

**Files:**
- Create: `server/src/services/uptime.service.ts`
- Modify: `server/src/routes/websites.routes.ts` (wire real computation into `toWebsiteDto` / `GET /`)
- Test: `server/src/services/uptime.service.test.ts`

**Interfaces:**
- Produces: `computeUptimeStats(pool, websiteId: string): Promise<{ uptime24h: number; uptime30d: number; latestResponseTime: number; history: { timestamp: string; value: number }[] }>` exported from `uptime.service.ts`. "History" returns up to the last 24 checks, oldest first, `timestamp` formatted as locale time string, `value` as the ms reading. Uptime percentage = (checks where `value_ms >= 0` and not flagged down) / total checks in window \* 100; a check counts as "down" when `value_ms` is stored as `-1` (the sentinel this task defines for a failed/timed-out check).
- Consumes: this is called from `websitesRouter.get('/')` in Task 4's file, replacing the stubbed zero values.

- [ ] **Step 1: Write the failing test**

Create `server/src/services/uptime.service.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { pool } from '../db.js';
import { computeUptimeStats } from './uptime.service.js';

describe('uptime.service', () => {
  let websiteId: string;

  beforeAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'uptime-test@example.com'");
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, username) VALUES ('uptime-test@example.com', 'x', 'Tester') RETURNING id`
    );
    const userId = userRes.rows[0].id;
    const webRes = await pool.query(
      `INSERT INTO websites (user_id, name, url) VALUES ($1, 'Uptime Test', 'https://example.com') RETURNING id`,
      [userId]
    );
    websiteId = webRes.rows[0].id;

    await pool.query(`INSERT INTO response_time_checks (website_id, value_ms) VALUES ($1, 100), ($1, 120), ($1, -1)`, [
      websiteId,
    ]);
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'uptime-test@example.com'");
    await pool.end();
  });

  it('computes uptime percentage excluding down checks and returns latest response time', async () => {
    const stats = await computeUptimeStats(pool, websiteId);
    expect(stats.uptime24h).toBeCloseTo((2 / 3) * 100, 1);
    expect(stats.latestResponseTime).toBe(-1);
    expect(stats.history.length).toBe(3);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run src/services/uptime.service.test.ts
```

Expected: FAIL — `Cannot find module './uptime.service.js'`.

- [ ] **Step 3: Create `server/src/services/uptime.service.ts`**

```typescript
import type { Pool } from 'pg';

export async function computeUptimeStats(pool: Pool, websiteId: string) {
  const windowStats = async (hours: number) => {
    const result = await pool.query(
      `SELECT
         COUNT(*) FILTER (WHERE value_ms >= 0) AS up_count,
         COUNT(*) AS total_count
       FROM response_time_checks
       WHERE website_id = $1 AND "timestamp" > now() - ($2 || ' hours')::interval`,
      [websiteId, hours]
    );
    const { up_count, total_count } = result.rows[0];
    const total = Number(total_count);
    if (total === 0) return 100;
    return (Number(up_count) / total) * 100;
  };

  const [uptime24h, uptime30d] = await Promise.all([windowStats(24), windowStats(24 * 30)]);

  const latestResult = await pool.query(
    `SELECT value_ms FROM response_time_checks WHERE website_id = $1 ORDER BY "timestamp" DESC LIMIT 1`,
    [websiteId]
  );
  const latestResponseTime = latestResult.rows[0]?.value_ms ?? 0;

  const historyResult = await pool.query(
    `SELECT "timestamp", value_ms FROM response_time_checks WHERE website_id = $1
     ORDER BY "timestamp" DESC LIMIT 24`,
    [websiteId]
  );
  const history = historyResult.rows
    .reverse()
    .map((row) => ({
      timestamp: new Date(row.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      value: row.value_ms,
    }));

  return { uptime24h, uptime30d, latestResponseTime, history };
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/services/uptime.service.test.ts
```

Expected: 1 test PASS.

- [ ] **Step 5: Wire real computation into websites list route**

In `server/src/routes/websites.routes.ts`, add the import:

```typescript
import { computeUptimeStats } from '../services/uptime.service.js';
```

Replace the `toWebsiteDto` function and the `GET /` handler with:

```typescript
function toWebsiteDto(row: any, stats: { uptime24h: number; uptime30d: number; latestResponseTime: number; history: { timestamp: string; value: number }[] }) {
  return {
    id: row.id,
    name: row.name,
    url: row.url,
    status: row.status,
    checkInterval: row.check_interval,
    locations: row.locations,
    tags: row.tags,
    sslStatus: row.ssl_status,
    sslExpiryDays: row.ssl_expiry_days,
    lastChecked: row.last_checked,
    uptime24h: stats.uptime24h,
    uptime30d: stats.uptime30d,
    responseTime: stats.latestResponseTime,
    responseTimeHistory: stats.history,
  };
}

websitesRouter.get('/', async (req, res) => {
  const result = await pool.query('SELECT * FROM websites WHERE user_id = $1 ORDER BY created_at DESC', [req.userId]);
  const websites = await Promise.all(
    result.rows.map(async (row) => toWebsiteDto(row, await computeUptimeStats(pool, row.id)))
  );
  res.json({ websites });
});
```

The `POST`, `PUT`, `DELETE`, and `toggle-status` handlers still call `toWebsiteDto(result.rows[0])` with one argument — update each of those call sites to pass a default stats object for newly-created/updated rows (which have no checks yet):

```typescript
const EMPTY_STATS = { uptime24h: 100, uptime30d: 100, latestResponseTime: 0, history: [] };
```

Add this constant near the top of the file (after the imports) and change every remaining single-argument `toWebsiteDto(result.rows[0])` call to `toWebsiteDto(result.rows[0], EMPTY_STATS)`.

- [ ] **Step 6: Run the full websites test suite to confirm no regression**

```bash
npx vitest run src/routes/websites.routes.test.ts src/services/uptime.service.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add server/src/services/uptime.service.ts server/src/services/uptime.service.test.ts server/src/routes/websites.routes.ts
git commit -m "feat: compute real uptime and response-time history from checks table"
```

---

### Task 7: Notification & workspace settings API

**Files:**
- Create: `server/src/routes/settings.routes.ts`
- Modify: `server/src/index.ts` (mount settings routes)
- Test: `server/src/routes/settings.routes.test.ts`

**Interfaces:**
- Consumes: `pool`, `requireAuth`.
- Produces: `GET /api/notifications`, `PUT /api/notifications`, `GET /api/settings`, `PUT /api/settings`, all scoped by `user_id`. DTOs match `src/types.ts` `NotificationSettings` and `WorkspaceSettings` (camelCase; `members` on `WorkspaceSettings` is out of scope for this pass and returned as an empty array).

- [ ] **Step 1: Write the failing test**

Create `server/src/routes/settings.routes.test.ts`:

```typescript
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import express from 'express';
import cookieParser from 'cookie-parser';
import { pool } from '../db.js';
import { authRouter } from './auth.routes.js';
import { settingsRouter } from './settings.routes.js';

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
    const res = await request(app)
      .post('/api/auth/register')
      .send({ email: 'settings-test@example.com', password: 'testpass123', username: 'Tester' });
    cookie = res.headers['set-cookie'][0];
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'settings-test@example.com'");
    await pool.end();
  });

  it('reads and updates notification settings', async () => {
    const getRes = await request(app).get('/api/notifications').set('Cookie', cookie);
    expect(getRes.status).toBe(200);
    expect(getRes.body.notifications.emailAddress).toBe('settings-test@example.com');

    const putRes = await request(app)
      .put('/api/notifications')
      .set('Cookie', cookie)
      .send({ ...getRes.body.notifications, thresholdResponseTime: 750 });
    expect(putRes.status).toBe(200);
    expect(putRes.body.notifications.thresholdResponseTime).toBe(750);
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
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run src/routes/settings.routes.test.ts
```

Expected: FAIL — `Cannot find module './settings.routes.js'`.

- [ ] **Step 3: Create `server/src/routes/settings.routes.ts`**

```typescript
import { Router } from 'express';
import { pool } from '../db.js';
import { requireAuth } from '../middleware/requireAuth.js';

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

settingsRouter.get('/notifications', async (req, res) => {
  const result = await pool.query('SELECT * FROM notification_settings WHERE user_id = $1', [req.userId]);
  res.json({ notifications: toNotificationsDto(result.rows[0]) });
});

settingsRouter.put('/notifications', async (req, res) => {
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
});

settingsRouter.get('/settings', async (req, res) => {
  const result = await pool.query('SELECT * FROM workspace_settings WHERE user_id = $1', [req.userId]);
  res.json({ settings: toWorkspaceDto(result.rows[0]) });
});

settingsRouter.put('/settings', async (req, res) => {
  const b = req.body ?? {};
  const result = await pool.query(
    `UPDATE workspace_settings SET company_name = $1, plan = $2, timezone = $3
     WHERE user_id = $4 RETURNING *`,
    [b.companyName, b.plan, b.timezone, req.userId]
  );
  res.json({ settings: toWorkspaceDto(result.rows[0]) });
});
```

- [ ] **Step 4: Mount the router in `server/src/index.ts`**

Add import: `import { settingsRouter } from './routes/settings.routes.js';`
Add mount: `app.use('/api', settingsRouter);`

- [ ] **Step 5: Run test to verify it passes**

```bash
npx vitest run src/routes/settings.routes.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 6: Commit**

```bash
git add server/src/routes/settings.routes.ts server/src/routes/settings.routes.test.ts server/src/index.ts
git commit -m "feat: add notification and workspace settings API"
```

---

### Task 8: Monitoring engine — ping logic and state transitions

**Files:**
- Create: `server/src/services/monitor.service.ts`
- Test: `server/src/services/monitor.service.test.ts`

**Interfaces:**
- Consumes: `pool` (Task 1).
- Produces: `checkWebsite(pool, website: { id: string; url: string; status: string; thresholdResponseTime: number }): Promise<void>` exported from `monitor.service.ts`. This is the unit the cron scheduler (Task 9) calls per due website. Internally it performs the HTTP request, retries once on network failure, writes to `response_time_checks` (using `-1` as the sentinel value for a failed check, per Task 6's contract), and calls the incident create/resolve logic also defined in this file: `createIncidentIfNeeded(pool, websiteId, severity, description)` and `resolveActiveIncidentIfAny(pool, websiteId)` (also exported, since Task 10's email wiring calls them too).

- [ ] **Step 1: Write the failing test**

Create `server/src/services/monitor.service.test.ts`. This test mocks `fetch` rather than hitting the network:

```typescript
import { describe, it, expect, beforeEach, afterAll, vi } from 'vitest';
import { pool } from '../db.js';
import { checkWebsite } from './monitor.service.js';

describe('monitor.service', () => {
  let websiteId: string;
  let userId: string;

  beforeEach(async () => {
    await pool.query("DELETE FROM users WHERE email = 'monitor-test@example.com'");
    const userRes = await pool.query(
      `INSERT INTO users (email, password_hash, username) VALUES ('monitor-test@example.com', 'x', 'Tester') RETURNING id`
    );
    userId = userRes.rows[0].id;
    const webRes = await pool.query(
      `INSERT INTO websites (user_id, name, url, status) VALUES ($1, 'Monitor Test', 'https://example.com', 'up') RETURNING id`,
      [userId]
    );
    websiteId = webRes.rows[0].id;
  });

  afterAll(async () => {
    await pool.query("DELETE FROM users WHERE email = 'monitor-test@example.com'");
    await pool.end();
  });

  it('records a successful check and keeps the site up', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    await checkWebsite(pool, { id: websiteId, url: 'https://example.com', status: 'up', thresholdResponseTime: 500 });

    const checks = await pool.query('SELECT value_ms FROM response_time_checks WHERE website_id = $1', [websiteId]);
    expect(checks.rows.length).toBe(1);
    expect(checks.rows[0].value_ms).toBeGreaterThanOrEqual(0);

    const site = await pool.query('SELECT status FROM websites WHERE id = $1', [websiteId]);
    expect(site.rows[0].status).toBe('up');
    vi.unstubAllGlobals();
  });

  it('creates a critical incident and marks the site down after a failed check with retry', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('connection refused')));
    await checkWebsite(pool, { id: websiteId, url: 'https://example.com', status: 'up', thresholdResponseTime: 500 });

    const site = await pool.query('SELECT status FROM websites WHERE id = $1', [websiteId]);
    expect(site.rows[0].status).toBe('down');

    const incidents = await pool.query(
      "SELECT * FROM incidents WHERE website_id = $1 AND status = 'active'",
      [websiteId]
    );
    expect(incidents.rows.length).toBe(1);
    expect(incidents.rows[0].severity).toBe('critical');

    const checks = await pool.query('SELECT value_ms FROM response_time_checks WHERE website_id = $1', [websiteId]);
    expect(checks.rows[0].value_ms).toBe(-1);
    vi.unstubAllGlobals();
  });

  it('auto-resolves the active incident once the site recovers', async () => {
    await pool.query(
      `INSERT INTO incidents (website_id, title, severity, status, description)
       VALUES ($1, 'Site down', 'critical', 'active', 'auto')`,
      [websiteId]
    );
    await pool.query("UPDATE websites SET status = 'down' WHERE id = $1", [websiteId]);

    vi.stubGlobal('fetch', vi.fn().mockResolvedValue({ ok: true, status: 200 }));
    await checkWebsite(pool, { id: websiteId, url: 'https://example.com', status: 'down', thresholdResponseTime: 500 });

    const site = await pool.query('SELECT status FROM websites WHERE id = $1', [websiteId]);
    expect(site.rows[0].status).toBe('up');

    const incidents = await pool.query(
      "SELECT * FROM incidents WHERE website_id = $1 AND status = 'resolved'",
      [websiteId]
    );
    expect(incidents.rows.length).toBe(1);
    expect(incidents.rows[0].resolved_at).not.toBeNull();
    vi.unstubAllGlobals();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run src/services/monitor.service.test.ts
```

Expected: FAIL — `Cannot find module './monitor.service.js'`.

- [ ] **Step 3: Create `server/src/services/monitor.service.ts`**

```typescript
import type { Pool } from 'pg';

interface WebsiteCheckTarget {
  id: string;
  url: string;
  status: string;
  thresholdResponseTime: number;
}

async function pingOnce(url: string): Promise<{ ok: boolean; ms: number }> {
  const start = Date.now();
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10000);
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeout);
    return { ok: response.ok, ms: Date.now() - start };
  } catch {
    return { ok: false, ms: -1 };
  }
}

export async function createIncidentIfNeeded(
  pool: Pool,
  websiteId: string,
  severity: 'critical' | 'warning',
  description: string
) {
  const existing = await pool.query(
    "SELECT id FROM incidents WHERE website_id = $1 AND status != 'resolved'",
    [websiteId]
  );
  if (existing.rows.length > 0) return;

  const websiteResult = await pool.query('SELECT name FROM websites WHERE id = $1', [websiteId]);
  const title = severity === 'critical' ? 'Sitio no responde' : 'Latencia elevada detectada';
  await pool.query(
    `INSERT INTO incidents (website_id, title, severity, status, description)
     VALUES ($1, $2, $3, 'active', $4)`,
    [websiteId, title, severity, description]
  );
  void websiteResult;
}

export async function resolveActiveIncidentIfAny(pool: Pool, websiteId: string) {
  const active = await pool.query(
    "SELECT id FROM incidents WHERE website_id = $1 AND status != 'resolved' ORDER BY created_at DESC LIMIT 1",
    [websiteId]
  );
  if (active.rows.length === 0) return;

  await pool.query("UPDATE incidents SET status = 'resolved', resolved_at = now() WHERE id = $1", [active.rows[0].id]);
  await pool.query("UPDATE websites SET status = 'up' WHERE id = $1", [websiteId]);
}

export async function checkWebsite(pool: Pool, website: WebsiteCheckTarget) {
  let result = await pingOnce(website.url);
  if (!result.ok) {
    result = await pingOnce(website.url);
  }

  const valueMs = result.ok ? result.ms : -1;
  await pool.query('INSERT INTO response_time_checks (website_id, value_ms) VALUES ($1, $2)', [website.id, valueMs]);
  await pool.query('UPDATE websites SET last_checked = now() WHERE id = $1', [website.id]);

  if (!result.ok) {
    await pool.query("UPDATE websites SET status = 'down' WHERE id = $1", [website.id]);
    await createIncidentIfNeeded(pool, website.id, 'critical', 'El sitio no respondió tras dos intentos de conexión.');
    return;
  }

  if (result.ms > website.thresholdResponseTime) {
    await pool.query("UPDATE websites SET status = 'degraded' WHERE id = $1", [website.id]);
    await createIncidentIfNeeded(
      pool,
      website.id,
      'warning',
      `Latencia de ${result.ms}ms supera el umbral de ${website.thresholdResponseTime}ms.`
    );
    return;
  }

  if (website.status === 'down' || website.status === 'degraded') {
    await resolveActiveIncidentIfAny(pool, website.id);
  }
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/services/monitor.service.test.ts
```

Expected: 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/src/services/monitor.service.ts server/src/services/monitor.service.test.ts
git commit -m "feat: add monitoring engine with retry, incident creation, and auto-resolve"
```

---

### Task 9: Cron scheduler wiring

**Files:**
- Create: `server/src/services/scheduler.ts`
- Modify: `server/src/index.ts` (start the scheduler)

**Interfaces:**
- Consumes: `checkWebsite` (Task 8), `pool` (Task 1).
- Produces: `startScheduler(pool): void` exported from `scheduler.ts`, called once from `index.ts` at startup.

- [ ] **Step 1: Create `server/src/services/scheduler.ts`**

```typescript
import cron from 'node-cron';
import type { Pool } from 'pg';
import { checkWebsite } from './monitor.service.js';

export function startScheduler(pool: Pool) {
  cron.schedule('* * * * *', async () => {
    const due = await pool.query(
      `SELECT w.id, w.url, w.status, w.check_interval, w.last_checked, n.threshold_response_time
       FROM websites w
       JOIN notification_settings n ON n.user_id = w.user_id
       WHERE w.status != 'maintenance'
         AND (w.last_checked IS NULL OR w.last_checked < now() - (w.check_interval || ' seconds')::interval)`
    );

    for (const row of due.rows) {
      try {
        await checkWebsite(pool, {
          id: row.id,
          url: row.url,
          status: row.status,
          thresholdResponseTime: row.threshold_response_time,
        });
      } catch (err) {
        console.error(`Monitoring check failed for website ${row.id}:`, err);
      }
    }
  });
}
```

- [ ] **Step 2: Wire it into `server/src/index.ts`**

Add import: `import { startScheduler } from './services/scheduler.js';`
Add near the bottom, before `app.listen`:

```typescript
startScheduler(pool);
```

(Add `import { pool } from './db.js';` if not already present in `index.ts`.)

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

Register a user and add a website pointing at a real reachable URL (e.g. `https://example.com`) via curl (reusing the pattern from Task 3/4's manual verification), wait just over a minute, then:

```bash
psql monitorpro -c "SELECT * FROM response_time_checks ORDER BY id DESC LIMIT 3;"
```

Expected: at least one row appears with a `value_ms >= 0`. Stop the dev server before continuing.

- [ ] **Step 4: Commit**

```bash
git add server/src/services/scheduler.ts server/src/index.ts
git commit -m "feat: wire node-cron scheduler to run due website checks every minute"
```

---

### Task 10: Email notifications on incident create/resolve

**Files:**
- Create: `server/src/services/email.service.ts`
- Modify: `server/src/services/monitor.service.ts` (call email sends from `createIncidentIfNeeded` / `resolveActiveIncidentIfAny`)
- Test: `server/src/services/email.service.test.ts`

**Interfaces:**
- Produces: `sendIncidentEmail(params: { to: string; websiteName: string; kind: 'created' | 'resolved'; severity?: string; description?: string }): Promise<void>` exported from `email.service.ts`, using a lazily-created Nodemailer transport built from `SMTP_HOST`/`SMTP_PORT`/`SMTP_USER`/`SMTP_PASS`/`SMTP_FROM` env vars. If `SMTP_HOST` is unset, the function logs a warning and returns without throwing (so local dev without SMTP configured doesn't crash the monitor).

- [ ] **Step 1: Write the failing test**

Create `server/src/services/email.service.test.ts`:

```typescript
import { describe, it, expect, vi, beforeEach } from 'vitest';

const sendMailMock = vi.fn().mockResolvedValue({ messageId: 'test' });

vi.mock('nodemailer', () => ({
  default: {
    createTransport: vi.fn(() => ({ sendMail: sendMailMock })),
  },
}));

import { sendIncidentEmail } from './email.service.js';

describe('email.service', () => {
  beforeEach(() => {
    sendMailMock.mockClear();
    process.env.SMTP_HOST = 'smtp.example.com';
    process.env.SMTP_FROM = 'alerts@monitorpro.io';
  });

  it('sends an incident-created email with the website name and severity in the body', async () => {
    await sendIncidentEmail({
      to: 'user@example.com',
      websiteName: 'Portal de Clientes',
      kind: 'created',
      severity: 'critical',
      description: 'El sitio no respondió tras dos intentos.',
    });

    expect(sendMailMock).toHaveBeenCalledTimes(1);
    const call = sendMailMock.mock.calls[0][0];
    expect(call.to).toBe('user@example.com');
    expect(call.subject).toContain('Portal de Clientes');
    expect(call.text).toContain('El sitio no respondió tras dos intentos.');
  });

  it('does nothing and does not throw when SMTP_HOST is unset', async () => {
    delete process.env.SMTP_HOST;
    await expect(
      sendIncidentEmail({ to: 'user@example.com', websiteName: 'X', kind: 'resolved' })
    ).resolves.toBeUndefined();
    expect(sendMailMock).not.toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd server && npx vitest run src/services/email.service.test.ts
```

Expected: FAIL — `Cannot find module './email.service.js'`.

- [ ] **Step 3: Create `server/src/services/email.service.ts`**

```typescript
import nodemailer from 'nodemailer';

interface IncidentEmailParams {
  to: string;
  websiteName: string;
  kind: 'created' | 'resolved';
  severity?: string;
  description?: string;
}

export async function sendIncidentEmail(params: IncidentEmailParams): Promise<void> {
  if (!process.env.SMTP_HOST) {
    console.warn('SMTP_HOST not configured — skipping incident email.');
    return;
  }

  const transport = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: Number(process.env.SMTP_PORT) || 587,
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } : undefined,
  });

  const subject =
    params.kind === 'created'
      ? `[MonitorPro] Incidente en ${params.websiteName}`
      : `[MonitorPro] Resuelto: ${params.websiteName}`;

  const text =
    params.kind === 'created'
      ? `Se detectó un incidente ${params.severity ?? ''} en ${params.websiteName}.\n\n${params.description ?? ''}`
      : `El sitio ${params.websiteName} volvió a funcionar con normalidad.`;

  await transport.sendMail({
    from: process.env.SMTP_FROM || 'alerts@monitorpro.io',
    to: params.to,
    subject,
    text,
  });
}
```

- [ ] **Step 4: Run test to verify it passes**

```bash
npx vitest run src/services/email.service.test.ts
```

Expected: 2 tests PASS.

- [ ] **Step 5: Wire email sends into `server/src/services/monitor.service.ts`**

Add the import at the top of `monitor.service.ts`:

```typescript
import { sendIncidentEmail } from './email.service.js';
```

Replace the body of `createIncidentIfNeeded` (keep the existing early-return guard and insert) by adding, right after the successful `INSERT INTO incidents`:

```typescript
  const notifyResult = await pool.query(
    `SELECT n.email_enabled, n.email_address, w.name AS website_name
     FROM notification_settings n JOIN websites w ON w.user_id = n.user_id
     WHERE w.id = $1`,
    [websiteId]
  );
  const notify = notifyResult.rows[0];
  if (notify?.email_enabled) {
    await sendIncidentEmail({
      to: notify.email_address,
      websiteName: notify.website_name,
      kind: 'created',
      severity,
      description,
    });
  }
```

Replace the body of `resolveActiveIncidentIfAny` by adding, right after the `UPDATE websites SET status = 'up'` call:

```typescript
  const notifyResult = await pool.query(
    `SELECT n.email_enabled, n.email_address, w.name AS website_name
     FROM notification_settings n JOIN websites w ON w.user_id = n.user_id
     WHERE w.id = $1`,
    [websiteId]
  );
  const notify = notifyResult.rows[0];
  if (notify?.email_enabled) {
    await sendIncidentEmail({ to: notify.email_address, websiteName: notify.website_name, kind: 'resolved' });
  }
```

- [ ] **Step 6: Re-run the monitor service tests to confirm no regression**

```bash
npx vitest run src/services/monitor.service.test.ts
```

Expected: 3 tests still PASS (SMTP_HOST is unset in that test's environment, so `sendIncidentEmail` no-ops silently per Step 3's guard).

- [ ] **Step 7: Commit**

```bash
git add server/src/services/email.service.ts server/src/services/email.service.test.ts server/src/services/monitor.service.ts
git commit -m "feat: send email notifications on incident creation and resolution"
```

---

### Task 11: Frontend API client

**Files:**
- Create: `src/api.ts`
- Test: manual (verified via later frontend wiring tasks; this codebase has no existing frontend test setup, matching current project conventions)

**Interfaces:**
- Produces: `api.auth.register`, `api.auth.login`, `api.auth.logout`, `api.auth.me`, `api.websites.list/create/update/remove/toggleStatus`, `api.incidents.list/acknowledge/resolve`, `api.notifications.get/update`, `api.settings.get/update` — all typed against the existing `src/types.ts` interfaces, all using `fetch` with `credentials: 'include'` so the JWT cookie is sent.

- [ ] **Step 1: Create `src/api.ts`**

```typescript
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import {
  UserSession,
  Website,
  Incident,
  NotificationSettings,
  WorkspaceSettings,
} from './types';

const API_BASE = import.meta.env.VITE_API_BASE || 'http://localhost:4000/api';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
    ...options,
  });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.error || `Request failed: ${res.status}`);
  }
  return res.json();
}

export const api = {
  auth: {
    register: (email: string, password: string, username: string) =>
      request<{ user: UserSession }>('/auth/register', { method: 'POST', body: JSON.stringify({ email, password, username }) }),
    login: (email: string, password: string) =>
      request<{ user: UserSession }>('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) }),
    logout: () => request<{ ok: true }>('/auth/logout', { method: 'POST' }),
    me: () => request<{ user: UserSession }>('/auth/me'),
  },
  websites: {
    list: () => request<{ websites: Website[] }>('/websites'),
    create: (data: Omit<Website, 'id' | 'responseTimeHistory' | 'lastChecked' | 'uptime24h' | 'uptime30d' | 'responseTime'>) =>
      request<{ website: Website }>('/websites', { method: 'POST', body: JSON.stringify(data) }),
    update: (id: string, data: Partial<Website>) =>
      request<{ website: Website }>(`/websites/${id}`, { method: 'PUT', body: JSON.stringify(data) }),
    remove: (id: string) => request<{ ok: true }>(`/websites/${id}`, { method: 'DELETE' }),
    toggleStatus: (id: string) => request<{ website: Website }>(`/websites/${id}/toggle-status`, { method: 'POST' }),
  },
  incidents: {
    list: () => request<{ incidents: Incident[] }>('/incidents'),
    acknowledge: (id: string) => request<{ incident: Incident }>(`/incidents/${id}/acknowledge`, { method: 'POST' }),
    resolve: (id: string) => request<{ incident: Incident }>(`/incidents/${id}/resolve`, { method: 'POST' }),
  },
  notifications: {
    get: () => request<{ notifications: NotificationSettings }>('/notifications'),
    update: (data: NotificationSettings) =>
      request<{ notifications: NotificationSettings }>('/notifications', { method: 'PUT', body: JSON.stringify(data) }),
  },
  settings: {
    get: () => request<{ settings: WorkspaceSettings }>('/settings'),
    update: (data: WorkspaceSettings) =>
      request<{ settings: WorkspaceSettings }>('/settings', { method: 'PUT', body: JSON.stringify(data) }),
  },
};
```

- [ ] **Step 2: Add `VITE_API_BASE` to a frontend env file**

Create `.env.local` at the repo root (do not commit — it should already be covered by `.gitignore`; if not, add `.env.local` to the root `.gitignore`):

```
VITE_API_BASE=http://localhost:4000/api
```

- [ ] **Step 3: Verify it type-checks**

```bash
npm run lint
```

Expected: no errors (this file is not yet imported anywhere, so this just confirms it compiles standalone).

- [ ] **Step 4: Commit**

```bash
git add src/api.ts .gitignore
git commit -m "feat: add typed frontend API client for the real backend"
```

---

### Task 12: Wire App.tsx to the real API and remove playground handlers

**Files:**
- Modify: `src/App.tsx`
- Modify: `src/components/LoginView.tsx`

**Interfaces:**
- Consumes: `api` from `src/api.ts` (Task 11).
- Removes: `handleInjectIncident`, `handleTriggerPingTest`, and the mock `setTimeout`-based login in `LoginView.tsx`, per spec section "Monitoring engine" (playground controls removed) and "Authentication" (real login call).

- [ ] **Step 1: Replace domain state in `src/App.tsx` to load from the API instead of localStorage**

Replace the import block (current lines 6-22) with:

```typescript
import React, { useState, useEffect } from 'react';
import {
  UserSession,
  Website,
  Incident,
  NotificationSettings,
  WorkspaceSettings,
  ViewType
} from './types';
import { api } from './api';
import { usePersistentState } from './hooks/usePersistentState';
```

Replace the state declarations (current lines 36-45) with:

```typescript
  const [user, setUser] = useState<UserSession | null>(null);
  const [authChecked, setAuthChecked] = useState(false);
  const [websites, setWebsites] = useState<Website[]>([]);
  const [incidents, setIncidents] = useState<Incident[]>([]);
  const [notifications, setNotifications] = useState<NotificationSettings | null>(null);
  const [settings, setSettings] = useState<WorkspaceSettings | null>(null);
  const [currentView, setCurrentView] = usePersistentState<ViewType>('current_view', 'dashboard');
  const [selectedWebsiteId, setSelectedWebsiteId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  // On mount, check for an existing session and load domain data if present
  useEffect(() => {
    api.auth
      .me()
      .then(({ user }) => setUser(user))
      .catch(() => setUser(null))
      .finally(() => setAuthChecked(true));
  }, []);

  useEffect(() => {
    if (!user) return;
    api.websites.list().then(({ websites }) => setWebsites(websites));
    api.incidents.list().then(({ incidents }) => setIncidents(incidents));
    api.notifications.get().then(({ notifications }) => setNotifications(notifications));
    api.settings.get().then(({ settings }) => setSettings(settings));
  }, [user]);
```

- [ ] **Step 2: Replace the mutator handlers to call the API**

Replace `handleLoginSuccess` through `handleToggleStatus` (current lines 67-145) with:

```typescript
  const handleLoginSuccess = (session: UserSession) => {
    setUser(session);
    setCurrentView('dashboard');
  };

  const handleLogout = async () => {
    await api.auth.logout();
    setUser(null);
    setWebsites([]);
    setIncidents([]);
    setCurrentView('login');
  };

  const handleNavigateToView = (view: ViewType, extraData?: any) => {
    if (view === 'details' && extraData) {
      setSelectedWebsiteId(extraData);
    }
    setCurrentView(view);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleAddWebsite = async (newWeb: Omit<Website, 'id' | 'responseTimeHistory' | 'lastChecked'>) => {
    const { website } = await api.websites.create(newWeb);
    setWebsites([website, ...websites]);
  };

  const handleEditWebsite = async (updatedWeb: Website) => {
    const { website } = await api.websites.update(updatedWeb.id, updatedWeb);
    setWebsites(websites.map((w) => (w.id === website.id ? website : w)));
  };

  const handleDeleteWebsite = async (id: string) => {
    await api.websites.remove(id);
    setWebsites(websites.filter((w) => w.id !== id));
    setIncidents(incidents.filter((i) => i.websiteId !== id));
    if (selectedWebsiteId === id) {
      setSelectedWebsiteId(null);
      if (currentView === 'details') {
        setCurrentView('inventory');
      }
    }
  };

  const handleToggleStatus = async (id: string) => {
    const { website } = await api.websites.toggleStatus(id);
    setWebsites(websites.map((w) => (w.id === id ? website : w)));
  };

  const handleAcknowledgeIncident = async (id: string) => {
    const { incident } = await api.incidents.acknowledge(id);
    setIncidents(incidents.map((i) => (i.id === id ? incident : i)));
  };

  const handleResolveIncident = async (id: string) => {
    const { incident } = await api.incidents.resolve(id);
    setIncidents(incidents.map((i) => (i.id === id ? incident : i)));
    const { websites: refreshed } = await api.websites.list();
    setWebsites(refreshed);
  };
```

- [ ] **Step 3: Delete the playground handlers entirely**

Delete the current `handleInjectIncident` block (comment `// 7. Inject Incident (Playground Crash simulation)` through the end of that function) and the current `handleTriggerPingTest` block (comment `// 8. Manual Diagnostic ping checking` through the end of that function) — these no longer exist anywhere in `App.tsx` after this step.

- [ ] **Step 4: Update save handlers for notifications/settings to call the API**

Find the `case 'notifications':` and `case 'settings':` branches inside `renderView()` and replace `onSaveNotifications={setNotifications}` / `onSaveSettings={setSettings}` with:

```typescript
      case 'notifications':
        return (
          <NotificationsView
            notifications={notifications!}
            onSaveNotifications={async (n) => {
              const { notifications: updated } = await api.notifications.update(n);
              setNotifications(updated);
            }}
          />
        );
      case 'settings':
        return (
          <SettingsView
            settings={settings!}
            onSaveSettings={async (s) => {
              const { settings: updated } = await api.settings.update(s);
              setSettings(updated);
            }}
          />
        );
```

- [ ] **Step 5: Remove the `onInjectIncident` and `onTriggerPingTest` props from the render calls**

In the `case 'incidents':` branch, remove the `onInjectIncident={handleInjectIncident}` line from the `<IncidentsView>` props.
In the `case 'details':` branch, remove the `onTriggerPingTest={handleTriggerPingTest}` line from the `<DetailsView>` props.

- [ ] **Step 6: Guard rendering until auth check and domain data have loaded**

Replace the current login guard (`if (!user) { return <LoginView ... />; }`) with:

```typescript
  if (!authChecked) {
    return null;
  }

  if (!user) {
    return <LoginView onLoginSuccess={handleLoginSuccess} />;
  }

  if (!notifications || !settings) {
    return null;
  }
```

- [ ] **Step 7: Update `src/components/LoginView.tsx` to call the real API**

Replace the import block and `handleSubmit` in `src/components/LoginView.tsx`:

```typescript
import { api } from '../api';
```

Replace the body of `handleSubmit`:

```typescript
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, ingresa tu dirección de correo electrónico.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const { user } = await api.auth.login(email, password);
      onLoginSuccess(user);
    } catch {
      setError('Credenciales inválidas. Verifica tu correo y contraseña.');
    } finally {
      setLoading(false);
    }
  };
```

- [ ] **Step 8: Type-check**

```bash
npm run lint
```

Expected: no errors. Fix any remaining references to removed handlers (`handleInjectIncident`, `handleTriggerPingTest`) the compiler flags — they should only remain in the two files handled in Task 13.

- [ ] **Step 9: Commit**

```bash
git add src/App.tsx src/components/LoginView.tsx
git commit -m "feat: wire App.tsx and LoginView to real backend API, remove playground handlers"
```

---

### Task 13: Remove playground UI triggers from IncidentsView and DetailsView

**Files:**
- Modify: `src/components/IncidentsView.tsx`
- Modify: `src/components/DetailsView.tsx`

**Interfaces:**
- Consumes: nothing new — this task only deletes dead UI now that `onInjectIncident` / `onTriggerPingTest` are no longer passed in (Task 12, Step 5).

- [ ] **Step 1: Remove the simulator from `IncidentsView.tsx`**

Remove `onInjectIncident` from the `IncidentsViewProps` interface (line 28) and from the destructured props (line 36).

Remove these pieces of local state (lines 47-52): `isInjecting`, `injectWebsiteId`, `injectTitle`, `injectSeverity`, `injectDescription`.

Remove the `handleInjectSubmit` function (lines 62-78).

Remove the "Simular Incidente / Fallo" button block (lines 102-109, the `<button id="btn-trigger-simulator">...</button>`).

Remove the entire "Simulator Modal Popup" block at the end of the file (from `{isInjecting && (` through its matching closing `)}`, lines 296-392).

Update the empty-state hint text (line 290) from `"Intenta cambiar los filtros o simula un nuevo fallo arriba."` to `"Intenta cambiar los filtros de búsqueda."` since there's no longer a simulator to reference.

- [ ] **Step 2: Remove the manual ping test from `DetailsView.tsx`**

Remove `onTriggerPingTest` from the `DetailsViewProps` interface (line 32) and from the destructured props (line 41).

Remove the `testing` and `testResult` state (lines 42-43) and the `handleTestNow` function (lines 50-66), including its call to `onTriggerPingTest`.

Find wherever `handleTestNow`, `testing`, or `testResult` are referenced further down in the JSX (the "Probar Ahora" / diagnostic button and its result display) and remove that button and result block entirely.

- [ ] **Step 3: Type-check**

```bash
npm run lint
```

Expected: no errors, and no remaining references to `onInjectIncident`, `onTriggerPingTest`, `isInjecting`, `handleInjectSubmit`, `handleTestNow`, `testing`, `testResult` anywhere in `src/`.

```bash
grep -rn "onInjectIncident\|onTriggerPingTest\|handleInjectSubmit\|handleTestNow" src/
```

Expected: no output.

- [ ] **Step 4: Manual UI verification**

```bash
npm run dev
```

Open the app in a browser, log in, navigate to Incidents — confirm there's no "Simular Incidente / Fallo" button. Navigate to a website's Details page — confirm there's no manual ping/test button. Stop the dev server after checking.

- [ ] **Step 5: Commit**

```bash
git add src/components/IncidentsView.tsx src/components/DetailsView.tsx
git commit -m "chore: remove playground incident simulator and manual ping test UI"
```

---

### Task 14: Registration flow in the UI

**Files:**
- Modify: `src/components/LoginView.tsx`

**Interfaces:**
- Consumes: `api.auth.register` (Task 11).

- [ ] **Step 1: Add a register/login mode toggle to `LoginView.tsx`**

Add state near the existing `useState` calls:

```typescript
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [username, setUsername] = useState('');
```

Update `handleSubmit` to branch on `mode`:

```typescript
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      setError('Por favor, ingresa tu dirección de correo electrónico.');
      return;
    }
    setError('');
    setLoading(true);

    try {
      const { user } = mode === 'register'
        ? await api.auth.register(email, password, username || email.split('@')[0])
        : await api.auth.login(email, password);
      onLoginSuccess(user);
    } catch (err) {
      setError(mode === 'register'
        ? 'No se pudo crear la cuenta. El correo puede estar ya registrado.'
        : 'Credenciales inválidas. Verifica tu correo y contraseña.');
    } finally {
      setLoading(false);
    }
  };
```

Add a toggle link/button below the form (in the existing JSX, near the submit button) and a username input shown only when `mode === 'register'`:

```typescript
        {mode === 'register' && (
          <input
            type="text"
            placeholder="Nombre completo"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm focus:outline-hidden focus:border-indigo-500 focus:bg-white"
          />
        )}
```

```typescript
        <button
          type="button"
          onClick={() => setMode(mode === 'login' ? 'register' : 'login')}
          className="text-xs text-indigo-600 hover:underline"
        >
          {mode === 'login' ? '¿No tenés cuenta? Registrate' : '¿Ya tenés cuenta? Iniciá sesión'}
        </button>
```

Exact placement within the existing JSX structure is left to match the current form's layout — insert the username field directly above the email field when `mode === 'register'`, and the toggle button directly below the submit button.

- [ ] **Step 2: Type-check**

```bash
npm run lint
```

Expected: no errors.

- [ ] **Step 3: Manual verification**

```bash
npm run dev
```

In the browser: click the register toggle, fill in a new email/password/username, submit — confirm it logs you into the dashboard. Log out, then log back in with the same credentials — confirm it succeeds. Stop the dev server.

- [ ] **Step 4: Commit**

```bash
git add src/components/LoginView.tsx
git commit -m "feat: add registration mode to LoginView"
```

---

### Task 15: VPS deployment configuration

**Files:**
- Create: `server/ecosystem.config.cjs`
- Create: `docs/deployment.md`

**Interfaces:**
- None — this task produces operational configuration and documentation, not code consumed by other tasks.

- [ ] **Step 1: Create `server/ecosystem.config.cjs`**

```javascript
module.exports = {
  apps: [
    {
      name: 'monitorpro-api',
      cwd: __dirname,
      script: 'dist/index.js',
      env: {
        NODE_ENV: 'production',
      },
      instances: 1,
      autorestart: true,
      max_restarts: 10,
    },
  ],
};
```

- [ ] **Step 2: Create `docs/deployment.md`**

```markdown
# Deploying MonitorPro to the Hostinger VPS

## One-time server setup

1. Install Node.js (20+), PostgreSQL, Nginx, and PM2 on the VPS.
2. Create the database and user:
   ```bash
   sudo -u postgres createuser monitorpro --pwprompt
   sudo -u postgres createdb monitorpro -O monitorpro
   ```
3. Clone the repo, then in `server/`:
   ```bash
   npm install
   cp .env.example .env   # fill in DATABASE_URL, JWT_SECRET, SMTP_*, FRONTEND_ORIGIN
   npm run build
   node dist/migrate.js
   pm2 start ecosystem.config.cjs
   pm2 save
   pm2 startup
   ```
4. Build the frontend and serve it as static files via Nginx:
   ```bash
   npm install
   VITE_API_BASE=https://your-domain.com/api npm run build
   ```
   Point Nginx's document root at the generated `dist/` folder.
5. Configure Nginx to reverse-proxy `/api/*` to `http://localhost:4000` and serve the frontend `dist/` for everything else. Issue a TLS certificate with Certbot:
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

## Redeploys

```bash
git pull
cd server && npm install && npm run build && pm2 restart monitorpro-api
cd .. && npm install && VITE_API_BASE=https://your-domain.com/api npm run build
```
```

- [ ] **Step 3: Commit**

```bash
git add server/ecosystem.config.cjs docs/deployment.md
git commit -m "docs: add PM2 config and VPS deployment guide"
```

---

## Self-Review Notes

- **Spec coverage:** architecture (Task 1, 9), data model (Task 2), auth (Task 3, 14), websites/incidents/settings APIs (Tasks 4, 5, 7), uptime computation (Task 6), monitoring engine incl. retry/create/resolve (Task 8), cron scheduling (Task 9), email notifications (Task 10), frontend integration and playground removal (Tasks 11-13), deployment (Task 15) — every spec section maps to at least one task.
- **Type consistency checked:** `Website`/`Incident`/`NotificationSettings`/`WorkspaceSettings` DTO shapes in Tasks 4/5/6/7 match `src/types.ts` field names exactly (camelCase) so `src/api.ts` (Task 11) and `App.tsx` (Task 12) can consume them without adapters. `checkWebsite`'s signature defined in Task 8 is reused verbatim by Task 9's scheduler.
- **No placeholders:** every step has literal, runnable code or exact shell commands with expected output.
