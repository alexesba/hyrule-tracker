// Live source: attaches (read-only) to a running game (Hookshot, Longshot, NX2navi or the
// Fritchii emulator), keeps the progress tables located, and reports when tracked values
// change. NX2Saria answers through its tracker API instead (gamedata/nx2saria.ts), on any
// system. Falls back to nothing (the save files) whenever the game isn't running or isn't
// in the same playthrough.
import type { GameDataFile } from '../gamedata/parser.js';
import { locate, readTables, buildLive, fingerprint, matchesReference, sweepRanges, LiveTables, Agreement } from '../gamedata/live.js';
import { MemoryAccessDenied, findProcesses, initMemoryAccess, openProcess, type GameProcess } from './procmem.js';
import { ptraceScope } from './procmem-linux.js';
import { ApiSession } from '../gamedata/nx2saria.js';
import { NATIVE_EXES, EMULATOR_EXES } from '../gamedata/saves.js';
import type { LiveInfo } from '../shared/types.js';
import { PlayerReader, type LivePlayer } from '../gamedata/player.js';

/**
 * Programs that run the game. Hookshot and its fork Longshot run it as hookshot.exe, its fork HeyListen
 * as bin\HeyListen.exe (bin/hookshot on Linux);
 * NX2navi builds it as Triforce.exe and Project ReLink as bin\relink-game.exe. They map the game
 * at a fixed place. The Fritchii
 * emulator (lichii.exe) puts it somewhere new every run, so it's found by sweeping.
 */
const GAMES = [...NATIVE_EXES.map(image => ({ image, emulator: false })),
  ...EMULATOR_EXES.map(image => ({ image, emulator: true }))];
const TICK_MS = 500;
const FIND_EVERY_MS = 3000;
/**
 * Where the tables were in Hookshot v2.1.0, Longshot v1.0.0, and NX2navi's Triforce v0.4.0 and
 * Project ReLink (the same address) (host addresses). Only starting points.
 */
const DEFAULT_HINTS = [0x1010_99f4_f418n, 0x1010_7eea_f418n, 0x1010_8bda_f418n];
/** The game's heap: guest 0x10_0000_0000, ~7 GB, mapped at host base 0x1000_0000_0000. */
const HEAP_LO = 0x1010_0000_0000n, HEAP_HI = 0x1011_c000_0000n;
const SWEEP_WINDOW = 64 << 20; // locate() reads twice this per step
/** Steps overlap a little, so tables lying across two windows are still found whole. */
const SWEEP_STEP = BigInt(SWEEP_WINDOW * 2 - (8 << 20));

export interface LiveOptions {
  /** Table addresses found before (hex), newest first. */
  hints: string[];
  onHint(hex: string): void;
  /**
   * A game was attached to: the full path of its exe if the system gave it, and its %APPDATA% when it runs in a
   * Wine/Proton prefix; or, for a game that says it (NX2Saria), the folder of the save it uses.
   */
  onGame?(exe: string | undefined, appData?: string, saveDir?: string): Promise<void>;
  onChange(): void;
  onStatus(): void;
  /** Attaching to (or reading) the game failed; called once per distinct error, not on every retry. */
  onError?(e: unknown): void;
  /** Link moved (or changed scene). Read it with player(). */
  onPlayer?(): void;
  /** Reading Link's position got further or fell back (a line for the error log, to tell why there's no pin). */
  onPlayerStage?(line: string): void;
}

export class LiveSource {
  info: LiveInfo = { status: 'off' };
  private mem?: GameProcess;
  private tables?: LiveTables;
  private ref?: GameDataFile;
  private timer?: NodeJS.Timeout;
  private lastFind = 0;
  private lastPrint?: string;
  private snapshot?: { data: GameDataFile; atMs: number; resettable: Set<bigint> };
  private emulator = false;
  /** Where the sweep is: ranges to search (host [lo, hi)), the current one and the next window's centre. */
  private sweep?: { ranges: [bigint, bigint][]; i: number; at: bigint };
  private sweepPausedUntil = 0;
  private inFlight?: Promise<void>;
  private playerReader?: PlayerReader;
  private playerNow?: LivePlayer & { atMs: number };
  private playerStage?: string;
  /** NX2Saria's tracker API, while it answers (instead of reading a process). */
  private api?: ApiSession;
  /** Reading another process's memory works on this system (Windows). */
  private memoryAccess = false;
  /** Ticks in a row the API gave no data while live: a few are a save being written or loaded. */
  private apiMisses = 0;
  watchInts = new Set<number>();

