import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import http from 'node:http';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { allowedHost, lanUrls, publicNetworkNames, startLanServer, type LanServer } from '../src/main/lan.js';

describe('allowedHost', () => {
  it('accepts addresses and local names', () => {
    for (const h of ['192.168.0.10:5184', '10.0.0.2', 'localhost:5184', '[::1]:5184', 'desktop-pc:5184', 'pc.local', 'tv.home.arpa'])
      expect(allowedHost(h), h).toBe(true);
  });
  it('refuses public domains (DNS rebinding) and junk', () => {
    for (const h of [undefined, '', 'evil.example.com', 'attacker.com:5184', 'a b'])
      expect(allowedHost(h), String(h)).toBe(false);
  });
});

describe('lanUrls', () => {
  it('lists IPv4 network addresses only', () => {
    const urls = lanUrls(5184, {
      lo: [{ address: '127.0.0.1', family: 'IPv4', internal: true, netmask: '', mac: '', cidr: null }],
      eth: [
        { address: '192.168.1.20', family: 'IPv4', internal: false, netmask: '', mac: '', cidr: null },
        { address: 'fe80::1', family: 'IPv6', internal: false, netmask: '', mac: '', cidr: null, scopeid: 0 },
        { address: '169.254.3.4', family: 'IPv4', internal: false, netmask: '', mac: '', cidr: null },
      ],
    });
    expect(urls).toEqual(['http://192.168.1.20:5184/']);
  });
  it('puts home networks before virtual adapters', () => {
    const v4 = (address: string) => [{ address, family: 'IPv4' as const, internal: false, netmask: '', mac: '', cidr: null }];
    expect(lanUrls(1, { wsl: v4('172.30.144.1'), lan: v4('192.168.15.3') })).toEqual(['http://192.168.15.3:1/', 'http://172.30.144.1:1/']);
  });
});

describe('startLanServer', () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'lan-'));
  const secret = path.join(path.dirname(root), path.basename(root) + '-secret.txt');
  let server: LanServer;
  let base: string;
  const calls: unknown[][] = [];

  beforeAll(async () => {
    fs.writeFileSync(path.join(root, 'index.html'), '<!doctype html><p>hi</p>');
    fs.writeFileSync(secret, 'nope');
    server = await startLanServer({
      root, port: 0, host: '127.0.0.1',
      rpc: { getState: () => ({ status: 'ok' }), toggleManual: (...a: unknown[]) => { calls.push(a); } },
    });
    base = `http://127.0.0.1:${server.port}`;
  });
  afterAll(async () => { await server.close(); fs.rmSync(root, { recursive: true, force: true }); fs.rmSync(secret, { force: true }); });

  const post = (body: unknown, headers: Record<string, string> = { 'Content-Type': 'application/json' }) =>
    fetch(`${base}/api/rpc`, { method: 'POST', headers, body: JSON.stringify(body) });

  it('serves the UI', async () => {
    const res = await fetch(`${base}/`);
    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('hi');
  });

  it('scopes an embedded tracker and its API to its session path', async () => {
    const embedded = await startLanServer({ root, host: '127.0.0.1', port: 0, basePath: '/test-session/', rpc: { getState: () => 'ok' } });
    try {
      const origin = `http://127.0.0.1:${embedded.port}`;
      const request = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method: 'getState' }) };
      expect((await fetch(`${origin}/`)).status).toBe(404);
      expect((await fetch(`${origin}/test-session-other/`)).status).toBe(404);
      expect(await (await fetch(`${origin}/test-session/?decky=1`)).text()).toContain('hi');
      expect((await fetch(`${origin}/api/rpc`, request)).status).toBe(404);
      expect(await (await fetch(`${origin}/test-session/api/rpc`, request)).json()).toEqual({ result: 'ok' });
    } finally {
      await embedded.close();
    }
  });

  it('never serves files outside the UI folder', async () => {
    const raw = (p: string) => new Promise<number>(resolve => {
      http.get({ host: '127.0.0.1', port: server.port, path: p }, r => { r.resume(); resolve(r.statusCode ?? 0); });
    });
    const name = path.basename(secret);
    expect(await raw(`/../${name}`)).not.toBe(200);
    expect(await raw(`/%2e%2e/${name}`)).not.toBe(200);
    expect(await raw(`/..%5c${name}`)).not.toBe(200);
  });

  it('runs allowed methods only', async () => {
    expect(await (await post({ method: 'getState' })).json()).toEqual({ result: { status: 'ok' } });
    expect((await post({ method: 'toggleManual', args: ['a.1'] })).status).toBe(200);
    expect(calls).toEqual([['a.1']]);
    expect((await post({ method: 'setHotkeys' })).status).toBe(404);
    expect((await post({ method: 'constructor' })).status).toBe(404);
    expect((await post({ method: 'toString' })).status).toBe(404);
  });

  it('refuses cross-site calls', async () => {
    expect((await post({ method: 'getState' }, { 'Content-Type': 'text/plain' })).status).toBe(415);
    expect((await post({ method: 'getState' }, { 'Content-Type': 'application/json', Origin: 'https://evil.example.com' })).status).toBe(403);
    expect((await post({ method: 'getState' }, { 'Content-Type': 'application/json', Origin: base })).status).toBe(200);
  });

  it('pushes events to connected pages', async () => {
    const got = await new Promise<string>((resolve, reject) => {
      const req = http.get(`${base}/api/events`, res => {
        let buf = '';
        res.setEncoding('utf8');
        res.on('data', (c: string) => {
          buf += c;
          if (buf.includes('retry:') && !buf.includes('event:')) server.broadcast('player', { x: 1 });
          if (buf.includes('event: player')) { req.destroy(); resolve(buf); }
        });
      });
      req.on('error', reject);
    });
    expect(got).toContain('data: {"x":1}');
  });
});

describe('publicNetworkNames', () => {
  it('names the networks set to Public', () => {
    const json = JSON.stringify([
      { Name: 'Home Wi-Fi', InterfaceAlias: 'Wi-Fi', NetworkCategory: 0 },
      { Name: 'Office', InterfaceAlias: 'Ethernet', NetworkCategory: 1 },
      { Name: 'corp.example', InterfaceAlias: 'Ethernet 2', NetworkCategory: 2 },
      { Name: '', InterfaceAlias: 'Ethernet 3', NetworkCategory: 'Public' },
    ]);
    expect(publicNetworkNames(json)).toEqual(['Home Wi-Fi', 'Ethernet 3']);
  });
  it('accepts a single profile and ignores junk', () => {
    expect(publicNetworkNames('{"Name":"Rede 2","InterfaceAlias":"Ethernet","NetworkCategory":0}')).toEqual(['Rede 2']);
    for (const bad of ['', 'not json', 'null', '[]', '[null]']) expect(publicNetworkNames(bad), bad).toEqual([]);
  });
});
