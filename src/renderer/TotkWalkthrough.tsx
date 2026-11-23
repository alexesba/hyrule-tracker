import { useMemo } from 'react';
import { chapterLocation } from '../core/totk-guide';
import { islandGuide, islandObjectives, type IslandText } from '../core/totk-island';
import type { WorldItem } from '../core/totk-world';
import type { WalkthroughChapter, WalkthroughStep } from '../core/walkthrough';
import type { TotkIslandState } from '../shared/types';
import { gameArtwork } from './GamePicker';
import { WalkthroughLayout } from './Walkthrough';
import { ObjectiveGuideLink, type WorldText } from './TotkWorldMap';
import { totkMapPreview } from './TotkMapArt';
import { useWorldJournal } from './WorldJournalContext';
import { journalName } from './i18n';

const summaries: Record<string, IslandText> = {
  LookingForLightSpot: ['Aprenda as habilidades de Rauru nos quatro santuários e abra a porta do Templo do Tempo.', 'Learn Rauru’s abilities in the four shrines and open the Temple of Time door.'],
  GOToTheCastleOfHyrule: ['Deixe a ilha e procure Purah no posto de observação.', 'Leave the island and find Purah at Lookout Landing.'],
  HyruleCastleIncident: ['Investigue os relatos sobre Zelda e volte ao castelo após resolver os quatro fenômenos regionais.', 'Investigate the sightings of Zelda and return to the castle after resolving the four regional phenomena.'],
  SurveyOfFourVillages: ['Escolha por onde começar a investigação dos quatro fenômenos de Hyrule.', 'Choose where to begin investigating Hyrule’s four regional phenomena.'],
  SageOfWind: ['Ajude Tulin a descobrir o que causa a nevasca nas montanhas de Hebra.', 'Help Tulin find the cause of the blizzard over the Hebra Mountains.'],
  SageOfFire: ['Descubra o que mudou o comportamento dos Goron e siga Yunobo até a mina subterrânea.', 'Find what changed the Gorons’ behavior and follow Yunobo into the underground mine.'],
  SageOfZora: ['Descubra a origem do lodo e ajude Sidon a restaurar a água do domínio.', 'Find the source of the sludge and help Sidon restore the Domain’s water.'],
  SageOfGerudo: ['Defenda a cidade com Riju e investigue o templo escondido na tempestade de areia.', 'Defend the town with Riju and investigate the temple hidden in the sandstorm.'],
  GetCamera: ['Investigue as estátuas nas Profundezas com Robbie e libere a câmera.', 'Investigate the statues in the Depths with Robbie and unlock the Camera.'],
  DeepHoleSurvey2: ['Siga as estátuas até a mina abandonada e descubra como usar Autobuild.', 'Follow the statues to the abandoned mine and learn how to use Autobuild.'],
  MemoryOfTheDragon: ['Encontre as poças nos geoglifos e descubra a ordem das memórias no Templo Esquecido.', 'Find the pools in the geoglyphs and discover the order of the memories at the Forgotten Temple.'],
  SageOfSoul: ['Encontre a máscara, monte o construto e leve Mineru até o Templo do Espírito.', 'Find the mask, assemble the construct, and take Mineru to the Spirit Temple.'],
  DefeatGanondorf: ['Desça pelo abismo sob o castelo e prepare-se para o confronto final.', 'Descend through the chasm below the castle and prepare for the final confrontation.'],
};

