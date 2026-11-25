// NX2Saria (a native PC port of the game, Windows and Linux) answers the running game's progress itself, read-only
// and to this PC only, through its tracker API on 127.0.0.1:6545 (`tracker_api = 1` in its nx2saria.ini): the
// values of the game data by the same Murmur3 keys the save files use (nx2saria.game_data), and Link's place
// (nx2saria.state). No process memory is read, so it works on Linux too and needs no table search. Protocol:
// newline-delimited JSON, one request at a time; NX2Saria's docs/tracker-api.md describes it. No Electron imports.
import net from 'node:net';
import type { GameDataFile, Entry, Value } from './parser.js';
import { LOCATION_KEY, type Agreement } from './live.js';
import type { LivePlayer } from './player.js';

export const NX2SARIA_PORT = 6545;
/** The kinds read every tick, as the save files name them. Bool64bitKey (the placed objects) is read apart. */
export const API_KINDS = ['Bool', 'Int', 'Enum', 'String64', 'String64Array', 'Int64'] as const;
export type ApiKind = (typeof API_KINDS)[number];
/** Kinds live tracking does without when the game does not answer them (the area, the place in it, the day counter). */
const OPTIONAL = new Set<string>(['String64', 'String64Array', 'Int64']);

export class ApiError extends Error {
  constructor(message: string, readonly code?: number) { super(message); }
}

/** One connection to the API: one request in flight, each answer matched by its id. */
export class Nx2SariaClient {
  private buf = '';
  private nextId = 1;
  private waiting?: { id: number; resolve(v: unknown): void; reject(e: Error): void; timer: NodeJS.Timeout };
  private closed = false;

  private constructor(private sock: net.Socket) {
    sock.setEncoding('utf8');
    sock.on('data', d => this.onData(String(d)));
    sock.on('close', () => this.fail(new ApiError('The game closed the connection.')));
    sock.on('error', e => this.fail(e));
  }

  static connect(port = NX2SARIA_PORT, timeoutMs = 700): Promise<Nx2SariaClient> {
    return new Promise((resolve, reject) => {
      const sock = net.createConnection({ host: '127.0.0.1', port });
      const timer = setTimeout(() => { sock.destroy(); reject(new ApiError('No answer from the tracker API.')); }, timeoutMs);
      sock.once('connect', () => { clearTimeout(timer); sock.setNoDelay(true); resolve(new Nx2SariaClient(sock)); });
      sock.once('error', e => { clearTimeout(timer); sock.destroy(); reject(e); });
    });
  }

  get alive() { return !this.closed; }

  call<T>(method: string, params: Record<string, unknown> = {}, timeoutMs = 1500): Promise<T> {
    if (this.closed) return Promise.reject(new ApiError('The connection is closed.'));
    if (this.waiting) return Promise.reject(new ApiError('A request is already waiting for its answer.'));
    const id = this.nextId++;
    return new Promise<T>((resolve, reject) => {
      const timer = setTimeout(() => {
        this.waiting = undefined;
        this.close();
        reject(new ApiError(`${method}: no answer in ${timeoutMs} ms`));
      }, timeoutMs);
      this.waiting = { id, resolve: v => resolve(v as T), reject, timer };
      this.sock.write(JSON.stringify({ id, method, params }) + '\n');
    });
  }

  close() {
    this.sock.destroy();
    this.fail(new ApiError('The connection is closed.'));
  }

  private fail(e: Error) {
    this.closed = true;
    const w = this.waiting;
    this.waiting = undefined;
    if (w) { clearTimeout(w.timer); w.reject(e); }
  }

