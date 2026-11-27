import { botwItems } from '../core/botw-world.js';
import type { WorldProgress } from '../core/totk-world.js';
import { crc32 } from './crc32.js';

const positionKey = crc32('PlayerSavePos');
const mapKey = crc32('PlayerSavePosMapType');
// 0x4730: game version 1.9.0 (Savage Wind's saves, issue #37).
const knownVersions = new Set([0x24e2, 0x24ee, 0x2588, 0x29c0, 0x2a46, 0x3ef8, 0x3ef9, 0x471a, 0x471b, 0x471e, 0x4730]);
const objectives = botwItems.map(item => ({
  id: item.id,
  done: typeof item.key === 'string' ? crc32(item.key) : undefined,
  found: typeof item.found === 'string' ? crc32(item.found) : undefined,
}));

export function readBotwProgress(buffer: Buffer): { world: WorldProgress; unverifiedFormat: boolean } {
  if (buffer.length < 24 || (buffer.length - 16) % 8 !== 0 || buffer.readUInt32LE(4) !== 0xffffffff ||
      buffer.readUInt32LE(buffer.length - 4) !== 0xffffffff) throw new Error('Invalid Breath of the Wild save');
  const little = buffer.readUInt32LE(8) === 1;
  if (!little && buffer.readUInt32BE(8) !== 1) throw new Error('Invalid Breath of the Wild save header');
  const uint = little ? buffer.readUInt32LE.bind(buffer) : buffer.readUInt32BE.bind(buffer);
  const float = little ? buffer.readFloatLE.bind(buffer) : buffer.readFloatBE.bind(buffer);
  const version = uint(0);
  if (version < 0x2000 || version > 0xffff) throw new Error('Unknown Breath of the Wild save header');
  const offsets = new Map<number, number>();
  const last = buffer.length - 4;
  for (let offset = 12; offset < last; offset += 8) {
    const key = uint(offset);
    if (!offsets.has(key)) offsets.set(key, offset + 4);
  }
  if (!offsets.has(crc32('CurrentRupee')) || !offsets.has(positionKey)) throw new Error('This is not game_data.sav');
  const value = (hash: number | undefined) => {
    const offset = hash == null ? undefined : offsets.get(hash);
    return offset == null ? undefined : uint(offset);
  };
  const marks: WorldProgress['marks'] = {};
  for (const item of objectives) {
    const done = value(item.done);
    const found = value(item.found);
    if (done !== undefined && done > 0) marks[item.id] = 'done';
    else if (found !== undefined && found > 0) marks[item.id] = 'found';
    else if (done !== undefined || found !== undefined) marks[item.id] = 'pending';
  }
  const firstSteps = ['FirstTower', 'Find_Impa', 'Water_Relic', 'Fire_Relic', 'Wind_Relic', 'Electric_Relic']
    .filter(id => value(crc32(id + '_Activated')) === 1);
  const map = offsets.get(mapKey);
  const mapType = map == null ? undefined : Buffer.concat(Array.from({ length: 8 }, (_, index) => map + index * 8)
    .filter(offset => offset < last && uint(offset - 4) === mapKey).map(offset => buffer.subarray(offset, offset + 4)))
    .toString('utf8').split('\0')[0];
  const pos = offsets.get(positionKey)!;
  const x = float(pos);
  const z = pos + 16 < last && uint(pos + 12) === positionKey ? float(pos + 16) : NaN;
  const player: WorldProgress['player'] = (mapType === 'MainField' || !mapType) && Math.abs(x) <= 6000 && Math.abs(z) <= 5000
    && (x !== 0 || z !== 0) ? { at: [x, z], layer: 'surface' } : undefined;
  return { world: { marks, firstSteps, player }, unverifiedFormat: !knownVersions.has(version) };
}