  constructor(private opts: LiveOptions) {}

  async start() {
    // Without memory access (koffi missing on Windows), NX2Saria's tracker API is still read.
    this.memoryAccess = await initMemoryAccess();
    this.set({ status: 'no-game' });
    this.timer = setInterval(() => void this.tick(), TICK_MS);
    void this.tick();
  }

  stop() {
    if (this.timer) clearInterval(this.timer);
    this.timer = undefined;
    this.detach();
    this.set({ status: 'off' });
  }

  /** The latest save: tells types apart and confirms we're looking at the same playthrough. */
  setReference(ref: GameDataFile | undefined) {
    if (this.ref === ref) return;
    this.ref = ref;
    this.lastPrint = undefined;
    if (!ref) this.snapshot = undefined;
  }

  /** Link's latest live position, while a game is attached and it could be read. */
  player() { return this.mem || this.api ? this.playerNow : undefined; }

  /** Live data, only while it matches the reference save. */
  current() { return this.info.status === 'live' ? this.snapshot : undefined; }

  refreshNow() {
    if (!this.timer) return;
    this.lastFind = 0;
    this.sweepPausedUntil = 0;
    return this.tick();
  }

  private set(info: LiveInfo) {
    const changed = info.status !== this.info.status || info.detail !== this.info.detail ||
      JSON.stringify(info.detailValues) !== JSON.stringify(this.info.detailValues);
    this.info = info;
    if (changed) { console.log('[live]', info.status, info.detail ?? ''); this.opts.onStatus(); }
  }

  private detach() {
    this.mem?.close();
    this.mem = undefined;
    this.api?.close();
    this.api = undefined;
    this.tables = undefined;
    this.snapshot = undefined;
    this.lastPrint = undefined;
    this.sweep = undefined;
    this.sweepPausedUntil = 0;
    this.playerReader = undefined;
    this.playerStage = undefined;
    if (this.playerNow) { this.playerNow = undefined; this.opts.onPlayer?.(); }
  }

  private tick() {
    this.inFlight ??= this.step().catch(e => {
      if (!this.timer) return; // stopped while a request was out
      this.detach();
      const error = String((e as Error)?.message ?? e);
      if (this.info.detailValues?.error !== error) this.opts.onError?.(e);
      this.set({ status: 'no-game', detail: "Couldn't connect to the game: {error}", detailValues: { error } });
    }).finally(() => {
      this.inFlight = undefined;
    });
    return this.inFlight;
  }

  private async step() {
    if (this.api && !this.api.alive) { this.detach(); this.set({ status: 'no-game' }); }
    if (this.api) return this.apiStep();
    if (this.mem && !this.mem.alive()) { this.detach(); this.set({ status: 'no-game' }); }
    if (!this.mem) {
      if (Date.now() - this.lastFind < FIND_EVERY_MS) return;
      this.lastFind = Date.now();
      // NX2Saria answers for itself and needs no memory reading: asked beside the process search, preferred.
      // A failed process search (tasklist) must neither leak the API connection nor keep NX2Saria from being read.
      const [api, found] = await Promise.all([ApiSession.open(),
        this.memoryAccess ? findGame().then(game => ({ game }), (error: unknown) => ({ error })) : undefined]);
      if (!this.timer) { api?.close(); return; }
      if (api) {
        this.api = api;
        this.apiMisses = 0;
        await this.opts.onGame?.(undefined, undefined, api.saveDir); // follow its saves, not another install's
        if (!this.timer || this.api !== api) return;
        return this.apiStep();
      }
      if (!this.memoryAccess) return this.set({ status: 'unavailable', detail: 'Reading game memory is not available on this system.' });
      if (found && 'error' in found) throw found.error;
      const game = found?.game;
      if (!game) return this.set({ status: 'no-game' });
      try {
        this.mem = openProcess(game.pid);
      } catch (e) {
        if (!(e instanceof MemoryAccessDenied)) throw e;
        // Linux: the game is running but the kernel won't let another program read it (Yama ptrace_scope).
        return this.set(ptraceScope() === 1
          ? { status: 'unavailable', detail: 'Linux blocked reading the game\'s memory. To allow it until the next restart, run {command} in a terminal.', detailValues: { command: 'sudo sysctl kernel.yama.ptrace_scope=0' } }
          : { status: 'unavailable', detail: 'Linux blocked reading the game\'s memory (ptrace_scope {scope}). Only the save files can be followed.', detailValues: { scope: ptraceScope() ?? '?' } });
      }
      this.emulator = !!game.emulator;
      // Link's position: only where guest memory sits at the fixed base (not in emulators).
      if (!this.emulator) { const mem = this.mem; this.playerReader = new PlayerReader(mem, () => mem.regions()); }
      await this.opts.onGame?.(this.mem.imagePath(), this.mem.appData?.());
    }
    if (!this.mem) return;
    this.readPlayer();
    if (!this.ref) return this.set({ status: 'searching', detail: 'Waiting for a save to compare with.' });
    if (!this.tables && !this.find()) return;
    const raw = readTables(this.mem, this.tables!);
    if (!raw) { this.tables = undefined; this.lastPrint = undefined; return this.set({ status: 'searching' }); }
    const print = fingerprint(this.tables!, raw, this.watchInts);
    // Nothing tracked changed: skip rebuilding (most ticks).
    if (print === this.lastPrint && this.info.status === 'live') return;
    this.publish(print, buildLive(this.tables!, raw, this.ref));
  }

