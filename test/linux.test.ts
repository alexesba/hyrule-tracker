import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { matchesImage, parseMaps, parseStartTime } from '../src/main/procmem-linux.js';
import { isWindowsPath, prefixFromEnv, prefixRoaming, toUnixPath, winePrefixes } from '../src/gamedata/wine.js';
import { isGameFile, programName } from '../src/gamedata/saves.js';
import { sweepRanges } from '../src/gamedata/live.js';
import { useX11 } from '../src/main/x11.js';

describe('/proc/<pid>/maps', () => {
  const maps = [
    '555555554000-555555556000 r--p 00000000 08:02 1048602                    /opt/hookshot/hookshot',
    '555555556000-55555555a000 r-xp 00002000 08:02 1048602                    /opt/hookshot/hookshot',
    '7f0000000000-7f0010000000 rw-s 00000000 00:01 4242                       /memfd:HostMemory (deleted)',
    '7f0010000000-7f0020000000 rw-s 10000000 00:01 4242                       /memfd:HostMemory (deleted)',
    '7f0030000000-7f0030100000 rw-p 00000000 00:00 0 ',
    '7f0040000000-7f0040001000 ---p 00000000 00:00 0 ',
    '101000000000-101100000000 rw-p 00000000 00:00 0 ',
    '7ffd2b9e0000-7ffd2ba01000 rw-p 00000000 00:00 0                          [stack]',
    'ffffffffff600000-ffffffffff601000 --xp 00000000 00:00 0                  [vsyscall]',
  ].join('\n');

  it('keeps readable blocks and tells shared, file and anonymous memory apart', () => {
    const r = parseMaps(maps);
    expect(r).toHaveLength(7);
    expect(r[0]).toEqual({ base: 0x555555554000n, size: 0x2000n, type: 0x1000000 });
    expect(r[2]).toEqual({ base: 0x7f0000000000n, size: 0x10000000n, type: 0x40000 });
    expect(r[4].type).toBe(0x20000);
    expect(r.some(x => x.base === 0x7f0040000000n)).toBe(false); // ---p: not readable
  });

  it('gives an emulator sweep its shared guest memory, merged', () => {
    expect(sweepRanges(parseMaps(maps))).toEqual([[0x7f0000000000n, 0x7f0020000000n]]);
  });
});

describe('process matching', () => {
  it('matches a Windows exe run through Wine, by name or argv[0]', () => {
    expect(matchesImage({ comm: 'hookshot.exe', argv0: 'C:\\Games\\Hookshot\\hookshot.exe', exe: '/usr/bin/wine64-preloader' }, 'hookshot.exe')).toBe(true);
    expect(matchesImage({ comm: 'wine64-preloade', argv0: 'Z:\\home\\me\\Longshot\\Longshot.exe', exe: '' }, 'Longshot.exe')).toBe(true);
  });
  it('matches a native build without .exe, and names the kernel cut to 15 characters', () => {
    expect(matchesImage({ comm: 'Triforce', argv0: './Triforce', exe: '/home/me/nx2navi/Triforce' }, 'Triforce.exe')).toBe(true);
    expect(matchesImage({ comm: 'ocarina-reborn-', argv0: '', exe: '' }, 'ocarina-reborn-game.exe')).toBe(true);
  });
  it('does not match other programs', () => {
    expect(matchesImage({ comm: 'bash', argv0: '/bin/bash', exe: '/usr/bin/bash' }, 'hookshot.exe')).toBe(false);
    expect(matchesImage({ comm: 'hookshot-helper', argv0: '/opt/x/hookshot-helper', exe: '' }, 'hookshot.exe')).toBe(false);
  });
  it('reads the start time even when the process name has spaces and parentheses', () => {
    const stat = '1234 (my (odd) game) S 1 1234 1234 0 -1 4194560 100 0 0 0 5 2 0 0 20 0 8 0 987654 123456 789';
    expect(parseStartTime(stat)).toBe('987654');
  });
});

