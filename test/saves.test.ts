import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, it, expect, afterAll, vi } from 'vitest';
import { installationLabel, listProfiles, preferredUserFolder, userFolderForExe, resolveUserFolders, listSlots, mostRecentSlot, OOT_TITLE_ID } from '../src/gamedata/saves.js';

// Made-up game folders in a temp directory (no real saves involved).
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'bt-saves-'));
afterAll(() => fs.rmSync(root, { recursive: true, force: true }));
const PROFILE = '0123456789abcdef0123456789abcdef';
function gameFolder(name: string, { bin = false, saves = true, exe = 'hookshot.exe' } = {}) {
  const dir = path.join(root, name);
  const exeDir = bin ? path.join(dir, 'bin') : dir;
  fs.mkdirSync(exeDir, { recursive: true });
  fs.writeFileSync(path.join(exeDir, exe), '');
  if (saves) {
    const slot = path.join(dir, 'user', 'save', PROFILE, 'slot_00');
    fs.mkdirSync(slot, { recursive: true });
    fs.writeFileSync(path.join(slot, 'progress.sav'), '');
  }
  return { exe: path.join(exeDir, exe), user: path.join(dir, 'user', 'save', PROFILE) };
}

describe('the running game\'s save folder', () => {
  it('finds it next to the exe (Longshot, Hookshot builds)', () => {
    const g = gameFolder('Longshot');
    expect(userFolderForExe(g.exe)).toBe(g.user);
  });
  it('finds it when the exe is in bin\\', () => {
    const g = gameFolder('Hookshot', { bin: true });
    expect(userFolderForExe(g.exe)).toBe(g.user);
  });
  it('finds it next to Triforce.exe (NX2navi builds)', () => {
    const g = gameFolder('Triforce', { exe: 'Triforce.exe' });
    expect(userFolderForExe(g.exe)).toBe(g.user);
  });
  it('finds it next to bin\\relink-game.exe (Project ReLink builds)', () => {
    const g = gameFolder('ReLink', { bin: true, exe: 'relink-game.exe' });
    expect(userFolderForExe(g.exe)).toBe(g.user);
  });
  it('finds it next to bin\\HeyListen.exe (HeyListen builds)', () => {
    const g = gameFolder('HeyListen', { bin: true, exe: 'HeyListen.exe' });
    expect(userFolderForExe(g.exe)).toBe(g.user);
    expect(installationLabel(g.user)).toBe('HeyListen');
  });
  it('gives nothing when that install has no saves yet', () => {
    expect(userFolderForExe(gameFolder('Fresh', { saves: false }).exe)).toBeNull();
  });
});

it('identifies the installation from its directory or executable', () => {
  const { user } = gameFolder('Reborn build', { exe: 'ocarina-reborn-game.exe' });
  const saveDir = path.join(root, 'Library', 'Local save');
  const emulator = path.join(root, 'Library', 'Fritchii');
  fs.mkdirSync(saveDir, { recursive: true });
  fs.mkdirSync(emulator);

  expect(installationLabel(user)).toBe('Ocarina Reborn');
  expect(installationLabel(emulator)).toBe('Fritchii');
  expect(installationLabel(saveDir)).toBeUndefined();
});

it('orders Triforce slots by the timestamp inside the caption when file times tie', () => {
  const { user } = gameFolder('Rotating', { exe: 'Triforce.exe' });
  const stamp = new Date(2026, 10, 16, 18, 0, 0);
  const make = (slot: string, seconds: number) => {
    const dir = path.join(user, slot);
    fs.mkdirSync(dir, { recursive: true });
    const progress = path.join(dir, 'progress.sav');
    fs.writeFileSync(progress, '');
    fs.utimesSync(progress, stamp, stamp);
    const caption = Buffer.alloc(0x2a0);
    caption.writeUInt32LE(0x01020304, 0);
    caption.writeUInt32LE(0x2a0, 8);
    [[0x9811a3f7, 2026], [0xdfd840d3, 11], [0xbd46f485, 16], [0x23f3d75e, 18], [0x27853bf7, 0], [0x5ee50bed, seconds]]
      .forEach(([key, value], i) => { caption.writeUInt32LE(key, 40 + i * 8); caption.writeUInt32LE(value, 44 + i * 8); });
    fs.writeFileSync(path.join(dir, 'caption.sav'), caption);
  };
  make('slot_00', 5);
  make('slot_03', 24);
  expect(mostRecentSlot(listSlots(user)).name).toBe('slot_03');
});

