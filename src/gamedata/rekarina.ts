// Rekarina's live progress tables. Rekarina keeps guest memory at the same host addresses (no GUEST_BASE) and the
// main module at a fixed place, so its game data manager is read straight from a pointer in the module instead of
// being searched for like Hookshot's tables. The manager holds, per value type, a block with the record array and
// its {u32 hash, u32 record index} slot table; the records themselves have the layouts in LAYOUTS.
//
// Worked out and tested in game by Maicon Odone on one Rekarina build: the fixed addresses may change with
// another build. Every pointer and table is checked before use, so a different build reads as "not found".
import { LAYOUTS, type LiveTables, type Mem } from './live.js';
import type { GameDataFile, TypeName } from './parser.js';

/** Where Rekarina maps the game's main module (host address = guest address). */
export const REKARINA_MAIN_BASE = 0x70_0000_0000n;
/** Rekarina's heap pointers start around 4 GB (the recomps' guest heap is above 64 GB). */
export const REKARINA_MIN_ADDRESS = 0x1_0000_0000n;
/** Global holding the game data manager's address. */
const MANAGER_POINTER = REKARINA_MAIN_BASE + 0x4e842a8n;
const ADDRESS_LIMIT = 0x80_0000_0000n;
/** Per-type blocks at manager + 0x10 + id * 0x60: u32 count, u64 records at +8, u64 slots at +0x10, u32 capacity at +0x1c. */
type TableType = 'Bool' | 'Int' | 'Enum' | 'Int64';
const TYPE_IDS: Record<TableType, number> = { Bool: 0, Int: 2, Enum: 6, Int64: 22 };
const REQUIRED = ['Bool', 'Int', 'Enum'] as const;
/** The 64-bit-key table: u32 count at manager + 0xc58, records (16 bytes, sorted by key) at + 0xc60. */
const B64_COUNT = 0xc58n, B64_RECORDS = 0xc60n, B64_STRIDE = 0x10;
const MAX_ENTRIES = 1 << 20, MIN_B64 = 1000, MAX_B64 = 100_000;

export interface RekarinaTables {
  manager: bigint;
  /** Where every table was and which save hashes it was indexed for: unchanged means the index maps still hold. */
  signature: string;
  tables: LiveTables;
}

const inRange = (a: bigint, n = 8) => a >= REKARINA_MIN_ADDRESS && a + BigInt(n) <= ADDRESS_LIMIT;

function u32(mem: Mem, a: bigint): number | undefined {
  const b = mem.read(a, 4);
  return b?.length === 4 ? b.readUInt32LE(0) : undefined;
}

function u64(mem: Mem, a: bigint): bigint | undefined {
  const b = mem.read(a, 8);
  return b?.length === 8 ? b.readBigUInt64LE(0) : undefined;
}

/** A type's block, if its counts are sane and its records all start with the same vtable pointer. */
function typeBlock(mem: Mem, manager: bigint, type: TableType) {
  const layout = LAYOUTS.find(l => l.type === type);
  const id = TYPE_IDS[type];
  if (!layout) return null;
  const b = mem.read(manager + 0x10n + BigInt(id) * 0x60n, 0x20);
  if (b?.length !== 0x20) return null;
  const count = b.readUInt32LE(0), records = b.readBigUInt64LE(8), slots = b.readBigUInt64LE(0x10), capacity = b.readUInt32LE(0x1c);
  if (count < layout.minRecords || count > MAX_ENTRIES || capacity < count || capacity > MAX_ENTRIES) return null;
  if (!inRange(records, count * layout.stride) || !inRange(slots, capacity * 8)) return null;
  const first = u64(mem, records), last = u64(mem, records + BigInt((count - 1) * layout.stride));
  if (!first || first !== last || !inRange(first)) return null;
  return { type, count, records, slots, capacity, vtable: first };
}

