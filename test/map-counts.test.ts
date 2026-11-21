import { describe, expect, it } from 'vitest';
import { regionBadges, type MapCountRow } from '../src/renderer/mapCounts';

const rows: MapCountRow[] = [
  { area: 'KokiriForest', catId: 'gold_skulltulas', done: false },
  { area: 'KokiriForest', catId: 'gold_skulltulas', done: true },
  { area: 'KokiriForest', catId: 'heart_pieces', done: true },
  { area: 'KokiriForest', catId: 'chests', done: false },
  { area: 'LostWood', catId: 'bottles', done: false },
];

describe('regionBadges', () => {
  it('shows only categories that still have some left when every category is selected', () => {
    expect(regionBadges(rows, 'KokiriForest', 'all').map(b => [b.id, b.left])).toEqual([['gold_skulltulas', 1]]);
  });

  it('hides a chosen category once nothing is left', () => {
    expect(regionBadges(rows, 'KokiriForest', 'heart_pieces')).toEqual([]);
  });

  it('keeps the remaining count for the chosen category', () => {
    expect(regionBadges(rows, 'LostWood', 'bottles')).toEqual([
      { id: 'bottles', icon: 'bottle', label: 'Garrafa', left: 1, total: 1 },
    ]);
  });

  it('omits a category the region does not have', () => {
    expect(regionBadges(rows, 'LostWood', 'gold_skulltulas')).toEqual([]);
  });
});
