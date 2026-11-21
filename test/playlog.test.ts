import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';
import { describe, expect, it } from 'vitest';
import { crc32 } from '../src/gamedata/crc32.js';
import { murmur3 } from '../src/gamedata/murmur3.js';
import { parseGameData } from '../src/gamedata/parser.js';
import { KIND, PLAY_LOG, PLAY_LOG_COUNT, PLAY_LOG_EPOCH_MS, PLAY_LOG_NEXT, readPlayLog, type PlayEvent } from '../src/gamedata/playlog.js';
import { playLogNames, summarizePlayLog } from '../src/core/playlog.js';
import { ACTION_TOTALS, companionProgress, type CompanionData } from '../src/core/companion.js';
import { Controller } from '../src/main/controller.js';
import { SettingsStore } from '../src/main/settings.js';

/** A GameData file with Int, Binary and Int64 sections, laid out like the game's saves. */
function gameData({ ints = [], binaries = [], int64s = [] }: { ints?: [number, number][]; binaries?: [number, Buffer][]; int64s?: [number, bigint][] }) {
  const records: [number, number][] = [];
  const data: Buffer[] = [];
  const recordCount = ints.length + binaries.length + int64s.length + 3;
  let offset = 0x28 + recordCount * 8;
  const dataStart = offset;
  records.push([0, 2], ...ints);
  records.push([0, 18]);
  for (const [hash, bytes] of binaries) {
    const chunk = Buffer.alloc(4 + bytes.length);
    chunk.writeUInt32LE(bytes.length, 0);
    bytes.copy(chunk, 4);
    records.push([hash, offset]); data.push(chunk); offset += chunk.length;
  }
  records.push([0, 22]);
  for (const [hash, value] of int64s) {
    const chunk = Buffer.alloc(8);
    chunk.writeBigInt64LE(value);
    records.push([hash, offset]); data.push(chunk); offset += 8;
  }
  const head = Buffer.alloc(dataStart);
  head.writeUInt32LE(0x01020304, 0);
  head.writeUInt32LE(0x002d80eb, 4);
  head.writeUInt32LE(dataStart, 8);
  records.forEach(([hash, value], i) => { head.writeUInt32LE(hash >>> 0, 0x28 + i * 8); head.writeUInt32LE(value >>> 0, 0x2c + i * 8); });
  return Buffer.concat([head, ...data]);
}

type Row = { s: number; kind: number; name1?: number; name2?: number; value1?: number; value2?: number };
function ring(rows: Row[], startSlot = 0) {
  const b = Buffer.alloc(1024 * 24);
  rows.forEach((r, i) => {
    const o = ((startSlot + i) % 1024) * 24;
    b.writeUInt32LE(r.s, o); b.writeUInt32LE(r.kind, o + 4);
    b.writeUInt32LE(r.name1 ?? 0, o + 8); b.writeUInt32LE(r.name2 ?? 0, o + 12);
    b.writeInt32LE(r.value1 ?? 0, o + 16); b.writeInt32LE(r.value2 ?? 0, o + 20);
  });
  return b;
}
const optionSav = (rows: Row[], next: number, count: number, startSlot = 0) =>
  gameData({ ints: [[PLAY_LOG_NEXT, next], [PLAY_LOG_COUNT, count]], binaries: [[PLAY_LOG, ring(rows, startSlot)]] });

const ev = (s: number, kind: number, extra: Partial<PlayEvent> = {}): PlayEvent =>
  ({ ms: PLAY_LOG_EPOCH_MS + s * 1000, kind, name1: 0, name2: 0, value1: 0, value2: 0, ...extra });
const names = playLogNames(['Enemy_Stalchild', 'Enemy_Peahat', 'Enemy_Peahat_Larva', 'Enemy_Skulltula_Gold']);
const LINK = crc32('Player_Child');
const allOneDay = () => 'day';

describe('crc32', () => {
  it('matches zlib', () => {
    expect(crc32('The quick brown fox jumps over the lazy dog')).toBe(0x414fa339);
    for (const s of ['Player_Child', 'Enemy_Stalchild', 'Item_Melody_ZeldaLullaby']) expect(crc32(s)).toBe(zlib.crc32(s) >>> 0);
  });
});

