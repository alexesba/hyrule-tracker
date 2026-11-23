import { useState, type CSSProperties } from 'react';
import { nearbyObjectives, worldTotals, type TotkHistoryEntry } from '../core/totk-journal';
import { chapterLocation } from '../core/totk-guide';
import { canTickByHand, worldCategories, worldLayers, type WorldCategory, type WorldItem } from '../core/totk-world';
import type { IslandText } from '../core/totk-island';
import type { TotkIslandState } from '../shared/types';
import type { Page } from './CompanionPages';
import { ObjectiveNote, worldCoordinates, type WorldText } from './TotkWorldMap';
import { JourneyMetrics, JourneyProgress } from './JournalOverview';
import { gameArtwork } from './GamePicker';
import { TotkCategoryIcon } from './TotkCategoryIcon';
import { totkMapPreview } from './TotkMapArt';
import { ObjectiveName } from './ObjectiveName';
import { date, hour, journalMessage, journalName, number } from './i18n';
import { Quiz, type Question } from './Recreation';
import { TodoSheet, useNarrow } from './WhatToDo';
import { Icon } from './CompanionPages';
import { useWorldJournal } from './WorldJournalContext';

interface SaveProps {
  text: WorldText;
  save: TotkIslandState;
  onPage: (page: Page) => void;
}

const stats: { category: WorldCategory; detail: IslandText }[] = [
  { category: 'shrine', detail: ['Provas concluídas', 'Trials cleared'] },
  { category: 'korok', detail: ['Sementes recolhidas', 'Seeds collected'] },
  { category: 'lightroot', detail: ['Raízes ativadas', 'Lightroots activated'] },
  { category: 'tower', detail: ['Torres ativadas', 'Towers activated'] },
  { category: 'main-quest', detail: ['Missões concluídas', 'Quests completed'] },
];
const seedsFound = (save: TotkIslandState, koroks: WorldItem[]) => koroks.reduce((sum, item) =>
  sum + (save.world?.marks[item.id] === 'done' ? item.seeds ?? 1 : 0), 0);

function historyChange(text: WorldText, entry: TotkHistoryEntry, previous: TotkHistoryEntry, labels = worldCategories) {
  return (Object.keys(worldCategories) as WorldCategory[]).flatMap(category => {
    const delta = (entry.counts[category] ?? 0) - (previous.counts[category] ?? 0);
    return delta ? [text(labels[category]) + ' ' + (delta > 0 ? '+' : '') + number(delta)] : [];
  }).join(' · ');
}

