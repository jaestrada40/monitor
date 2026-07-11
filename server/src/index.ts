import express from 'express';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import dotenv from 'dotenv';
import { authRouter } from './routes/auth.routes.js';
import { websitesRouter } from './routes/websites.routes.js';
import { incidentsRouter } from './routes/incidents.routes.js';

dotenv.config();

const app = express();
app.use(cors({ origin: process.env.FRONTEND_ORIGIN, credentials: true }));
app.use(express.json());
app.use(cookieParser());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.use('/api/auth', authRouter);
app.use('/api/websites', websitesRouter);
app.use('/api/incidents', incidentsRouter);

const port = Number(process.env.PORT) || 4000;
app.listen(port, () => {
  console.log(`MonitorPro API listening on port ${port}`);
});