describe('readPlayLog', () => {
  it('reads a full ring oldest first, starting at the next slot', () => {
    const rows = Array.from({ length: 1024 }, (_, i) => ({ s: 1000 + i, kind: KIND.saved, value1: i % 6 }));
    // The oldest entry sits at slot 700, where the game writes next.
    const events = readPlayLog(parseGameData(optionSav(rows, 700, 1024, 700)))!;
    expect(events).toHaveLength(1024);
    expect(events[0]).toMatchObject({ ms: PLAY_LOG_EPOCH_MS + 1000 * 1000, kind: KIND.saved, value1: 0 });
    expect(events.at(-1)!.ms).toBe(PLAY_LOG_EPOCH_MS + 2023 * 1000);
    expect(events.every((e, i) => !i || e.ms > events[i - 1].ms)).toBe(true);
  });

  it('reads only the filled slots before the ring wraps', () => {
    const events = readPlayLog(parseGameData(optionSav([{ s: 5, kind: KIND.hurt, name1: 7, value2: -3 }, { s: 9, kind: KIND.song }], 2, 2)))!;
    expect(events).toEqual([
      { ms: PLAY_LOG_EPOCH_MS + 5000, kind: KIND.hurt, name1: 7, name2: 0, value1: 0, value2: -3 },
      { ms: PLAY_LOG_EPOCH_MS + 9000, kind: KIND.song, name1: 0, name2: 0, value1: 0, value2: 0 },
    ]);
  });

  it('has nothing to read in a file without the log or with a log of another size', () => {
    expect(readPlayLog(parseGameData(gameData({ ints: [[PLAY_LOG_NEXT, 0]] })))).toBeUndefined();
    expect(readPlayLog(parseGameData(gameData({ binaries: [[PLAY_LOG, Buffer.alloc(24 * 10)]] })))).toBeUndefined();
  });
});

describe('summarizePlayLog', () => {
  it('counts the enemies Link defeated, by name', () => {
    const day = summarizePlayLog([
      ev(1, KIND.defeated, { name1: LINK, name2: crc32('Enemy_Stalchild') }),
      ev(2, KIND.defeated, { name1: LINK, name2: crc32('Enemy_Stalchild') }),
      ev(3, KIND.defeated, { name1: LINK, name2: 0x12345678 }),
      ev(3, KIND.defeated, { name1: LINK, name2: crc32('Enemy_Skulltula_Gold') }),
      // A Peahat's larvae die with it: not Link's.
      ev(4, KIND.defeated, { name1: crc32('Enemy_Peahat'), name2: crc32('Enemy_Peahat_Larva') }),
    ], names, allOneDay)!.days.day;
    expect(day.enemies).toBe(4);
    // Ties: named first, the unidentified last.
    expect(day.enemyNames).toEqual([{ name: 'Stalchild', count: 2 }, { name: 'Gold Skulltula', count: 1 }, { name: '', count: 1 }]);
  });

  it('adds up damage in quarter hearts and songs', () => {
    const day = summarizePlayLog([
      ev(1, KIND.hurt, { name1: crc32('Enemy_Stalchild'), value2: 2 }),
      ev(2, KIND.hurt, { value2: 4 }),
      ev(3, KIND.song, { name1: crc32('Item_Melody_ZeldaLullaby') }),
      ev(4, KIND.song, { name1: crc32('Item_Melody_SunSong') }),
      ev(5, KIND.song, { name1: crc32('Item_Melody_SunSong') }),
      ev(6, KIND.song, { name1: 0xdeadbeef }),
      ev(7, KIND.saved, { value1: 3 }),
    ], names, allOneDay)!.days.day;
    expect([day.damage, day.hits]).toEqual([6, 2]);
    expect(day.songs).toEqual([{ name: "Sun's Song", count: 2 }, { name: "Zelda's Lullaby", count: 1 }]);
  });

  it('gives the time between entries to the area Link is in', () => {
    const field = murmur3('HyruleField_Child'), market = murmur3('Market_Child'), house = murmur3('SomeHouse_Child');
    const day = summarizePlayLog([
      // After a file loads the area is only known when Link leaves it.
      ev(0, KIND.fileLoaded, { value1: 2 }),
      ev(100, KIND.hurt, { value2: 1 }),
      ev(200, KIND.areaChange, { name1: market, name2: field }),
      ev(500, KIND.hurt, { value2: 1 }),
      // Twenty idle minutes (game closed) don't count.
      ev(1700, KIND.hurt, { value2: 1 }),
      ev(1760, KIND.areaChange, { name1: field, name2: house }),
      ev(1860, KIND.saved),
    ], names, allOneDay)!.days.day;
    expect(day.areas).toEqual([
      { name: 'Campo de Hyrule', seconds: 360 },
      { name: 'Mercado', seconds: 200 },
      { name: '', seconds: 100 },
    ]);
  });

  it('drops the time before a file loads when the area was never known', () => {
    const day = summarizePlayLog([ev(0, KIND.hurt, { value2: 1 }), ev(100, KIND.fileLoaded), ev(160, KIND.hurt, { value2: 1 })], names, allOneDay)!.days.day;
    expect(day.areas).toEqual([]);
  });

  it('splits the log by day and keeps its time range', () => {
    const summary = summarizePlayLog([ev(10, KIND.hurt, { value2: 1 }), ev(90_000, KIND.hurt, { value2: 1 }), ev(90_010, KIND.hurt, { value2: 1 })], names,
      ms => ms < PLAY_LOG_EPOCH_MS + 86_400_000 ? 'first' : 'second')!;
    expect(Object.fromEntries(Object.entries(summary.days).map(([d, v]) => [d, v.hits]))).toEqual({ first: 1, second: 2 });
    expect([summary.fromMs, summary.toMs]).toEqual([PLAY_LOG_EPOCH_MS + 10_000, PLAY_LOG_EPOCH_MS + 90_010_000]);
    expect(summarizePlayLog([], names)).toBeUndefined();
  });
});

