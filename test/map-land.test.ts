import { describe, expect, it } from 'vitest';
import atlas from '../data/atlas.json';
import markers from '../data/world-markers.json';
import { onIllustratedMap } from '../src/core/mapLand';
import { locatePlacement, type AtlasPlace } from '../src/core/position';
import { listedRegion } from '../src/renderer/mapCounts';

const places = atlas.places as AtlasPlace[];

function onKokiri(x: number, y: number, z: number) {
  const fix = locatePlacement('KokiriForest', 'child', { x, y, z }, places).find(f => f.placeId === 'kokiri' && f.mapId === 'principal');
  expect(fix?.at).toBeTruthy();
  return onIllustratedMap(fix!.placeId, fix!.mapId!, fix!.at!);
}

describe('illustrated map', () => {
  it('keeps Kokiri pins on the village and skips the two in the blank margin toward the Lost Woods', () => {
    expect(onKokiri(-50.3, 112.3, -42)).toBe(true);
    expect(onKokiri(89.2, 114.6, -41.8)).toBe(true);
    expect(onKokiri(-70.8, 103.6, -63.4)).toBe(true);
    expect(onKokiri(-132.2, 123.9, -16)).toBe(false);
    expect(onKokiri(-118.4, 114.5, -16.3)).toBe(false);
  });

  it('leaves a floor with no mask alone', () => {
    expect(onIllustratedMap('desierto', 'principal', { x: 0.5, y: 0.5 })).toBe(true);
  });

  it('keeps the Lost Woods tunnels and leaves the parchment margin empty', () => {
    expect(onIllustratedMap('perdido', 'principal', { x: 0.1723, y: 0.7473 })).toBe(true);
    expect(onIllustratedMap('perdido', 'principal', { x: 0.02, y: 0.02 })).toBe(false);
  });

  it('keeps a Lost Woods actor on the Lost Woods list until its coordinate hits a tunnel', () => {
    expect(listedRegion({
      projectedRegion: 'LostWood',
      projectedHasFloor: true,
      checklistRegion: 'LostWood',
      checklistHasFloor: true,
      checklistClaimsMiss: true,
      placed: true,
    })).toBe('LostWood');
  });

  it('lists a Lost Woods gossip stone with the Lost Woods when its point misses another map', () => {
    const stages: Record<string, string> = { kokiri: 'KokiriForest', prado: 'SacredForestMeadow', rio: 'ZoraRiver', perdido: 'LostWood' };
    const atEdge = (at: { x: number; y: number }) => at.x <= 0.021 || at.x >= 0.979 || at.y <= 0.021 || at.y >= 0.979;
    const region = (id: keyof typeof markers, checklist: string, checklistHasFloor: boolean) => {
      const spot = markers[id];
      const fixes = locatePlacement(spot.stage, undefined, { x: spot.x, y: spot.y, z: spot.z }, places);
      const shown = fixes.find(f => f.mapId && f.at && !atEdge(f.at) && onIllustratedMap(f.placeId, f.mapId, f.at));
      const projected = fixes[0] ? stages[fixes[0].placeId] : undefined;
      return listedRegion({
        shownRegion: shown ? stages[shown.placeId] : undefined,
        projectedRegion: projected,
        projectedHasFloor: projected !== 'LostWood',
        checklistRegion: checklist,
        checklistHasFloor,
        placed: true,
      });
    };
    expect(region('gossip_stones.LOST_WOOD_02', 'LostWood', false)).toBe('LostWood');
    expect(region('gossip_stones.LOST_WOOD_01', 'LostWood', false)).toBe('LostWood');
    expect(listedRegion({
      projectedRegion: 'KokiriForest',
      projectedHasFloor: true,
      checklistRegion: 'LostWood',
      checklistHasFloor: true,
      checklistClaimsMiss: true,
      placed: true,
    })).toBe('LostWood');
    expect(region('gossip_stones.KOKIRI_FOREST_01', 'KokiriForest', true)).toBe('KokiriForest');
    expect(region('gossip_stones.KOKIRI_FOREST_02', 'KokiriForest', true)).toBe('SacredForestMeadow');
  });

  it('leaves a Kokiri chest off the list when its point misses the drawing', () => {
    expect(listedRegion({
      projectedRegion: 'KokiriForest',
      projectedHasFloor: true,
      checklistRegion: 'KokiriForest',
      checklistHasFloor: true,
      placed: true,
    })).toBe('unknown');
  });

  it('keeps a row with no point with the atlas marker it is linked to', () => {
    expect(listedRegion({
      checklistRegion: 'LostWood',
      checklistHasFloor: false,
      markerRegion: 'KokiriForest',
      projectedHasFloor: false,
      placed: false,
    })).toBe('KokiriForest');
  });
});
