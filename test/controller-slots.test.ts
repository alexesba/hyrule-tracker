import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { murmur3 } from '../src/gamedata/murmur3.js';
import { MAGIC, parseGameData, TYPE_NAMES } from '../src/gamedata/parser.js';
import * as saves from '../src/gamedata/saves.js';
import { Controller } from '../src/main/controller.js';
import { LiveSource } from '../src/main/live.js';
import { SettingsStore } from '../src/main/settings.js';
import discoveries from '../data/easter-eggs.json';

describe('a temporarily missing pinned slot', () => {
  let dir: string;
  let settings: SettingsStore;
  let controller: Controller;
  const itemId = 'minigames.shooting_child_expert';
  const marked = () => controller.state.categories.flatMap(c => c.items).find(i => i.id === itemId)?.done;
  const movePinned = (restore = false) => {
    const file = join(dir, 'slot_00', 'progress.sav');
    renameSync(restore ? file + '.pending' : file, restore ? file : file + '.pending');
  };

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'hyrule-pinned-'));
    for (const [slot, hour] of [['slot_00', 10], ['slot_01', 11]] as const) {
      mkdirSync(join(dir, slot));
      const buffer = Buffer.alloc(0x38);
      buffer.writeUInt32LE(0x01020304, 0);
      buffer.writeUInt32LE(0x002d80eb, 4);
      buffer.writeUInt32LE(buffer.length, 8);
      buffer.writeUInt32LE(2, 0x2c);
      buffer.writeUInt32LE(murmur3('PlayerStatus.MaxLife'), 0x30);
      buffer.writeUInt32LE(28, 0x34);
      const file = join(dir, slot, 'progress.sav');
      writeFileSync(file, buffer);
      const stamp = new Date(2026, 0, 1, hour);
      utimesSync(file, stamp, stamp);
    }
    settings = new SettingsStore(join(dir, 'settings.json'));
    settings.data.saveDir = dir;
    controller = new Controller({ appDir: fileURLToPath(new URL('..', import.meta.url)),
      userData: dir, snapshots: join(dir, 'snapshots'), version: 'test', noLive: true }, settings);
  });

  afterEach(() => {
    controller.stop();
    vi.restoreAllMocks();
    rmSync(dir, { recursive: true, force: true });
  });

  it('reads and writes recent marks during fallback, then resumes the pin when its save returns', async () => {
    await controller.start();
    controller.stop(); // Make each refresh explicit, without a concurrent watcher.
    await controller.toggleManual(itemId);
    expect(marked()).toBe(true);
    await controller.pinSlot('slot_00');
    expect(marked()).toBe(false);
    movePinned();
    await controller.refresh(false);
    expect(controller.state).toMatchObject({ slotMode: 'recent', activeSlot: 'slot_01' });
    expect(marked()).toBe(true);
    await controller.toggleManual(itemId);
    expect(marked()).toBe(false);
    expect(settings.data.manual[`${dir}|@recent`]?.[itemId]).toBeUndefined();
    expect(settings.data.manual[`${dir}|slot_01`]).toBeUndefined();
    expect(settings.data.pinnedSlot).toBe('slot_00');
    movePinned(true);
    await controller.refresh(false);
    expect(controller.state).toMatchObject({ slotMode: 'manual', activeSlot: 'slot_00' });
    expect(marked()).toBe(false);
  });

  it('uses live position and refresh only while the displayed mode follows the latest save', async () => {
    // Stub the process-memory boundary; no running game is needed or accessed.
    vi.spyOn(LiveSource.prototype, 'start').mockResolvedValue();
    vi.spyOn(LiveSource.prototype, 'player').mockReturnValue({ scene: 'ZoraFountain/ZoraFountain_Child',
      pos: { x: 55.27, y: 102.47, z: 23.14, yaw: 52.1 }, atMs: 1 });
    const refresh = vi.spyOn(LiveSource.prototype, 'refreshNow').mockResolvedValue();
    controller.paths.noLive = false;
    await controller.start();
    await controller.pinSlot('slot_00');
    expect(controller.state.player).toBeUndefined();
    movePinned();
    await controller.refreshNow();
    expect(controller.state.slotMode).toBe('recent');
    expect(controller.state.player).toMatchObject({ source: 'live', placeId: 'fuente' });
    expect(refresh).toHaveBeenCalledTimes(1);
    movePinned(true);
    await controller.refreshNow();
    expect(controller.state.slotMode).toBe('manual');
    expect(controller.state.player).toBeUndefined();
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('records live progress and keeps thumbnails from game saves', async () => {
    const file = join(dir, 'settings.json');
    writeFileSync(file, JSON.stringify({ saveDir: dir, captureActivity: true, captureActivityOptIn: true }));
    const oldPhoto = 'data:image/jpeg;base64,b2xk';
    const activityFile = join(dir, 'activity.json');
    writeFileSync(activityFile, JSON.stringify([{ ms: 1, source: 'live', entries: [], screenshot: oldPhoto }]));
    settings = new SettingsStore(file);
    expect(settings.data).not.toHaveProperty('captureActivity');
    expect(settings.data).not.toHaveProperty('captureActivityOptIn');
    controller = new Controller({ ...controller.paths, noLive: false }, settings);

    vi.spyOn(LiveSource.prototype, 'start').mockResolvedValue();
    const progress = join(dir, 'slot_01', 'progress.sav');
    const atMs = Date.now();
    const snapshot = (hearts: number) => {
      const data = parseGameData(readFileSync(progress));
      data.entries.get(murmur3('PlayerStatus.MaxLife'))!.value = hearts * 4;
      return { data, atMs: atMs + hearts, resettable: new Set<bigint>() };
    };
    const current = vi.spyOn(LiveSource.prototype, 'current').mockReturnValue(snapshot(7));
    await controller.start();
    controller.stop();

    current.mockReturnValue(snapshot(8));
    await controller.refresh(true);
    expect(controller.state.activity?.[0]).toMatchObject({ source: 'live', hearts: 1, screenshot: undefined });
    expect(controller.state.activity?.[1]?.screenshot).toBe(oldPhoto);

    const jpeg = Buffer.from('ffd8ffe0ffd9', 'hex');
    const caption = Buffer.alloc(0x3c + jpeg.length);
    caption.writeUInt32LE(MAGIC, 0);
    caption.writeUInt32LE(0x002d80eb, 4);
    caption.writeUInt32LE(0x38, 8);
    caption.writeUInt32LE(TYPE_NAMES.indexOf('Binary'), 0x2c);
    caption.writeUInt32LE(0x63696a32, 0x30);
    caption.writeUInt32LE(0x38, 0x34);
    caption.writeUInt32LE(jpeg.length, 0x38);
    jpeg.copy(caption, 0x3c);
    writeFileSync(join(dir, 'slot_01', 'caption.sav'), caption);
    const save = readFileSync(progress);
    save.writeUInt32LE(9 * 4, 0x34);
    writeFileSync(progress, save);
    const nextSaveTime = new Date(atMs + 1000);
    utimesSync(progress, nextSaveTime, nextSaveTime);
    current.mockReturnValue(undefined);
    await controller.refresh(true);

    const savePhoto = 'data:image/jpeg;base64,' + jpeg.toString('base64');
    expect(controller.state.saveImage).toBe(savePhoto);
    expect(JSON.parse(readFileSync(activityFile, 'utf8'))).toMatchObject([
      { source: 'save', hearts: 1, screenshot: savePhoto },
      { source: 'live', hearts: 1 },
      { source: 'live', screenshot: oldPhoto },
    ]);
  });

  it('lists each program once and opens its latest profile on selection', async () => {
    const progress = readFileSync(join(dir, 'slot_01', 'progress.sav'));
    const programs = ['Hookshot', 'Triforce', 'Longshot-v1', 'Fritchii-v1', 'Lichii'];
    const profiles = programs.map(program => {
      const profile = join(dir, program, 'save');
      mkdirSync(join(profile, 'slot_00'), { recursive: true });
      writeFileSync(join(profile, 'slot_00', 'progress.sav'), progress);
      return profile;
    });
    const [hookshot, triforce, longshot] = profiles;
    const latestTriforce = join(triforce, 'a'.repeat(32));
    const latest = new Date(Math.floor(Date.now() / 1000) * 1000 + 60_000);
    for (const slot of ['slot_02', 'slot_03']) {
      const folder = join(latestTriforce, slot);
      mkdirSync(folder, { recursive: true });
      const file = join(folder, 'progress.sav');
      writeFileSync(file, progress);
      if (slot === 'slot_02') utimesSync(file, latest, latest);
    }
    writeFileSync(join(dir, 'Longshot-v1', 'hookshot.exe'), '');
    writeFileSync(join(dir, 'Fritchii-v1', 'lichii.exe'), '');
    settings.data.saveDir = hookshot;
    vi.spyOn(saves, 'candidateGameFoldersAsync').mockResolvedValue([...programs.map(program => join(dir, program)), triforce]);
    await controller.start();

    expect(await controller.selectSaveFolder(triforce)).toBe(false);
    const choices = await controller.findSaveFolders();
    expect(choices).toHaveLength(5);
    expect(choices.map(choice => choice.program).sort()).toEqual(['Fritchii', 'Hookshot', 'Lichii', 'Longshot', 'Triforce']);
    expect(choices[0]).toEqual({ dir: latestTriforce, program: 'Triforce', lastSavedMs: latest.getTime() });
    expect(controller.state.saveDir).toBe(hookshot);
    expect(await controller.selectSaveFolder(triforce)).toBe(false);
    expect(await controller.selectSaveFolder(latestTriforce)).toBe(true);
    expect(controller.state).toMatchObject({ saveDir: latestTriforce, sourceLabel: 'Triforce', activeSlot: 'slot_02' });
    expect(settings.data.manualSaveDir).toBe(true);
    await controller.pinSlot('slot_03');
    expect(controller.state.activeSlot).toBe('slot_03');
    await controller.scanFolders();
    expect(controller.state.saveDir).toBe(latestTriforce);

    rmSync(join(longshot, 'slot_00', 'progress.sav'));
    expect(await controller.selectSaveFolder(longshot)).toBe(false);
    expect(controller.state.saveDir).toBe(latestTriforce);
  });

  it('keeps the same discoveries with no save, the recent save and a pinned save', async () => {
    const [first, second] = discoveries;
    expect(controller.setEasterEggFound(first.id, true)).toBe(true);
    await controller.start();
    controller.stop();
    const summary = controller.state.summary;
    expect(controller.state.easterEggs).toEqual([first.id]);
    expect(controller.setEasterEggFound('unknown-discovery', true)).toBe(false);
    expect(controller.setEasterEggFound(second.id, true)).toBe(true);
    expect(controller.setEasterEggFound(second.id, true)).toBe(true);
    expect(controller.state.easterEggs).toEqual([first.id, second.id]);
    expect(controller.state.summary).toBe(summary);

    await controller.pinSlot('slot_00');
    expect(controller.state.easterEggs).toEqual([first.id, second.id]);
    await controller.useFolder(undefined);
    expect(controller.state.status).toBe('no-folder');
    expect(controller.state.easterEggs).toEqual([first.id, second.id]);
    const persisted = new SettingsStore(join(dir, 'settings.json'));
    expect(persisted.data.easterEggs).toEqual([first.id, second.id]);
    expect(persisted.data.manual).toEqual({});
  });

  it('keeps the shown discovery unchanged when writing settings fails', () => {
    vi.spyOn(settings, 'save').mockImplementationOnce(() => { throw new Error('Disk full'); });
    expect(() => controller.setEasterEggFound(discoveries[0].id, true)).toThrow('Disk full');
    expect(controller.state.easterEggs).toEqual([]);
    expect(settings.data.easterEggs).toEqual([]);
    expect(controller.setEasterEggFound(discoveries[0].id, true)).toBe(true);
    expect(controller.setEasterEggFound(discoveries[0].id, false)).toBe(true);
    expect(controller.state.easterEggs).toEqual([]);
  });

  it('combines marks from preview builds that saved separate lists', () => {
    const [first, second] = discoveries;
    const file = join(dir, 'settings.json');
    writeFileSync(file, JSON.stringify({ easterEggs: {
      standalone: { [first.id]: true, [second.id]: false },
      [`${dir}|@recent`]: { [first.id]: true, [second.id]: true },
    } }));
    expect(new SettingsStore(file).data.easterEggs).toEqual([first.id, second.id]);
  });
});