const data: CompanionData = JSON.parse(readFileSync(new URL('../data/companion.json', import.meta.url), 'utf8'));

describe('action totals', () => {
  it('reads jumps, rolls and sword swings from the Int64 fields of progress.sav', () => {
    const save = parseGameData(gameData({ int64s: [[ACTION_TOTALS.jumps, 2156n], [ACTION_TOTALS.rolls, 1291n], [ACTION_TOTALS.swings, 1238n]] }));
    expect(save.warnings).toEqual([]);
    expect(companionProgress(data, save)).toMatchObject({ jumps: 2156, rolls: 1291, swings: 1238 });
  });

  it('has no totals in a save without them', () => {
    expect(companionProgress(data, parseGameData(gameData({})))).toMatchObject({ jumps: null, rolls: null, swings: null });
  });
});

describe('controller', () => {
  it('summarizes option.sav next to the slot folders', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hyrule-playlog-'));
    mkdirSync(join(dir, 'slot_00'));
    writeFileSync(join(dir, 'slot_00', 'progress.sav'), gameData({ int64s: [[ACTION_TOTALS.jumps, 4n]] }));
    writeFileSync(join(dir, 'option.sav'), optionSav([
      { s: 100, kind: KIND.defeated, name1: LINK, name2: crc32('Enemy_Stalchild') },
      { s: 160, kind: KIND.song, name1: crc32('Item_Melody_TimeSong') },
    ], 2, 2));
    const settings = new SettingsStore(join(dir, 'settings.json'));
    settings.data.saveDir = dir;
    const appDir = fileURLToPath(new URL('..', import.meta.url));
    const controller = new Controller({ appDir, userData: dir, snapshots: join(dir, 'snapshots'), version: 'test', noLive: true }, settings);
    try {
      await controller.start();
      expect(controller.state.companion?.jumps).toBe(4);
      const days = Object.values(controller.state.playLog?.days ?? {});
      expect(days).toHaveLength(1);
      expect(days[0]).toMatchObject({ enemies: 1, songs: [{ name: 'Song of Time', count: 1 }] });
    } finally {
      controller.stop();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
