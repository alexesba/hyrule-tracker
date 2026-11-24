import { describe, it, expect } from 'vitest';
import { readRekarinaTables, REKARINA_MAIN_BASE, REKARINA_MIN_ADDRESS } from '../src/gamedata/rekarina';
import { readLive, matchesReference, LAYOUTS, type Mem } from '../src/gamedata/live';
import { PlayerReader, MAIN_MOD0_OFFSET } from '../src/gamedata/player';
import type { GameDataFile, Entry } from '../src/gamedata/parser';

// Synthetic Rekarina memory: host addresses are guest addresses, the game data manager is found through a global
// in the main module at a fixed place. All values made up.
const MANAGER = 0x2_0000_0000n, VTABLE = REKARINA_MAIN_BASE + 0x0100_0000n;
const nBool = 2100, nInt = 220, nEnum = 40, nB64 = 1100;
const hBool = (i: number) => (0x10000000 + i * 7919) >>> 0;
const hInt = (i: number) => (0x50000000 + i * 104729) >>> 0;
const hEnum = (i: number) => (0x90000000 + i * 1299709) >>> 0;
const key64 = (j: number) => 0x0100_0000_0000_0000n + BigInt(j) * 0x0000_0100_0000_0001n;

function sparse() {
  const pages = new Map<bigint, Buffer>();
  const mem: Mem = {
    read(addr, len) {
      for (const [at, buf] of pages) if (addr >= at && addr + BigInt(len) <= at + BigInt(buf.length)) {
        const o = Number(addr - at); return Buffer.from(buf.subarray(o, o + len));
      }
      return null;
    },
  };
  return { pages, mem };
}

function build() {
  const { pages, mem } = sparse();
  const manager = Buffer.alloc(0xc68);
  const global = Buffer.alloc(8); global.writeBigUInt64LE(MANAGER); pages.set(REKARINA_MAIN_BASE + 0x4e842a8n, global);
  pages.set(MANAGER, manager);
  let at = 0x3_0000_0000n;
  const records: Record<string, bigint> = {};
  const table = (type: 'Bool' | 'Int' | 'Enum', id: number, n: number, h: (i: number) => number, val: (i: number) => number) => {
    const L = LAYOUTS.find(l => l.type === type)!;
    const recs = Buffer.alloc(n * L.stride);
    for (let i = 0; i < n; i++) {
      recs.writeBigUInt64LE(VTABLE + BigInt(id), i * L.stride);
      if (type === 'Bool') recs[i * L.stride + L.valueOffset] = val(i);
      else recs.writeUInt32LE(val(i) >>> 0, i * L.stride + L.valueOffset);
    }
    const capacity = n + 17;
    const slots = Buffer.alloc(capacity * 8);
    for (let i = 0; i < n; i++) { slots.writeUInt32LE(h(i), (i + 9) * 8); slots.writeUInt32LE(i, (i + 9) * 8 + 4); } // empty slots around them
    const recAt = at, slotAt = at + 0x100_0000n; at += 0x200_0000n;
    pages.set(recAt, recs); pages.set(slotAt, slots);
    records[type] = recAt;
    const o = 0x10 + id * 0x60;
    manager.writeUInt32LE(n, o); manager.writeBigUInt64LE(recAt, o + 8); manager.writeBigUInt64LE(slotAt, o + 0x10); manager.writeUInt32LE(capacity, o + 0x1c);
  };
  table('Bool', 0, nBool, hBool, i => (i % 10 === 0 ? 1 : 0));
  table('Int', 2, nInt, hInt, i => i * 3 - 5);
  table('Enum', 6, nEnum, hEnum, i => hEnum(i) ^ 0xabc);
  const b64 = Buffer.alloc(nB64 * 16);
  for (let j = 0; j < nB64; j++) { b64.writeBigUInt64LE(key64(j), j * 16); b64[j * 16 + 12] = j % 20 === 0 ? 1 : 0; }
  const b64At = at; pages.set(b64At, b64);
  manager.writeUInt32LE(nB64, 0xc58); manager.writeBigUInt64LE(b64At, 0xc60);
  return { pages, mem, manager, records, b64, b64At };
}

function reference(): GameDataFile {
  const entries = new Map<number, Entry>();
  const add = (hash: number, type: Entry['type'], value: Entry['value']) => entries.set(hash, { hash, type, value, recordOffset: 0 });
  for (let i = 0; i < nBool; i++) add(hBool(i), 'Bool', i % 10 === 0);
  for (let i = 0; i < nInt; i++) add(hInt(i), 'Int', i * 3 - 5);
  for (let i = 0; i < nEnum; i++) add(hEnum(i), 'Enum', (hEnum(i) ^ 0xabc) >>> 0);
  const bool64 = new Set<bigint>();
  for (let j = 0; j < nB64; j++) if (j % 20 === 0) bool64.add(key64(j));
  return { version: 0, dataStart: 0, size: 0, entries, bool64, warnings: [] };
}

