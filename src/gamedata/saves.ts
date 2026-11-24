// Finding save folders and reading saves safely. No Electron imports.
// Saves are only ever read. A read is accepted only when the file looks complete
// (magic matches, size is stable across the read, and the parser accepts it).
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type { SaveFolderChoice } from '../shared/types.js';
import { parseGameData, GameDataFile, MAGIC } from './parser.js';
import { isWindowsPath, prefixUsers, steamLibraries, toUnixPath, userAppData, winePrefixes } from './wine.js';

const isLinux = process.platform === 'linux';
const isMac = process.platform === 'darwin';

export interface SlotInfo {
  name: string; // "slot_03"
  dir: string;
  progress: string;
  caption: string;
  mtimeMs: number; // progress.sav modified time
  savedAtMs?: number; // wall-clock time recorded by the game
}

/** A user folder holds slot_* dirs: <...>\save\<32-hex user id>\ */
export function isUserFolder(dir: string): boolean {
  try {
    return fs.readdirSync(dir).some(n => /^slot_\d+$/.test(n) && fs.existsSync(path.join(dir, n, 'progress.sav')));
  } catch { return false; }
}

/**
 * Given a game folder, a "save" folder, or a user folder, return the user folders inside.
 * Also an emulator's data folder (or any folder down to the account one): see emulatorUserFolders.
 */
export function resolveUserFolders(start: string): string[] {
  if (!fs.existsSync(start)) return [];
  if (isUserFolder(start)) return [start];
  if (/^slot_\d+$/i.test(path.basename(start)) && isUserFolder(path.dirname(start))) return [path.dirname(start)];
  // NX2Saria and Rekarina keep their saves in <game>\profile\save (their launchers' game folder is <install>\game).
  const tries = [start, path.join(start, 'save'), path.join(start, 'user', 'save'), path.join(start, 'profile', 'save'),
    path.join(start, 'game', 'profile', 'save')];
  const out: string[] = [];
  for (const t of tries) {
    if (t !== start && isUserFolder(t)) out.push(t);
    for (const n of readdir(t)) {
      const p = path.join(t, n);
      if (/^[0-9a-f]{32}$/i.test(n) && isUserFolder(p)) out.push(p);
    }
  }
  out.push(...emulatorUserFolders(start));
  return [...new Set(out)];
}

function readdir(dir: string): string[] {
  try { return fs.readdirSync(dir); } catch { return []; }
}

/** Ocarina of Time's title id: emulators keep its saves in a folder named after it. */
export const OOT_TITLE_ID = '0400486024DEC000';

/**
 * Emulators keep saves as <data>\nand\user\save\0000000000000000\<32-hex account>\<title id>\slot_*
 * (<data> is e.g. %APPDATA%\fritchii, or a portable "user" folder next to the exe). Only
 * Ocarina of Time's title folder counts: other games' saves can look alike.
 */
function emulatorUserFolders(start: string): string[] {
  const out: string[] = [];
  const saveDirs = [start, path.join(start, 'save'), path.join(start, 'nand', 'user', 'save'), path.join(start, 'user', 'nand', 'user', 'save')];
  const accountDirs = [...saveDirs, ...saveDirs.map(d => path.join(d, '0000000000000000'))];
  for (const a of accountDirs) {
    const accounts = /^[0-9a-f]{32}$/i.test(path.basename(a)) ? [a] : readdir(a).filter(n => /^[0-9a-f]{32}$/i.test(n)).map(n => path.join(a, n));
    for (const acc of accounts) {
      const title = readdir(acc).find(n => n.toUpperCase() === OOT_TITLE_ID);
      if (title && isUserFolder(path.join(acc, title))) out.push(path.join(acc, title));
    }
  }
  return out;
}

