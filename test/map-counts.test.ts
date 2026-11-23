import { describe, expect, it } from 'vitest';
import { regionCounts, type MapCountRow } from '../src/renderer/mapCounts';

const rows: MapCountRow[] = [
  { area: 'KokiriForest', catId: 'gold_skulltulas', done: false },
  { area: 'KokiriForest', catId: 'gold_skulltulas', done: true },
  { area: 'KokiriForest', catId: 'heart_pieces', done: true },
  { area: 'KokiriForest', catId: 'chests', done: false },
  { area: 'LostWood', catId: 'bottles', done: false },
];

describe('regionCounts', () => {
  it('counts what is still left for every category', () => {
    expect(regionCounts(rows, 'KokiriForest', 'all', 'todo').map(b => [b.catId, b.count])).toEqual([
      ['gold_skulltulas', 1],
      ['chests', 1],
    ]);
  });

  it('counts one chosen category', () => {
    expect(regionCounts(rows, 'KokiriForest', 'gold_skulltulas', 'todo')).toEqual([
      { catId: 'gold_skulltulas', left: 1, total: 2, count: 1 },
    ]);
  });

  it('hides a finished category when only the remainder is shown', () => {
    expect(regionCounts(rows, 'KokiriForest', 'heart_pieces', 'todo')).toEqual([]);
  });

  it('counts what is already taken', () => {
    expect(regionCounts(rows, 'KokiriForest', 'all', 'done').map(b => [b.catId, b.count])).toEqual([
      ['gold_skulltulas', 1],
      ['heart_pieces', 1],
    ]);
  });

  it('counts how many the region has of each category', () => {
    expect(regionCounts(rows, 'KokiriForest', 'all', 'all').map(b => [b.catId, b.count, b.left])).toEqual([
      ['gold_skulltulas', 2, 1],
      ['heart_pieces', 1, 0],
      ['chests', 1, 1],
    ]);
  });

  it('omits a category the region does not have', () => {
    expect(regionCounts(rows, 'LostWood', 'gold_skulltulas', 'todo')).toEqual([]);
  });
});
