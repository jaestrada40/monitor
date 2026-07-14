import dns from 'dns/promises';

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