/** Emulator exes, and the data folders (under %APPDATA%) they keep saves in. Fritchii runs as lichii.exe. */
export const EMULATOR_EXES = ['fritchii.exe', 'lichii.exe'];
const EMULATOR_DIRS = ['fritchii', 'lichii', 'eden', 'orchid', 'eglantine', 'pokedinner'];
function emulatorDataDirs(appData = baseDirs().roaming): string[] {
  return EMULATOR_DIRS.map(n => path.join(appData, n));
}

// HeyListen (a Hookshot fork) runs the game as bin\HeyListen.exe on Windows and bin/hookshot on Linux.
export const NATIVE_EXES = ['Triforce.exe', 'hookshot.exe', 'HeyListen.exe', 'Longshot.exe', 'nx2navi.exe', 'relink-game.exe',
  'ocarina-reborn-game.exe', 'ocarina-reborn.exe', 'OcarinaReborn.exe'];
/**
 * NX2Saria's game (ocarina from its launcher, nx2saria from a source build; .exe on Windows). It answers through its
 * tracker API (nx2saria.ts), so it is not in NATIVE_EXES: its memory is not laid out as theirs.
 */
export const NX2SARIA_EXES = ['ocarina.exe', 'nx2saria.exe'];
/** Rekarina's game. Saves only: it keeps guest memory at the same host addresses, not at GUEST_BASE as NATIVE_EXES do. */
export const REKARINA_EXE = 'Rekarina.exe';
const GAME_NAMES = /zelda|ocarina|hookshot|heylisten|longshot|triforce|nx2navi|nx2saria|rekarina|relink|fritchii|lichii|eden|orchid|eglantine|pokedinner/i;
/** A program's name without ".exe" (or a Linux build's ".AppImage" / ".x86_64"), lowercase. */
export const programName = (file: string) => file.toLowerCase().replace(/\.(exe|appimage|x86_64)$/, '');
const GAME_FILES = new Set([...NATIVE_EXES, ...EMULATOR_EXES, ...NX2SARIA_EXES, 'ReLink.exe', REKARINA_EXE].map(programName));
const NX2SARIA_PROGRAMS = new Set(NX2SARIA_EXES.map(programName));
/** A file that runs the game: the Windows exe, or a Linux build of the same name. */
export const isGameFile = (file: string) => GAME_FILES.has(programName(file));
const installations: Record<string, string> = {
  fritchii: 'Fritchii', lichii: 'Lichii', eden: 'Eden', orchid: 'Orchid', eglantine: 'Eglantine',
  pokedinner: 'PokeDinner', triforce: 'Triforce', longshot: 'Longshot', hookshot: 'Hookshot', heylisten: 'HeyListen',
  nx2navi: 'NX2navi', nx2saria: 'NX2Saria', rekarina: 'Rekarina', 'ocarina reborn': 'Ocarina Reborn', 'ocarina-reborn': 'Ocarina Reborn',
  ocarinareborn: 'Ocarina Reborn', 'ocarina-reborn-game': 'Ocarina Reborn', relink: 'ReLink', 'relink-game': 'ReLink',
};
export function installationLabel(saveDir: string): string | undefined {
  const dirs: string[] = [];
  for (let dir = saveDir; dir !== path.dirname(dir) && dirs.length < 9; dir = path.dirname(dir)) dirs.push(dir);
  for (const dir of dirs) {
    const folder = path.basename(dir).toLowerCase();
    const brand = folder.replace(/[-_. ]v?\d.*$/, '');
    if (Object.hasOwn(installations, folder)) return installations[folder];
    if (Object.hasOwn(installations, brand)) return installations[brand];
    if (/^(save|user|nand|[0-9a-f]{16,32})$/.test(folder)) continue;
    const game = readdir(dir).find(file => {
      if (!isGameFile(file)) return false;
      try { return fs.statSync(path.join(dir, file)).isFile(); } catch { return false; }
    });
    // NX2Saria's "ocarina" is named by its file only: a folder called Ocarina is no install of it.
    if (game) return NX2SARIA_PROGRAMS.has(programName(game)) ? 'NX2Saria' : installations[programName(game)];
  }
}
const SEARCH_GROUPS = /^(apps?|programs?|games?|jogos|emulators?|emuladores|downloads|desktop|documents|gamesbuilds?|builds?|ports?|steamapps|common|quiverlauncher)$/i;

