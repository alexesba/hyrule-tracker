// Optional web server for other devices on the local network (a phone or tablet next to the TV).
// Serves the built UI (dist/) and a small API the browser version of window.tracker talks to:
//   GET  /api/events  server-sent events: state, player
//   POST /api/rpc     {"method": "...", "args": [...]} -> {"result": ...}; only the methods passed in `rpc`
// On by default (settings.lan). No Electron imports, so it can be tested with plain Node.
import { execFile } from 'node:child_process';
import http from 'node:http';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export type RpcHandler = (...args: unknown[]) => unknown;

export interface LanOptions {
  /** Folder with the built UI (index.html and its assets). */
  root: string;
  port: number;
  /** Address to listen on (default: every interface). */
  host?: string;
  /** Optional URL path prefix, including its leading and trailing slashes. */
  basePath?: string;
  /** What remote pages may call, by method name. Anything else is refused. */
  rpc: Record<string, RpcHandler>;
  /** Told each finished request (method, path without the base path, status), for a log. */
  onRequest?: (line: string) => void;
}

export interface LanServer {
  port: number;
  /** Sends an event to every connected page. */
  broadcast(event: string, data: unknown): void;
  /** How many pages are connected right now. */
  clients(): number;
  close(): Promise<void>;
}

const TYPES: Record<string, string> = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.json': 'application/json', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg', '.ico': 'image/x-icon', '.woff2': 'font/woff2', '.woff': 'font/woff', '.txt': 'text/plain; charset=utf-8',
  '.map': 'application/json',
};
const MAX_BODY = 256 * 1024;

/**
 * Host header a request may carry: an IP address, localhost, or a local name (no dots, .local, .lan, .home,
 * .internal). Anything else (a public domain) is refused, so a web page can't reach the tracker through DNS rebinding.
 */
export function allowedHost(host: string | undefined): boolean {
  if (!host) return false;
  let name: string;
  try { name = new URL(`http://${host}`).hostname.toLowerCase(); } catch { return false; }
  if (name.startsWith('[') && name.endsWith(']')) return true; // IPv6 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(name)) return true;
  if (name === 'localhost' || !name.includes('.')) return true;
  return /\.(local|lan|home|internal|home\.arpa)$/.test(name);
}

/** http://<address>:<port>/ for each IPv4 address of this PC on a network (not loopback). */
export function lanUrls(port: number, interfaces = os.networkInterfaces()): string[] {
  const urls: string[] = [];
  for (const list of Object.values(interfaces)) {
    for (const a of list ?? []) {
      if (a.internal || (a.family !== 'IPv4' && (a.family as unknown) !== 4)) continue;
      if (a.address.startsWith('169.254.')) continue; // link-local: no real network behind it
      urls.push(`http://${a.address}:${port}/`);
    }
  }
  // Home networks first (192.168.x, then 10.x); 172.16-31.x is often a virtual adapter (WSL, Hyper-V, Docker).
  const rank = (u: string) => u.startsWith('http://192.168.') ? 0 : u.startsWith('http://10.') ? 1 : 2;
  return [...new Set(urls)].sort((a, b) => rank(a) - rank(b));
}

/**
 * Names of the Windows networks this PC is on that are set to Public, from Get-NetConnectionProfile as JSON.
 * Windows Firewall blocks the tracker on those, even after the user allowed it on private networks.
 * NetworkCategory: 0 Public, 1 Private, 2 DomainAuthenticated.
 */
export function publicNetworkNames(json: string): string[] {
  let list: unknown;
  try { list = JSON.parse(json); } catch { return []; }
  if (!Array.isArray(list)) list = list && typeof list === 'object' ? [list] : [];
  const names: string[] = [];
  for (const p of list as Record<string, unknown>[]) {
    if (!p || (p.NetworkCategory !== 0 && p.NetworkCategory !== 'Public')) continue;
    const name = typeof p.Name === 'string' && p.Name.trim() ? p.Name.trim() : typeof p.InterfaceAlias === 'string' ? p.InterfaceAlias : '';
    if (name) names.push(name);
  }
  return [...new Set(names)];
}

/** Networks set to Public on this PC (Windows only; empty elsewhere or if PowerShell can't tell). */
export function findPublicNetworks(): Promise<string[]> {
  if (process.platform !== 'win32') return Promise.resolve([]);
  const script = 'ConvertTo-Json -Compress -InputObject @(Get-NetConnectionProfile | Select-Object Name, InterfaceAlias, @{n="NetworkCategory";e={[int]$_.NetworkCategory}})';
  return new Promise(resolve => {
    execFile('powershell.exe', ['-NoProfile', '-NonInteractive', '-Command', script], { windowsHide: true, timeout: 8000 },
      (err, stdout) => resolve(err ? [] : publicNetworkNames(String(stdout))));
  });
}

function send(res: http.ServerResponse, status: number, body: string | Buffer, type = 'text/plain; charset=utf-8', extra: http.OutgoingHttpHeaders = {}) {
  res.writeHead(status, { 'Content-Type': type, 'X-Content-Type-Options': 'nosniff', 'Referrer-Policy': 'no-referrer', ...extra });
  res.end(body);
}