describe("an emulator's save folders", () => {
  const ACCOUNT = 'FEDCBA9876543210FEDCBA9876543210'; // made up
  function emulatorData(root2: string, titles: string[]) {
    const out: Record<string, string> = {};
    for (const t of titles) {
      const dir = path.join(root2, 'nand', 'user', 'save', '0000000000000000', ACCOUNT, t);
      fs.mkdirSync(path.join(dir, 'slot_00'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'slot_00', 'progress.sav'), '');
      out[t] = dir;
    }
    return out;
  }

  it("finds Ocarina of Time's title folder in the data folder, and only that one", () => {
    const d = emulatorData(path.join(root, 'fritchii'), [OOT_TITLE_ID, '0100000000010000']);
    expect(resolveUserFolders(path.join(root, 'fritchii'))).toEqual([d[OOT_TITLE_ID]]);
  });
  it('finds it from any folder on the way down', () => {
    const data = path.join(root, 'fritchii2');
    const d = emulatorData(data, [OOT_TITLE_ID]);
    for (const start of [path.join(data, 'nand', 'user', 'save'), path.join(data, 'nand', 'user', 'save', '0000000000000000'), path.dirname(d[OOT_TITLE_ID]), d[OOT_TITLE_ID]])
      expect(resolveUserFolders(start)).toEqual([d[OOT_TITLE_ID]]);
  });
  it('follows a running emulator to its portable user folder or its data folder', () => {
    const exeDir = path.join(root, 'Fritchii-v1');
    fs.mkdirSync(exeDir, { recursive: true });
    const exe = path.join(exeDir, 'lichii.exe');
    fs.writeFileSync(exe, '');
    const appData = path.join(root, 'AppData');
    const inData = emulatorData(path.join(appData, 'fritchii'), [OOT_TITLE_ID])[OOT_TITLE_ID];
    expect(userFolderForExe(exe, appData)).toBe(inData);
    const portable = emulatorData(path.join(exeDir, 'user'), [OOT_TITLE_ID])[OOT_TITLE_ID];
    const later = new Date(Date.now() + 60_000);
    fs.utimesSync(path.join(portable, 'slot_00', 'progress.sav'), later, later);
    expect(userFolderForExe(exe, appData)).toBe(portable); // the most recently played one
  });
});

describe('Rekarina', () => {
  // As its runtime lays out a game folder: profile/save/<uid> is the committed save, save-tx and save-backup are not.
  function rekarina(dir: string) {
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'Rekarina.exe'), '');
    const user = path.join(dir, 'profile', 'save', PROFILE);
    for (const d of [user, path.join(dir, 'profile', 'save-tx', 'ready-3'), path.join(dir, 'profile', 'save-backup', '20261121T090000Z')]) {
      fs.mkdirSync(path.join(d, 'slot_00'), { recursive: true });
      fs.writeFileSync(path.join(d, 'slot_00', 'progress.sav'), '');
    }
    return user;
  }

  it('finds the committed save in the game folder, or from the launcher\'s folder above it', () => {
    const home = path.join(root, 'Rekarina home');
    const user = rekarina(path.join(home, 'game'));
    expect(resolveUserFolders(path.join(home, 'game'))).toEqual([user]);
    expect(resolveUserFolders(home)).toEqual([user]);
    expect(installationLabel(user)).toBe('Rekarina');
  });
  it('names the install by Rekarina.exe when the folder has another name', () => {
    expect(installationLabel(rekarina(path.join(root, 'Games', 'OoT PC')))).toBe('Rekarina');
  });
  it("looks in the default home and in the game folder the launcher remembers", async () => {
    const appData = path.join(root, 'rk-roaming'), localAppData = path.join(root, 'rk-local');
    const dest = path.join(root, 'D-drive', 'Zelda', 'game');
    fs.mkdirSync(path.join(appData, 'Rekarina'), { recursive: true });
    fs.writeFileSync(path.join(appData, 'Rekarina', 'launcher.json'), JSON.stringify({ game: path.join(root, 'dump'), dest }));
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
    vi.stubEnv('APPDATA', appData);
    vi.stubEnv('LOCALAPPDATA', localAppData);
    try {
      Object.defineProperty(process, 'platform', { value: 'win32' });
      vi.resetModules();
      const { knownGameFolders } = await import('../src/gamedata/saves.js');
      expect(knownGameFolders()).toEqual(expect.arrayContaining([path.join(localAppData, 'Rekarina'), dest]));
    } finally {
      Object.defineProperty(process, 'platform', platform);
      vi.unstubAllEnvs();
    }
  });
});

