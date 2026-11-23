import type { TrackerApi } from '../preload/preload';
import { currentLocale, date } from './i18n';
import { createWebApi, type Connection } from './webApi';
import { chooseDeckyFolder, inDecky } from './decky';

declare global {
  interface Window { tracker?: TrackerApi }
}
/** Opened in a browser on another device (served on the local network), not in the app's own window. */
export const isRemote = !window.tracker;
export const canChooseSaveFolder = !isRemote || inDecky;
const web = isRemote ? createWebApi(inDecky ? chooseDeckyFolder : undefined) : undefined;
export const api: TrackerApi = window.tracker ?? web!;
/** Remote pages: whether the PC is reachable. The app's own windows are always connected. */
export const onConnection = (fn: (c: Connection) => void) => web ? web.onConnection(fn) : (fn('open'), () => {});

export function timeAgo(ms: number | undefined, now = Date.now()): string {
  if (!ms) return '—';
  const s = Math.max(0, Math.round((now - ms) / 1000));
  const relative = new Intl.RelativeTimeFormat(currentLocale(), { numeric: 'auto', style: 'short' });
  if (s < 10) return relative.format(0, 'second');
  if (s < 60) return relative.format(-s, 'second');
  const m = Math.round(s / 60);
  if (m < 60) return relative.format(-m, 'minute');
  const h = Math.round(m / 60);
  if (h < 24) return relative.format(-h, 'hour');
  return date(ms);
}