export function TotkOverview({ text, save, onPage, onConnect, connecting }: SaveProps & { onConnect?: () => void; connecting: boolean }) {
  const { game, items: worldItems, checklist: worldChecklistItems, story: worldGuide, categories: labels, totals, koroks } = useWorldJournal();
  const marks = save.world?.marks;
  const counts = marks && worldTotals(marks, worldItems);
  const manual = new Set(save.manual);
  // Like the Ocarina journal: the progress shows from the start, at zero until a save or a hand tick fills it.
  const completed = worldChecklistItems.filter(item => marks?.[item.id] === 'done' || manual.has(item.id)).length;
  const fraction = Math.floor(completed / worldChecklistItems.length * 100);
  const player = save.world?.player;
  const history = save.history ?? [];
  const recent = history.slice(1).map((entry, index) => ({ at: entry.at, description: historyChange(text, entry, history[index], labels) }))
    .filter(entry => entry.description).slice(-3).reverse();

  return <>
    <JourneyProgress variant="totk-progress-panel" artwork={gameArtwork(game)}
      title={text(['Progresso da jornada', 'Journey progress'])}
      progress={{ value: fraction, display: number(fraction), label: text(['Progresso do diário', 'Journal progress']) }}
      description={journalMessage(['{done} de {total} objetivos do diário concluídos', '{done} of {total} journal objectives complete'],
        { done: completed, total: worldChecklistItems.length })}
      place={save.updatedAt != null && <>
        {player ? text(worldLayers[player.layer]) + ' · ' + worldCoordinates(player.at) : save.activeSlot}
        <small>{date(save.updatedAt)}</small>
      </>}
      action={<div className="totk-progress-actions">
        {!marks && onConnect && <button type="button" className="action primary" disabled={connecting} onClick={onConnect}>
          {text(['Conectar save', 'Connect save'])}
        </button>}
        <button type="button" className={'action' + (marks || !onConnect ? ' primary' : '')} onClick={() => onPage('checklist')}>
          {text(['Abrir checklist', 'Open checklist'])}
        </button>
      </div>} />
    <JourneyMetrics label={text(['Resumo da partida', 'Save summary'])} metrics={stats.map(stat => {
      const { category, detail } = game === 'botw' && stat.category === 'lightroot'
        ? { category: 'memory' as const, detail: ['Lembranças recuperadas', 'Memories recovered'] as const } : stat;
      const total = totals[category] ?? 0;
      return {
        label: text(category === 'korok' ? ['Sementes Korok', 'Korok Seeds'] : labels[category]),
        icon: <TotkCategoryIcon category={category} />,
        value: number(category === 'korok' ? seedsFound(save, koroks) : counts?.[category] ?? 0),
        max: total,
        detail: text(detail),
      };
    })} />
    <div className="home-grid">
      <section className="focus-panel">
        <div className="section-line"><h2>{text(['Missões e memórias', 'Quests and memories'])}</h2>
          <button type="button" className="text-action" onClick={() => onPage('threads')}>{text(['Ver jornada', 'View journey'])}</button>
        </div>
        <div className="chapter-list">{worldGuide.map(route => {
          const done = route.chapters.filter(chapter => marks?.['quest:' + chapter.quest] === 'done' || manual.has('quest:' + chapter.quest)).length;
          const total = route.chapters.length;
          return <div className="chapter-line" key={route.id}>
            <span className={done === total ? 'story-dot done' : 'story-dot'} aria-hidden="true" />
            <b><ObjectiveName done={done === total}>{text(route.title)}</ObjectiveName></b>
            <small>{done}/{total}</small>
          </div>;
        })}</div>
      </section>
      <section className="focus-panel">
        <div className="section-line"><h2>{text(['Atividade recente', 'Recent activity'])}</h2>
          <button type="button" className="text-action" onClick={() => onPage('timeline')}>{text(['Abrir registro', 'Open log'])}</button>
        </div>
        {recent.length > 0 ? <ol className="activity-list">
          {recent.map(entry => <li key={entry.at}>
            <time dateTime={new Date(entry.at).toISOString()} title={date(entry.at)}>{hour(entry.at)}</time>
            <div><b>{entry.description}</b><small>{text(['Atualizado pelo save', 'Updated from the save'])}</small></div>
          </li>)}
        </ol> : <p className="quiet">{text(marks
          ? ['Os próximos avanços aparecem aqui quando você salvar.', 'New progress appears here when you save.']
          : ['O registro começa depois que você conectar um save.', 'The log starts after you connect a save.'])}</p>}
      </section>
    </div>
  </>;
}

