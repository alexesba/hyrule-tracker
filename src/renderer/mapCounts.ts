/**
 * Region a collectible is listed under. A point on the drawing wins. A point in the blank margin
 * does not stay with that region: a checklist region with no floor of its own receives it,
 * and so does a checklist that still claims the miss after it has a floor. Otherwise it is left unmapped.
 * A row with no point stays with the atlas marker the player linked it to.
 */
export function listedRegion(opts: {
  shownRegion?: string
  projectedRegion?: string
  projectedHasFloor: boolean
  checklistRegion?: string
  checklistHasFloor: boolean
  /** The checklist region keeps a point that misses another map, even when it has a floor. */
  checklistClaimsMiss?: boolean
  markerRegion?: string
  placed: boolean
}): string {
  if (opts.shownRegion) return opts.shownRegion;
  if (!opts.placed && opts.markerRegion) return opts.markerRegion;
  if (opts.checklistRegion && opts.checklistClaimsMiss) return opts.checklistRegion;
  if (opts.checklistRegion && opts.checklistRegion !== (opts.projectedRegion ?? '') && !opts.checklistHasFloor) return opts.checklistRegion;
  if (opts.placed && opts.projectedHasFloor && opts.checklistRegion === opts.projectedRegion) return 'unknown';
  if (opts.placed) return opts.projectedRegion || 'unknown';
  return opts.markerRegion || opts.checklistRegion || '';
}

export interface MapCountRow { area: string; catId: string; done: boolean }
export interface MapCount { catId: string; left: number; total: number; count: number }
/** all: how many exist. todo: still to find. done: already taken. */
export type MapBadgeStatus = 'all' | 'todo' | 'done'

/** Counts for the chosen category, or every category when none is chosen. A category with nothing for this status is left off. */
export function regionCounts(rows: readonly MapCountRow[], area: string, filter: string, status: MapBadgeStatus): MapCount[] {
  const order: string[] = [];
  const byCat = new Map<string, { total: number; left: number }>();
  for (const row of rows) {
    if (row.area !== area || (filter !== 'all' && row.catId !== filter)) continue;
    let entry = byCat.get(row.catId);
    if (!entry) {
      entry = { total: 0, left: 0 };
      byCat.set(row.catId, entry);
      order.push(row.catId);
    }
    entry.total++;
    if (!row.done) entry.left++;
  }
  const out: MapCount[] = [];
  for (const catId of order) {
    const entry = byCat.get(catId)!;
    const collected = entry.total - entry.left;
    const count = status === 'done' ? collected : status === 'todo' ? entry.left : entry.total;
    if (!entry.total || count === 0) continue;
    out.push({ catId, left: entry.left, total: entry.total, count });
  }
  return out;
}
