// The live reader's thread: searching the game's memory takes seconds and must not freeze the windows.
// It talks to LiveSource (live.ts) in the main process with the messages typed there.
import { parentPort, workerData } from 'node:worker_threads';
import { LiveReader, type FromWorker, type ToWorker, type WorkerInit } from './live.js';

const port = parentPort!;
const init = workerData as WorkerInit;
const send = (m: FromWorker) => port.postMessage(m);

let nextId = 0;
const games = new Map<number, () => void>();

const reader: LiveReader = new LiveReader({
  hints: init.hints,
  onHint: hex => send({ t: 'hint', hex }),
  // The main process follows the game's saves; the reader waits until it has.
  onGame: (exe, appData, saveDir) => new Promise<void>(resolve => {
    const id = ++nextId;
    games.set(id, resolve);
    send({ t: 'game', id, exe, appData, saveDir });
  }),
  onChange: () => send({ t: 'state', info: reader.info, snapshot: reader.current(), changed: true }),
  onStatus: () => send({ t: 'state', info: reader.info, snapshot: reader.current(), changed: false }),
  onError: e => send({ t: 'error', message: String((e as Error)?.message ?? e) }),
  onPlayer: () => send({ t: 'player', player: reader.player() }),
  onPlayerStage: line => send({ t: 'stage', line }),
});
reader.watchInts = new Set(init.watchInts);
reader.permanentFlags = new Set(init.permanentFlags);

port.on('message', (m: ToWorker) => {
  switch (m.t) {
    case 'ref': reader.setReference(m.ref); return;
    case 'refresh': void Promise.resolve(reader.refreshNow()).finally(() => send({ t: 'refreshed', id: m.id })); return;
    case 'gameDone': games.get(m.id)?.(); games.delete(m.id); return;
    case 'stop':
      reader.stop();
      for (const resolve of games.values()) resolve();
      games.clear();
      port.close();
      return;
  }
});

void reader.start();