/**
 * Absolute folders a launcher's JSON config points to. `prefix`: the config lives in a Wine prefix,
 * so its Windows paths (C:\...) are turned into real ones.
 */
function configPaths(base: string, file: string, keys: string[], prefix?: string): string[] {
  try {
    const config = JSON.parse(fs.readFileSync(path.join(base, file), 'utf8').replace(/^\uFEFF/, ''));
    const values = [config, ...(Array.isArray(config.builds) ? config.builds : [])];
    return values.flatMap(value => keys.map(key => value?.[key]))
      .map(value => (prefix && typeof value === 'string' && isWindowsPath(value) ? toUnixPath(value, prefix) : value))
      .filter((value): value is string => typeof value === 'string' && path.isAbsolute(value));
  } catch { return []; }
}

interface Bases { roaming: string; local: string; storage: string[]; prefix?: string }

/**
 * Where programs keep their data. Windows: %APPDATA% and %LOCALAPPDATA%. Linux: the XDG data and
 * config folders (~/.local/share, ~/.config) stand in for them.
 */
function baseDirs() {
  const home = os.homedir();
  if (isLinux) {
    const roaming = process.env.XDG_DATA_HOME || path.join(home, '.local', 'share');
    const local = process.env.XDG_CONFIG_HOME || path.join(home, '.config');
    const storage = [roaming, local, path.join(home, 'Games'), path.join(home, 'Applications'), path.join(home, 'opt'), '/opt'];
    return { home, roaming, local, storage };
  }
  if (isMac) {
    // macOS: ~/Library/Application Support holds the native ports' data (e.g. nxnative/<title id>/save).
    const roaming = path.join(home, 'Library', 'Application Support');
    return { home, roaming, local: roaming, storage: [roaming, path.join(home, 'Games'), '/Applications', path.join(home, 'Applications')] };
  }
  const roaming = process.env.APPDATA ?? path.join(home, 'AppData', 'Roaming');
  const local = process.env.LOCALAPPDATA ?? path.join(home, 'AppData', 'Local');
  const storage = [roaming, local, path.join(local, 'Programs'), path.join(home, 'Games')];
  return { home, roaming, local, storage };
}

/**
 * Linux only: the other places a game may keep its data. Each Wine/Proton prefix's users (the Windows
 * build run through Wine) and each Flatpak app's data and config folders.
 */
function otherBases(home: string): Bases[] {
  if (!isLinux) return [];
  const out: Bases[] = [];
  for (const prefix of winePrefixes(home)) {
    for (const user of prefixUsers(prefix)) {
      const { roaming, local } = userAppData(user);
      out.push({ roaming, local, prefix, storage: [roaming, local, path.join(local, 'Programs'), path.join(prefix, 'drive_c', 'Games')] });
    }
  }
  for (const app of readdir(path.join(home, '.var', 'app'))) {
    const dir = path.join(home, '.var', 'app', app);
    out.push({ roaming: path.join(dir, 'data'), local: path.join(dir, 'config'), storage: [] });
  }
  return out;
}