export function JournalMilestones({ text, save }: Pick<SaveProps, 'text' | 'save'>) {
  const { game, items: worldItems, checklist: worldChecklistItems, categories: labels, totals, koroks } = useWorldJournal();
  const counts = save.world && worldTotals(save.world.marks, worldItems);
  // Zero without a save, as on the Ocarina page. The checklist share counts hand ticks too.
  const manual = new Set(save.manual);
  const checklist = Math.floor(worldChecklistItems.filter(item => save.world?.marks[item.id] === 'done' || manual.has(item.id)).length / worldChecklistItems.length * 100);
  const tracks: { id: string; label: IslandText; value: number; levels: number[] }[] = [
    { id: 'shrine', label: labels.shrine, value: counts?.shrine ?? 0, levels: game === 'botw' ? [25, 60, 90, 120] : [25, 75, 120, 152] },
    { id: 'korok', label: labels.korok, value: seedsFound(save, koroks), levels: [100, 300, 600, totals.korok ?? 0] },
    game === 'botw' ? { id: 'memory', label: labels.memory, value: counts?.memory ?? 0, levels: [3, 6, 9, totals.memory ?? 0] }
      : { id: 'lightroot', label: labels.lightroot, value: counts?.lightroot ?? 0, levels: [15, 40, 80, 120] },
    { id: 'tower', label: labels.tower, value: counts?.tower ?? 0, levels: [3, 6, 10, 15] },
    { id: 'chest', label: labels.chest, value: counts?.chest ?? 0, levels: [25, 100, 300, totals.chest ?? 0] },
    { id: 'main-quest', label: labels['main-quest'], value: counts?.['main-quest'] ?? 0, levels: game === 'botw' ? [4, 8, 12, 15] : [4, 10, 18, 23] },
    { id: 'checklist', label: ['Checklist (%)', 'Checklist (%)'], value: checklist, levels: [25, 50, 75, 100] },
  ];
  return <>
    {counts && <section className="focus-panel"><h2>{text(['Contadores da partida', 'Save counters'])}</h2>
      <div className="metric-strip counter-strip">{tracks.slice(0, 3).map(({ id, label, value }) => <div className="metric" key={id}>
        <span className="metric-label"><TotkCategoryIcon category={id as WorldCategory} />{text(label)}</span>
        <strong>{number(value)}</strong></div>)}</div>
    </section>}
    <section className="focus-panel">
      <h2>{text(['Medalhas da jornada', 'Journey medals'])}</h2>
      <p className="quiet">{text(['Marcos locais calculados a partir do seu progresso.', 'Local milestones based on your progress.'])}</p>
      <div className="medal-list">{tracks.map(({ id, label, value, levels }) => <div className="medal-row" key={id}>
        <div><b>{text(label)}</b><small>{number(value)}</small></div>
        {levels.map(level => {
          const earned = value >= level;
          return <span className={earned ? 'medal earned' : 'medal'} key={level}
            title={text(earned ? ['Medalha conquistada', 'Medal earned'] : ['Medalha pendente', 'Medal pending'])}>
            <Icon name="medals" /><ObjectiveName done={earned}>{number(level)}</ObjectiveName></span>;
        })}
      </div>)}</div>
    </section>
  </>;
}

