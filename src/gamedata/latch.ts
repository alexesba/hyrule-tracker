import { GOSSIP_STONE_FLAGS } from '../core/companion.js';
import type { GameDataFile } from './parser.js';
import { hex32, murmur3 } from './murmur3.js';

const FLAG_PREFIX = 'BlewOcarinaByGossipStone.GOSSIP_';

/** Checklist id for one ocarina-at-stone flag, e.g. gossip_stones.KOKIRI_FOREST_01. */
export function gossipStoneItemId(flag: string): string {
  return `gossip_stones.${flag.slice(FLAG_PREFIX.length)}`;
}

const itemByHash = new Map(GOSSIP_STONE_FLAGS.map(flag => [hex32(murmur3(flag)).slice(2).toLowerCase(), gossipStoneItemId(flag)]));

function reported(save: GameDataFile, flag: string): boolean {
  return save.entries.get(murmur3(flag))?.value === true;
}

/** Stones whose ocarina flag is true in one of these saves. */
export function gossipItemIdsTrue(saves: readonly GameDataFile[]): string[] {
  return GOSSIP_STONE_FLAGS.filter(flag => saves.some(save => reported(save, flag))).map(gossipStoneItemId);
}

/** Stones this save reports that the previous one did not. No previous save: nothing, so a restart is not a new report. */
export function gossipItemIdsRising(current: GameDataFile, previous?: GameDataFile): string[] {
  if (!previous) return [];
  return GOSSIP_STONE_FLAGS.filter(flag => reported(current, flag) && !reported(previous, flag)).map(gossipStoneItemId);
}

function hashKey(key: string): string | undefined {
  const hex = /^0x([0-9a-f]+)$/i.exec(key.trim());
  return hex ? hex[1].padStart(8, '0').toLowerCase() : undefined;
}

/** Item ids for Gossip Stones a change log already saw go true. */
export function gossipItemIdsFromChangeLog(text: string): string[] {
  const ids: string[] = [];
  const seen = new Set<string>();
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed.startsWith('{')) continue;
    let row: { kind?: string; known?: { key?: string; type?: string; new?: string }[] };
    try { row = JSON.parse(trimmed) as typeof row; } catch { continue; }
    if (row.kind !== 'change' || !row.known) continue;
    for (const change of row.known) {
      if (change.type !== 'Bool' || change.new !== 'true' || !change.key) continue;
      const id = itemByHash.get(hashKey(change.key) ?? '');
      if (!id || seen.has(id)) continue;
      seen.add(id);
      ids.push(id);
    }
  }
  return ids;
}

/** An earlier save still belongs to this playthrough when it has not lost more placed-object flags than a respawn would. */
export function continuesPlaythrough(current: GameDataFile, earlier: GameDataFile, slack = 3): boolean {
  let lost = 0;
  for (const key of earlier.bool64) if (!current.bool64.has(key) && ++lost > slack) return false;
  return true;
}
