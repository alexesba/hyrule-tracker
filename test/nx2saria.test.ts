import { describe, it, expect, afterEach } from 'vitest';
import net from 'node:net';
import { decodeRecords, decodeKeys, overlay, yawFromRotation, ApiSession, isNx2Saria, trackerApiSettings, type GameDataAnswer } from '../src/gamedata/nx2saria';
import { matchesReference, LOCATION_KEY, STAGE_KEY } from '../src/gamedata/live';
import type { GameDataFile, Entry } from '../src/gamedata/parser';

// Answers as NX2Saria's tracker API gives them (its docs/tracker-api.md). All values made up.
const rec = (h: number, v: number, signed = false) => {
  const b = Buffer.alloc(8);
  b.writeUInt32LE(h, 0);
  if (signed) b.writeInt32LE(v, 4); else b.writeUInt32LE(v, 4);
  return b;
};
const text64 = (s: string) => { const b = Buffer.alloc(64); b.write(s, 'latin1'); return b; };
const u32 = (v: number) => { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; };
const key = (k: bigint, cls: number, set: number) => { const b = Buffer.alloc(16); b.writeBigUInt64LE(k); b[8] = cls; b[12] = set; return b; };
const answer = (kind: string, size: number, parts: Buffer[], digest = 'd-' + kind): GameDataAnswer =>
  ({ kind, format: 1, count: parts.length, record_size: size, digest, records: Buffer.concat(parts).toString('hex') });

function ref(): GameDataFile {
  const entries = new Map<number, Entry>();
  const add = (hash: number, type: Entry['type'], value: Entry['value']) => entries.set(hash, { hash, type, value, recordOffset: 0 });
  for (let i = 1; i <= 20; i++) add(i, 'Bool', i <= 10);
  add(0x04735978, 'Int', 3);
  add(0x33333333, 'Enum', 0x11);
  add(STAGE_KEY, 'String64', 'LostWood_Child');
  return { version: 0x002d80eb, dataStart: 0x28, size: 0, entries, bool64: new Set([0x10n, 0x20n]), warnings: [] };
}

describe('NX2Saria tracker API: decoding', () => {
  it('reads every kind as the save parser gives it', () => {
    expect([...decodeRecords(answer('Bool', 8, [rec(5, 1), rec(6, 0)]))]).toEqual([[5, true], [6, false]]);
    expect([...decodeRecords(answer('Int', 8, [rec(7, -1, true)]))]).toEqual([[7, -1]]);
    expect([...decodeRecords(answer('Enum', 8, [rec(8, 0x4c0a63f4)]))]).toEqual([[8, 0x4c0a63f4]]);
    expect([...decodeRecords(answer('String64', 68, [Buffer.concat([u32(STAGE_KEY), text64('HyruleField_Adult')])]))])
      .toEqual([[STAGE_KEY, 'HyruleField_Adult']]);
    const i64 = Buffer.alloc(12); i64.writeUInt32LE(9); i64.writeBigInt64LE(0x100000002n, 4);
    expect([...decodeRecords(answer('Int64', 12, [i64]))]).toEqual([[9, 0x100000002n]]);
    const list = Buffer.concat([u32(LOCATION_KEY), u32(2), text64('HyruleField'), text64('LakeHylia')]);
    expect([...decodeRecords({ kind: 'String64Array', count: 1, record_size: 0, digest: 'x', records: list.toString('hex') })])
      .toEqual([[LOCATION_KEY, ['HyruleField', 'LakeHylia']]]);
    const k = decodeKeys(answer('Bool64bitKey', 16, [key(0x10n, 0x18, 1), key(0x30n, 0x58, 0)]));
    expect([...k.set]).toEqual([0x10n]);
    expect([...k.resettable]).toEqual([0x30n]);
  });

  it('turns the rotation into the heading player.ts uses', () => {
    expect(yawFromRotation([0, 0, 1, 0, 1, 0, -1, 0, 0])).toBe(90);
    expect(yawFromRotation([1, 0, 0, 0, 1, 0, 0, 0, 1])).toBe(180);
    expect(yawFromRotation(null)).toBeNull();
  });

  it('lays live values over the reference save', () => {
    const kinds = new Map([
      ['Bool', decodeRecords(answer('Bool', 8, Array.from({ length: 20 }, (_, i) => rec(i + 1, i < 11 ? 1 : 0))))],
      ['Int', decodeRecords(answer('Int', 8, [rec(0x04735978, 4)]))],
      ['String64Array', decodeRecords({ kind: 'String64Array', count: 1, record_size: 0, digest: 'x',
        records: Buffer.concat([u32(LOCATION_KEY), u32(1), text64('LakeHylia')]).toString('hex') })],
    ]);
    const live = overlay(ref(), kinds, new Set([0x10n, 0x20n, 0x40n]), new Set());
    expect(live.data.entries.get(11)?.value).toBe(true);
    expect(live.data.entries.get(0x04735978)?.value).toBe(4);
    expect(live.data.entries.get(LOCATION_KEY)?.value).toEqual(['LakeHylia']);
    expect(live.data.bool64.has(0x40n)).toBe(true);
    expect(matchesReference(live.agreement)).toBe(true);
    // At the title screen or in another file, most of the save's flags are not set.
    const other = overlay(ref(), new Map([['Bool', new Map([[1, true]])]]), new Set(), new Set());
    expect(matchesReference(other.agreement)).toBe(false);
  });
});