export function AvailableObjectives({ text, save, onPage, onMap, onChecklist, onMark, markingDisabled }: SaveProps & {
  onMap: (item: WorldItem) => void; onChecklist: (item: WorldItem) => void;
  onMark: (id: string, checked: boolean) => void; markingDisabled: boolean;
}) {
  const { game, story: worldGuide, categories: worldCategories, regions: worldRegions, byId, items, skipForNext } = useWorldJournal();
  const [page, setPage] = useState<HTMLDivElement | null>(null);
  const compact = useNarrow(page, 760);
  const [picked, setPicked] = useState<string>();
  const [sheetOpen, setSheetOpen] = useState(false);
  const marks = save.world?.marks;
  const chapters = worldGuide.flatMap(route => route.chapters);
  const done = (id: string) => marks?.[id] === 'done' || save.manual.includes(id);
  const next = chapters.find(chapter => !skipForNext.includes(chapter.quest) && !done('quest:' + chapter.quest) && marks?.['quest:' + chapter.quest] === 'found')
    ?? chapters.find(chapter => !done('quest:' + chapter.quest));
  const location = next && (game === 'botw' ? byId.get('quest:' + next.quest) : chapterLocation(next));
  const nearby = save.world ? nearbyObjectives(save.world, items) : [];
  if (!location && !nearby.length) return <div className="todo-empty"><b>{text(['Nenhum objetivo próximo', 'No nearby objectives'])}</b>
    <p>{text(['Use o mapa para procurar em outra região.', 'Open the map to look in a different region.'])}</p></div>;
  const options = [
    ...(location && next ? [{ id: 'next', item: location, story: true, title: text(next.title),
      detail: text(next.steps[Math.max(0, next.objectives?.findIndex(ids => ids.some(id => !done(id))) ??
        (save.world?.firstSteps.includes(next.quest) && next.steps.length > 1 ? 1 : 0))]) }] : []),
    ...nearby.map(({ item, distance }) => ({ id: item.id, item, story: false, title: journalName(game, item.name), detail: number(Math.round(distance)) + ' m' })),
  ];
  const groups = new Map<string, typeof options>();
  for (const entry of options) {
    const key = entry.story ? 'story' : entry.item.region ?? entry.item.layer ?? '';
    const group = groups.get(key) ?? [];
    group.push(entry);
    groups.set(key, group);
  }
  const groupName = (key: string) => key === 'story' ? text(['Próximo passo da história', 'Next story step']) :
    journalName(game, worldRegions.find(region => region.id === key)?.name ?? '') || text(['Perto do último save', 'Near your last save']);
  const current = options.find(entry => entry.id === picked) ?? options[0];
  const art = gameArtwork(game);
  // Each group shows its own spot on the map, as the Ocarina list shows each region's photo.
  const groupArt = (item: WorldItem) => (item.at && item.layer && totkMapPreview(item.layer, item.at, 3, game)) || art;
  const detail = <div className="todo-detail">
    <span className="marker-kind"><TotkCategoryIcon category={current.item.category} />{text(worldCategories[current.item.category])}</span>
    <h2 id="todo-detail-title">{current.title}</h2><p className="todo-place">{current.detail}</p>
    {!current.story && <ObjectiveNote item={current.item} text={text} />}
    <div className="result-actions">
      <button type="button" className="action primary" onClick={() => current.story ? onPage('walkthrough') : onChecklist(current.item)}>
        {text(current.story ? ['Abrir passo a passo', 'Open walkthrough'] : ['Ver na checklist', 'Open checklist'])}</button>
      <button type="button" className="action" onClick={() => onMap(current.item)}>{text(['Ver no mapa', 'Show on map'])}</button>
      {/* The same hand tick as the Ocarina list. A story step follows its quest, so it stays with the walkthrough. */}
      {!current.story && canTickByHand(current.item, marks?.[current.item.id] === 'done') && <button type="button" className="action"
        disabled={markingDisabled} onClick={() => onMark(current.item.id, !save.manual.includes(current.item.id))}>
        {text(save.manual.includes(current.item.id) ? ['Desmarcar', 'Uncheck'] : ['Concluí', 'Done'])}</button>}
    </div>
  </div>;
  const pick = (id: string) => { setPicked(id); setSheetOpen(true); };
  return <div ref={setPage} className={`todo-page ${compact ? 'compact' : ''}`}>
    <section className="todo-hero has-shot" style={{ '--todo-shot': `url("${art}")` } as CSSProperties}>
      <span className="todo-eyebrow">{text(['Comece por aqui', 'Start here'])}</span>
      <h2>{groupName(groups.keys().next().value ?? '')}</h2>
      <p>{options.length} {text(options.length === 1 ? ['sugestão para retomar a jornada', 'suggestion to resume your journey']
        : ['sugestões para retomar a jornada', 'suggestions to resume your journey'])}</p>
      <div className="todo-hero-picks">{options.slice(0, 4).map(entry => <button key={entry.id} type="button" onClick={() => pick(entry.id)}>
        <TotkCategoryIcon category={entry.item.category} />{entry.title}</button>)}</div>
    </section>
    <div className="todo-body"><div className="todo-regions">
      {[...groups].map(([key, entries]) => <section key={key} className="todo-region">
        <header><img src={groupArt(entries[0].item)} alt="" /><div><h3>{groupName(key)}</h3><small>{entries.length}</small></div></header>
        <ul>{entries.map(entry => <li key={entry.id}><button type="button" aria-pressed={current.id === entry.id}
          className={current.id === entry.id ? 'selected' : ''} onClick={() => pick(entry.id)}>
          <span className="todo-icon"><TotkCategoryIcon category={entry.item.category} fallback /></span>
          <span className="todo-text"><b>{entry.title}</b><small>{text(worldCategories[entry.item.category])}</small></span>
        </button></li>)}</ul>
      </section>)}
    </div>{!compact && <aside className="todo-side">{detail}</aside>}</div>
    {compact && sheetOpen && <TodoSheet onClose={() => setSheetOpen(false)}>{detail}</TodoSheet>}
  </div>;
}

