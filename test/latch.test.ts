import { describe, expect, it } from 'vitest';
import { GOSSIP_STONE_FLAGS } from '../src/core/companion.js';
import { continuesPlaythrough, gossipItemIdsFromChangeLog, gossipItemIdsRising, gossipItemIdsTrue, gossipStoneItemId } from '../src/gamedata/latch.js';
import { hex32, murmur3 } from '../src/gamedata/murmur3.js';
import type { Entry, GameDataFile } from '../src/gamedata/parser.js';

const file = (values: [number, boolean][], flags: bigint[] = []): GameDataFile => ({
  version: 1, dataStart: 0, size: 0, warnings: [], bool64: new Set(flags),
  entries: new Map(values.map(([hash, value]): [number, Entry] => [hash, { hash, type: 'Bool', value, recordOffset: 0 }])),
});

describe('gossip stones remembered from a report', () => {
  const flag = 'BlewOcarinaByGossipStone.GOSSIP_KOKIRI_FOREST_01';
  const stone = murmur3(flag);
  const other = murmur3('SomeOtherFlag');
  const itemId = 'gossip_stones.KOKIRI_FOREST_01';

  it('names one flag for each stone', () => {
    expect(GOSSIP_STONE_FLAGS).toHaveLength(40);
    expect(new Set(GOSSIP_STONE_FLAGS).size).toBe(40);
    expect(gossipStoneItemId(flag)).toBe(itemId);
    expect(hex32(stone)).toBe('0xCCADDC99');
  });

  it('names a stone an earlier save reported after the newest save cleared it', () => {
    const newest = file([[stone, false], [other, false]], [1n]);
    const earlier = file([[stone, true], [other, true]], [1n]);
    expect(gossipItemIdsTrue([newest, earlier])).toEqual([itemId]);
    expect(newest.entries.get(stone)?.value).toBe(false);
  });

  it('names a stone only when this save newly reports it', () => {
    const before = file([[stone, false]]);
    const after = file([[stone, true]]);
    expect(gossipItemIdsRising(after, before)).toEqual([itemId]);
    expect(gossipItemIdsRising(after, after)).toEqual([]);
    expect(gossipItemIdsRising(after)).toEqual([]);
  });

  it('reads a true report from a change log and skips other flags', () => {
    const text = [
      JSON.stringify({ kind: 'change', known: [{ key: hex32(stone), type: 'Bool', old: 'false', new: 'true' }] }),
      JSON.stringify({ kind: 'change', known: [{ key: hex32(stone), type: 'Bool', old: 'true', new: 'false' }] }),
      JSON.stringify({ kind: 'change', known: [{ key: hex32(other), type: 'Bool', old: 'false', new: 'true' }] }),
      'not json',
    ].join('\n');
    expect(gossipItemIdsFromChangeLog(text)).toEqual([itemId]);
  });

  it('ignores a true flag from a different playthrough', () => {
    const newest = file([[stone, false]], [1n]);
    const otherGame = file([[stone, true]], [9n, 8n, 7n, 6n]);
    expect(continuesPlaythrough(newest, otherGame)).toBe(false);
    const kept = [otherGame].filter(save => continuesPlaythrough(newest, save));
    expect(gossipItemIdsTrue(kept)).toEqual([]);
  });
});