  private onData(d: string) {
    this.buf += d;
    if (this.buf.length > 16 << 20) return this.close(); // no answer is that long
    for (let nl = this.buf.indexOf('\n'); nl >= 0; nl = this.buf.indexOf('\n')) {
      const line = this.buf.slice(0, nl);
      this.buf = this.buf.slice(nl + 1);
      const w = this.waiting;
      let ans: { id?: unknown; result?: unknown; error?: { code?: number; message?: string } };
      try { ans = JSON.parse(line); } catch { return this.close(); }
      if (!w || ans.id !== w.id) continue;
      this.waiting = undefined;
      clearTimeout(w.timer);
      if (ans.error) w.reject(new ApiError(ans.error.message ?? 'error', ans.error.code));
      else w.resolve(ans.result);
    }
  }
}

export interface ApiStatus {
  powered_on: boolean; emulator: string; game_version: string; api_version: number; methods?: string[];
  /** The folder of the save the game loads and writes (<profile>/save/<account>, with its slot_*), when it says. */
  save_dir?: string | null;
}
export interface ApiState {
  area: string | null;
  player: { x: number; y: number; z: number; rotation: number[] | null } | null;
  game_data?: boolean;
}
export interface GameDataAnswer { kind: string; format?: number; count: number; record_size: number; digest: string; records?: string; unchanged?: boolean }
/** The records' layout this module reads (nx2saria.game_data's `format`). */
export const GAME_DATA_FORMAT = 1;
/** -32002: nothing to answer yet (no save loaded, or the game changed it meanwhile); -32003: not on this game build. */
const NOT_NOW = -32002, UNSUPPORTED = -32003;
/** Why a read gave no data: the game data is not there now, or not readable by this tracker on this game build. */
export type NoRead = { none: 'wait' | 'unsupported' };
function refusal(e: unknown): NoRead | undefined {
  if (!(e instanceof ApiError)) return undefined;
  return e.code === NOT_NOW ? { none: 'wait' } : e.code === UNSUPPORTED ? { none: 'unsupported' } : undefined;
}

/**
 * The tracker API's settings in an nx2saria.ini: `tracker_api` (off unless 1) and `tracker_api_port`, both in
 * [tracker] in NX2Saria's example file but read by key alone here, since a section name is not what turns them on.
 */