const dayKey = (at: number) => {
  const value = new Date(at);
  return [value.getFullYear(), value.getMonth() + 1, value.getDate()].map(part => String(part).padStart(2, '0')).join('-');
};

export function JournalTimeline({ text, entries = [] }: { text: WorldText; entries?: TotkHistoryEntry[] }) {
  const { game, categories: labels } = useWorldJournal();
  const [picked, setPicked] = useState('');
  const day = picked || dayKey(Date.now());
  const events = entries.slice(1).map((entry, index) => {
    const previous = entries[index];
    return { entry, previous, label: historyChange(text, entry, previous, labels) };
  }).filter(event => dayKey(event.entry.at) === day && event.label).reverse();
  const categories = ['shrine', game === 'botw' ? 'memory' : 'lightroot', 'main-quest'] as const;
  return <section className="focus-panel timeline-panel">
    <div className="section-line"><h2>{text(['Atividade da partida', 'Save activity'])}</h2>
      <label className="inline-field">{text(['Dia', 'Day'])}<input type="date" value={day} onChange={event => setPicked(event.target.value)} /></label></div>
    <div className="timeline-stats">{categories.map(category => {
      const total = events.reduce((sum, { entry, previous }) =>
        sum + (entry.counts[category] ?? 0) - (previous.counts[category] ?? 0), 0);
      return <span key={category}><b><TotkCategoryIcon category={category} />{number(total)}</b>{text(labels[category])}</span>;
    })}</div>
    {events.length ? <ol className="activity-list">{events.map(({ entry, label }) =>
      <li key={entry.at}><time dateTime={new Date(entry.at).toISOString()}>{hour(entry.at)}</time>
        <div><b>{label}</b><small>{text(['Último save', 'Last save'])}</small></div></li>,
    )}</ol> : <p className="quiet">{text(['Nenhum avanço foi registrado neste dia com o tracker aberto.', 'No progress was recorded on this day while the tracker was open.'])}</p>}
  </section>;
}

