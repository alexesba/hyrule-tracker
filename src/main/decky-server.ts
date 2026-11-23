import { randomBytes } from 'node:crypto';
import path from 'node:path';
import { Controller } from './controller.js';
import { SettingsStore } from './settings.js';
import { startLanServer } from './lan.js';
import { trackerRpc } from './tracker-rpc.js';
import { isLocale, isString, sanitizeUiPrefs } from './validate.js';

const [appDir, userData, version] = process.argv.slice(2);
if (!appDir || !userData || !version) throw new Error('Decky tracker requires app directory, runtime directory and version.');

const settings = new SettingsStore(path.join(userData, 'settings.json'));
const controller = new Controller({ appDir, userData, snapshots: path.join(userData, 'snapshots'), version, noLive: true }, settings);
const basePath = `/${randomBytes(24).toString('hex')}/`;
const server = await startLanServer({
  root: path.join(appDir, 'ui'),
  host: '127.0.0.1',
  port: 0,
  basePath,
  rpc: {
    ...trackerRpc(controller),
    findSaveFolders: () => controller.findSaveFolders(),
    selectSaveFolder: (dir: unknown) => isString(dir, 4096) ? controller.selectSaveFolder(dir) : false,
    pickSaveFolder: (dir: unknown) => isString(dir, 4096) && path.isAbsolute(dir) ? controller.pickFolder(dir) : controller.state,
    setPrefs: (prefs: unknown) => {
      const ui = sanitizeUiPrefs(prefs, settings.data.ui);
      if (ui) settings.update(saved => { saved.ui = ui; });
      return settings.data.ui;
    },
    setLanguage: (locale: unknown) => { if (isLocale(locale)) settings.update(saved => { saved.locale = locale; }); },
  },
});
const unlistenState = controller.onState(state => server.broadcast('state', state));
const unlistenPlayer = controller.onPlayer(player => server.broadcast('player', player));
async function stop() {
  unlistenState();
  unlistenPlayer();
  controller.stop();
  await server.close();
}
process.once('SIGTERM', () => void stop());
process.once('SIGINT', () => void stop());

const url = new URL(basePath, `http://127.0.0.1:${server.port}`);
url.searchParams.set('decky', '1');
if (settings.data.locale) url.searchParams.set('locale', settings.data.locale);
console.log(JSON.stringify({ url: url.href }));
try {
  await controller.start();
} catch (error) {
  console.error(error);
  await stop();
  process.exitCode = 1;
}
