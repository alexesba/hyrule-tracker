// window.tracker for the tracker opened in a browser on another device (served by src/main/lan.ts).
// Progress comes from the PC; display preferences and the language stay on this device.
import type { TrackerApi } from '../preload/preload';
import type { AppState, PlayerState, UiPrefs, UpdateState } from '../shared/types';

type Listener<T> = (v: T) => void;

async function rpc<T>(method: string, ...args: unknown[]): Promise<T> {
  const res = await fetch('./api/rpc', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ method, args }) });
  if (!res.ok) throw new Error(`${method}: ${res.status}`);
  return ((await res.json()) as { result: T }).result;
}

const PREFS = 'hyrule-tracker.remote-prefs';
function storedPrefs(): UiPrefs | undefined {
  try { const raw = localStorage.getItem(PREFS); return raw ? JSON.parse(raw) as UiPrefs : undefined; } catch { return undefined; }
}

/** Whether the page is connected to the PC right now (for a "reconnecting" notice). */
export type Connection = 'connecting' | 'open' | 'lost';

export function createWebApi(chooseFolder?: () => Promise<string | undefined>): TrackerApi & { onConnection: (fn: Listener<Connection>) => () => void } {
  const state = new Set<Listener<AppState>>();
  const player = new Set<Listener<PlayerState | null>>();
  const language = new Set<Listener<string>>();
  const connection = new Set<Listener<Connection>>();
  let source: EventSource | undefined;
  let status: Connection = 'connecting';
  let everOpen = false;

  const setStatus = (s: Connection) => { if (s !== status) { status = s; for (const fn of connection) fn(s); } };
  function connect() {
    if (source) return;
    source = new EventSource('./api/events');
    source.addEventListener('state', e => { const s = JSON.parse((e as MessageEvent).data) as AppState; for (const fn of state) fn(s); });
    source.addEventListener('player', e => { const p = JSON.parse((e as MessageEvent).data) as PlayerState | null; for (const fn of player) fn(p); });
    source.addEventListener('open', () => {
      setStatus('open');
      // Back after a drop: catch up on whatever changed meanwhile.
      if (everOpen) void rpc<AppState>('getState').then(s => { for (const fn of state) fn(s); }).catch(() => {});
      everOpen = true;
    });
    source.addEventListener('error', () => setStatus('lost')); // EventSource retries by itself
  }
  const subscribe = <T>(set: Set<Listener<T>>, fn: Listener<T>) => { connect(); set.add(fn); return () => { set.delete(fn); }; };
  const nothing = () => Promise.resolve(undefined);
  const idle: UpdateState = { status: 'idle' };

  return {
    getState: () => rpc<AppState>('getState'),
    onState: fn => subscribe(state, fn),
    onPlayer: fn => subscribe(player, fn),
    onConnection: fn => { connect(); connection.add(fn); fn(status); return () => { connection.delete(fn); }; },
    // Updates are installed on the PC.
    getUpdate: () => Promise.resolve(idle),
    onUpdate: () => () => {},
    updateNow: () => {},
    updateLater: () => {},
    installUpdate: () => {},
    getPrefs: async () => (!chooseFolder && storedPrefs()) || await rpc<UiPrefs>('getPrefs'),
    setPrefs: async (p: UiPrefs) => {
      if (chooseFolder) return rpc<UiPrefs>('setPrefs', p);
      try { localStorage.setItem(PREFS, JSON.stringify(p)); } catch { /* storage unavailable: keep for this visit */ }
      return p;
    },
    setLanguage: async (locale: string) => {
      if (chooseFolder) await rpc('setLanguage', locale);
      for (const fn of language) fn(locale);
    },
    onLanguage: fn => { language.add(fn); return () => { language.delete(fn); }; },
    pinSlot: (name: string | null) => rpc('pinSlot', name),
    selectProfile: (id: string | null) => rpc<AppState>('selectProfile', id),
    toggleManual: (id: string) => rpc('toggleManual', id),
    setEasterEggFound: (id: string, found: boolean) => rpc<boolean>('setEasterEggFound', id, found),
    refreshProgress: () => rpc<void>('refreshProgress'),
    browseTotkFolder: () => Promise.resolve(null),
    refreshTotk: () => rpc<void>('refreshTotk'),
    pinTotkSlot: (name: string | null) => rpc<void>('pinTotkSlot', name),
    markTotkExtra: (id: string, done: boolean) => rpc<boolean>('markTotkExtra', id, done),
    browseBotwFolder: () => Promise.resolve(null),
    refreshBotw: () => rpc<void>('refreshBotw'),
    pinBotwSlot: (name: string | null) => rpc<void>('pinBotwSlot', name),
    markBotwExtra: (id: string, done: boolean) => rpc<boolean>('markBotwExtra', id, done),
    scanFolders: () => rpc<AppState>('scanFolders'),
    browseFolder: async () => {
      const folder = await chooseFolder?.();
      return folder ? rpc<AppState>('pickSaveFolder', folder) : rpc<AppState>('getState');
    },
    findSaveFolders: () => chooseFolder ? rpc('findSaveFolders') : Promise.resolve([]),
    selectSaveFolder: (dir: string) => chooseFolder ? rpc('selectSaveFolder', dir) : Promise.resolve(false),
    answerIdentify: (reqId: string, itemIds: string[]) => rpc('answerIdentify', reqId, itemIds),
    skipIdentify: (reqId: string) => rpc('skipIdentify', reqId),
    forgetIdentification: (itemId: string) => rpc('forgetIdentification', itemId),
    exportLearned: () => Promise.resolve(''),
    // Desktop only: windows, files and hotkeys of the PC.
    setDevPanel: nothing,
    setChangeLog: nothing,
    openLogFolder: nothing,
    takeSnapshot: nothing,
    openSnapshotFolder: nothing,
    toggleOverlay: nothing,
    toggleOverlayLock: nothing,
    setOverlay: nothing,
    setHotkeys: nothing,
    setLan: () => rpc<AppState>('getState').then(s => s.lan),
    checkLan: () => rpc<AppState>('getState').then(s => s.lan),
    openNetworkSettings: nothing,
  } as TrackerApi & { onConnection: (fn: Listener<Connection>) => () => void };
}