const questions: { prompt: IslandText; choices: IslandText[]; answer: number; explanation: IslandText }[] = [
  { prompt: ['Onde ficam as raízes de luz?', 'Where are Lightroots found?'], choices: [['No céu', 'In the sky'], ['Nas Profundezas', 'In the Depths'], ['Só nas cavernas', 'Only in caves']], answer: 1,
    explanation: ['Cada raiz fica sob um santuário da superfície.', 'Each Lightroot sits below a surface shrine.'] },
  { prompt: ['Que habilidade o santuário In-isa ensina?', 'What ability does In-isa Shrine teach?'], choices: [['Fuse', 'Fuse'], ['Recall', 'Recall'], ['Ascend', 'Ascend']], answer: 0,
    explanation: ['Em In-isa, Link aprende a combinar materiais com armas e escudos.', 'At In-isa, Link learns to fuse materials to weapons and shields.'] },
  { prompt: ['Qual povo vive em Rito Village?', 'Which people live in Rito Village?'], choices: [['Goron', 'Goron'], ['Zora', 'Zora'], ['Rito', 'Rito']], answer: 2,
    explanation: ['Rito Village fica a oeste de Hyrule, na região de Hebra.', 'Rito Village is in western Hyrule, in the Hebra region.'] },
  { prompt: ['Quais materiais as estátuas negociantes aceitam?', 'What do Bargainer Statues accept?'], choices: [['Poes', 'Poes'], ['Rúpias', 'Rupees'], ['Sementes Korok', 'Korok Seeds']], answer: 0,
    explanation: ['As estátuas trocam poes por itens e peças de roupa.', 'The statues trade poes for items and clothing.'] },
  { prompt: ['De qual região Tulin faz parte?', 'Which region is Tulin from?'], choices: [['Gerudo', 'Gerudo'], ['Hebra', 'Hebra'], ['Eldin', 'Eldin']], answer: 1,
    explanation: ['A aventura de Tulin começa em Rito Village e segue para o Templo do Vento.', 'Tulin’s adventure starts in Rito Village and leads to the Wind Temple.'] },
  { prompt: ['Quantas Vontades dos Sábios são usadas para fortalecer um sábio?', 'How many Sage’s Wills strengthen a sage?'],
    choices: [['Duas', 'Two'], ['Três', 'Three'], ['Quatro', 'Four']], answer: 2,
    explanation: ['Leve quatro a uma Estátua da Deusa para fortalecer um sábio.', 'Take four to a Goddess Statue to strengthen a sage.'] },
  { prompt: ['Quem aceita gemas Bubbul em troca de itens?', 'Who trades items for Bubbul Gems?'], choices: [['Koltin', 'Koltin'], ['Hestu', 'Hestu'], ['Addison', 'Addison']], answer: 0,
    explanation: ['Koltin viaja com sua barraca e aparece à noite.', 'Koltin travels with his stall and appears at night.'] },
];

const botwQuestions: typeof questions = [
  { prompt: ['Qual runa Oman Au ensina?', 'Which rune does Oman Au teach?'], choices: [['Magnesis', 'Magnesis'], ['Cryonis', 'Cryonis'], ['Stasis', 'Stasis']], answer: 0,
    explanation: ['Magnesis movimenta as placas e os cubos metálicos do santuário.', 'Magnesis moves the shrine’s metal slabs and cubes.'] },
  { prompt: ['Quem entrega o paraglider?', 'Who gives Link the paraglider?'], choices: [['Impa', 'Impa'], ['O velho', 'The Old Man'], ['Purah', 'Purah']], answer: 1,
    explanation: ['Encontre o velho no telhado do Templo do Tempo depois dos quatro santuários.', 'Meet the Old Man on the Temple of Time roof after clearing the four shrines.'] },
  { prompt: ['Qual Besta Divina sobrevoa a Vila Rito?', 'Which Divine Beast flies over Rito Village?'], choices: [['Vah Medoh', 'Vah Medoh'], ['Vah Ruta', 'Vah Ruta'], ['Vah Rudania', 'Vah Rudania']], answer: 0,
    explanation: ['Teba ajuda Link a desarmar os canhões de Vah Medoh.', 'Teba helps Link disable Vah Medoh’s cannons.'] },
  { prompt: ['Qual runa permite criar pilares de gelo?', 'Which rune creates ice pillars?'], choices: [['Stasis', 'Stasis'], ['Cryonis', 'Cryonis'], ['Magnesis', 'Magnesis']], answer: 1,
    explanation: ['A runa é ensinada no santuário Keh Namut, no Grande Planalto.', 'The rune is taught in Keh Namut Shrine on the Great Plateau.'] },
  { prompt: ['De quantos corações permanentes Link precisa para retirar a Espada Mestra?', 'How many permanent hearts does Link need to draw the Master Sword?'], choices: [['10', '10'], ['13', '13'], ['15', '15']], answer: 1,
    explanation: ['Os corações amarelos de comida ficam fora da contagem.', 'Temporary yellow hearts from food are excluded.'] },
  { prompt: ['Quem melhora a Tábua Sheikah em Hateno?', 'Who upgrades the Sheikah Slate in Hateno?'], choices: [['Robbie', 'Robbie'], ['Pikango', 'Pikango'], ['Purah', 'Purah']], answer: 2,
    explanation: ['Acenda o forno do laboratório com a chama azul para liberar o serviço de Purah.', 'Light the lab furnace with the blue flame to unlock Purah’s services.'] },
  { prompt: ['Em que região vivem as Moldugas?', 'Which region is home to Molduga?'], choices: [['Deserto Gerudo', 'Gerudo Desert'], ['Montanhas de Hebra', 'Hebra Mountains'], ['Akkala', 'Akkala']], answer: 0,
    explanation: ['Uma bomba jogada na areia pode atrair uma Molduga à superfície.', 'A bomb thrown onto the sand can lure a Molduga to the surface.'] },
];