export function trackerApiSettings(ini: string): { on: boolean; port: number } {
  let on = false, port = NX2SARIA_PORT;
  for (const raw of ini.split(/\r?\n/)) {
    const line = raw.replace(/[#;].*$/, '').trim();
    const m = /^(tracker_api|tracker_api_port)\s*=\s*(\S+)$/i.exec(line);
    if (!m) continue;
    if (m[1].toLowerCase() === 'tracker_api') on = m[2] === '1';
    else { const n = Number(m[2]); if (Number.isInteger(n) && n >= 1024 && n <= 65535) port = n; }
  }
  return { on, port };
}

/** The game answering is NX2Saria with the game-data method. */
export function isNx2Saria(s: ApiStatus | undefined): boolean {
  return !!s && s.emulator === 'nx2saria' && s.api_version >= 1 && !!s.methods?.includes('nx2saria.game_data');
}

function text(b: Buffer): string {
  const z = b.indexOf(0);
  return b.subarray(0, z < 0 ? b.length : z).toString('utf8');
}

/** A kind's records as {hash → value}, the values as parser.ts gives them for a save. */
export function decodeRecords(a: GameDataAnswer): Map<number, Value> {
  const out = new Map<number, Value>();
  const b = Buffer.from(a.records ?? '', 'hex');
  if (a.kind === 'String64Array') {
    for (let o = 0; o + 8 <= b.length;) {
      const h = b.readUInt32LE(o), n = b.readUInt32LE(o + 4);
      const list: string[] = [];
      for (let i = 0; i < n && o + 8 + (i + 1) * 64 <= b.length; i++) list.push(text(b.subarray(o + 8 + i * 64, o + 8 + (i + 1) * 64)));
      out.set(h, list);
      o += 8 + n * 64;
    }
    return out;
  }
  const size = a.record_size;
  if (!size) return out;
  for (let o = 0; o + size <= b.length; o += size) {
    const h = b.readUInt32LE(o);
    switch (a.kind) {
      case 'Bool': out.set(h, b.readUInt32LE(o + 4) !== 0); break;
      case 'Int': out.set(h, b.readInt32LE(o + 4)); break;
      case 'Int64': out.set(h, b.readBigInt64LE(o + 4)); break;
      case 'String64': out.set(h, text(b.subarray(o + 4, o + 68))); break;
      default: out.set(h, b.readUInt32LE(o + 4)); // Enum: the hash of the value's name
    }
  }
  return out;
}

/** The placed objects' 16-byte records: u64 key, u32 class at +8 (bit 0x40: respawns), set byte at +12. */
export function decodeKeys(a: GameDataAnswer): { set: Set<bigint>; resettable: Set<bigint> } {
  const b = Buffer.from(a.records ?? '', 'hex');
  const set = new Set<bigint>(), resettable = new Set<bigint>();
  for (let o = 0; o + 16 <= b.length; o += 16) {
    const k = b.readBigUInt64LE(o);
    if (b[o + 12] & 1) set.add(k);
    if (b[o + 8] & 0x40) resettable.add(k);
  }
  return { set, resettable };
}

/**
 * Link's heading in degrees from his rotation (a 3x3 matrix by rows): his forward axis (the matrix's third column)
 * on the ground, measured as player.ts measures the direction he moves in. Checked against the way he moves in
 * NX2Saria 0.14.0 (its tools/tracker_api_client.py --watch prints both).
 */
export function yawFromRotation(m: number[] | null | undefined): number | null {
  if (!m || m.length !== 9) return null;
  const fx = m[2], fz = m[8];
  if (!Number.isFinite(fx) || !Number.isFinite(fz) || Math.hypot(fx, fz) < 0.01) return null;
  return Number((((Math.atan2(fx, -fz) * 180) / Math.PI + 360) % 360).toFixed(1));
}

/** The reference save with the live values laid over it, as buildLive (live.ts) makes it from memory. */
export function overlay(ref: GameDataFile, kinds: Map<string, Map<number, Value>>, keys: Set<bigint>, resettable: Set<bigint>) {
  const entries = new Map(ref.entries);
  const agreement: Agreement[] = [];
  for (const kind of ['Bool', 'Int', 'Enum', 'String64', 'Int64'] as const) {
    const values = kinds.get(kind);
    if (!values) continue;
    const a: Agreement = { type: kind, checked: 0, agree: 0, refTrue: 0, liveTrueOfRefTrue: 0 };
    for (const [h, v] of values) {
      const prev = ref.entries.get(h);
      if (!prev || prev.type !== kind) continue;
      a.checked++;
      if (v === prev.value) a.agree++;
      if (v !== prev.value) entries.set(h, { ...prev, value: v });
    }
    // Every flag set in the save counts, the ones the game did not answer too (matchesReference).
    if (kind === 'Bool')
      for (const e of ref.entries.values())
        if (e.type === 'Bool' && e.value === true) { a.refTrue!++; if (values.get(e.hash) === true) a.liveTrueOfRefTrue!++; }
    agreement.push(a);
  }
  const lists = kinds.get('String64Array');
  for (const [h, v] of lists ?? []) {
    const prev = ref.entries.get(h);
    if (h === LOCATION_KEY || prev?.type === 'String64Array')
      entries.set(h, { hash: h, type: 'String64Array', recordOffset: prev?.recordOffset ?? 0, value: v } as Entry);
  }
  const lost = [...ref.bool64].filter(k => !keys.has(k) && !resettable.has(k)).length;
  agreement.push({ type: 'Bool64bitKey', checked: ref.bool64.size, agree: ref.bool64.size - lost });
  return { data: { ...ref, entries, bool64: new Set(keys), warnings: [] } as GameDataFile, agreement, resettable };
}

/**
 * A connection to NX2Saria while it runs: the values of each kind, asked again with their last digest so an unchanged
 * kind costs one short answer, and the placed objects' classes once (they do not change).
 */
export class ApiSession {
  private last = new Map<string, { digest: string; values: Map<number, Value> }>();
  private keys?: { digest: string; set: Set<bigint> };
  private resettable?: Set<bigint>;

  /** Where the running game keeps the save it loads and writes, as it said when the session opened. */
  readonly saveDir?: string;

  private constructor(private client: Nx2SariaClient, status: ApiStatus) {
    this.saveDir = typeof status.save_dir === 'string' && status.save_dir ? status.save_dir : undefined;
  }

  /** The API when NX2Saria answers on the port, else undefined. */
  static async open(port = NX2SARIA_PORT): Promise<ApiSession | undefined> {
    let client: Nx2SariaClient | undefined;
    try {
      client = await Nx2SariaClient.connect(port);
      const st = await client.call<ApiStatus>('status', {}, 700);
      if (isNx2Saria(st)) return new ApiSession(client, st);
    } catch { /* nothing there, or not NX2Saria */ }
    client?.close();
    return undefined;
  }

  get alive() { return this.client.alive; }
  close() { this.client.close(); }

  /** Link's place, or undefined while there is no player. */
  async player(): Promise<LivePlayer | undefined> {
    const s = await this.client.call<ApiState>('nx2saria.state', {}, 700);
    if (!s.player) return undefined;
    const p = s.player;
    return { pos: { x: Number(p.x.toFixed(2)), y: Number(p.y.toFixed(2)), z: Number(p.z.toFixed(2)), yaw: yawFromRotation(p.rotation) ?? 0 }, scene: s.area };
  }

  /**
   * The live data over `ref`, and a fingerprint of what the tracker follows (as live.ts fingerprint: every Bool,
   * Enum, text and placed object, and the Ints in watchInts); or why there is none. An optional kind the game does
   * not answer is left out (the save's values stay), as the memory path does without the area.
   */
  async read(ref: GameDataFile, watchInts: Set<number>) {
    const kinds = new Map<string, Map<number, Value>>();
    const print: string[] = [];
    for (const kind of API_KINDS) {
      const was = this.last.get(kind);
      let a: GameDataAnswer;
      try {
        a = await this.client.call<GameDataAnswer>('nx2saria.game_data', was ? { kind, if_digest: was.digest } : { kind });
      } catch (e) {
        const no = refusal(e);
        if (!no) throw e;
        if (OPTIONAL.has(kind)) { this.last.delete(kind); print.push('-'); continue; }
        return no;
      }
      if (a.format !== GAME_DATA_FORMAT) return { none: 'unsupported' } as NoRead; // laid out otherwise than decodeRecords reads
      const values = a.unchanged && was ? was.values : decodeRecords(a);
      this.last.set(kind, { digest: a.digest, values });
      kinds.set(kind, values);
      if (kind === 'Int' || kind === 'Int64') {
        for (const h of watchInts) if (values.has(h)) print.push(`${h}:${values.get(h)}`);
      } else {
        print.push(a.digest);
      }
    }
    try {
      this.resettable ??= decodeKeys(await this.client.call<GameDataAnswer>('nx2saria.game_data', { kind: 'Bool64bitKey', filter: 'all' }, 3000)).resettable;
      const k = await this.client.call<GameDataAnswer>('nx2saria.game_data', this.keys ? { kind: 'Bool64bitKey', if_digest: this.keys.digest } : { kind: 'Bool64bitKey' });
      if (!k.unchanged || !this.keys) this.keys = { digest: k.digest, set: decodeKeys(k).set };
    } catch (e) {
      const no = refusal(e);
      if (!no) throw e;
      return no;
    }
    print.push(this.keys.digest);
    return { ...overlay(ref, kinds, this.keys.set, this.resettable), print: print.join('|') };
  }
}
