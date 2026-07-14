import type { Request, Response, NextFunction } from 'express';
import { verifyToken } from '../services/auth.service.js';
import { pool } from '../db.js';

declare global {
  namespace Express {
    interface Request {
      userId?: string;
    }
  }
}

export async function requireAuth(req: Request, res: Response, next: NextFunction) {
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

  // Rejects tokens issued before a password change/MFA reset bumped the stored
  // version — otherwise a stolen token would stay valid for its full 7-day lifetime
  // even after the account owner "logs out" everywhere by changing their credentials.
  const result = await pool.query('SELECT token_version FROM users WHERE id = $1', [decoded.userId]);
  const currentVersion = result.rows[0]?.token_version;
  if (currentVersion === undefined || currentVersion !== decoded.tokenVersion) {
    res.status(401).json({ error: 'unauthorized' });
    return;
  }

  req.userId = decoded.userId;
  next();
}