function foldersIn({ roaming, local, storage, prefix }: Bases): string[] {
  const native = ['Hookshot', 'HeyListen', 'Longshot', 'Triforce', 'NX2navi', 'NX2Saria', 'Rekarina', 'Ocarina Reborn', 'OcarinaReborn', 'ReLink',
    ...(isLinux ? ['heylisten'] : []), // HeyListen's Linux saves: ~/.local/share/heylisten/save
    ...(isMac ? [`nxnative/${OOT_TITLE_ID}`] : [])];
  return [...emulatorDataDirs(roaming), ...emulatorDataDirs(local),
    ...storage.flatMap(base => native.map(name => path.join(base, name))),
    ...configPaths(local, 'Ocarina Reborn/Config/settings.json', ['game_dir'], prefix),
    ...configPaths(local, 'Ocarina Reborn/Config/build-state.json', ['dest'], prefix),
    ...configPaths(local, 'LongshotLauncher/builds.json', ['folder'], prefix),
    ...configPaths(local, 'LongshotLauncher/settings.json', ['buildsFolder'], prefix),
    ...configPaths(local, 'ReLink/install.json', ['Out'], prefix),
    ...configPaths(roaming, 'Rekarina/launcher.json', ['dest'], prefix)];
}

/** Install folders the ports and emulators use by default, or that launcher config points to. Cheap: no directory walk. */
export function knownGameFolders(): string[] {
  const base = baseDirs();
  return [...new Set([base, ...otherBases(base.home)].flatMap(foldersIn))];
}

interface DirEntry { name: string; isFile(): boolean; isDirectory(): boolean }
const DRIVE_LETTERS = Array.from('CDEFGHIJKLMNOPQRSTUVWXYZ', letter => letter + ':\\');
const SCAN_LIMIT = 2500;
/**
 * Other disks. Windows: drive letters (C: is searched like the others). Linux: what's mounted under
 * /media/<user>, /run/media/<user> and /mnt.
 */
function volumeRoots(): string[] {
  if (process.platform === 'win32') return DRIVE_LETTERS.filter(root => fs.existsSync(root));
  if (!isLinux) return [];
  const user = os.userInfo().username;
  return ['/mnt', path.join('/media', user), path.join('/run/media', user)].flatMap(dir => readdir(dir).map(n => path.join(dir, n)));
}
/** Linux: Steam libraries' game folders and Wine prefixes' C: drives, where Windows builds get installed. */
const linuxRoots = (home: string) => isLinux
  ? [...steamLibraries(home).map(lib => path.join(lib, 'steamapps', 'common')), ...winePrefixes(home).map(p => path.join(p, 'drive_c'))]
  : [];
const scanRoots = (home: string, storage: string[], volumes: string[]) =>
  [...volumes, home, ...storage, path.join(home, 'Downloads'), path.join(home, 'Desktop'), path.join(home, 'Documents'), ...linuxRoots(home)];
/** Holds a game exe, a portable "user" folder, or a save/nand folder under a game-like name. */
const looksLikeGame = (dir: string, entries: DirEntry[]) =>
  entries.some(e => e.isFile() && isGameFile(e.name)) ||
  entries.some(e => e.isDirectory() && e.name.toLowerCase() === 'user') ||
  (GAME_NAMES.test(path.basename(dir)) && entries.some(e => e.isDirectory() && /^(save|nand)$/i.test(e.name)));
/** Sub-folders worth descending into (game-like names, library groupings). */
const subdirsToScan = (entries: DirEntry[], depth: number, library: boolean) => entries.flatMap(entry => {
  if (!entry.isDirectory()) return [];
  const named = GAME_NAMES.test(entry.name);
  const grouping = SEARCH_GROUPS.test(entry.name);
  return named || grouping || (library && depth >= 2 && !entry.name.startsWith('.')) ? [{ name: entry.name, library: named || grouping }] : [];
});
const topLevel = (names: string[]) => names.filter(n => !n.startsWith('.') && !n.startsWith('$'));

