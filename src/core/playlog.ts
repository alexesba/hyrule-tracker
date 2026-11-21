// Day-by-day summary of the game's play log (src/gamedata/playlog.ts) for the "Today's record" page.
import { crc32 } from '../gamedata/crc32.js';
import { murmur3 } from '../gamedata/murmur3.js';
import { KIND, type PlayEvent } from '../gamedata/playlog.js';
import { canonicalStage, enemyName, LOCAL_NAMES } from './companion.js';

/** Song actors (CRC32 of the name) -> the song's name as the catalog translates it. */
export const SONGS: Record<string, string> = {
  Item_Melody_ZeldaLullaby: "Zelda's Lullaby", Item_Melody_EponaSong: "Epona's Song",
  Item_Melody_SariaSong: "Saria's Song", Item_Melody_SunSong: "Sun's Song",
  Item_Melody_TimeSong: 'Song of Time', Item_Melody_StormSong: 'Song of Storms',
  Item_Melody_ScarecrowSong: "Scarecrow's Song", Item_Melody_ForestMinuet: 'Minuet of Forest',
  Item_Melody_FireBolero: 'Bolero of Fire', Item_Melody_WaterSerenade: 'Serenade of Water',
  Item_Melody_ShadowNocturne: 'Nocturne of Shadow', Item_Melody_SpiritRequiem: 'Requiem of Spirit',
  Item_Melody_LightPrelude: 'Prelude of Light',
};
const SCENE_ALIASES = ['DodongoCave', 'InsideJabu_Jabu', 'TempleOfTime', 'TempleOfTimeExterior', 'LostWoods',
  'HauntedWasteland', 'MarketEntrance', 'BackAlley', 'InsideDekuTree'];
/** Gaps longer than this between two log entries are breaks (game closed or paused), not time in an area. */
export const IDLE_GAP_MS = 5 * 60_000;
/** Areas visited for less than this are left out of the day's list (passing through). */
const MIN_AREA_SECONDS = 30;
/** Enemy_Tektite_Blue -> "Blue Tektite", the name the catalog translates; others as the Hall of Fallen Foes names them. */
const logEnemyName = (actor: string) => {
  const variant = /^Enemy_([A-Za-z]+)_(Gold|Blue|Red|Ice|Fire)$/.exec(actor);
  return variant ? `${variant[2]} ${variant[1]}` : enemyName(actor);
};

export interface PlayLogNames {
  /** CRC32 -> actor name (Enemy_Stalchild, Item_Melody_SunSong, Player_Child...). */
  actors: Map<number, string>;
  /** Murmur3 -> the area's checklist name (Portuguese source text, translated by the renderer). */
  scenes: Map<number, string>;
}

/** Name tables from the actor names the tracker knows (enemies, items, songs, save key parts). */
export function playLogNames(actorCandidates: Iterable<string>): PlayLogNames {
  const actors = new Map<number, string>();
  for (const name of [...actorCandidates, ...Object.keys(SONGS), 'Player_Child', 'Player_Adult']) actors.set(crc32(name), name);
  const scenes = new Map<number, string>();
  for (const base of [...Object.keys(LOCAL_NAMES), ...SCENE_ALIASES]) {
    const stage = canonicalStage(base);
    if (!stage) continue;
    for (const scene of [base, base + '_Child', base + '_Adult']) scenes.set(murmur3(scene), LOCAL_NAMES[stage]);
  }
  return { actors, scenes };
}

export interface PlayDay {
  /** Enemies Link defeated. */
  enemies: number;
  /** By name, most first; name '' = not identified. */
  enemyNames: { name: string; count: number }[];
  /** Damage from hits, in quarter hearts, and the number of hits. */
  damage: number;
  hits: number;
  songs: { name: string; count: number }[];
  /** Approximate seconds in each area, most first; name '' = an area the tracker can't name. */
  areas: { name: string; seconds: number }[];
}

export interface PlayLogSummary {
  fromMs: number;
  toMs: number;
  /** By local day, "YYYY-MM-DD". */
  days: Record<string, PlayDay>;
}

export const localDay = (ms: number) => { const d = new Date(ms); return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map(n => String(n).padStart(2, '0')).join('-'); };

const ranked = <K extends string>(m: Map<string, number>, key: K) =>
  [...m].sort((a, b) => b[1] - a[1] || Number(!a[0]) - Number(!b[0]) || a[0].localeCompare(b[0])).map(([name, n]) => ({ name, [key]: n }) as { name: string } & Record<K, number>);

export function summarizePlayLog(events: PlayEvent[], names: PlayLogNames, dayOf: (ms: number) => string = localDay): PlayLogSummary | undefined {
  if (!events.length) return;
  type Acc = { enemies: Map<string, number>; songs: Map<string, number>; areas: Map<string, number>; damage: number; hits: number };
  const days = new Map<string, Acc>();
  const acc = (ms: number) => {
    const key = dayOf(ms);
    let a = days.get(key);
    if (!a) days.set(key, a = { enemies: new Map(), songs: new Map(), areas: new Map(), damage: 0, hits: 0 });
    return a;
  };
  const bump = (m: Map<string, number>, k: string, n = 1) => m.set(k, (m.get(k) ?? 0) + n);
  const sceneName = (hash: number) => names.scenes.get(hash) ?? '';

  // Time per area: the time between entries goes to the area Link is in. After a file loads
  // the area isn't known until he leaves it, when the area change names where he came from.
  let current: string | undefined;
  let pending: { ms: number; seconds: number }[] = [];
  const credit = (scene: string) => {
    for (const p of pending) bump(acc(p.ms).areas, scene, p.seconds);
    pending = [];
  };
  for (let i = 0; i < events.length; i++) {
    const e = events[i];
    const prev = events[i - 1];
    if (prev && e.ms > prev.ms && e.ms - prev.ms <= IDLE_GAP_MS) pending.push({ ms: prev.ms, seconds: (e.ms - prev.ms) / 1000 });
    const a = acc(e.ms);
    switch (e.kind) {
      case KIND.defeated: {
        // name1 is who defeated it: Link, or another enemy (a Peahat's larvae when it dies).
        const by = names.actors.get(e.name1);
        if (by && !by.startsWith('Player_')) break;
        const actor = names.actors.get(e.name2);
        bump(a.enemies, actor ? logEnemyName(actor) : '');
        break;
      }
      case KIND.hurt:
        if (e.value2 > 0) { a.damage += e.value2; a.hits++; }
        break;
      case KIND.song: {
        const actor = names.actors.get(e.name1);
        if (actor && SONGS[actor]) bump(a.songs, SONGS[actor]);
        break;
      }
      case KIND.areaChange:
        credit(sceneName(e.name1));
        current = sceneName(e.name2);
        break;
      case KIND.fileLoaded:
        if (current !== undefined) credit(current); else pending = [];
        current = undefined;
        break;
    }
    if (current !== undefined && e.kind !== KIND.areaChange) credit(current);
  }
  if (current !== undefined) credit(current);

  const out: Record<string, PlayDay> = {};
  for (const [key, a] of days) {
    const enemyNames = ranked(a.enemies, 'count');
    out[key] = {
      enemies: enemyNames.reduce((n, e) => n + e.count, 0), enemyNames,
      damage: a.damage, hits: a.hits, songs: ranked(a.songs, 'count'),
      areas: ranked(a.areas, 'seconds').map(r => ({ ...r, seconds: Math.round(r.seconds) })).filter(r => r.seconds >= MIN_AREA_SECONDS),
    };
  }
  return { fromMs: events[0].ms, toMs: events[events.length - 1].ms, days: out };
}
