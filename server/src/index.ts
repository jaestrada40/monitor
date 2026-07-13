import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.routes.js';
import { websitesRouter } from './routes/websites.routes.js';
import { incidentsRouter } from './routes/incidents.routes.js';
import { settingsRouter } from './routes/settings.routes.js';
import { adminRouter } from './routes/admin.routes.js';
import { reportsRouter } from './routes/reports.routes.js';
import { startScheduler } from './services/scheduler.js';
import { startReportScheduler } from './services/reportScheduler.js';
import { seedAdminIfNeeded } from './seed.js';
import { pool } from './db.js';

dotenv.config();

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled promise rejection:', reason);
});

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));
// Raised from the 100kb default to fit small base64 avatar uploads (capped separately
// per-field in the avatar route).
app.use(express.json({ limit: '1mb' }));
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/websites', websitesRouter);
app.use('/api/incidents', incidentsRouter);
app.use('/api', settingsRouter);
app.use('/api/admin/users', adminRouter);
app.use('/api/reports', reportsRouter);

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('Unhandled route error:', err);
  if (!res.headersSent) {
    res.status(500).json({ error: 'internal_server_error' });
  }
});

const port = Number(process.env.PORT) || 4000;

async function start() {
  await seedAdminIfNeeded(pool);

  startScheduler(pool);
  startReportScheduler(pool);

  app.listen(port, () => {
    console.log(`MonitorPro API listening on port ${port}`);
  });
}

start().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
