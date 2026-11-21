// The game's own play log (Zelda Notes data), kept in option.sav next to the slot_NN
// folders. Found and documented by Kabosune (github.com/Kabosune/oot-remake-modding,
// docs/zelda-notes.md); checked here against real option.sav files, see docs/save-format.md.
import type { GameDataFile } from './parser.js';

/** Binary field: 1,024 entries of 24 bytes, a ring buffer. */
export const PLAY_LOG = 0x5392e233;
/** Int fields: the ring's next slot and how many slots are filled. */
export const PLAY_LOG_NEXT = 0x25418e68;
export const PLAY_LOG_COUNT = 0xe110ceb6;
export const PLAY_LOG_SIZE = 1024;
const ENTRY = 24;
/** Entry times are seconds since 1 January 2026, UTC. */
export const PLAY_LOG_EPOCH_MS = Date.UTC(2026, 0, 1);

/** Kinds used by the tracker (names from Kabosune's table, each matched to something done in game). */
export const KIND = {
  hurt: 1,
  defeated: 3,
  fileLoaded: 17,
  areaChange: 25,
  saved: 26,
  song: 30,
} as const;

export interface PlayEvent {
  ms: number;
  kind: number;
  name1: number;
  name2: number;
  value1: number;
  value2: number;
}

/**
 * Entries oldest first. Returns undefined when the file has no play log (an older game
 * version) or the field isn't the expected size.
 */
export function readPlayLog(option: GameDataFile): PlayEvent[] | undefined {
  const field = option.entries.get(PLAY_LOG);
  if (field?.type !== 'Binary' || typeof field.value !== 'object' || !('bytes' in field.value)) return;
  const b = Buffer.from(field.value.bytes, 'hex');
  if (b.length !== PLAY_LOG_SIZE * ENTRY) return;
  const int = (hash: number) => { const v = option.entries.get(hash)?.value; return typeof v === 'number' ? v : undefined; };
  const next = int(PLAY_LOG_NEXT);
  const count = Math.min(int(PLAY_LOG_COUNT) ?? PLAY_LOG_SIZE, PLAY_LOG_SIZE);
  // Before the ring wraps, the filled slots are 0..count-1; after, the oldest is at `next`.
  const start = next !== undefined && next >= 0 && next < PLAY_LOG_SIZE && count === PLAY_LOG_SIZE ? next : 0;
  const out: PlayEvent[] = [];
  for (let j = 0; j < count; j++) {
    const o = ((start + j) % PLAY_LOG_SIZE) * ENTRY;
    const seconds = b.readUInt32LE(o), kind = b.readUInt32LE(o + 4);
    if (!seconds && !kind) continue;
    out.push({
      ms: PLAY_LOG_EPOCH_MS + seconds * 1000, kind,
      name1: b.readUInt32LE(o + 8), name2: b.readUInt32LE(o + 12),
      value1: b.readInt32LE(o + 16), value2: b.readInt32LE(o + 20),
    });
  }
  // The ring order is the write order; if the counters were missing, fall back to the times.
  if (next === undefined) out.sort((a, b) => a.ms - b.ms);
  return out;
}
