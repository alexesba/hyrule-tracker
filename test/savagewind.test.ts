import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { readLivePlayer, savagewindDataRoots, savagewindSaveFolder } from '../src/main/savagewind';

/** Memory holding the PlayerInfo pointer and Link's position, as Savage Wind lays them out. */
function memory(info: bigint, pos?: [number, number, number]) {
  return {
    read(addr: bigint, len: number) {
      if (addr === 0x7001e13ed0n && len === 8) { const b = Buffer.alloc(8); b.writeBigUInt64LE(info); return b; }
      if (pos && addr === info + 0x88n && len === 12) { const b = Buffer.alloc(12); pos.forEach((v, i) => b.writeFloatLE(v, i * 4)); return b; }
      return null;
    },
  };
}

describe('Savage Wind live position', () => {
  it('reads x and z from PlayerInfo +0x88', () => {
    const player = readLivePlayer(memory(0x7250001000n, [-1250.5, 230, 1830.25]));
    expect(player).toEqual({ at: [-1250.5, 1830.25], layer: 'surface' });
  });

  it('has no Link before PlayerInfo exists or outside the map', () => {
    expect(readLivePlayer(memory(0n))).toBeUndefined();
    expect(readLivePlayer(memory(0x7250001000n))).toBeUndefined();
    expect(readLivePlayer(memory(0x7250001000n, [0, 0, 0]))).toBeUndefined();
    expect(readLivePlayer(memory(0x7250001000n, [9000, 0, 100]))).toBeUndefined();
  });
});

describe('Savage Wind saves', () => {
  it('uses save/save_0, or the profile save_profile.txt names', () => {
    const root = fs.mkdtempSync(path.join(os.tmpdir(), 'savagewind-'));
    try {
      expect(savagewindSaveFolder(root)).toBe(path.join(root, 'save', 'save_0'));
      fs.writeFileSync(path.join(root, 'save_profile.txt'), 'Default\n');
      expect(savagewindSaveFolder(root)).toBe(path.join(root, 'save', 'save_0'));
      fs.writeFileSync(path.join(root, 'save_profile.txt'), '100 percent\n');
      expect(savagewindSaveFolder(root)).toBe(path.join(root, 'save-profiles', '100 percent', 'save', 'save_0'));
      fs.writeFileSync(path.join(root, 'save_profile.txt'), '../elsewhere');
      expect(savagewindSaveFolder(root)).toBe(path.join(root, 'save', 'save_0'));
    } finally { fs.rmSync(root, { recursive: true, force: true }); }
  });

  it('knows the Linux data folder and SAVAGEWIND_DATA_ROOT', () => {
    expect(savagewindDataRoots({ HOME: '/home/link' }, 'linux')).toEqual([path.join('/home/link', '.local', 'share', 'savagewind')]);
    expect(savagewindDataRoots({ HOME: '/home/link', XDG_DATA_HOME: '/data' }, 'linux')).toEqual([path.join('/data', 'savagewind')]);
    expect(savagewindDataRoots({ SAVAGEWIND_DATA_ROOT: 'D:\\SW' }, 'win32')).toEqual(['D:\\SW']);
    expect(savagewindDataRoots({}, 'win32')).toEqual([]);
  });
});
