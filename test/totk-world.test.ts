import { describe, expect, it } from 'vitest';
import { worldGuide, worldSideRoutes, chapterLocation } from '../src/core/totk-guide';
import { islandBounds, islandMapPoint } from '../src/core/totk-island';
import { totkTileSpan, totkTiles } from '../src/core/totk-map-tiles';
import { isWorldLocation, isWorldManual, questCategories, worldBounds, worldById, worldItems, worldMapPoint, worldRegions, type WorldCategory, type WorldLayer } from '../src/core/totk-world';
import { murmur3 } from '../src/gamedata/murmur3';
import type { GameDataFile, TypeName, Value } from '../src/gamedata/parser';
import { readTotkWorld } from '../src/gamedata/totk-world';

describe('Tears of the Kingdom world catalog', () => {
  it('aligns the atlas tiles and marker projection at both chart scales', () => {
    expect(totkTiles(worldBounds, 2)).toHaveLength(9);
    expect(totkTileSpan(5)).toBe(512);
    expect(totkTiles(islandBounds, 5)).toHaveLength(9);
    const tile = totkTiles(islandBounds, 5).find(({ x, y }) => x === 12 && y === 11)!;
    expect(tile).toEqual({ x: 12, y: 11, west: 144, north: 632 });
    expect(islandMapPoint([tile.west, tile.north])[0]).toBeCloseTo(30.32258);
    expect(islandMapPoint([tile.west, tile.north])[1]).toBeCloseTo(-7.65217);
    expect(worldMapPoint([0, 0])).toEqual([50, 50]);
  });

  it('keeps the known totals, unique identifiers, and valid map placement', () => {
    const items = (type: WorldCategory, layer?: WorldLayer) =>
      worldItems.filter(item => item.category === type && (layer === undefined || layer === item.layer));
    expect(worldById.size).toBe(worldItems.length);
    expect(items('shrine', 'surface')).toHaveLength(120);
    expect(items('shrine', 'sky')).toHaveLength(32);
    expect(items('lightroot', 'depths')).toHaveLength(120);
    expect(items('korok', 'surface')).toHaveLength(841);
    expect(items('korok', 'sky')).toHaveLength(59);
    expect(items('korok').reduce((sum, item) => sum + (item.seeds ?? 1), 0)).toBe(1000);
    expect(items('cave')).toHaveLength(197);
    expect(items('well')).toHaveLength(58);
    expect(items('chasm')).toHaveLength(36);
    expect(items('tablet', 'sky')).toHaveLength(12);
    expect(items('compendium')).toHaveLength(509);
    expect(items('chest').length).toBeGreaterThan(1500);
    expect(['main-quest', 'adventure', 'shrine-quest', 'quest'].map(kind => items(kind as WorldCategory).length)).toEqual([23, 60, 31, 139]);
    for (const item of worldItems) {
      if (item.at) expect(worldMapPoint(item.at).every(n => n >= 0 && n <= 100), item.id).toBe(true);
    }
  });

  it('links the full main guide and optional routes to real quest flags and map locations', () => {
    const main = worldGuide.flatMap(route => route.chapters);
    expect(new Set(main.map(chapter => chapter.quest)).size).toBe(23);
    for (const chapter of [...main, ...worldSideRoutes.flatMap(route => route.chapters)]) {
      expect(worldById.has('quest:' + chapter.quest), chapter.quest).toBe(true);
      expect(chapterLocation(chapter)?.at, chapter.place).toBeDefined();
    }
  });

  it('locates cataloged quests, interior chests and edition-specific memories in tower regions', () => {
    const worldRegionsById = new Set(worldRegions.map(region => region.id));
    expect(worldRegionsById.size).toBe(15);
    expect(worldItems.filter(item => questCategories.has(item.category)).every(item => item.at && item.guide)).toBe(true);
    expect(worldItems.filter(item => item.category === 'chest' && item.interior && item.at)).toHaveLength(225);
    expect(worldItems.filter(item => item.category === 'voice' && isWorldManual(item))).toHaveLength(240);
    expect(worldItems.filter(item => item.category === 'gloom' && isWorldLocation(item))).toHaveLength(49);
    expect(worldItems.filter(item => item.category === 'minigame')).toHaveLength(19);
    expect(worldItems.filter(item => item.at && !worldRegionsById.has(item.region ?? ''))).toHaveLength(0);
  });

  it('reads shrine discovery, lightroot activation, chest GUIDs, quests and the starred clear', () => {
    const data: GameDataFile = {
      version: 0x47e0f4, dataStart: 0, size: 0, entries: new Map(), bool64: new Set(),
      bool64Hash: 1, warnings: [],
    };
    const put = (name: string, type: TypeName, value: Value) => {
      const hash = murmur3(name);
      data.entries.set(hash, { hash, type, value, recordOffset: 0 });
    };
    put('DungeonState.Dungeon000', 'Enum', murmur3('Open'));
    put('ArrivalPointState.CheckPoint000', 'Enum', murmur3('Open'));
    put('Step_SageOfWind', 'Enum', murmur3('GoDungeon'));
    put('Step_DefeatGanondorf', 'Enum', murmur3('FindWhereabouts'));
    put('Step_MainChallenge', 'Enum', murmur3('GoToDeepHole'));
    put('IsGameClear', 'Bool', true);
    put('PlayerStatus.SavePos', 'Vector3', { x: 345, y: -385, z: 1008 });
    const chest = worldItems.find(item => item.category === 'chest')!;
    data.bool64.add(BigInt(String(chest.key).slice(5)));

    const world = readTotkWorld(data);
    expect(world.player).toEqual({ at: [345, 1008], layer: 'depths' });
    expect(world.firstSteps).toContain('SageOfWind');
    expect(world.marks).toMatchObject({
      'shrine:Dungeon000': 'found',
      'lightroot:CheckPoint000': 'done',
      'quest:SageOfWind': 'found',
      'quest:DefeatGanondorf': 'done',
      'quest:MainChallenge': 'done',
      [chest.id]: 'done',
    });
  });
});
