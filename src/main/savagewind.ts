// Savage Wind (github.com/Revivedx/SavageWindRecomp): Breath of the Wild 1.9.0 recompiled for Windows and Linux.
// Its guest addresses are the host's own and the game's main module always sits at 0x70_0000_0000, so Link's
// position is read at the same place every run. The tracker only reads; it never writes to the game.
import fs from 'node:fs';
import path from 'node:path';
import type { Mem } from '../gamedata/live.js';
import type { WorldProgress } from '../core/totk-world.js';

export const SAVAGEWIND_EXE = 'savagewind.exe';

/**
 * Where the game keeps its uking::act::PlayerInfo pointer in 1.9.0, the only version Savage Wind runs
 * (tools/game_sites.py KNOWN['1.9.0'].player_info). Link's position, x y z floats, is at PlayerInfo +0x88:
 * the copy the game rewrites every frame (runtime/control_game.c).
 */
const PLAYER_INFO_SITE = 0x7001e13ed0n;
const POSITION_OFFSET = 0x88n;

/** Link on the surface map, read from the running game; undefined while there's no Link (title screen, loading). */
export function readLivePlayer(mem: Mem): WorldProgress['player'] {
  const pointer = mem.read(PLAYER_INFO_SITE, 8);
  const info = pointer?.readBigUInt64LE(0);
  if (!info) return undefined;
  const pos = mem.read(info + POSITION_OFFSET, 12);
  if (!pos) return undefined;
  const x = pos.readFloatLE(0), z = pos.readFloatLE(8);
  // The same bounds the save's position is held to (gamedata/botw.ts).
  if (!Number.isFinite(x) || !Number.isFinite(z) || Math.abs(x) > 6000 || Math.abs(z) > 5000 || (x === 0 && z === 0)) return undefined;
  return { at: [x, z], layer: 'surface' };
}

/**
 * The save folder in use under a Savage Wind data folder: save/save_0, or the chosen profile's
 * (save_profile.txt names it; profiles live in save-profiles/<name>/save). Holds the slots 0 to 5.
 */
export function savagewindSaveFolder(dataRoot: string): string {
  let profile = '';
  try { profile = fs.readFileSync(path.join(dataRoot, 'save_profile.txt'), 'utf8').trim(); } catch { /* the Default profile */ }
  const save = profile && profile !== 'Default' && !/[\\/]|^\.\.?$/.test(profile)
    ? path.join(dataRoot, 'save-profiles', profile, 'save') : path.join(dataRoot, 'save');
  return path.join(save, 'save_0');
}

/** Savage Wind's data folders that don't depend on where it's installed (Linux, or SAVAGEWIND_DATA_ROOT). */
export function savagewindDataRoots(env = process.env, platform = process.platform): string[] {
  const roots = [env.SAVAGEWIND_DATA_ROOT];
  if (platform === 'linux') {
    const xdg = env.XDG_DATA_HOME && path.isAbsolute(env.XDG_DATA_HOME) ? env.XDG_DATA_HOME : env.HOME && path.join(env.HOME, '.local', 'share');
    roots.push(xdg && path.join(xdg, 'savagewind'));
  }
  return roots.filter((dir): dir is string => !!dir);
}
