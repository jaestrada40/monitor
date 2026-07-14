import tls from 'node:tls';
import { createPinnedLookup } from './ssrf-guard.js';

export interface SslCheckResult {
  status: 'valid' | 'expiring' | 'expired' | 'none';
  expiryDays: number;
  issuer: string;
}

const NO_SSL_RESULT: SslCheckResult = { status: 'none', expiryDays: 0, issuer: '' };

export function classifySslExpiry(expiryDate: Date, now: Date, warnDays: number): { status: SslCheckResult['status']; expiryDays: number } {
  const expiryDays = Math.floor((expiryDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (expiryDays < 0) return { status: 'expired', expiryDays };
  if (expiryDays <= warnDays) return { status: 'expiring', expiryDays };
  return { status: 'valid', expiryDays };
}

// Opens a real TLS handshake against the site and inspects the certificate it actually
// presents — this is the only way to know true expiry/issuer, unlike a plain HTTP ping.
export async function checkSsl(url: string, warnDays: number): Promise<SslCheckResult> {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return NO_SSL_RESULT;
  }
  if (parsed.protocol !== 'https:') {
    return NO_SSL_RESULT;
  }

  return new Promise((resolve) => {
    let settled = false;
    const finish = (result: SslCheckResult) => {
      if (settled) return;
      settled = true;
      resolve(result);
    };

    const socket = tls.connect(
      {
        host: parsed.hostname,
        port: parsed.port ? Number(parsed.port) : 443,
        servername: parsed.hostname,
        // We want to inspect the certificate even if it's invalid/expired, not have
        // Node reject the connection before we can read it.
        rejectUnauthorized: false,
        timeout: 8000,
        // Same pinned-lookup guard as the plain HTTP check (ssrf-guard.ts) — the caller
        // (checkWebsite) already validated this URL, but pinning here too means the TLS
        // socket connects to exactly the address that was validated, not a second,
        // possibly-different DNS answer (rebinding).
        lookup: createPinnedLookup() as unknown as typeof import('dns').lookup,
      },
      () => {
        const cert = socket.getPeerCertificate();
        socket.end();
        if (!cert || !cert.valid_to) {
          finish(NO_SSL_RESULT);
          return;
        }
        const { status, expiryDays } = classifySslExpiry(new Date(cert.valid_to), new Date(), warnDays);
        const issuerField = cert.issuer?.O ?? cert.issuer?.CN ?? '';
        const issuer = Array.isArray(issuerField) ? issuerField[0] ?? '' : issuerField;
        finish({ status, expiryDays, issuer });
      }
    );
    socket.on('error', () => finish(NO_SSL_RESULT));
    socket.on('timeout', () => {
      socket.destroy();
      finish(NO_SSL_RESULT);
    });
  });
}