describe('NX2Saria tracker API: a session', () => {
  let server: net.Server | undefined;
  afterEach(() => { server?.close(); server = undefined; });

  // A stand-in for the game: answers one JSON line per request, as NX2Saria does.
  async function serve(gameData: boolean, refuse: Record<string, number> = {}, format = 1) {
    const asked: { method: string; params: Record<string, unknown> }[] = [];
    server = net.createServer(sock => {
      let buf = '';
      sock.on('data', d => {
        buf += d;
        for (let nl = buf.indexOf('\n'); nl >= 0; nl = buf.indexOf('\n')) {
          const req = JSON.parse(buf.slice(0, nl));
          buf = buf.slice(nl + 1);
          asked.push({ method: req.method, params: req.params ?? {} });
          let result: unknown, error: unknown;
          if (req.method === 'status') {
            result = { powered_on: true, emulator: 'nx2saria', game_version: '1.1.1', api_version: 1,
              methods: ['status', 'read_memory', 'search_memory', 'nx2saria.state', 'nx2saria.game_data'],
              save_dir: 'C:\\Jogos\\oot\\profile/save/0123' };
          } else if (req.method === 'nx2saria.state') {
            result = { area: 'HyruleField_Child', player: { x: 1.234, y: 2, z: 3, rotation: [0, 0, 1, 0, 1, 0, -1, 0, 0] }, game_data: gameData };
          } else if (!gameData) {
            error = { code: -32002, message: 'Bool: the game has not loaded its game data yet' };
          } else if (refuse[req.params.kind]) {
            error = { code: refuse[req.params.kind], message: `${req.params.kind}: refused` };
          } else {
            const p = req.params;
            const a: GameDataAnswer =
              p.kind === 'Bool' ? answer('Bool', 8, Array.from({ length: 20 }, (_, i) => rec(i + 1, i < 10 ? 1 : 0))) :
              p.kind === 'Int' ? answer('Int', 8, [rec(0x04735978, 3)]) :
              p.kind === 'Bool64bitKey' ? answer('Bool64bitKey', 16, [key(0x10n, 0x18, 1), key(0x20n, 0x18, 1)]) :
              answer(p.kind, p.kind === 'String64' ? 68 : p.kind === 'Int64' ? 12 : p.kind === 'String64Array' ? 0 : 8, []);
            a.format = format;
            result = p.if_digest === a.digest ? { ...a, records: undefined, unchanged: true } : a;
          }
          sock.write(JSON.stringify(error ? { id: req.id, error } : { id: req.id, result }) + '\n');
        }
      });
    });
    await new Promise<void>(r => server!.listen(0, '127.0.0.1', r));
    return { port: (server!.address() as net.AddressInfo).port, asked };
  }

  it('finds NX2Saria and reads the game through it', async () => {
    const { port, asked } = await serve(true);
    const api = await ApiSession.open(port);
    expect(api).toBeDefined();
    expect(api!.saveDir).toBe('C:\\Jogos\\oot\\profile/save/0123'); // the save folder the game says it uses
    const p = await api!.player();
    expect(p).toEqual({ pos: { x: 1.23, y: 2, z: 3, yaw: 90 }, scene: 'HyruleField_Child' });
    const first = await api!.read(ref(), new Set([0x04735978]));
    expect('agreement' in first && matchesReference(first.agreement)).toBe(true);
    const again = await api!.read(ref(), new Set([0x04735978]));
    expect('print' in again && 'print' in first && again.print === first.print).toBe(true);
    // The second read asks each kind with its digest, and the placed objects' classes only once.
    const bools = asked.filter(a => a.params.kind === 'Bool');
    expect(bools.map(a => a.params.if_digest)).toEqual([undefined, 'd-Bool']);
    expect(asked.filter(a => a.params.filter === 'all')).toHaveLength(1);
    api!.close();
  });

  it('waits while the game has no game data', async () => {
    const { port } = await serve(false);
    const api = await ApiSession.open(port);
    expect(await api!.read(ref(), new Set())).toEqual({ none: 'wait' });
    api!.close();
  });

  it('does without the area kinds the game does not answer, never without the flags', async () => {
    let { port } = await serve(true, { String64Array: -32003, String64: -32002, Int64: -32003 });
    let api = await ApiSession.open(port);
    const live = await api!.read(ref(), new Set());
    expect('agreement' in live && matchesReference(live.agreement)).toBe(true);
    expect('data' in live && live.data.entries.get(STAGE_KEY)?.value).toBe('LostWood_Child'); // the save's
    api!.close();
    server!.close();
    ({ port } = await serve(true, { Bool: -32003 }));
    api = await ApiSession.open(port);
    expect(await api!.read(ref(), new Set())).toEqual({ none: 'unsupported' });
    api!.close();
  });

  it('reads no records of another format', async () => {
    const { port } = await serve(true, {}, 2);
    const api = await ApiSession.open(port);
    expect(await api!.read(ref(), new Set())).toEqual({ none: 'unsupported' });
    api!.close();
  });

  it('is not taken for another program on the port', async () => {
    expect(isNx2Saria({ powered_on: true, emulator: 'lichii', game_version: '1.1.1', api_version: 1 })).toBe(false);
    server = net.createServer(sock => sock.end('HTTP/1.1 400 Bad Request\r\n\r\n'));
    await new Promise<void>(r => server!.listen(0, '127.0.0.1', r));
    expect(await ApiSession.open((server.address() as net.AddressInfo).port)).toBeUndefined();
  });
});

describe('nx2saria.ini tracker settings', () => {
  it('is off with the example file, where both settings are commented out', () => {
    expect(trackerApiSettings('[tracker]\n# tracker_api = 0\n# tracker_api_port = 6545\n')).toEqual({ on: false, port: 6545 });
  });

  it('reads tracker_api = 1 and a moved port, with Windows line ends and a comment after the value', () => {
    expect(trackerApiSettings('[tracker]\r\ntracker_api = 1 ; on\r\ntracker_api_port=7001\r\n')).toEqual({ on: true, port: 7001 });
  });

  it('keeps the default port when the one given is out of range', () => {
    expect(trackerApiSettings('tracker_api = 1\ntracker_api_port = 80\n')).toEqual({ on: true, port: 6545 });
  });
});
