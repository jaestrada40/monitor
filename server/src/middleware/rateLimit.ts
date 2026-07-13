import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

// Keyed by IP + email so one person mistyping their password repeatedly doesn't lock out
// everyone else behind the same NAT/office IP, while still blocking a targeted brute force.
// ipKeyGenerator normalizes IPv6 addresses to their /64 prefix so a single user can't dodge
// the limit by cycling through addresses within their own subnet.
function keyByIpAndEmail(req: { ip?: string; body?: any }): string {
  const email = typeof req.body?.email === 'string' ? req.body.email.toLowerCase() : '';
  return `${ipKeyGenerator(req.ip ?? '')}:${email}`;
}

export const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIpAndEmail,
  message: { error: 'too_many_attempts' },
});

export const forgotPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 5,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: keyByIpAndEmail,
  message: { error: 'too_many_attempts' },
});

export const resetPasswordLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts' },
});

export const mfaVerifyLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 10,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'too_many_attempts' },
});
