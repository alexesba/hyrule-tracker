import { mkdtempSync, mkdirSync, rmSync, utimesSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { murmur3 } from '../src/gamedata/murmur3';
import { parseGameData } from '../src/gamedata/parser';
import { readTotkIsland } from '../src/gamedata/totk';
import { SettingsStore } from '../src/main/settings';
import { TotkTracker } from '../src/main/totk-tracker';
import type { TotkIslandState } from '../src/shared/types';

function save(states: string[]) {
  const records: [number, number][] = [
    [murmur3('IsVisitLocation.BeginningIsland'), 1],
    [murmur3('IsVisitLocation.AncientTimeShrine'), 1],
    [murmur3('IsVisitLocation.Cave_CentralHyrule_0017'), 1],
    [murmur3('IsGetCaveMasterMedal.Cave_CentralHyrule_0017'), 0],
    ...states.map((state, i): [number, number] => [murmur3('IsVisitLocation.Dungeon0' + (60 + i)), Number(state !== 'Hidden')]),
    [0, 6],
    [0x0fc7d184, murmur3('Clear')],
    ...states.map((state, i): [number, number] => [murmur3('DungeonState.Dungeon0' + (60 + i)), murmur3(state)]),
  ];
  const bytes = Buffer.alloc(0x28 + 8 * records.length);
  bytes.writeUInt32LE(0x01020304, 0);
  bytes.writeUInt32LE(0x0047e0f4, 4);
  bytes.writeUInt32LE(bytes.length, 8);
  records.forEach(([key, value], idx) => {
    bytes.writeUInt32LE(key, 0x28 + 8 * idx);
    bytes.writeUInt32LE(value, 0x2c + 8 * idx);
  });
  return bytes;
}

describe('Great Sky Island save progress', () => {
  it('identifies each shrine and preserves the save status independently of route order', () => {
    const progress = readTotkIsland(parseGameData(save(['Open', 'Clear', 'Hidden', 'Enter'])));
    expect(progress.marks).toMatchObject({
      opening: 'done', ukouh: 'found', gutanbac: 'done', 'in-isa': 'pending', nachoyah: 'found',
      pondside: 'done', 'bubbul-pondside': 'pending', 'korok-fc7d184': 'done', recall: 'unknown',
    });
    expect(progress.unverifiedFormat).toBe(false);
    expect(progress.marks['portable-pot']).toBeUndefined();
  });

  it('rejects a different game or a partial shrine table', () => {
    const missing = save(['Hidden', 'Hidden', 'Hidden']);
    expect(() => readTotkIsland(parseGameData(missing))).toThrow(/Tears of the Kingdom/);
  });

  it('follows new writes, keeps a pinned slot independent, and ticks by hand only what the save has not confirmed', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'hyrule-totk-'));
    const prefs = new SettingsStore(join(dir, 'settings.json'));
    let state: TotkIslandState | undefined;
    const tracker = new TotkTracker(prefs, next => { state = next; });
    const write = (slot: string, states: string[], time: number) => {
      mkdirSync(join(dir, slot), { recursive: true });
      const filename = join(dir, slot, 'progress.sav');
      writeFileSync(filename, save(states));
      utimesSync(filename, time, time);
    };

    vi.useFakeTimers();
    try {
      write('slot_00', ['Clear', 'Clear', 'Clear', 'Clear'], 100);
      write('slot_01', ['Open', 'Hidden', 'Hidden', 'Hidden'], 200);
      expect(await tracker.attach(dir)).toBe(true);
      expect(state).toMatchObject({ activeSlot: 'slot_01', marks: { ukouh: 'found' }, status: 'ok' });
      // Found but not cleared in this save: it can be ticked by hand, as on the Ocarina journal.
      expect(tracker.mark('ukouh', true)).toBe(true);
      expect(tracker.mark('portable-pot', true)).toBe(true);
      expect(tracker.mark('not-an-objective', true)).toBe(false);
      await tracker.pin('slot_00');
      expect(state).toMatchObject({ activeSlot: 'slot_00', marks: { ukouh: 'done' }, manual: [] });
      // Cleared in this save: the save decides, so the hand tick is refused.
      expect(tracker.mark('ukouh', true)).toBe(false);
      await tracker.pin(null);
      expect(state).toMatchObject({ activeSlot: 'slot_01', manual: ['ukouh', 'portable-pot'] });
      tracker.start();
      write('slot_01', ['Clear', 'Hidden', 'Hidden', 'Hidden'], 300);
      await vi.advanceTimersByTimeAsync(2100);
      expect(state).toMatchObject({ activeSlot: 'slot_01', marks: { ukouh: 'done' } });
    } finally {
      tracker.stop();
      vi.useRealTimers();
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