export function TotkWalkthrough({ text, save, island, onMap, onIslandMap, onIsland, jump }: {
  text: WorldText; save: TotkIslandState; island: boolean; onMap: (item: WorldItem) => void;
  onIslandMap: (id: string) => void; onIsland: () => void; jump?: string | null;
}) {
  const { game, byId: worldById, mapped, story: worldGuide, sideRoutes: worldSideRoutes, skipForNext } = useWorldJournal();
  const guide = useMemo(() => {
    if (island) {
      const title = text(['Grande Ilha Celeste', 'Great Sky Island']);
      const chapters: WalkthroughChapter<string>[] = islandGuide.map(step => ({
        id: step.id, part: 'island', title: text(step.title), summary: title, place: step.map ?? '',
        goal: [step.id], source: '', sections: [{
          id: step.id, title: text(['Rota', 'Route']), steps: step.steps.map(line => ({ text: text(line), objectives: [step.id] })),
        }],
      }));
      return { chapters, groups: [['island', title]] as [string, string][] };
    }
    const routes = [...worldGuide, ...worldSideRoutes];
    const groups: [string, string][] = routes.map(route => [route.id === 'optional' && game === 'botw' && route === worldSideRoutes[0] ? 'expansion' : route.id, text(route.title)]);
    const chapters = routes.flatMap(route => route.chapters.map((chapter): WalkthroughChapter<string> => {
      const start = game === 'totk' ? chapterLocation(chapter)
        : (chapter.place && mapped.find(item => item.name.replaceAll('’', "'") === chapter.place!.replaceAll('’', "'"))) || worldById.get('quest:' + chapter.quest);
      const temple = worldById.get('temple:' + chapter.quest);
      const goal = 'quest:' + chapter.quest;
      const steps: WalkthroughStep[] = chapter.steps.map((line, index) => ({
        text: text(line), objectives: chapter.objectives?.[index] ?? [index === 0 && chapter.steps.length > 1 ? 'first:' + chapter.quest : goal],
      }));
      return {
        id: chapter.quest, part: game === 'botw' && route === worldSideRoutes[0] ? 'expansion' : route.id, title: text(chapter.title),
        summary: summaries[chapter.quest] ? text(summaries[chapter.quest]) : start ? journalName(game, start.name) : text(route.title),
        place: start?.id ?? goal, goal: [goal], source: '', sections: temple ? [
          { id: chapter.quest + '-reach', title: text(['Chegar ao templo', 'Reach the temple']), steps: steps.slice(0, 1) },
          { id: chapter.quest + '-temple', title: journalName(game, temple.name), place: temple.id, steps: steps.slice(1) },
        ] : [{ id: chapter.quest, title: text(['Rota', 'Route']), steps }],
      };
    }));
    return { chapters, groups };
  }, [text, island, game, mapped, worldById, worldGuide, worldSideRoutes]);
  const progress = save.world;
  // Without a save the guide still counts, from zero, so chapters show their progress and the first one is "you are here".
  const hasSave = true;
  const done = (id: string) => {
    if (island) return save.marks[id] === 'done';
    if (!id.startsWith('first:')) return progress?.marks[id] === 'done' || (game === 'botw' && save.manual.includes(id));
    const quest = id.slice(6);
    return progress?.marks['quest:' + quest] === 'done' || progress?.firstSteps.includes(quest);
  };
  const active = island ? -1 : guide.chapters.findIndex(chapter =>
    !skipForNext.includes(chapter.id) && !done(chapter.goal[0]) && progress?.marks['quest:' + chapter.id] === 'found');
  const current = hasSave ? active >= 0 ? active : guide.chapters.findIndex(chapter => !['optional', 'expansion'].includes(chapter.part) && !done(chapter.goal[0])) : -1;
  return <WalkthroughLayout key={String(island) + '/' + (jump ?? '')} {...guide} hasSave={hasSave} current={current} done={done}
    artwork={chapter => {
      const item = worldById.get(chapter.place);
      const point = island ? islandObjectives.find(entry => entry.id === chapter.place)?.at : item?.at;
      const layer = island ? 'sky' : item?.layer;
      return (point && layer && totkMapPreview(layer, point, island ? 5 : 3, game)) || gameArtwork(game);
    }} jump={island ? jump ?? undefined : undefined}
    onShowPlace={id => {
      if (island) onIslandMap(id);
      else {
        const item = worldById.get(id);
        if (item?.at) onMap(item);
      }
    }}
    chapterLinks={chapter => {
      if (island) return <button type="button" className="action" onClick={onIsland}>{text(['Guia de Hyrule', 'Hyrule guide'])}</button>;
      const item = worldById.get('quest:' + chapter.id);
      return <>
        {chapter.id === 'LookingForLightSpot' && <button type="button" className="action" onClick={onIsland}>
          {text(['Guia da Grande Ilha Celeste', 'Great Sky Island guide'])}
        </button>}
        <ObjectiveGuideLink text={text} guide={item?.guide} action />
      </>;
    }} />;
}
