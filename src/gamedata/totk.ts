import { islandGuide, islandMapPoint, islandObjectives, islandShrines, type IslandMark, type IslandPoint, type IslandRule } from '../core/totk-island.js';
import { murmur3 } from './murmur3.js';
import type { GameDataFile } from './parser.js';

export interface TotkProgress {
  marks: Record<string, IslandMark>;
  position?: IslandPoint;
  unverifiedFormat: boolean;
}

const get = (data: GameDataFile, key: IslandRule['key']) => data.entries.get(typeof key === 'number' ? key : murmur3(key));
const shrineStates = ['Hidden', 'Appear', 'Open', 'Enter', 'Clear'].map(name => murmur3(name));
const openShrineStates = ['Open', 'Enter'].map(name => murmur3(name));
const testedTotkVersion = 0x0047e0f4;

function matches(data: GameDataFile, rule: IslandRule): boolean | undefined {
  const field = get(data, rule.key);
  if (rule.values && field?.type === 'Enum') return rule.values.some(value => murmur3(value) === field.value);
  if (!rule.values && field?.type === 'Bool' && typeof field.value === 'boolean') return field.value;
}

export function readTotkIsland(data: GameDataFile): TotkProgress {
  if (get(data, 'IsVisitLocation.BeginningIsland')?.type !== 'Bool' ||
      !islandShrines.every(shrine => {
        const state = get(data, shrine.rule!.key);
        return state?.type === 'Enum' && typeof state.value === 'number' && shrineStates.includes(state.value)
          && get(data, shrine.found!.key)?.type === 'Bool';
      })) throw new Error('Not a Tears of the Kingdom progress save');

  if (data.warnings.some(warning => !warning.startsWith('Unknown format version'))) {
    throw new Error('Incomplete or unsupported Tears of the Kingdom save');
  }

  const marks: Record<string, IslandMark> = {};
  for (const objective of islandObjectives) {
    if (!objective.rule) continue;
    const done = matches(data, objective.rule);
    const shrine = objective.found && get(data, objective.rule.key)?.value;
    const found = objective.found && (matches(data, objective.found) ||
      typeof shrine === 'number' && openShrineStates.includes(shrine));
    marks[objective.id] = done ? 'done' : found ? 'found' : done === false ? 'pending' : 'unknown';
  }
  for (const step of islandGuide) {
    if (!step.rule) continue;
    const done = matches(data, step.rule);
    marks[step.id] = done ? 'done' : done === false ? 'pending' : 'unknown';
  }

  const pos = get(data, 'PlayerStatus.SavePos');
  let position: IslandPoint | undefined;
  if (pos?.type === 'Vector3' && pos.value && typeof pos.value === 'object' && 'z' in pos.value) {
    const { x, y, z } = pos.value;
    if (typeof z === 'number') {
      const [mapX, mapY] = islandMapPoint([x, z]);
      if (y >= 1300 && y < 2600 && mapX > 0 && mapX < 100 && mapY > 0 && mapY < 100) position = [x, z];
    }
  }
  return { marks, position, unverifiedFormat: data.version !== testedTotkVersion };
}
