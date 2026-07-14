import http from 'http';
import net from 'net';
import { pinnedResolve } from './ssrf-guard.js';

// Chromium (via Playwright) does its own DNS resolution internally — there's no public
// API to pin its connections the way createPinnedLookup does for fetch()/tls in
// ssrf-guard.ts. Instead, every request the browser makes is routed through this small
// local forward proxy, which does the pinned resolution itself and opens the actual
// socket to that exact address. Chromium never resolves DNS or connects directly, so a
// DNS-rebinding response after the initial page load can't land it on a private address.

let server: http.Server | null = null;
let boundPort: number | null = null;

function isSafePort(port: number): boolean {
  return Number.isInteger(port) && port > 0 && port <= 65535;
}

// HTTPS: browser sends `CONNECT host:port` and then tunnels an opaque (encrypted) stream
// through the two spliced sockets — we never see the decrypted traffic, only the address
// we're connecting the tunnel to.
function handleConnect(req: http.IncomingMessage, clientSocket: net.Socket, head: Buffer) {
  const [host, portStr] = (req.url ?? '').split(':');
  const port = Number(portStr) || 443;
  if (!host || !isSafePort(port)) {
    clientSocket.destroy();
    return;
  }

  pinnedResolve(host)
    .then(({ address }) => {
      const upstream = net.connect(port, address, () => {
        clientSocket.write('HTTP/1.1 200 Connection Established\r\n\r\n');
        upstream.write(head);
        upstream.pipe(clientSocket);
        clientSocket.pipe(upstream);
      });
      upstream.on('error', () => clientSocket.destroy());
    })
    .catch(() => clientSocket.destroy());
  clientSocket.on('error', () => { /* client hung up — nothing to do */ });
}

// Plain HTTP: Chromium sends an absolute-URI request line (proxy convention) instead of
// a CONNECT — resolve+pin the target the same way, then forward the request verbatim.
function handleHttpRequest(req: http.IncomingMessage, res: http.ServerResponse) {
  let target: URL;
  try {
    target = new URL(req.url ?? '');
  } catch {
    res.writeHead(400).end();
    return;
  }
  if (target.protocol !== 'http:') {
    res.writeHead(400).end();
    return;
  }

  pinnedResolve(target.hostname)
    .then(({ address }) => {
      const upstreamReq = http.request(
        {
          host: address,
          port: target.port || 80,
          method: req.method,
          path: `${target.pathname}${target.search}`,
          headers: req.headers,
        },
        (upstreamRes) => {
          res.writeHead(upstreamRes.statusCode ?? 502, upstreamRes.headers);
          upstreamRes.pipe(res);
        }
      );
      upstreamReq.on('error', () => res.destroy());
      req.pipe(upstreamReq);
    })
    .catch(() => res.destroy());
}

// Started once and reused for every browser check (like the shared Chromium instance) —
// binds to loopback only, so nothing outside this container can reach it.
export async function getBrowserProxyUrl(): Promise<string> {
  if (server && boundPort) {
    return `http://127.0.0.1:${boundPort}`;
  }

  server = http.createServer(handleHttpRequest);
  server.on('connect', handleConnect);

  await new Promise<void>((resolve, reject) => {
    server!.once('error', reject);
    server!.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    throw new Error('Failed to bind browser proxy');
  }
  boundPort = address.port;
  return `http://127.0.0.1:${boundPort}`;
}