export function JournalQuiz({ text }: { text: WorldText }) {
  const { game, totals: categoryTotals } = useWorldJournal();
  const normalQuestions = (game === 'botw' ? botwQuestions : questions).map((item): Question => {
    const [a, b] = item.choices.filter((_, index) => index !== item.answer);
    return [text(item.prompt), text(item.choices[item.answer]), text(a), text(b),
      text(['Nenhuma das anteriores', 'None of the above']), undefined, text(item.explanation)];
  });
  const coordinates: [WorldCategory, IslandText, string[]][] = game === 'botw' ? [
    ['shrine', ['Quantos santuários há no jogo base?', 'How many shrines are in the base game?'], ['116', '128', '136']],
    ['dlc-shrine', ['Quantos santuários a Balada acrescenta?', 'How many shrines does the Ballad add?'], ['8', '12', '20']],
    ['korok', ['Quantas Sementes Korok há em Hyrule?', 'How many Korok Seeds are there in Hyrule?'], ['441', '720', '1000']],
    ['tower', ['Quantas torres Sheikah há em Hyrule?', 'How many Sheikah Towers are in Hyrule?'], ['12', '18', '20']],
    ['temple', ['Quantas Bestas Divinas Link liberta na história principal?', 'How many Divine Beasts does Link free in the main story?'], ['2', '3', '5']],
    ['fairy', ['Quantas Grandes Fadas melhoram armaduras em Hyrule?', 'How many Great Fairies upgrade armor in Hyrule?'], ['2', '5', '6']],
  ] : [
    ['shrine', ['Quantos santuários existem em Hyrule?', 'How many shrines are in Hyrule?'], ['120', '147', '160']],
    ['lightroot', ['Quantas raízes de luz existem?', 'How many Lightroots are there?'], ['58', '100', '152']],
    ['tower', ['Quantas torres de observação existem?', 'How many Skyview Towers are there?'], ['12', '18', '20']],
    ['addison', ['Quantas placas Addison tenta erguer?', 'How many signs is Addison trying to raise?'], ['58', '72', '90']],
    ['well', ['Quantos poços Fera pede que você encontre?', 'How many wells does Fera ask you to find?'], ['36', '49', '60']],
    ['tear', ['Quantas Lágrimas do Dragão podem ser encontradas?', 'How many Dragon’s Tears can you find?'], ['10', '11', '13']],
    ['bubbul', ['Quantas Gemas Bubbul existem?', 'How many Bubbul Gems are there?'], ['120', '138', '152']],
  ];
  const hardQuestions = coordinates.map(([category, prompt, wrong]): Question =>
    [text(prompt), String(categoryTotals[category]), wrong[0], wrong[1], wrong[2]]);
  return <Quiz normalQuestions={normalQuestions} hardQuestions={hardQuestions} historyKey={game + '.quiz.results'} />;
}