/** Look in launcher config, standard data directories and shallow game-library layouts (synchronous; CLI). */
export function candidateGameFolders(): string[] {
  const { home, storage } = baseDirs();
  const volumes = volumeRoots();
  const found = new Set(knownGameFolders());
  const inspected = new Set<string>();
  function scan(dir: string, depth: number, library: boolean) {
    const key = dir.toLowerCase();
    if (inspected.has(key) || inspected.size >= SCAN_LIMIT) return;
    inspected.add(key);
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    if (looksLikeGame(dir, entries)) found.add(dir);
    if (!depth) return;
    for (const sub of subdirsToScan(entries, depth, library)) scan(path.join(dir, sub.name), depth - 1, sub.library);
  }
  for (const root of scanRoots(home, storage, volumes)) scan(root, 4, SEARCH_GROUPS.test(path.basename(root)));
  // Ports can choose the installation folder's name freely. Check top-level folders on
  // secondary drives for recognizable binaries or a portable user/save layout.
  for (const root of volumes.filter(dir => !/^c:/i.test(dir))) {
    for (const name of topLevel(readdir(root))) scan(path.join(root, name), 1, false);
  }
  return [...found];
}

/** The same search as candidateGameFolders without blocking the main process (fs.promises). */
export async function candidateGameFoldersAsync(): Promise<string[]> {
  const { home, storage } = baseDirs();
  const exists = (p: string) => fs.promises.access(p).then(() => true, () => false);
  const volumes = process.platform === 'win32'
    ? (await Promise.all(DRIVE_LETTERS.map(async root => (await exists(root)) ? root : null))).filter((r): r is string => !!r)
    : volumeRoots();
  const found = new Set(knownGameFolders());
  const inspected = new Set<string>();
  async function scan(dir: string, depth: number, library: boolean): Promise<void> {
    const key = dir.toLowerCase();
    if (inspected.has(key) || inspected.size >= SCAN_LIMIT) return;
    inspected.add(key);
    let entries: fs.Dirent[];
    try { entries = await fs.promises.readdir(dir, { withFileTypes: true }); } catch { return; }
    if (looksLikeGame(dir, entries)) found.add(dir);
    if (!depth) return;
    for (const sub of subdirsToScan(entries, depth, library)) await scan(path.join(dir, sub.name), depth - 1, sub.library);
  }
  for (const root of scanRoots(home, storage, volumes)) await scan(root, 4, SEARCH_GROUPS.test(path.basename(root)));
  for (const root of volumes.filter(dir => !/^c:/i.test(dir))) {
    let names: string[] = [];
    try { names = await fs.promises.readdir(root); } catch { /* drive not ready */ }
    for (const name of topLevel(names)) await scan(path.join(root, name), 1, false);
  }
  return [...found];
}

/**
 * A folder the user picked by hand: the profile folder, a slot_* folder, the game or
 * emulator folder, or any folder up to a few levels above a profile folder. Returns the
 * profile folders found (empty if none).
 */
export function resolvePickedFolder(dir: string, maxDepth = 2): string[] {
  const direct = resolveUserFolders(dir);
  if (direct.length) return direct;
  if (!fs.existsSync(dir)) return [];
  const out: string[] = [];
  let level = [dir];
  let visited = 0;
  for (let depth = 0; depth < maxDepth && level.length && !out.length; depth++) {
    const next: string[] = [];
    for (const d of level) {
      let entries: fs.Dirent[];
      try { entries = fs.readdirSync(d, { withFileTypes: true }); } catch { continue; }
      for (const e of entries) {
        if (!e.isDirectory() || e.name.startsWith('.') || e.name.startsWith('$') || /^slot_\d+$/i.test(e.name)) continue;
        if (++visited > 200) return [...new Set(out)];
        const p = path.join(d, e.name);
        // Each folder may itself be a game, save or profile folder (resolveUserFolders knows the layouts).
        const found = resolveUserFolders(p);
        if (found.length) out.push(...found);
        else next.push(p);
      }
    }
    level = next;
  }
  return [...new Set(out)];
}

/**
 * The save folder of the install a running game exe belongs to (exe at the top of the
 * game folder or in bin\), the most recently played profile if there are several. For an
 * emulator: its portable "user" folder next to the exe, or its data folder.
 */
