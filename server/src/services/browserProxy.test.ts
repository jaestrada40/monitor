import { describe, it, expect, vi, afterEach } from 'vitest';
import http from 'http';
import net from 'net';

const pinnedResolveMock = vi.fn();
vi.mock('./ssrf-guard.js', () => ({
  pinnedResolve: (...args: unknown[]) => pinnedResolveMock(...args),
}));

const { getBrowserProxyUrl } = await import('./browserProxy.js');

function listenOnRandomPort(server: net.Server | http.Server): Promise<number> {
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve(typeof address === 'object' && address ? address.port : 0);
    });
  });
}

describe('browserProxy', () => {
  afterEach(() => {
    pinnedResolveMock.mockReset();
  });

  it('tunnels a CONNECT request to the address pinnedResolve returns', async () => {
    // Stands in for the "real" target the browser wants to reach — pinnedResolve is
    // mocked to point at it, simulating a hostname that resolved safely.
    const target = net.createServer((socket) => {
      socket.on('data', (data) => socket.write(`echo:${data}`));
    });
    const targetPort = await listenOnRandomPort(target);
    pinnedResolveMock.mockResolvedValue({ address: '127.0.0.1', family: 4 });

    const proxyUrl = await getBrowserProxyUrl();
    const proxy = new URL(proxyUrl);

    const received = await new Promise<string>((resolve, reject) => {
      const socket = net.connect(Number(proxy.port), proxy.hostname, () => {
        socket.write(`CONNECT some-host.example.com:${targetPort} HTTP/1.1\r\nHost: some-host.example.com\r\n\r\n`);
      });
      let buffer = '';
      socket.on('data', (chunk) => {
        buffer += chunk.toString();
        if (buffer.includes('200 Connection Established') && !buffer.includes('echo:')) {
          socket.write('hello');
          return;
        }
        if (buffer.includes('echo:')) {
          socket.end();
          resolve(buffer);
        }
      });
      socket.on('error', reject);
    });

    expect(received).toContain('200 Connection Established');
    expect(received).toContain('echo:hello');
    target.close();
  });

  it('destroys the client socket instead of connecting when pinnedResolve rejects (blocked address)', async () => {
    pinnedResolveMock.mockRejectedValue(new Error('blocked_address'));

    const proxyUrl = await getBrowserProxyUrl();
    const proxy = new URL(proxyUrl);

    const closed = await new Promise<boolean>((resolve) => {
      const socket = net.connect(Number(proxy.port), proxy.hostname, () => {
        socket.write('CONNECT 169.254.169.254:443 HTTP/1.1\r\nHost: 169.254.169.254\r\n\r\n');
      });
      let gotSuccessResponse = false;
      socket.on('data', (chunk) => {
        if (chunk.toString().includes('200 Connection Established')) gotSuccessResponse = true;
      });
      socket.on('close', () => resolve(!gotSuccessResponse));
      socket.on('error', () => {});
    });

    expect(closed).toBe(true);
  });

  it('forwards a plain HTTP proxy request to the address pinnedResolve returns', async () => {
    const target = http.createServer((_req, res) => res.end('ok-from-target'));
    const targetPort = await listenOnRandomPort(target);
    pinnedResolveMock.mockResolvedValue({ address: '127.0.0.1', family: 4 });

    const proxyUrl = await getBrowserProxyUrl();
    const proxy = new URL(proxyUrl);

    const body = await new Promise<string>((resolve, reject) => {
      // Proxy convention: `path` is the full absolute-URI of the real target, not just
      // the pathname — that's how the proxy knows which origin to forward to.
      const req = http.request(
        {
          host: proxy.hostname,
          port: proxy.port,
          method: 'GET',
          path: `http://some-host.example.com:${targetPort}/`,
        },
        (res) => {
          let data = '';
          res.on('data', (c) => (data += c));
          res.on('end', () => resolve(data));
        }
      );
      req.on('error', reject);
      req.end();
    });

    expect(body).toBe('ok-from-target');
    target.close();
  });
});
