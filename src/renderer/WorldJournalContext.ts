import { createContext, useContext } from 'react';
import { botwDlcRoutes, botwStory } from '../core/botw-guide';
import { botwById, botwHint, botwItems, botwRegions } from '../core/botw-world';
import { worldGuide, worldSideRoutes } from '../core/totk-guide';
import { journalPages, objectiveHint } from '../core/totk-journal';
import { isWorldLocation, worldById, worldCategories, worldItems, worldLayers, worldRegions, type WorldCategory } from '../core/totk-world';

const totk = {
  game: 'totk' as const,
  items: worldItems,
  byId: worldById,
  regions: worldRegions,
  layers: worldLayers,
  categories: worldCategories,
  hint: objectiveHint,
  story: worldGuide,
  sideRoutes: worldSideRoutes,
  skipForNext: ['MainChallenge', 'SurveyOfFourVillages'],
  mapSource: 'https://objmap-totk.zeldamods.org/',
  guideMap: 'https://www.zeldaxtreme.com/tears-of-the-kingdom/map/',
};

const botw: Omit<typeof totk, 'game' | 'layers'> & { game: 'botw'; layers: Pick<typeof worldLayers, 'surface'> } = {
  game: 'botw',
  items: botwItems,
  byId: botwById,
  regions: botwRegions,
  layers: { surface: worldLayers.surface },
  categories: { ...worldCategories, tower: ['Torres Sheikah', 'Sheikah Towers'], temple: ['Bestas Divinas', 'Divine Beasts'] },
  hint: botwHint,
  story: botwStory,
  sideRoutes: botwDlcRoutes,
  skipForNext: ['Find_4Relic', 'GanonQuest', 'TrialSword', 'BalladOfHeroes'],
  mapSource: 'https://objmap.zeldamods.org/',
  guideMap: 'https://www.zeldaxtreme.com/breath-of-the-wild/map/',
};

function catalog<T extends typeof totk | typeof botw>(game: T) {
  return {
    ...game,
    pages: journalPages(game.items),
    checklist: game.items.filter(item => !isWorldLocation(item)),
    mapped: game.items.filter(item => item.layer && item.at),
    koroks: game.items.filter(item => item.category === 'korok'),
    totals: game.items.reduce<Partial<Record<WorldCategory, number>>>((totals, item) => {
      totals[item.category] = (totals[item.category] ?? 0) + (item.category === 'korok' ? item.seeds ?? 1 : 1);
      return totals;
    }, {}),
  };
}

export const journals = { totk: catalog(totk), botw: catalog(botw) };
export type WorldGame = keyof typeof journals;
export const WorldJournalContext = createContext<(typeof journals)[WorldGame]>(journals.totk);
export const useWorldJournal = () => useContext(WorldJournalContext);