export function userFolderForExe(exe: string, appData?: string): string | null {
  let dir = path.dirname(exe);
  if (path.basename(dir).toLowerCase() === 'bin') dir = path.dirname(dir);
  const image = programName(path.basename(exe));
  const priority = /fritchii/i.test(exe) ? 'fritchii' : /lichii/i.test(exe) ? 'lichii' : undefined;
  const emulatorRoots = emulatorDataDirs(appData);
  const portable = latestUserFolder(resolveUserFolders(dir));
  if (portable) return portable;
  if (EMULATOR_EXES.map(programName).includes(image)) {
    const preferred = emulatorRoots.find(root => path.basename(root) === priority);
    return (preferred && latestUserFolder(resolveUserFolders(preferred))) ||
      latestUserFolder(emulatorRoots.flatMap(resolveUserFolders));
  }
  const roaming = appData ?? baseDirs().roaming;
  // HeyListen's Linux build is bin/hookshot inside its folder and keeps its saves in ~/.local/share/heylisten.
  const brand = /longshot/i.test(exe) ? 'Longshot' : /ocarina[ -]?reborn/i.test(exe) ? 'Ocarina Reborn' :
    /heylisten/i.test(exe) ? (isLinux ? 'heylisten' : 'HeyListen') : /hookshot/i.test(dir) ? 'Hookshot' : undefined;
  return brand ? latestUserFolder(resolveUserFolders(path.join(roaming, brand))) : null;
}

/** The save folder with the most recent save across every install found. */
export function autoDetectUserFolder(): string | null {
  const all = candidateGameFolders().flatMap(g => resolveUserFolders(g));
  return latestUserFolder(all);
}

/** One save folder per program: the most recently played, or the chosen profile there (see preferredUserFolder). */
export function latestSaveFoldersByProgram(folders: string[], profile?: string): SaveFolderChoice[] {
  const seen = new Set<string>();
  const latest = new Map<string | undefined, SaveFolderChoice>();
  for (const dir of new Set(folders.flatMap(resolveUserFolders))) {
    let real: string;
    try { real = fs.realpathSync.native(dir); } catch { continue; }
    if (seen.has(real)) continue;
    seen.add(real);
    const slot = mostRecentSlot(listSlots(dir));
    if (!slot) continue;
    const program = installationLabel(dir);
    const lastSavedMs = slot.savedAtMs ?? slot.mtimeMs;
    const previous = latest.get(program);
    if (!previous || lastSavedMs > previous.lastSavedMs) latest.set(program, { dir, program, lastSavedMs });
  }
  const chosen = [...latest.values()].map(choice => {
    const own = profile ? listProfiles(choice.dir).find(p => p.id === profile.toUpperCase()) : undefined;
    return own ? { ...choice, dir: own.dir, lastSavedMs: own.lastSavedMs } : choice;
  });
  return chosen.sort((a, b) => b.lastSavedMs - a.lastSavedMs);
}

export interface ProfileInfo {
  /** The 32-hex folder name, upper case: the emulator account, or the port's user id. */
  id: string;
  dir: string;
  lastSavedMs: number;
  /** The account's name, when the emulator keeps it readably (profiles.dat). */
  name?: string;
}

const PROFILE_ID = /^[0-9a-f]{32}$/i;
const isTitleFolder = (dir: string) => path.basename(dir).toUpperCase() === OOT_TITLE_ID;

/** The profile a save folder belongs to: <account>\<title id> for emulators, save\<user id> for the ports. */
export function profileIdOf(userDir: string): string | undefined {
  const own = isTitleFolder(userDir) ? path.basename(path.dirname(userDir)) : path.basename(userDir);
  return PROFILE_ID.test(own) ? own.toUpperCase() : undefined;
}

/**
 * Every profile with saves next to this save folder (the same emulator or install), most recently
 * played first. Empty when the folder isn't laid out by profile.
 */
