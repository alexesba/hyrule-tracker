import catalog from '../../data/totk-world.json';
import type { IslandMark, IslandPoint, IslandText } from './totk-island.js';

export const worldLayers = {
  sky: ['Céu', 'Sky'],
  surface: ['Superfície', 'Surface'],
  depths: ['Profundezas', 'Depths'],
} as const;
export type WorldLayer = keyof typeof worldLayers;

export const worldCategories = {
  shrine: ['Santuários', 'Shrines'], tower: ['Torres de observação', 'Skyview Towers'], lightroot: ['Raízes de luz', 'Lightroots'],
  korok: ['Koroks', 'Koroks'], cave: ['Entradas de cavernas', 'Cave entrances'], well: ['Poços', 'Wells'], chasm: ['Abismos', 'Chasms'],
  location: ['Locais', 'Locations'], stable: ['Estábulos', 'Stables'], shop: ['Comércio e serviços', 'Shops and services'],
  lab: ['Laboratórios', 'Research labs'], dispenser: ['Dispensadores Zonai', 'Zonai Device Dispensers'],
  bargainer: ['Estátuas negociantes', 'Bargainer Statues'], tear: ['Lágrimas do Dragão', 'Dragon’s Tears'],
  bubbul: ['Gemas Bubbul', 'Bubbul Gems'], hinox: ['Hinox e Stalnox', 'Hinoxes and Stalnoxes'],
  talus: ['Talus', 'Taluses'], molduga: ['Moldugas', 'Moldugas'], flux: ['Construtos de Fluxo', 'Flux Constructs'],
  frox: ['Frox', 'Froxes'], gleeok: ['Gleeoks', 'Gleeoks'], rematch: ['Revanches de chefes', 'Boss rematches'],
  schema: ['Pedras de esquema', 'Schema Stones'], yiga: ['Projetos Yiga', 'Yiga Schematics'],
  'sage-will': ['Vontades dos Sábios', 'Sage’s Wills'], 'old-map': ['Mapas antigos', 'Old Maps'],
  addison: ['Placas de Addison', 'Addison signs'], fairy: ['Grandes Fadas', 'Great Fairies'],
  tablet: ['Tabletes celestes', 'Ancient tablets'], lynel: ['Locais de Lynels', 'Lynel locations'],
  chest: ['Baús', 'Treasure chests'], armor: ['Vestuário', 'Armor'], recipe: ['Receitas', 'Recipes'],
  compendium: ['Compêndio de Hyrule', 'Hyrule Compendium'],
  memory: ['Memórias recuperadas', 'Recovered Memories'],
  'dlc-shrine': ['Santuários do DLC', 'DLC Shrines'],
  'dlc-quest': ['Missões do DLC', 'DLC Quests'],
  minigame: ['Minijogos', 'Minigames'],
  temple: ['Templos', 'Temples'], blossom: ['Cerejeiras de Satori', 'Satori cherry blossoms'],
  voice: ['Memórias de voz', 'Voice Memories'], gloom: ['Mãos de miasma', 'Gloom Spawn'],
  'main-quest': ['Missões principais', 'Main Quests'], adventure: ['Aventuras secundárias', 'Side Adventures'],
  'shrine-quest': ['Missões de santuário', 'Shrine Quests'], quest: ['Missões secundárias', 'Side Quests'],
} satisfies Record<string, IslandText>;
export type WorldCategory = keyof typeof worldCategories;

export interface WorldItem {
  id: string;
  category: WorldCategory;
  name: string;
  key?: string | number;
  at?: IslandPoint;
  layer?: WorldLayer;
  found?: string | number;
  values?: string[];
  detail?: string;
  hint?: IslandText;
  guide?: string;
  featured?: boolean;
  interior?: boolean;
  region?: string;
  tracking?: 'location';
  seeds?: number;
  edition?: 'dlc' | 'switch2';
}

export interface WorldProgress {
  marks: Record<string, IslandMark>;
  firstSteps: string[];
  player?: { at: IslandPoint; layer: WorldLayer };
}

export const worldItems = catalog as WorldItem[];
export const worldById = new Map(worldItems.map(item => [item.id, item]));
export const worldRegions = worldItems.filter(item => item.category === 'tower')
  .map(item => ({ id: item.id, name: item.name.replace(/ Skyview Tower$/, '') }))
  .sort((a, b) => a.name.localeCompare(b.name));
export const isWorldLocation = (item: WorldItem) => item.tracking === 'location' || item.category === 'lynel';
export const isWorldManual = (item: WorldItem) => item.key === undefined && !isWorldLocation(item);
/** As in the Ocarina journal, any objective can be ticked by hand until the save confirms it. Places to visit cannot. */
export const canTickByHand = (item: WorldItem, savedDone: boolean) => !isWorldLocation(item) && !savedDone;
export const worldChecklistItems = worldItems.filter(item => !isWorldLocation(item));
export const mapCategories = new Set<WorldCategory>([
  'shrine', 'tower', 'lightroot', 'korok', 'cave', 'well', 'chasm', 'location', 'stable', 'shop',
  'lab', 'dispenser', 'bargainer', 'tear', 'fairy', 'tablet',
]);
export const questCategories = new Set<WorldCategory>(['main-quest', 'adventure', 'shrine-quest', 'quest', 'dlc-quest']);
export const secretCategories = new Set<WorldCategory>([
  'bubbul', 'hinox', 'talus', 'molduga', 'flux', 'frox', 'gleeok', 'rematch', 'schema', 'yiga', 'sage-will',
  'old-map', 'addison', 'lynel', 'chest',
]);

export const worldBounds = { west: -5500, east: 5500, north: -4250, south: 4250 };

export function worldMapPoint([x, z]: IslandPoint): IslandPoint {
  return [
    (x - worldBounds.west) / (worldBounds.east - worldBounds.west) * 100,
    (z - worldBounds.north) / (worldBounds.south - worldBounds.north) * 100,
  ];
}

export function layerFromHeight(height: number): WorldLayer {
  return height < -100 ? 'depths' : height >= 750 ? 'sky' : 'surface';
}