describe('Wine paths', () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'wine-'));
  const prefix = path.join(tmp, 'pfx');
  fs.mkdirSync(path.join(prefix, 'drive_c', 'users', 'steamuser', 'AppData', 'Roaming', 'Longshot'), { recursive: true });
  fs.mkdirSync(path.join(prefix, 'drive_c', 'users', 'Public'), { recursive: true });
  fs.mkdirSync(path.join(prefix, 'drive_c', 'Games', 'Hookshot'), { recursive: true });

  it('knows Windows absolute paths', () => {
    expect(isWindowsPath('C:\\Games\\x.exe')).toBe(true);
    expect(isWindowsPath('/home/me')).toBe(false);
  });
  it('turns C:\\ paths into the prefix drive_c, matching case like Windows', () => {
    expect(toUnixPath('C:\\games\\HOOKSHOT\\hookshot.exe', prefix)).toBe(path.join(prefix, 'drive_c', 'Games', 'Hookshot', 'hookshot.exe'));
    expect(toUnixPath('Q:\\nowhere', prefix)).toBeUndefined();
  });
  it('finds the prefix from the environment', () => {
    expect(prefixFromEnv({ WINEPREFIX: '/w' })).toBe('/w');
    expect(prefixFromEnv({ STEAM_COMPAT_DATA_PATH: '/s/compatdata/1' })).toBe(path.join('/s/compatdata/1', 'pfx'));
    expect(prefixFromEnv({}, '/home/me')).toBe(path.join('/home/me', '.wine'));
  });
  it("picks Proton's steamuser for %APPDATA%, never Public", () => {
    expect(prefixRoaming(prefix, 'someone')).toBe(path.join(prefix, 'drive_c', 'users', 'steamuser', 'AppData', 'Roaming'));
  });
  it('lists prefixes from $WINEPREFIX and Steam compatdata', () => {
    const home = path.join(tmp, 'home');
    const compat = path.join(home, '.local', 'share', 'Steam', 'steamapps', 'compatdata', '123', 'pfx');
    fs.mkdirSync(path.join(compat, 'drive_c'), { recursive: true });
    const found = winePrefixes(home, { WINEPREFIX: prefix });
    expect(found).toContain(prefix);
    expect(found.map(p => fs.realpathSync(p))).toContain(fs.realpathSync(compat));
  });
});

describe('program names', () => {
  it('accepts Linux builds of the same programs', () => {
    expect(programName('Hookshot.EXE')).toBe('hookshot');
    expect(isGameFile('hookshot.exe')).toBe(true);
    expect(isGameFile('hookshot')).toBe(true);
    expect(isGameFile('Triforce.AppImage')).toBe(true);
    expect(isGameFile('notes.txt')).toBe(false);
  });
});

describe('X11 or Wayland', () => {
  it('prefers X11 when the session advertises a display', () => {
    expect(useX11({ DISPLAY: ':0', WAYLAND_DISPLAY: 'wayland-0' })).toBe(true);
    expect(useX11({ DISPLAY: ':0' })).toBe(true);
  });
  it('leaves backend selection to Electron without DISPLAY', () => {
    expect(useX11({ WAYLAND_DISPLAY: 'wayland-0' })).toBe(false);
    expect(useX11({ DISPLAY: '', XDG_SESSION_TYPE: 'wayland' })).toBe(false);
    expect(useX11({})).toBe(false);
  });
  it('lets the Wayland override take priority', () => {
    expect(useX11({ DISPLAY: ':0', HYRULE_TRACKER_WAYLAND: '1' })).toBe(false);
    expect(useX11({ DISPLAY: ':0', HYRULE_TRACKER_X11: '1', HYRULE_TRACKER_WAYLAND: '1' })).toBe(false);
  });
  it('can be forced to X11', () => {
    expect(useX11({ WAYLAND_DISPLAY: 'wayland-0', HYRULE_TRACKER_X11: '1' })).toBe(true);
  });
  it("uses native Wayland in a Wayland session on NVIDIA's driver, where XWayland showed an invisible window", () => {
    expect(useX11({ DISPLAY: ':0', WAYLAND_DISPLAY: 'wayland-0' }, true)).toBe(false);
    expect(useX11({ DISPLAY: ':0' }, true)).toBe(true); // a plain X11 session
    expect(useX11({ DISPLAY: ':0', WAYLAND_DISPLAY: 'wayland-0', HYRULE_TRACKER_X11: '1' }, true)).toBe(true);
  });
});
