import { describe, expect, it } from 'vitest';
import atlas from '../data/atlas.json';
import { onIllustratedMap } from '../src/core/mapLand';
import { locatePlacement, type AtlasPlace } from '../src/core/position';

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
    expect(onIllustratedMap('perdido', 'principal', { x: 0.5, y: 0.5 })).toBe(true);
  });
});