/** Record index per wanted hash, from the slot table; null if it is inconsistent or misses too many. */
function indexMap(mem: Mem, block: NonNullable<ReturnType<typeof typeBlock>>, wanted: Set<number>): Map<number, number> | null {
  const bytes = mem.read(block.slots, block.capacity * 8);
  if (bytes?.length !== block.capacity * 8) return null;
  const index = new Map<number, number>();
  for (let o = 0; o < bytes.length; o += 8) {
    const hash = bytes.readUInt32LE(o);
    if (hash === 0) continue;
    const record = bytes.readUInt32LE(o + 4);
    if (record >= block.count) return null;
    if (!wanted.has(hash)) continue;
    const seen = index.get(hash);
    if (seen !== undefined && seen !== record) return null;
    index.set(hash, record);
  }
  return index.size >= wanted.size * 0.9 ? index : null;
}

function b64Table(mem: Mem, manager: bigint, ref: GameDataFile) {
  const count = u32(mem, manager + B64_COUNT), records = u64(mem, manager + B64_RECORDS);
  if (count === undefined || count < MIN_B64 || count > MAX_B64 || records === undefined || !inRange(records, count * B64_STRIDE)) return null;
  const bytes = mem.read(records, count * B64_STRIDE);
  if (bytes?.length !== count * B64_STRIDE) return null;
  const keys = new Set<bigint>();
  let previous = 0n;
  for (let i = 0; i < count; i++) {
    const key = bytes.readBigUInt64LE(i * B64_STRIDE);
    if (key <= previous) return null; // sorted and never 0
    keys.add(key);
    previous = key;
  }
  if (ref.bool64.size) {
    let found = 0;
    for (const k of ref.bool64) if (keys.has(k)) found++;
    if (found < ref.bool64.size * 0.9) return null;
  }
  return { start: records, count };
}

/** The save's hashes per type, sorted (the reference rarely changes, so they are kept per save). */
const refHashes = new WeakMap<GameDataFile, Map<TypeName, number[]>>();
function hashesOf(ref: GameDataFile, type: TypeName): number[] {
  let byType = refHashes.get(ref);
  if (!byType) {
    byType = new Map();
    for (const e of ref.entries.values()) {
      let list = byType.get(e.type);
      if (!list) byType.set(e.type, list = []);
      list.push(e.hash >>> 0);
    }
    for (const list of byType.values()) list.sort((a, b) => a - b);
    refHashes.set(ref, byType);
  }
  return byType.get(type) ?? [];
}

const refSignatures = new WeakMap<GameDataFile, string>();
/** The indexed hashes of a save, as text: a new save with other hashes needs new index maps. */
function refSignature(ref: GameDataFile): string {
  let s = refSignatures.get(ref);
  if (s === undefined) refSignatures.set(ref, s = [...REQUIRED, 'Int64' as const].map(t => `${t}:${hashesOf(ref, t).join(',')}`).join('|'));
  return s;
}

/**
 * The game data manager's tables, checked against the reference save; null while they can't be read (title
 * screen, loading, another Rekarina build). `previous` is reused as is when nothing moved.
 */
export function readRekarinaTables(mem: Mem, ref: GameDataFile, previous?: RekarinaTables): RekarinaTables | null {
  const manager = u64(mem, MANAGER_POINTER);
  if (manager === undefined || !inRange(manager, Number(B64_RECORDS) + 8)) return null;
  const blocks = [];
  for (const type of REQUIRED) {
    const block = typeBlock(mem, manager, type);
    if (!block) return null;
    blocks.push(block);
  }
  if (hashesOf(ref, 'Int64').length) {
    const block = typeBlock(mem, manager, 'Int64');
    if (!block) return null;
    blocks.push(block);
  }
  const b64 = b64Table(mem, manager, ref);
  if (!b64) return null;
  const signature = [manager.toString(16), ...blocks.flatMap(b => [b.type, b.count, b.records.toString(16), b.slots.toString(16), b.capacity]),
    b64.count, b64.start.toString(16), refSignature(ref)].join(':');
  if (previous?.manager === manager && previous.signature === signature) return previous;
  const records = [];
  for (const b of blocks) {
    const index = indexMap(mem, b, new Set(hashesOf(ref, b.type)));
    if (!index) return null;
    records.push({ type: b.type, start: b.records, count: b.count, index, vtable: b.vtable });
  }
  // Its class byte isn't known to tell respawning objects apart here (see LiveTables.b64.unclassified).
  return { manager, signature, tables: { records, b64: { ...b64, unclassified: true } } };
}