export function listProfiles(userDir: string): ProfileInfo[] {
  if (!profileIdOf(userDir)) return [];
  const emulator = isTitleFolder(userDir);
  const root = emulator ? path.dirname(path.dirname(userDir)) : path.dirname(userDir);
  const names = emulator ? emulatorProfileNames(root) : new Map<string, string>();
  const out: ProfileInfo[] = [];
  for (const n of readdir(root)) {
    if (!PROFILE_ID.test(n)) continue;
    const title = emulator ? readdir(path.join(root, n)).find(t => t.toUpperCase() === OOT_TITLE_ID) : '';
    if (title === undefined) continue;
    const dir = path.join(root, n, title);
    const slot = mostRecentSlot(listSlots(dir));
    if (!slot) continue;
    const id = n.toUpperCase();
    out.push({ id, dir, lastSavedMs: slot.savedAtMs ?? slot.mtimeMs, name: names.get(id) });
  }
  return out.sort((a, b) => b.lastSavedMs - a.lastSavedMs || a.id.localeCompare(b.id));
}

const PROFILES_DAT_SIZE = 0x650, USER_RAW_SIZE = 0xc8, MAX_USERS = 8;

/**
 * Account names from <nand>\system\save\8000000000000010\su\avators\profiles.dat (the yuzu family's layout:
 * 0x10 bytes of header, then 8 records of uuid, uuid2, timestamp, 0x20-byte UTF-8 name, 0x80 of extra data).
 * `accounts` is <nand>\user\save\0000000000000000. A name is kept only when its uuid matches a folder there,
 * so a file laid out differently gives no names instead of wrong ones.
 */
function emulatorProfileNames(accounts: string): Map<string, string> {
  const names = new Map<string, string>();
  const save = path.dirname(accounts), user = path.dirname(save);
  if (path.basename(accounts) !== '0000000000000000' || path.basename(save).toLowerCase() !== 'save' || path.basename(user).toLowerCase() !== 'user') return names;
  const file = path.join(path.dirname(user), 'system', 'save', '8000000000000010', 'su', 'avators', 'profiles.dat');
  let buf: Buffer;
  try { buf = fs.readFileSync(file); } catch { return names; }
  if (buf.length !== PROFILES_DAT_SIZE) return names;
  const folders = new Set(readdir(accounts).filter(n => PROFILE_ID.test(n)).map(n => n.toUpperCase()));
  for (let i = 0; i < MAX_USERS; i++) {
    const at = 0x10 + i * USER_RAW_SIZE;
    // The save folder is the uuid as two little-endian u64s, high half first.
    const hex = (offset: number) => buf.readBigUInt64LE(at + offset).toString(16).toUpperCase().padStart(16, '0');
    const id = hex(8) + hex(0);
    if (!folders.has(id) || /^0+$/.test(id)) continue;
    const raw = buf.subarray(at + 0x28, at + 0x48);
    const end = raw.indexOf(0);
    const name = raw.subarray(0, end < 0 ? raw.length : end).toString('utf8').trim();
    if (name && !/[\u0000-\u001f\u007f�]/.test(name)) names.set(id, name);
  }
  return names;
}

/**
 * The most recently played save folder, or the chosen profile's folder in the same emulator or install
 * when it has saves. Other installs' profiles don't count: ports can share one user id.
 */
export function preferredUserFolder(folders: string[], profile?: string): string | null {
  const latest = latestUserFolder(folders);
  if (!latest || !profile) return latest;
  return listProfiles(latest).find(p => p.id === profile.toUpperCase())?.dir ?? latest;
}

/** Cheap re-check: only these folders and the default install locations, no drive walk. */
export function detectInFolders(candidates: string[]): string | null {
  return latestUserFolder([...new Set([...candidates, ...knownGameFolders()])].flatMap(g => resolveUserFolders(g)));
}

export function latestUserFolder(folders: string[]): string | null {
  return [...new Set(folders)].map(dir => {
    const slot = mostRecentSlot(listSlots(dir));
    return { dir, time: slot?.savedAtMs ?? slot?.mtimeMs ?? 0 };
  }).sort((a, b) => b.time - a.time)[0]?.dir ?? null;
}