describe('macOS', () => {
  it("lists nxnative's Ocarina of Time folders (a home without them is fine), and only on macOS", async () => {
    const home = path.join(root, 'mac-home');
    vi.spyOn(os, 'homedir').mockReturnValue(home);
    const platform = Object.getOwnPropertyDescriptor(process, 'platform')!;
    try {
      for (const [name, expected] of [['darwin', true], ['win32', false]] as const) {
        Object.defineProperty(process, 'platform', { value: name });
        vi.resetModules();
        const { knownGameFolders } = await import('../src/gamedata/saves.js');
        const nx = path.join(home, 'Library', 'Application Support', 'nxnative', OOT_TITLE_ID);
        expect(knownGameFolders().includes(nx)).toBe(expected);
        if (expected) expect(knownGameFolders()).toContain(path.join(home, 'Games', 'nxnative', OOT_TITLE_ID));
      }
    } finally {
      Object.defineProperty(process, 'platform', platform);
      vi.restoreAllMocks();
    }
  });
});

describe('profiles', () => {
  const DAD = 'A1B2C3D4E5F60718293A4B5C6D7E8F90', SON = '0F1E2D3C4B5A69788796A5B4C3D2E1F0'; // made up
  function play(dir: string, at: Date) {
    fs.mkdirSync(path.join(dir, 'slot_00'), { recursive: true });
    const file = path.join(dir, 'slot_00', 'progress.sav');
    fs.writeFileSync(file, '');
    fs.utimesSync(file, at, at);
    return dir;
  }
  const earlier = new Date(2026, 0, 1), later = new Date(2026, 0, 2);
  /** profiles.dat as the yuzu family writes it: the folder name is the uuid's high u64 then low u64, both little-endian. */
  function profilesDat(data: string, users: [string, string][], size = 0x650) {
    const buf = Buffer.alloc(size);
    users.forEach(([id, name], i) => {
      const at = 0x10 + i * 0xc8;
      buf.writeBigUInt64LE(BigInt('0x' + id.slice(16)), at);
      buf.writeBigUInt64LE(BigInt('0x' + id.slice(0, 16)), at + 8);
      buf.write(name, at + 0x28, 'utf8');
    });
    const dir = path.join(data, 'nand', 'system', 'save', '8000000000000010', 'su', 'avators');
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'profiles.dat'), buf);
  }
  function emulator(name: string) {
    const data = path.join(root, name);
    const accounts = path.join(data, 'nand', 'user', 'save', '0000000000000000');
    const dad = play(path.join(accounts, DAD, OOT_TITLE_ID), earlier);
    const son = play(path.join(accounts, SON, OOT_TITLE_ID), later);
    play(path.join(accounts, '11111111111111111111111111111111', '0100000000010000'), later); // another game only
    return { data, dad, son };
  }

  it("lists an emulator's accounts that have Ocarina of Time saves, most recent first, with their names", () => {
    const { data, dad, son } = emulator('profiles-named');
    profilesDat(data, [[DAD, 'Pai'], ['22222222222222222222222222222222', 'Ghost'], [SON, 'Filho']]);
    expect(listProfiles(dad)).toEqual([
      { id: SON, dir: son, lastSavedMs: later.getTime(), name: 'Filho' },
      { id: DAD, dir: dad, lastSavedMs: earlier.getTime(), name: 'Pai' },
    ]);
  });
  it('shows no names when profiles.dat is not laid out as expected', () => {
    const { data, dad } = emulator('profiles-odd');
    profilesDat(data, [[DAD, 'Pai'], [SON, 'Filho']], 0x700);
    expect(listProfiles(dad).map(p => p.name)).toEqual([undefined, undefined]);
  });
  it("lists a port's user folders, and nothing for a folder not laid out by profile", () => {
    const save = path.join(root, 'profiles-port', 'user', 'save');
    const dad = play(path.join(save, DAD.toLowerCase()), later);
    play(path.join(save, SON.toLowerCase()), earlier);
    expect(listProfiles(dad).map(p => [p.id, p.name])).toEqual([[DAD, undefined], [SON, undefined]]);
    expect(listProfiles(play(path.join(root, 'profiles-flat'), later))).toEqual([]);
  });
  it('prefers the chosen profile, and the most recent one when it is not chosen or has gone', () => {
    const { data, dad, son } = emulator('profiles-choice');
    expect(preferredUserFolder(resolveUserFolders(data))).toBe(son);
    expect(preferredUserFolder(resolveUserFolders(data), DAD.toLowerCase())).toBe(dad);
    expect(preferredUserFolder([son], DAD)).toBe(dad);
    fs.rmSync(path.dirname(dad), { recursive: true });
    expect(preferredUserFolder(resolveUserFolders(data), DAD)).toBe(son);
  });
  it("doesn't take the chosen profile from another install", () => {
    const other = emulator('profiles-other');
    const ported = play(path.join(root, 'profiles-port2', 'user', 'save', SON), new Date(2026, 0, 3));
    expect(preferredUserFolder([ported, other.dad], DAD)).toBe(ported);
  });
});