  /** NX2Saria: Link's place and the game data, from its tracker API. A failed call drops the connection. */
  private async apiStep() {
    const api = this.api!;
    const p = await api.player();
    if (!this.timer || this.api !== api) return;
    if (p) this.setPlayer(p);
    if (!this.ref) return this.set({ status: 'searching', detail: 'Waiting for a save to compare with.' });
    const live = await api.read(this.ref, this.watchInts);
    if (!this.timer || this.api !== api) return;
    if ('none' in live) {
      if (live.none === 'unsupported')
        return this.set({ status: 'waiting', detail: "NX2Saria's tracker API doesn't read this game version's progress." });
      // A save being written or loaded refuses for a moment: stay live a few ticks before saying so.
      if (this.info.status === 'live' && ++this.apiMisses <= 6) return;
      return this.set({ status: 'waiting', detail: "Couldn't find the progress tables yet. Load your file in the game." });
    }
    this.apiMisses = 0;
    if (live.print === this.lastPrint && this.info.status === 'live') return;
    this.publish(live.print, live);
  }

  /** Use a fresh read when it is the same playthrough as the reference save. */
  private publish(print: string, live: { data: GameDataFile; agreement: Agreement[]; resettable: Set<bigint> }) {
    if (!matchesReference(live.agreement)) {
      this.snapshot = undefined;
      this.lastPrint = undefined;
      return this.set({ status: 'waiting', ...describeMismatch(live.agreement) });
    }
    const wasLive = this.info.status === 'live';
    this.set({ status: 'live' });
    if (print !== this.lastPrint || !wasLive) {
      this.lastPrint = print;
      this.snapshot = { data: live.data, atMs: Date.now(), resettable: live.resettable };
      this.opts.onChange();
    }
  }

  private readPlayer() {
    const reader = this.playerReader;
    const p = reader?.read();
    // 'scanning' comes back every rescan: only the outcomes are worth a log line.
    if (reader && reader.stage !== 'scanning' && reader.stage !== this.playerStage) {
      this.playerStage = reader.stage;
      this.opts.onPlayerStage?.(`Link's position: ${reader.stage} (guest base 0x${reader.base.toString(16)}${reader.stage === 'no-module' ? `; ${reader.scanInfo}` : ''})`);
    }
    if (p) this.setPlayer(p);
  }

  private setPlayer(p: LivePlayer) {
    const prev = this.playerNow;
    const moved = !prev || prev.scene !== p.scene || Math.abs(prev.pos.x - p.pos.x) > 0.05 ||
      Math.abs(prev.pos.y - p.pos.y) > 0.05 || Math.abs(prev.pos.z - p.pos.z) > 0.05 || Math.abs(prev.pos.yaw - p.pos.yaw) > 2;
    if (!moved) return;
    this.playerNow = { ...p, atMs: Date.now() };
    this.opts.onPlayer?.();
  }

