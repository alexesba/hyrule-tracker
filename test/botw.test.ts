import { describe, expect, it } from 'vitest';
import { botwById, botwItems, botwRegions } from '../src/core/botw-world';
import { botwDlcRoutes, botwStory } from '../src/core/botw-guide';
import { readBotwProgress } from '../src/gamedata/botw';
import { crc32 } from '../src/gamedata/crc32';

function save(little: boolean) {
  const words: [string, number | string][] = [
    ['CurrentRupee', 32],
    ['PlayerSavePos', -1045.25],
    ['PlayerSavePos', 140],
    ['PlayerSavePos', 1778.5],
    ['PlayerSavePosMapType', 'Main'],
    ['PlayerSavePosMapType', 'Fiel'],
    ['PlayerSavePosMapType', 'd'],
    ['Clear_Dungeon038', 1],
    ['Clear_Dungeon041', 0],
    ['Location_Dungeon041', 16],
    ['Clear_Dungeon065', 0],
    ['FindDungeon_Activated', 1],
    ['IsGet_PlayerStole2', 0],
    ['FirstTower_Finish', 1],
  ];
  const buffer = Buffer.alloc(16 + words.length * 8);
  const uint = little ? buffer.writeUInt32LE.bind(buffer) : buffer.writeUInt32BE.bind(buffer);
  const float = little ? buffer.writeFloatLE.bind(buffer) : buffer.writeFloatBE.bind(buffer);
  uint(0x471e, 0);
  uint(0xffffffff, 4);
  uint(1, 8);
  words.forEach(([name, value], index) => {
    const offset = 12 + index * 8;
    uint(crc32(name), offset);
    if (typeof value === 'string') buffer.write(value, offset + 4, 'ascii');
    else if (name === 'PlayerSavePos') float(value, offset + 4);
    else uint(value, offset + 4);
  });
  uint(0xffffffff, buffer.length - 4);
  return buffer;
}

describe('Breath of the Wild journal', () => {
  it.each([true, false])('synchronizes save objectives and position (little endian: %s)', little => {
    const result = readBotwProgress(save(little));
    expect(result.unverifiedFormat).toBe(false);
    expect(result.world.player).toEqual({ at: [-1045.25, 1778.5], layer: 'surface' });
    expect(result.world.marks).toMatchObject({
      'shrine:Dungeon038': 'done',
      'shrine:Dungeon041': 'found',
      'shrine:Dungeon065': 'pending',
      'quest:FirstTower': 'done',
      'quest:FindDungeon': 'found',
    });
    expect(result.world.marks['shrine:Dungeon009']).toBeUndefined();
  });

  it('rejects a partially written slot or an unrelated file', () => {
    expect(() => readBotwProgress(save(true).subarray(0, -8))).toThrow();
    expect(() => readBotwProgress(Buffer.alloc(128))).toThrow();
  });

  it('links the base game and DLC walkthrough chapters to their own catalog', () => {
    const limits = { shrine: 120, 'dlc-shrine': 16, tower: 15, korok: 900, memory: 18, 'main-quest': 15 };
    for (const [category, total] of Object.entries(limits)) {
      const items = botwItems.filter(item => item.category === category);
      expect(items).toHaveLength(total);
      expect(items.every(item => item.at && item.key && botwRegions.some(region => region.id === item.region))).toBe(true);
    }
    expect(botwItems.filter(item => item.category === 'shrine' && item.region === 'tower:great-plateau-tower')).toHaveLength(4);
    for (const route of [...botwStory, ...botwDlcRoutes]) {
      for (const chapter of route.chapters) {
        expect(botwById.has('quest:' + chapter.quest)).toBe(true);
        for (const id of chapter.objectives?.flat() ?? []) {
          if (!id.startsWith('first:')) expect(botwById.has(id)).toBe(true);
        }
      }
    }
    expect(botwById.size).toBe(botwItems.length);
  });
});
