import type { WorldCategory } from '../core/totk-world';
import { Icon } from './CompanionPages';
import { useWorldJournal } from './WorldJournalContext';

const icons: Partial<Record<WorldCategory, string>> = {
  shrine: 'shrine', cave: 'caveEntrance', well: 'well', tower: 'skyviewTower', lightroot: 'lightroot',
  chasm: 'hole', temple: 'structure', location: 'structure', stable: 'village', shop: 'shop', lab: 'structure',
  bargainer: 'shop', dispenser: 'gacha', blossom: 'blossomTree', korok: 'hiddenKorok',
  bubbul: 'mayoi', tear: 'dragonTears', tablet: 'stoneMonument', 'sage-will': 'sagesWill',
  'old-map': 'oldMap', schema: 'schemaStone', yiga: 'schemaYiga', addison: 'signboard',
  'main-quest': 'mainChallenge', adventure: 'episodeChallenge', quest: 'miniChallenge', 'shrine-quest': 'shrineChallenge',
  rematch: 'villageBoss', gleeok: 'gleeok', lynel: 'lynel', gloom: 'gloomSpawn', hinox: 'hinox',
  talus: 'stoneTalus', frox: 'frox', flux: 'blockGolem', molduga: 'molduga', voice: 'voiceTotkZelda',
};

const botwIcons: Partial<Record<WorldCategory, string>> = {
  shrine: 'shrineChallenge', 'dlc-shrine': 'shrineChallenge', tower: 'tower', temple: 'dungeon',
  location: 'structure', stable: 'hatago', shop: 'shop', lab: 'structure', korok: 'hiddenKorok',
  memory: 'pictureMemory', 'main-quest': 'mainChallenge', quest: 'miniChallenge', 'shrine-quest': 'shrineChallenge',
  lynel: 'lynel', hinox: 'hinox', talus: 'stoneTalus', molduga: 'molduga', fairy: 'fairy',
  voice: 'voiceBotwZelda', rematch: 'dungeon', 'dlc-quest': 'mainChallenge',
};

export function TotkCategoryIcon({ category, seeds, fallback = false }: { category?: WorldCategory; seeds?: number; fallback?: boolean }) {
  const { game } = useWorldJournal();
  if (!category) return null;
  const icon = game === 'botw' ? botwIcons[category] : category === 'korok' && seeds === 2 ? 'korokCarry' : icons[category];
  if (!icon) return fallback ? <Icon name={category === 'minigame' ? 'minigames' : 'checklist'} size={23} /> : null;
  return <img key={game + icon} className="totk-category-icon" src={'https://www.zeldaxtreme.com/images/notes-icons/' + game + '/' + icon + '.png'}
    width={20} height={20} alt="" draggable={false} decoding="async" referrerPolicy="no-referrer"
    onLoad={event => { event.currentTarget.dataset.loaded = 'true'; }}
    onError={event => { event.currentTarget.hidden = true; }} />;
}