describe('choosing a profile', () => {
  const DAD = 'A1B2C3D4E5F60718293A4B5C6D7E8F90', SON = '0F1E2D3C4B5A69788796A5B4C3D2E1F0'; // made up
  let dir: string;
  const controllers: Controller[] = [];
  beforeEach(() => { dir = mkdtempSync(join(tmpdir(), 'hyrule-profiles-')); });
  afterEach(() => {
    for (const c of controllers.splice(0)) c.stop();
    rmSync(dir, { recursive: true, force: true });
  });
  function play(id: string, hour: number) {
    const slot = join(dir, 'save', id, 'slot_00');
    mkdirSync(slot, { recursive: true });
    const buffer = Buffer.alloc(0x38);
    buffer.writeUInt32LE(0x01020304, 0);
    buffer.writeUInt32LE(0x002d80eb, 4);
    buffer.writeUInt32LE(buffer.length, 8);
    buffer.writeUInt32LE(2, 0x2c);
    buffer.writeUInt32LE(murmur3('PlayerStatus.MaxLife'), 0x30);
    buffer.writeUInt32LE(28, 0x34);
    writeFileSync(join(slot, 'progress.sav'), buffer);
    const stamp = new Date(2026, 0, 1, hour);
    utimesSync(join(slot, 'progress.sav'), stamp, stamp);
    return join(dir, 'save', id);
  }
  async function open(settings: SettingsStore) {
    const c = new Controller({ appDir: fileURLToPath(new URL('..', import.meta.url)),
      userData: dir, snapshots: join(dir, 'snapshots'), version: 'test', noLive: true }, settings);
    controllers.push(c);
    await c.start();
    return c;
  }

  it('switches to the chosen profile, remembers it, and follows the most recent one when it goes', async () => {
    const dad = play(DAD, 10), son = play(SON, 11);
    const settings = new SettingsStore(join(dir, 'settings.json'));
    settings.data.saveDir = dir;
    const first = await open(settings);
    expect(first.state.saveDir).toBe(son);
    expect(first.state.profiles.map(p => p.id)).toEqual([SON, DAD]);
    expect(first.state.chosenProfile).toBeUndefined();

    await first.selectProfile(DAD);
    expect(first.state.saveDir).toBe(dad);
    expect(first.state.chosenProfile).toBe(DAD);
    first.stop();

    const again = await open(new SettingsStore(join(dir, 'settings.json')));
    expect(again.state.saveDir).toBe(dad);
    // Opening the game folder again keeps the chosen profile, though the other one saved last.
    await again.useFolder(dir);
    expect(again.state.saveDir).toBe(dad);
    await again.selectProfile(null);
    expect(again.state.saveDir).toBe(son);
    expect(again.state.chosenProfile).toBeUndefined();
    again.stop();

    const reopened = new SettingsStore(join(dir, 'settings.json'));
    reopened.data.profile = DAD;
    reopened.data.saveDir = dir;
    rmSync(dad, { recursive: true });
    const gone = await open(reopened);
    expect(gone.state.saveDir).toBe(son);
    expect(gone.state.chosenProfile).toBeUndefined();
  });
});