export function listSlots(userDir: string): SlotInfo[] {
  let names: string[] = [];
  try { names = fs.readdirSync(userDir).filter(n => /^slot_\d+$/.test(n)).sort(); } catch { return []; }
  const out: SlotInfo[] = [];
  for (const name of names) {
    const dir = path.join(userDir, name);
    const progress = path.join(dir, 'progress.sav');
    try {
      const st = fs.statSync(progress);
      if (!st.isFile()) continue;
      const caption = path.join(dir, 'caption.sav');
      out.push({ name, dir, progress, caption, mtimeMs: st.mtimeMs, savedAtMs: readSaveTime(caption) });
    } catch { /* slot without progress.sav */ }
  }
  return out;
}

export const mostRecentSlot = (slots: SlotInfo[]) => [...slots].sort((a, b) =>
  (b.savedAtMs ?? b.mtimeMs) - (a.savedAtMs ?? a.mtimeMs) || b.mtimeMs - a.mtimeMs || a.name.localeCompare(b.name))[0];

const TIME_FIELDS = [0x9811a3f7, 0xdfd840d3, 0xbd46f485, 0x23f3d75e, 0x27853bf7, 0x5ee50bed];

export function readSaveTime(caption: string): number | undefined {
  try {
    // Only the caption's record table is needed, not the embedded screenshot.
    const table = Buffer.alloc(0x2a0);
    const fd = fs.openSync(caption, 'r');
    let count: number;
    try { count = fs.readSync(fd, table, 0, table.length, 0); } finally { fs.closeSync(fd); }
    if (count !== table.length || table.readUInt32LE(0) !== MAGIC || table.readUInt32LE(8) !== table.length) return;
    const values = new Map<number, number>();
    for (let i = 0x28; i < table.length; i += 8) values.set(table.readUInt32LE(i), table.readUInt32LE(i + 4));
    const [year, month, day, hour, minute, sec = 0] = TIME_FIELDS.map(k => values.get(k));
    if (year === undefined || month === undefined || day === undefined || hour === undefined || minute === undefined) return;
    const date = new Date(year, month - 1, day, hour, minute, sec);
    if (year >= 1980 && year <= 2107 && date.getFullYear() === year && date.getMonth() === month - 1 && date.getDate() === day &&
        date.getHours() === hour && date.getMinutes() === minute && date.getSeconds() === sec) return date.getTime();
  } catch { /* legacy or currently being saved */ }
}

export class IncompleteSaveError extends Error {}

/**
 * Read a save without risking a half-written file: read it into memory, check the
 * size didn't change while reading, check the magic, and parse. Retries a few times.
 */
export async function readSaveStable(file: string, { attempts = 5, delayMs = 300 } = {}): Promise<{ buf: Buffer; data: GameDataFile; mtimeMs: number }> {
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    try {
      const before = fs.statSync(file);
      const buf = fs.readFileSync(file); // read-only: fs.readFileSync opens with flag 'r'
      const after = fs.statSync(file);
      if (before.size !== after.size || before.mtimeMs !== after.mtimeMs || buf.length !== after.size)
        throw new IncompleteSaveError('File changed while reading');
      if (buf.length < 0x28 || buf.readUInt32LE(0) !== MAGIC) throw new IncompleteSaveError('Bad magic (file may be mid-write)');
      return { buf, data: parseGameData(buf), mtimeMs: after.mtimeMs };
    } catch (e) {
      // Missing file or folder: retrying won't bring it back, fail right away.
      const code = (e as NodeJS.ErrnoException)?.code;
      if (code === 'ENOENT' || code === 'ENOTDIR' || code === 'EISDIR') throw e;
      lastErr = e;
      if (i < attempts - 1) await new Promise(r => setTimeout(r, delayMs));
    }
  }
  throw lastErr;
}
