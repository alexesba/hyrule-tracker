export interface TotkMapBounds { west: number; east: number; north: number; south: number }

export const totkTilePixels = 256;
const westEdge = -6000;
const northEdge = -5000;
const eastEdge = 6000;
const southEdge = 5000;

// ZeldaMods' MapBase transforms world coordinates as (4 * coord + MAP_SIZE) * 2^level / 256.
export function totkTileSpan(level: number) {
  return totkTilePixels ** 2 / (4 * 2 ** level);
}

export function totkTiles(bounds: TotkMapBounds, level: number) {
  const span = totkTileSpan(level);
  const firstX = Math.floor((Math.max(bounds.west, westEdge) - westEdge) / span);
  const firstY = Math.floor((Math.max(bounds.north, northEdge) - northEdge) / span);
  const endX = Math.ceil((Math.min(bounds.east, eastEdge) - westEdge) / span);
  const endY = Math.ceil((Math.min(bounds.south, southEdge) - northEdge) / span);
  const tiles = [];
  for (let x = firstX; x < endX; x++) {
    for (let y = firstY; y < endY; y++) {
      tiles.push({ x, y, west: westEdge + x * span, north: northEdge + y * span });
    }
  }
  return tiles;
}
