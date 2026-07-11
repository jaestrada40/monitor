import type { RequestHandler } from 'express';
import { pool } from '../db.js';
import { asyncHandler } from './asyncHandler.js';

export function requireRole(allowedRoles: string[]): RequestHandler {
  return asyncHandler(async (req, res, next) => {
    const result = await pool.query('SELECT role FROM users WHERE id = $1', [req.userId]);
    const role = result.rows[0]?.role;
    if (!role || !allowedRoles.includes(role)) {
      res.status(403).json({ error: 'forbidden' });
      return;
    }
    next();
  });
}
