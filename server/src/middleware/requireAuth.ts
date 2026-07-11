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
