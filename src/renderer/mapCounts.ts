/** Categories the Hyrule map can count, in the order the rail shows them. */
export interface RailCategory { id: string; label: string; icon?: string }

export const MAP_RAIL: readonly RailCategory[] = [
  { id: 'all', label: 'Todas' },
  { id: 'gold_skulltulas', icon: 'gold_skulltula', label: 'Skulltula dourada' },
  { id: 'heart_pieces', icon: 'heart_piece', label: 'Pedaço de coração' },
  { id: 'heart_containers', icon: 'heart_container', label: 'Recipiente de coração' },
  { id: 'bean_spots', icon: 'magic_bean', label: 'Feijão mágico' },
  { id: 'great_fairies', icon: 'double_magic', label: 'Grande Fada' },
  { id: 'bottles', icon: 'bottle', label: 'Garrafa' },
  { id: 'fairy_thoughts', icon: 'fairy_ocarina', label: 'Pensamento de fada' },
];

export interface MapCountRow { area: string; catId: string; done: boolean }
export interface MapCountBadge { id: string; icon: string; label: string; left: number; total: number }

const counted = MAP_RAIL.filter((cat): cat is RailCategory & { icon: string } => cat.icon != null);

/** Remaining counts for one region. A category with nothing left is left off, so the map shows where to go. */
export function regionBadges(rows: readonly MapCountRow[], area: string, filter: string): MapCountBadge[] {
  const cats = counted.filter(cat => filter === 'all' || cat.id === filter);
  const out: MapCountBadge[] = [];
  for (const cat of cats) {
    let total = 0;
    let left = 0;
    for (const row of rows) {
      if (row.area !== area || row.catId !== cat.id) continue;
      total++;
      if (!row.done) left++;
    }
    if (!total || left === 0) continue;
    out.push({ id: cat.id, icon: cat.icon, label: cat.label, left, total });
  }
  return out;
}