function readBody(req: http.IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => {
      size += c.length;
      if (size > MAX_BODY) { reject(new Error('too large')); req.destroy(); return; }
      chunks.push(c);
    });
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

export function startLanServer(opts: LanOptions): Promise<LanServer> {
  const root = path.resolve(opts.root);
  const streams = new Set<http.ServerResponse>();

  async function rpc(req: http.IncomingMessage, res: http.ServerResponse) {
    // A JSON body can't be sent cross-site without a CORS preflight, which this server never answers.
    if (!/^application\/json\b/i.test(req.headers['content-type'] ?? '')) return send(res, 415, 'JSON only');
    const origin = req.headers.origin;
    if (origin) {
      let ok = false;
      try { ok = new URL(origin).host === req.headers.host; } catch { /* bad origin */ }
      if (!ok) return send(res, 403, 'Forbidden');
    }
    let call: { method?: unknown; args?: unknown };
    try { call = JSON.parse(await readBody(req)); } catch { return send(res, 400, 'Bad request'); }
    const method = typeof call?.method === 'string' ? call.method : '';
    const handler = Object.hasOwn(opts.rpc, method) ? opts.rpc[method] : undefined;
    if (!handler) return send(res, 404, 'Unknown method');
    const args = Array.isArray(call.args) ? call.args : [];
    try {
      const result = await handler(...args);
      send(res, 200, JSON.stringify({ result: result ?? null }), 'application/json', { 'Cache-Control': 'no-store' });
    } catch {
      send(res, 500, 'Failed');
    }
  }

  function events(req: http.IncomingMessage, res: http.ServerResponse) {
    res.writeHead(200, { 'Content-Type': 'text/event-stream', 'Cache-Control': 'no-store', Connection: 'keep-alive', 'X-Content-Type-Options': 'nosniff' });
    res.write('retry: 2000\n\n');
    streams.add(res);
    req.on('close', () => streams.delete(res));
  }

  function file(req: http.IncomingMessage, res: http.ServerResponse, pathname: string) {
    if (req.method !== 'GET' && req.method !== 'HEAD') return send(res, 405, 'Method not allowed');
    let rel: string;
    try { rel = decodeURIComponent(pathname); } catch { return send(res, 400, 'Bad request'); }
    if (rel.endsWith('/')) rel += 'index.html';
    const full = path.resolve(root, '.' + rel);
    if (full !== root && !full.startsWith(root + path.sep)) return send(res, 403, 'Forbidden');
    fs.readFile(full, (err, data) => {
      if (err) return send(res, 404, 'Not found');
      const ext = path.extname(full).toLowerCase();
      const cache = ext === '.html' ? 'no-cache' : 'max-age=3600';
      send(res, 200, req.method === 'HEAD' ? '' : data, TYPES[ext] ?? 'application/octet-stream', { 'Cache-Control': cache });
    });
  }

  const server = http.createServer((req, res) => {
    // The base path is the page's secret: the log gets the path after it.
    let logged = '?';
    if (opts.onRequest) res.once('finish', () => opts.onRequest!(`${req.method} ${logged} ${res.statusCode}${res.statusCode === 421 ? ` (host ${req.headers.host})` : ''}`));
    if (!allowedHost(req.headers.host)) return send(res, 421, 'Misdirected request');
    let pathname: string;
    try { pathname = new URL(req.url ?? '/', 'http://x').pathname; } catch { return send(res, 400, 'Bad request'); }
    if (opts.basePath) {
      if (!pathname.startsWith(opts.basePath)) return send(res, 404, 'Not found');
      pathname = pathname.slice(opts.basePath.length - 1);
    }
    logged = pathname;
    if (pathname === '/api/rpc') return req.method === 'POST' ? void rpc(req, res) : send(res, 405, 'Method not allowed');
    if (pathname === '/api/events') return req.method === 'GET' ? events(req, res) : send(res, 405, 'Method not allowed');
    file(req, res, pathname);
  });
  // Keep-alive pings so phones and proxies don't drop an idle event stream.
  const ping = setInterval(() => { for (const s of streams) s.write(': ping\n\n'); }, 25_000);
  ping.unref();

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(opts.port, opts.host ?? '0.0.0.0', () => {
      server.off('error', reject);
      server.on('error', () => { /* runtime socket errors: keep serving */ });
      const address = server.address();
      resolve({
        port: typeof address === 'object' && address ? address.port : opts.port,
        broadcast(event, data) {
          const msg = `event: ${event}\ndata: ${JSON.stringify(data ?? null)}\n\n`;
          for (const s of streams) s.write(msg);
        },
        clients: () => streams.size,
        close: () => new Promise<void>(done => {
          clearInterval(ping);
          for (const s of streams) s.end();
          streams.clear();
          server.close(() => done());
          server.closeAllConnections?.();
        }),
      });
    });
  });
}