describe('Rekarina game data manager', () => {
  it('reads the tables from the manager and builds live values', () => {
    const { mem, pages, records } = build();
    const ref = reference();
    const t = readRekarinaTables(mem, ref)!;
    expect(t).toBeTruthy();
    expect(t.tables.records.map(r => [r.type, r.start, r.count])).toEqual([
      ['Bool', records.Bool, nBool], ['Int', records.Int, nInt], ['Enum', records.Enum, nEnum],
    ]);
    pages.get(records.Bool)![3 * 0x18 + 0x16] = 1; // a flag set in game since the save
    const live = readLive(mem, t.tables, ref)!;
    expect(live.data.entries.get(hBool(3))!.value).toBe(true);
    expect(live.data.entries.get(hInt(5))!.value).toBe(10);
    expect(live.data.bool64.has(key64(40))).toBe(true);
    expect(live.resettableKnown).toBe(false);
    expect(matchesReference(live.agreement)).toBe(true);
  });

  it('keeps the same tables while nothing moved', () => {
    const { mem } = build();
    const ref = reference();
    const first = readRekarinaTables(mem, ref)!;
    expect(readRekarinaTables(mem, ref, first)).toBe(first);
  });

  it('takes the key table as it is: a cleared key may be a respawning object', () => {
    const { mem, b64 } = build();
    const ref = reference();
    for (const j of [20, 40, 60, 80, 100]) b64[j * 16 + 12] = 0; // more than the 3 a classified table would allow
    const t = readRekarinaTables(mem, ref)!;
    const live = readLive(mem, t.tables, ref)!;
    expect(live.data.bool64.has(key64(20))).toBe(false);
    expect(live.missing).toEqual([]);
    expect(matchesReference(live.agreement)).toBe(true);
  });

  it('reads nothing without the manager or with records that are not one table', () => {
    const ref = reference();
    expect(readRekarinaTables(sparse().mem, ref)).toBeNull();
    const { mem, pages, records } = build();
    pages.get(records.Int)!.writeBigUInt64LE(0x1234n, (nInt - 1) * 0x28); // last record's vtable differs
    expect(readRekarinaTables(mem, ref)).toBeNull();
  });

  it('rejects a key table that misses the save\'s keys (another file)', () => {
    const { mem, b64 } = build();
    const ref = reference();
    for (let j = 0; j < nB64; j++) b64.writeBigUInt64LE(key64(j) + 1n, j * 16);
    expect(readRekarinaTables(mem, ref)).toBeNull();
  });
});

describe('Rekarina player reader', () => {
  const HEAP = REKARINA_MIN_ADDRESS + 0x1000_0000n; // below the recomps' 64 GB heap floor
  const SINGLETON = HEAP + 0x1000n, POBJ = HEAP + 0x2000n, ARR = HEAP + 0x3000n, SUB36 = HEAP + 0x4000n;
  const u64 = (v: bigint) => { const b = Buffer.alloc(8); b.writeBigUInt64LE(v); return b; };
  const layout = { mainBase: REKARINA_MAIN_BASE, minHeap: REKARINA_MIN_ADDRESS };

  function game(withHeader = true) {
    const { pages, mem } = sparse();
    const M = REKARINA_MAIN_BASE;
    const head = Buffer.alloc(8);
    if (withHeader) { head.writeUInt32LE(1, 0); head.writeUInt32LE(Number(MAIN_MOD0_OFFSET), 4); }
    pages.set(M, head);
    pages.set(M + 0x04e6c7a8n, u64(SINGLETON));
    const singleton = Buffer.alloc(0x18); singleton.writeBigUInt64LE(POBJ, 0x10); pages.set(SINGLETON, singleton);
    const pobj = Buffer.alloc(0x60); pobj.writeBigUInt64LE(M + 0x04ba27c8n, 0); pobj.writeUInt32LE(40, 0x50); pobj.writeBigUInt64LE(ARR, 0x58); pages.set(POBJ, pobj);
    const arr = Buffer.alloc(40 * 8); arr.writeBigUInt64LE(SUB36, 36 * 8); pages.set(ARR, arr);
    const sub = Buffer.alloc(0x40);
    sub.writeBigUInt64LE(M + 0x04ba1818n, 0); sub.writeBigUInt64LE(M + 0x03ee4f8cn, 8);
    sub.writeFloatLE(-120.5, 0x1c); sub.writeFloatLE(30, 0x20); sub.writeFloatLE(64.25, 0x24); sub.writeFloatLE(1, 0x28);
    pages.set(SUB36, sub);
    return mem;
  }

  it('reads Link at the fixed main module, with heap pointers under 64 GB, without searching', () => {
    let regionsAsked = 0;
    const reader = new PlayerReader(game(), () => { regionsAsked++; return []; }, 0n, layout);
    expect(reader.read(0)?.pos).toEqual({ x: -120.5, y: 30, z: 64.25, yaw: 90 });
    expect(reader.stage).toBe('ok');
    expect(reader.moduleFound).toBe(true);
    expect(regionsAsked).toBe(0);
  });

  it('says no-module when the fixed place holds no main module header', () => {
    const reader = new PlayerReader(game(false), () => [], 0n, layout);
    expect(reader.read(0)).toBeNull();
    expect(reader.stage).toBe('no-module');
    expect(reader.moduleFound).toBe(false);
  });
});
