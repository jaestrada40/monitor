import dns from 'dns/promises';
import dnsCallback from 'dns';
import http from 'http';
import https from 'https';

// Blocks SSRF: a monitored URL is fetched server-side (both by plain fetch and by a
// headless browser), so without this a user could register http://127.0.0.1, an internal
// service, or a cloud metadata endpoint (169.254.169.254) and have the server request it
// on their behalf. Checked both at registration time and again at check time, since a
// hostname's DNS could change between the two (DNS rebinding).

function ipv4ToLong(ip: string): number | null {
  const parts = ip.split('.');
  if (parts.length !== 4) return null;
  let result = 0;
  for (const part of parts) {
    const n = Number(part);
    if (!Number.isInteger(n) || n < 0 || n > 255) return null;
    result = (result << 8) | n;
  }
  return result >>> 0;
}

function inCidr(ip: string, cidr: string): boolean {
  const [range, bitsStr] = cidr.split('/');
  const bits = Number(bitsStr);
  const ipLong = ipv4ToLong(ip);
  const rangeLong = ipv4ToLong(range);
  if (ipLong === null || rangeLong === null) return false;
  const mask = bits === 0 ? 0 : (~0 << (32 - bits)) >>> 0;
  return (ipLong & mask) === (rangeLong & mask);
}

const BLOCKED_IPV4_CIDRS = [
  '0.0.0.0/8',
  '10.0.0.0/8',
  '100.64.0.0/10', // carrier-grade NAT
  '127.0.0.0/8', // loopback
  '169.254.0.0/16', // link-local — includes cloud metadata (169.254.169.254)
  '172.16.0.0/12',
  '192.0.0.0/24',
  '192.0.2.0/24', // documentation
  '192.168.0.0/16',
  '198.18.0.0/15',
  '198.51.100.0/24', // documentation
  '203.0.113.0/24', // documentation
  '224.0.0.0/4', // multicast
  '240.0.0.0/4', // reserved
];

function isBlockedIpv4(ip: string): boolean {
  return BLOCKED_IPV4_CIDRS.some((cidr) => inCidr(ip, cidr));
}

function isBlockedIpv6(ip: string): boolean {
  const lower = ip.toLowerCase();
  if (lower === '::1' || lower === '::') return true;
  if (lower.startsWith('fe80:') || lower.startsWith('fe8') || lower.startsWith('fe9') || lower.startsWith('fea') || lower.startsWith('feb')) return true; // link-local
  if (lower.startsWith('fc') || lower.startsWith('fd')) return true; // unique local
  // IPv4-mapped IPv6 (::ffff:a.b.c.d) — check the embedded IPv4 address too.
  const mapped = lower.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isBlockedIpv4(mapped[1]);
  return false;
}

function isBlockedIp(ip: string): boolean {
  return ip.includes(':') ? isBlockedIpv6(ip) : isBlockedIpv4(ip);
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnsafeUrlError';
  }
}

// Throws if the URL is malformed, uses a non-HTTP(S) scheme, or resolves to a
// private/reserved/loopback/link-local address.
export async function assertSafeUrl(rawUrl: string): Promise<void> {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    throw new UnsafeUrlError('invalid_url');
  }

  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
    throw new UnsafeUrlError('unsupported_scheme');
  }

  const hostname = parsed.hostname;

  // A bracketed literal IPv6 or a bare IPv4 literal — check directly, no DNS lookup needed.
  const literalIp = hostname.replace(/^\[|\]$/g, '');
  if (ipv4ToLong(literalIp) !== null || literalIp.includes(':')) {
    if (isBlockedIp(literalIp)) throw new UnsafeUrlError('blocked_address');
    return;
  }

  if (hostname.toLowerCase() === 'localhost') {
    throw new UnsafeUrlError('blocked_address');
  }

  let addresses;
  try {
    addresses = await dns.lookup(hostname, { all: true });
  } catch {
    throw new UnsafeUrlError('dns_resolution_failed');
  }

  if (addresses.length === 0 || addresses.some((a) => isBlockedIp(a.address))) {
    throw new UnsafeUrlError('blocked_address');
  }
}

// Passed as the `lookup` option to http(s)/tls connect calls below. Critically, the
// address this returns is the *exact* address the socket then connects to — there's no
// second DNS resolution afterward, so a DNS-rebinding attacker can't have this call
// validate a public IP and have the actual connection land on a different (private) one.
// This is what actually closes the TOCTOU gap; assertSafeUrl above is only a fast
// early-rejection pass with a clearer error, not the real guarantee.
export function createPinnedLookup() {
  return (hostname: string, options: dnsCallback.LookupOneOptions, callback: (err: NodeJS.ErrnoException | null, address: string, family: number) => void) => {
    dnsCallback.lookup(hostname, { all: true }, (err, addresses) => {
      if (err) {
        callback(err, '', 4);
        return;
      }
      const list = addresses as dnsCallback.LookupAddress[];
      const safe = list.find((a) => !isBlockedIp(a.address));
      if (!safe) {
        callback(new UnsafeUrlError('blocked_address'), '', 4);
        return;
      }
      callback(null, safe.address, safe.family);
    });
  };
}

const REDIRECT_STATUS_CODES = new Set([301, 302, 303, 307, 308]);
const MAX_REDIRECTS = 5;
const MAX_RESPONSE_BYTES = 2_000_000;

export interface SafeHttpResponse {
  statusCode: number;
  body: string;
}

// Replaces fetch() for any user-supplied URL: fetch() follows redirects transparently,
// which would let a public site 302 the request to an internal address after the initial
// URL already passed validation. Each redirect hop is re-validated (scheme, literal IP,
// hostname resolution) before being followed, and every actual connection uses the
// pinned lookup above.
export function safeRequest(
  rawUrl: string,
  opts: { method?: string; headers?: Record<string, string>; timeoutMs?: number } = {}
): Promise<SafeHttpResponse> {
  return new Promise((resolve, reject) => {
    let redirects = 0;

    const attempt = async (currentUrl: string) => {
      try {
        await assertSafeUrl(currentUrl);
      } catch (err) {
        reject(err);
        return;
      }

      const parsed = new URL(currentUrl);
      const lib = parsed.protocol === 'https:' ? https : http;
      const req = lib.request(
        currentUrl,
        {
          method: opts.method || 'GET',
          headers: opts.headers,
          timeout: opts.timeoutMs ?? 10000,
          lookup: createPinnedLookup() as unknown as typeof dnsCallback.lookup,
        },
        (res) => {
          const location = res.headers.location;
          if (location && REDIRECT_STATUS_CODES.has(res.statusCode ?? 0)) {
            res.resume(); // discard body, we're not using it
            redirects += 1;
            if (redirects > MAX_REDIRECTS) {
              reject(new UnsafeUrlError('too_many_redirects'));
              return;
            }
            let nextUrl: string;
            try {
              nextUrl = new URL(location, currentUrl).toString();
            } catch {
              reject(new UnsafeUrlError('invalid_redirect_location'));
              return;
            }
            attempt(nextUrl);
            return;
          }

          let body = '';
          let byteLength = 0;
          res.on('data', (chunk: Buffer) => {
            byteLength += chunk.length;
            if (byteLength > MAX_RESPONSE_BYTES) {
              req.destroy();
              return;
            }
            body += chunk.toString('utf8');
          });
          res.on('end', () => resolve({ statusCode: res.statusCode ?? 0, body }));
        }
      );
      req.on('timeout', () => req.destroy(new Error('request_timeout')));
      req.on('error', (err) => reject(err));
      req.end();
    };

    attempt(rawUrl);
  });
}
