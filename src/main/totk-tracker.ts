import fs from 'node:fs';
import path from 'node:path';
import { islandObjectives } from '../core/totk-island.js';
import { worldTotals, type TotkHistoryEntry } from '../core/totk-journal.js';
import { isWorldLocation, worldItems, type WorldProgress } from '../core/totk-world.js';
import { readSaveStable } from '../gamedata/saves.js';
import { readTotkIsland } from '../gamedata/totk.js';
import { readTotkWorld } from '../gamedata/totk-world.js';
import { botwItems } from '../core/botw-world.js';
import { readBotwProgress } from '../gamedata/botw.js';
import type { TotkIslandState } from '../shared/types.js';
import type { SettingsStore } from './settings.js';

interface Slot {
  name: string;
  file: string;
  mtimeMs: number;
  size: number;
  changedAt: number;
}

const slotName = /^slot_?[0-9]+$/i;
const botwSlot = /^[0-9]+$/;
// As in the Ocarina tracker, any objective can be ticked by hand until the save confirms it. Places to visit cannot.
const manualIds = new Set([
  ...islandObjectives.map(item => item.id),
  ...worldItems.filter(item => !isWorldLocation(item)).map(item => item.id),
]);

const botwManualIds = new Set(botwItems.filter(item => !isWorldLocation(item)).map(item => item.id));

function readSlots(folder: string, game: 'totk' | 'botw'): Slot[] {
  const slotPattern = game === 'botw' ? botwSlot : slotName;
  const filename = game === 'botw' ? 'game_data.sav' : 'progress.sav';
  let names: string[];
  try { names = fs.readdirSync(folder, { withFileTypes: true }).filter(entry => entry.isDirectory() && slotPattern.test(entry.name)).map(entry => entry.name); }
  catch { return []; }
  if (!names.length) names = [filename];
  return names.sort().flatMap(name => {
    const file = name === filename ? path.join(folder, name) : path.join(folder, name, filename);
    try {
      const stat = fs.statSync(file);
      if (stat.isFile()) return [{ name, file, mtimeMs: stat.mtimeMs, size: stat.size, changedAt: stat.ctimeMs }];
    } catch { /* One slot may be rotating while the game saves. */ }
    return [];
  });
}

const recentSlot = (slots: Slot[]) => slots.reduce<Slot | undefined>((latest, slot) =>
  !latest || slot.mtimeMs > latest.mtimeMs ? slot : latest, undefined);

/** The games' title ids, the folder name the Switch emulators keep each save under. */
const TITLE_IDS = { totk: '0100F2C0115B6000', botw: '01007EF00011E000' } as const;
/** Switch emulators that keep yuzu's folder layout (nand\user\save\<zeros>\<user>\<title id>). */
const EMULATORS = ['eden', 'yuzu', 'suyu', 'sudachi', 'citron'];

/** Where the emulators keep their data: %APPDATA% on Windows, the XDG data folder on Linux. */
function emulatorDataRoots(): string[] {
  if (process.platform === 'win32') return process.env.APPDATA ? [process.env.APPDATA] : [];
  const home = process.env.HOME;
  return [process.env.XDG_DATA_HOME, home && path.join(home, '.local', 'share')].filter((dir): dir is string => !!dir);
}

/**
 * The game's save folders in the Switch emulators' data, newest save first. The folder name is the title id
 * (compared without case, as emulators differ). `roots` is for tests.
 */
export function emulatorSaveFolders(game: 'totk' | 'botw', roots = emulatorDataRoots()): string[] {
  const title = TITLE_IDS[game].toLowerCase();
  const found: { folder: string; mtimeMs: number }[] = [];
  const dirs = (dir: string) => { try { return fs.readdirSync(dir, { withFileTypes: true }).filter(e => e.isDirectory()).map(e => e.name); } catch { return []; } };
  for (const root of roots) for (const emulator of EMULATORS) {
    const saves = path.join(root, emulator, 'nand', 'user', 'save', '0000000000000000');
    for (const user of dirs(saves)) for (const name of dirs(path.join(saves, user))) {
      if (name.toLowerCase() !== title) continue;
      const folder = path.join(saves, user, name);
      const slot = recentSlot(readSlots(folder, game));
      if (slot) found.push({ folder, mtimeMs: slot.mtimeMs });
    }
  }
  return found.sort((a, b) => b.mtimeMs - a.mtimeMs).map(f => f.folder);
}

async function loadSlot(slot: Slot, game: 'totk' | 'botw') {
  if (slot.size > 16 * 1024 * 1024) throw new Error('Save is too large');
  if (game === 'botw') {
    const buffer = await fs.promises.readFile(slot.file);
    const after = await fs.promises.stat(slot.file);
    if (buffer.length !== slot.size || after.size !== slot.size || after.mtimeMs !== slot.mtimeMs || after.ctimeMs !== slot.changedAt)
      throw new Error('Save is changing');
    const progress = readBotwProgress(buffer);
    return { ...progress, marks: {}, updatedAt: after.mtimeMs };
  }
  const result = await readSaveStable(slot.file, { attempts: 2, delayMs: 250 });
  const island = readTotkIsland(result.data);
  return { ...island, world: readTotkWorld(result.data), updatedAt: result.mtimeMs };
}

export class TotkTracker {
  private timer?: ReturnType<typeof setInterval>;
  private revision = 0;
  private busy = 0;
  /** The Switch emulators' folders were searched for a save already (done once, when no folder is chosen). */
  private lookedForEmulators = false;
  private signature?: string;
  private state: TotkIslandState = { status: 'unlinked', slots: [], marks: {}, manual: [] };

