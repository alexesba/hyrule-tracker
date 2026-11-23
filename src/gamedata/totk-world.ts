import { worldItems, layerFromHeight, worldMapPoint, questCategories, type WorldItem, type WorldProgress } from '../core/totk-world.js';
import type { IslandMark } from '../core/totk-island.js';
import { murmur3 } from './murmur3.js';
import type { GameDataFile } from './parser.js';

function hashed(key: string | number) {
  return typeof key === 'number' ? key : murmur3(key);
}

const records = worldItems.flatMap(item => item.key === undefined ? [] : [{
  item,
  key: typeof item.key === 'string' && item.key.startsWith('guid:') ? BigInt(item.key.slice(5)) : hashed(item.key),
  found: item.found === undefined ? undefined : hashed(item.found),
  values: item.values?.map(value => murmur3(value)),
}]);
const closedQuestStates = new Set(['NotReady', 'Ready'].map(value => murmur3(value)));
const openShrineStates = new Set(['Open', 'Enter', 'Appear'].map(value => murmur3(value)));
const savePosition = murmur3('PlayerStatus.SavePos');
const gameClear = murmur3('IsGameClear');
const firstStepStates = Object.entries({
  HyruleCastleIncident: ['ToLand', 'EventLightSpot', 'EventLightSpot2', 'EventLightSpot3', 'EventLightSpot4', 'EventLightSpot5', 'UnderSurveyOfFourVillages', 'ResearchCastle', 'DefeatBlackZelda', 'ReturnBCAfterBlackZelda', 'UnderFindTheFifthSage'],
  SageOfWind: ['GoToHebra', 'GoDungeon', 'CheckTerminal', 'DungeonStart', 'BossBattle', 'DefeatBoss', 'TouchSecretStone', 'Finish'],
  SageOfFire: ['GoEntranceDungeon', 'GoDungeon', 'Dungeon', 'StartBossBattle', 'DefeatBoss', 'TouchSecretStone', 'Finale'],
  SageOfZora: ['GoToDungeonStart', 'TryOneTank', 'GoToBossArea', 'DefeatBoss', 'TouchSecretStone', 'Finish'],
  SageOfGerudo: ['DefenseEnd', 'DungeonSearch', 'DungeonFind', 'DungeonStart', 'DungeonBossDead', 'DungeonEnd'],
  GetCamera: ['TakePicture', 'ReturnBaseCamp'],
  DeepHoleSurvey2: ['Report', 'Buield'],
  SageOfSoul: ['CarryHead_CheckPoint04', 'Collected_AllParts', 'GolemAppearance', 'LightSpotOn', 'Dungeon_DuringDungeonCapture', 'Dungeon_Entrance', 'Dungeon_BeforeBossBattle', 'Dungeon_DefeatedBoss'],
  DefeatGanondorf: ['DefeatMonsterArmy', 'DefeatGanon1', 'DefeatGanon2', 'DefeatBlackDragon'],
  ZonauReliefSearch: ['Step1'],
}).map(([quest, states]) => ({ quest, hash: murmur3('Step_' + quest), states: new Set(states.map(name => murmur3(name))) }));

function status(data: GameDataFile, item: WorldItem, key: number | bigint, found?: number, values?: number[]): IslandMark {
  if (item.category === 'lynel') return 'unknown';
  if (typeof key === 'bigint') {
    return data.bool64Hash === undefined ? 'unknown' : data.bool64.has(key) ? 'done' : 'pending';
  }
  const entry = data.entries.get(key);
  const discovered = found !== undefined && data.entries.get(found)?.value === true;
  if (!entry) return discovered ? 'found' : 'unknown';
  if (values?.length && entry.type === 'Enum' && typeof entry.value === 'number') {
    if (values.includes(entry.value)) return 'done';
    if (questCategories.has(item.category)) return closedQuestStates.has(entry.value) ? 'pending' : 'found';
    return discovered || item.category === 'shrine' && openShrineStates.has(entry.value) ? 'found' : 'pending';
  }
  if (!values && entry.type === 'Bool') return entry.value === true ? 'done' : discovered ? 'found' : 'pending';
  return 'unknown';
}

export function readTotkWorld(data: GameDataFile): WorldProgress {
  const marks: WorldProgress['marks'] = {};
  for (const { item, key, found, values } of records) {
    marks[item.id] = status(data, item, key, found, values);
  }
  // The starred save can retain quest steps from before the last battle.
  if (data.entries.get(gameClear)?.value === true) {
    marks['quest:DefeatGanondorf'] = 'done';
    marks['quest:MainChallenge'] = 'done';
  }
  const firstSteps = firstStepStates.filter(({ hash, states }) => {
    const step = data.entries.get(hash);
    return step?.type === 'Enum' && typeof step.value === 'number' && states.has(step.value);
  }).map(({ quest }) => quest);
  const player = data.entries.get(savePosition);
  if (player?.type === 'Vector3' && player.value && typeof player.value === 'object' && 'z' in player.value) {
    const { x, y, z } = player.value;
    if (typeof z === 'number' && Number.isFinite(y)) {
      const [left, top] = worldMapPoint([x, z]);
      if (left >= 0 && left <= 100 && top >= 0 && top <= 100) {
        return { marks, firstSteps, player: { at: [x, z], layer: layerFromHeight(y) } };
      }
    }
  }
  return { marks, firstSteps };
}
