import masks from './map-land.json';

interface Mask { vx: number; vy: number; vw: number; vh: number; cell: number; cols: number; rows: number; bits: string }
const table = masks as Record<string, Mask>;
const decoded = new Map<string, Uint8Array>();

function bytes(key: string, bits: string): Uint8Array {
  const hit = decoded.get(key);
  if (hit) return hit;
  const raw = Uint8Array.from(atob(bits), char => char.charCodeAt(0));
  decoded.set(key, raw);
  return raw;
}

/**
 * A floor map's viewBox includes the blank margin around the drawing. A projected pin there
 * is on the parchment, not on the place, so it is not drawn. The mask is the filled ground
 * grown by a short reach, so a pin on a narrow path still counts. A map with no mask is left alone.
 */
export function onIllustratedMap(placeId: string, mapId: string, at: { x: number; y: number }): boolean {
  const mask = table[`${placeId}:${mapId}`];
  if (!mask) return true;
  const col = Math.floor((at.x * mask.vw) / mask.cell);
  const row = Math.floor((at.y * mask.vh) / mask.cell);
  if (col < 0 || row < 0 || col >= mask.cols || row >= mask.rows) return false;
  const bit = row * mask.cols + col;
  return (bytes(`${placeId}:${mapId}`, mask.bits)[bit >> 3] & (1 << (bit & 7))) !== 0;
}