  /**
   * Try the saved hints, then the defaults, then sweep one window per tick: the recomps'
   * heap, or an emulator's mapped memory (biggest blocks first).
   */
  private find(): boolean {
    const mem = this.mem!, ref = this.ref!;
    if (Date.now() < this.sweepPausedUntil) return false;
    if (this.sweep === undefined) {
      // After a full sweep found nothing, stay "waiting" rather than flicker back.
      if (this.info.status !== 'waiting') this.set({ status: 'searching' });
      const hints = [...new Set([...this.opts.hints.map(h => BigInt('0x' + h)), ...DEFAULT_HINTS])];
      // Exact spots first (cheap), then a wider window around each. An emulator's memory
      // moves every run, so only a tracker restart during the same run hits a hint there.
      for (const h of hints) { const t = locate(mem, ref, h, 4 << 20); if (t) return this.found(t); }
      if (!this.emulator) for (const h of hints.slice(0, 2)) {
        const t = locate(mem, ref, h, SWEEP_WINDOW);
        if (t) return this.found(t);
      }
      const ranges: [bigint, bigint][] = this.emulator
        ? sweepRanges(mem.regions())
        : [[HEAP_LO, HEAP_HI], ...sweepRanges(mem.regions()).filter(([lo, hi]) => hi <= HEAP_LO || lo >= HEAP_HI)];
      this.sweep = { ranges, i: 0, at: (ranges[0]?.[0] ?? 0n) + BigInt(SWEEP_WINDOW) };
    }
    const s = this.sweep;
    const range = s.ranges[s.i];
    if (range) {
      const t = locate(mem, ref, s.at, SWEEP_WINDOW);
      if (t) return this.found(t);
      s.at += SWEEP_STEP;
      if (s.at - BigInt(SWEEP_WINDOW) >= range[1] && s.ranges[++s.i]) s.at = s.ranges[s.i][0] + BigInt(SWEEP_WINDOW);
    }
    if (!s.ranges[s.i]) {
      // Not found anywhere (e.g. still at the title screen). Try again in a bit.
      this.sweep = undefined;
      this.sweepPausedUntil = Date.now() + 10_000;
      this.set({ status: 'waiting', detail: "Couldn't find the progress tables yet. Load your file in the game." });
    }
    return false;
  }

  private found(t: LiveTables): boolean {
    this.tables = t;
    this.sweep = undefined;
    // The tables showed guest memory somewhere other than the usual base (e.g. under Wine): read Link there too.
    const base = t.location?.checked ? t.location.base : undefined;
    const reader = this.playerReader;
    if (reader && base !== undefined && base !== reader.base && reader.stage !== 'ok') {
      const mem = this.mem!;
      this.playerReader = new PlayerReader(mem, () => mem.regions(), base);
      this.playerStage = undefined;
    }
    const hint = t.records[0].start.toString(16);
    if (hint !== this.opts.hints[0]) { this.opts.hints = [hint, ...this.opts.hints.filter(h => h !== hint)].slice(0, 4); this.opts.onHint(hint); }
    return true;
  }
}

/** The first running game, in the order of GAMES. */
async function findGame(): Promise<{ pid: number; emulator?: boolean } | undefined> {
  for (const g of GAMES) {
    const pids = await findProcesses(g.image);
    const pid = pids.length > 1 ? largest(pids) : pids[0];
    if (pid) return { pid, emulator: g.emulator };
  }
  return undefined;
}

/**
 * Several processes with the same name: HeyListen's launcher and its game are both HeyListen.exe.
 * The game is the one holding gigabytes of memory. One that can't be opened counts as empty.
 */
function largest(pids: number[]): number {
  let best = pids[0], most = -1n;
  for (const pid of pids) {
    let p: GameProcess | undefined;
    try {
      p = openProcess(pid);
      const size = p.regions().reduce((sum, r) => sum + r.size, 0n);
      if (size > most) { most = size; best = pid; }
    } catch { /* not readable: keep looking */ } finally { p?.close(); }
  }
  return best;
}

/** A translatable key (source text) plus its values; the window translates it. */
function describeMismatch(a: Agreement[]): Pick<LiveInfo, 'detail' | 'detailValues'> {
  const b = a.find(x => x.type === 'Bool');
  const k = a.find(x => x.type === 'Bool64bitKey');
  const kept = b?.refTrue ? Math.round((100 * b.liveTrueOfRefTrue!) / b.refTrue) : 100;
  return {
    detail: "The game is running, but its progress doesn't match your latest save ({percent}% of flags, {missing} collected objects missing). On the title screen, or a different file?",
    detailValues: { percent: kept, missing: k ? k.checked - k.agree : 0 },
  };
}
