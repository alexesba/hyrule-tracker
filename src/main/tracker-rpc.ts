import type { Controller } from './controller.js';
import { isString, isStringArray } from './validate.js';

export function trackerRpc(controller: Controller) {
  return {
    getState: () => controller.state,
    getPrefs: () => controller.settings.data.ui,
    pinSlot: (name: unknown) => (name === null || isString(name, 100)) ? controller.pinSlot(name) : undefined,
    selectProfile: (id: unknown) => (id === null || isString(id, 64)) ? controller.selectProfile(id) : undefined,
    toggleManual: (id: unknown) => isString(id) ? controller.toggleManual(id) : undefined,
    setEasterEggFound: (id: unknown, found: unknown) => controller.setEasterEggFound(id, found),
    answerIdentify: (reqId: unknown, itemIds: unknown) => isString(reqId) && isStringArray(itemIds) ? controller.answerIdentify(reqId, itemIds) : undefined,
    skipIdentify: (reqId: unknown) => isString(reqId) ? controller.skipIdentify(reqId) : undefined,
    forgetIdentification: (itemId: unknown) => isString(itemId) ? controller.forgetIdentification(itemId) : undefined,
    refreshProgress: () => controller.refreshNow(),
    refreshTotk: () => controller.totk.refresh(true),
    pinTotkSlot: (name: unknown) => controller.totk.pin(name),
    markTotkExtra: (id: unknown, done: unknown) => controller.totk.mark(id, done),
    refreshBotw: () => controller.botw.refresh(true),
    pinBotwSlot: (name: unknown) => controller.botw.pin(name),
    markBotwExtra: (id: unknown, done: unknown) => controller.botw.mark(id, done),
    scanFolders: () => controller.scanFolders(),
  };
}