  constructor(private settings: SettingsStore, private publish: (state: TotkIslandState) => void,
    private game: 'totk' | 'botw' = 'totk') {}

  start() {
    void this.refresh();
    this.timer = setInterval(() => { if (!this.busy) void this.refresh(); }, 2000);
    this.timer.unref();
  }

  stop() {
    ++this.revision;
    clearInterval(this.timer);
  }

  private get preferences() { return this.settings.data[this.game]; }
  private get allowedMarks() { return this.game === 'botw' ? botwManualIds : manualIds; }

  private manual(folder: string | undefined, pinned?: string): string[] {
    const marks = this.preferences?.manual?.[JSON.stringify([folder, pinned])];
    return Array.isArray(marks) ? marks.filter(id => this.allowedMarks.has(id)) : [];
  }

  private recordProgress(folder: string, slot: string, progress: WorldProgress): TotkHistoryEntry[] {
    const key = JSON.stringify([folder, slot]);
    const stored = this.preferences?.history?.[key];
    const history = Array.isArray(stored) ? stored : [];
    const counts = worldTotals(progress.marks, this.game === 'botw' ? botwItems : worldItems);
    if (JSON.stringify(history.at(-1)?.counts) === JSON.stringify(counts)) return history;
    const next = [...history.slice(-119), { at: Date.now(), counts }];
    this.settings.update(settings => {
      const game = settings[this.game];
      if (!game) return;
      game.history ??= {};
      game.history[key] = next;
    });
    return next;
  }

  private update(state: TotkIslandState) {
    if (JSON.stringify(state) === JSON.stringify(this.state)) return;
    this.state = state;
    this.publish(state);
  }

  async attach(selected: string): Promise<boolean> {
    const slotPattern = this.game === 'botw' ? botwSlot : slotName;
    const parent = slotPattern.test(path.basename(selected)) ? path.dirname(selected) : selected;
    const folder = readSlots(parent, this.game).length ? parent : selected;
    const slot = recentSlot(readSlots(folder, this.game));
    if (!slot) return false;
    const revision = ++this.revision;
    ++this.busy;
    try {
      await loadSlot(slot, this.game);
      if (revision !== this.revision) return false;
      this.settings.update(s => { s[this.game] = { ...s[this.game], folder, pinnedSlot: undefined }; });
      this.signature = undefined;
      await this.refresh(true);
      return true;
    } catch { return false; }
    finally { --this.busy; }
  }

  async pin(name: unknown) {
    if (!this.preferences?.folder ||
        (name !== null && (typeof name !== 'string' || !this.state.slots.includes(name)))) return;
    this.settings.update(s => { s[this.game]!.pinnedSlot = name ?? undefined; });
    await this.refresh(true);
  }

  mark(id: unknown, checked: unknown): boolean {
    if (typeof id !== 'string' || typeof checked !== 'boolean' || !this.allowedMarks.has(id)) return false;
    // The save already counts it: there is nothing left to tick or untick.
    if (this.state.marks[id] === 'done' || this.state.world?.marks[id] === 'done') return false;
    const pinned = this.state.pinnedSlot;
    const manual = new Set(this.manual(this.preferences?.folder, pinned));
    if (manual.has(id) === checked) return true;
    if (checked) manual.add(id);
    else manual.delete(id);
    this.settings.update(s => {
      const game = s[this.game] ??= {};
      game.manual ??= {};
      game.manual[JSON.stringify([game.folder, pinned])] = [...manual];
    });
    this.update({ ...this.state, manual: [...manual] });
    return true;
  }

  async refresh(force = false) {
    const folder = this.preferences?.folder;
    if (typeof folder !== 'string' || !folder) {
      // No folder chosen yet: use the save of a Switch emulator (Eden, yuzu…) if there is one. Once per run.
      if (!this.lookedForEmulators) {
        this.lookedForEmulators = true;
        const [found] = emulatorSaveFolders(this.game);
        if (found && await this.attach(found)) return;
      }
      this.update({ ...this.state, manual: this.manual(undefined) });
      return;
    }
    const slots = readSlots(folder, this.game);
    const pin = this.preferences?.pinnedSlot;
    const pinnedSlot = slots.find(s => s.name === pin)?.name;
    const slot = slots.find(s => s.name === pinnedSlot) ?? recentSlot(slots);
    const names = slots.map(s => s.name);
    const signature = JSON.stringify([pin, names, slot]);
    if (!force && signature === this.signature) return;
    const revision = ++this.revision;
    const base = { slots: names, activeSlot: slot?.name, pinnedSlot, manual: this.manual(folder, pinnedSlot) };
    if (!slot) {
      this.signature = signature;
      this.update({ ...base, status: 'waiting', marks: {} });
      return;
    }
    ++this.busy;
    try {
      const progress = await loadSlot(slot, this.game);
      if (revision !== this.revision) return;
      this.signature = signature;
      const history = this.recordProgress(folder, slot.name, progress.world);
      this.update({ ...base, ...progress, history, manual: this.manual(folder, pinnedSlot), status: 'ok' });
    } catch {
      if (revision !== this.revision) return;
      const previous = this.signature && this.state.activeSlot === slot.name ? this.state : undefined;
      this.update({ ...previous, ...base, marks: previous?.marks ?? {}, manual: this.manual(folder, pinnedSlot), status: 'error' });
    } finally { --this.busy; }
  }
}
