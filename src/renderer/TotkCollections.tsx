import { useState } from 'react';
import { canTickByHand, isWorldLocation, isWorldManual, worldLayers, type WorldItem } from '../core/totk-world';
import type { TotkIslandState } from '../shared/types';
import { gameArtwork } from './GamePicker';
import { ObjectiveName } from './ObjectiveName';
import { PageProgress } from './PageProgress';
import { TotkCategoryIcon } from './TotkCategoryIcon';
import { ObjectiveNote, markLabels, matchesWorldItem, type WorldText } from './TotkWorldMap';
import { TotkMapCrop, totkMapPreview } from './TotkMapArt';
import { useWorldJournal } from './WorldJournalContext';
import { journalMessage, journalName } from './i18n';
import './easter-eggs.css';

export interface TotkCollectionProps {
  text: WorldText; save: TotkIslandState; markingDisabled: boolean;
  onMap: (item: WorldItem) => void; onMark: (id: string, checked: boolean) => void;
}

const mark = (save: TotkIslandState, item: WorldItem) => save.manual.includes(item.id) ? 'done' :
  save.world?.marks[item.id] ?? save.marks[item.id] ?? 'unknown';
const isDone = (save: TotkIslandState, item: WorldItem) => mark(save, item) === 'done';

function itemState(text: WorldText, save: TotkIslandState, item: WorldItem) {
  if (isWorldLocation(item)) return text(['Localização', 'Location']);
  if (isWorldManual(item) && !isDone(save, item)) return text(['Sem resultado no save', 'No result in the save']);
  // No save yet reads as not done, like the Ocarina pages, rather than as missing data.
  const state = mark(save, item);
  return text(markLabels[state === 'unknown' && !save.world ? 'pending' : state]);
}

function ItemActions({ text, save, markingDisabled, onMap, onMark, item }: TotkCollectionProps & { item: WorldItem }) {
  const done = isDone(save, item);
  return <div className="result-actions">
    {item.at && <button type="button" className="small-btn" onClick={() => onMap(item)}>{text(['Ver no mapa', 'Show on map'])}</button>}
    {canTickByHand(item, (save.world?.marks[item.id] ?? save.marks[item.id]) === 'done') && <button type="button" className="action" disabled={markingDisabled} onClick={() => onMark(item.id, !done)}>
      {text(done ? ['Desmarcar', 'Uncheck'] : ['Marcar', 'Check off'])}
    </button>}
  </div>;
}

export function TotkThreads(props: TotkCollectionProps) {
  const { game, pages: worldPages, story: worldGuide, byId: worldById, categories: worldCategories } = useWorldJournal();
  const { text, save } = props;
  const items = worldPages.threads;
  const side = items.filter(item => item.category !== 'main-quest');
  const groups = [...new Set(side.map(item => item.category))].map(category =>
    ({ category, items: side.filter(item => item.category === category) }));
  return <div>
    <PageProgress done={items.filter(item => isDone(save, item)).length} total={items.length} />
    <div className="story-grid">
      <section className="focus-panel"><h2>{text(['História principal', 'Main story'])}</h2>
        {worldGuide.map(route => {
          const missions = route.chapters.flatMap(chapter => {
            const item = worldById.get('quest:' + chapter.quest);
            return item ? [{ item, title: text(chapter.title) }] : [];
          });
          const done = missions.filter(({ item }) => isDone(save, item)).length;
          return <details className="story-chapter" key={route.id}>
            <summary><span className={'story-dot' + (done === missions.length ? ' done' : '')} aria-hidden="true" />
              <ObjectiveName done={done === missions.length}>{text(route.title)}</ObjectiveName><small>{done}/{missions.length}</small></summary>
            <ul>{missions.map(({ item, title }) => <li key={item.id}>
              <span><ObjectiveName done={isDone(save, item)}>{title}</ObjectiveName></span>
              <button className="small-btn" type="button" onClick={() => props.onMap(item)}>{text(['Ver no mapa', 'Show on map'])}</button>
            </li>)}</ul>
          </details>;
        })}
      </section>
      <section className="focus-panel"><h2>{text(['Missões secundárias e memórias', 'Side quests and memories'])}</h2>
        {groups.map(group => <details className="story-chapter side-quest" key={group.category}>
          <summary><span className="story-dot" aria-hidden="true" /><b>{text(worldCategories[group.category])}</b>
            <small>{group.items.filter(item => isDone(save, item)).length}/{group.items.length}</small></summary>
          <ul>{group.items.map(item => <li key={item.id}><details className="totk-quest-detail">
            <summary><ObjectiveName done={isDone(save, item)}>{journalName(game, item.name)}</ObjectiveName><small>{itemState(text, save, item)}</small></summary>
            <ObjectiveNote text={text} item={item} /><ItemActions {...props} item={item} />
          </details></li>)}</ul>
        </details>)}
      </section>
    </div>
  </div>;
}

const miniFilters = [['all', ['Todos', 'All']], ['cleared', ['Já concluídos', 'Completed']], ['remaining', ['Sem conclusão', 'Not completed']]] as const;

export function TotkMinigames(props: TotkCollectionProps) {
  const { game, pages: worldPages, regions: worldRegions } = useWorldJournal();
  const { text, save } = props;
  const [filter, setFilter] = useState<typeof miniFilters[number][0]>('all');
  const items = worldPages.minigames;
  const visible = items.filter(item => filter === 'all' || isDone(save, item) === (filter === 'cleared'));
  return <>
    <PageProgress done={items.filter(item => isDone(save, item)).length} total={items.length} />
    <div className="section-line minigame-controls"><div className="segment" role="group" aria-label={text(['Filtrar minijogos', 'Filter minigames'])}>
      {miniFilters.map(([id, label]) => <button key={id} type="button" aria-pressed={id === filter} onClick={() => setFilter(id)}>{text(label)}</button>)}
    </div></div>
    <div className="minigame-grid">{visible.map(item => {
      const done = isDone(save, item);
      return <section className="focus-panel minigame-card" key={item.id}>
        <div className="minigame-heading">
          <TotkCategoryIcon category={item.category} fallback />
          <div><h2><ObjectiveName done={done}>{journalName(game, item.name)}</ObjectiveName></h2>
            <small>{journalName(game, worldRegions.find(region => region.id === item.region)?.name ?? '') || (item.layer && text(worldLayers[item.layer]))}</small></div>
          <b>{done ? '1/1' : '0/1'}</b>
        </div>
        <ul className="minigame-objectives"><li><span><ObjectiveName done={done}>{journalName(game, item.name)}</ObjectiveName><small>{itemState(text, save, item)}</small><ObjectiveNote item={item} text={text} /></span>
          <ItemActions {...props} item={item} /></li></ul>
      </section>;
    })}</div>
    {!visible.length && <p className="quiet">{text(['Nenhum minijogo neste filtro.', 'No minigames match this filter.'])}</p>}
  </>;
}

// The catalog numbers every Hinox or Talus ("Hinox 01"); the region and layer say which one it is.
const enemyName = (game: 'botw' | 'totk', text: WorldText, item: WorldItem, regions: { id: string; name: string }[]) => [
  journalName(game, item.name.replace(/ \d+$/, '')),
  journalName(game, regions.find(region => region.id === item.region)?.name ?? ''),
  item.layer && text(worldLayers[item.layer]),
].filter(Boolean).join(' · ');

const hallTabs = [['field', ['Chefes de campo', 'Field bosses']], ['rematch', ['Revanches', 'Rematches']], ['encounter', ['Encontros', 'Encounters']]] as const;

export function TotkHall(props: TotkCollectionProps) {
  const { game, pages: worldPages, categories, regions } = useWorldJournal();
  const { text, save } = props;
  const [tab, setTab] = useState<typeof hallTabs[number][0]>('field');
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string>();
  const items = worldPages.hall;
  const category = items.filter(item => tab === 'rematch' ? item.category === 'rematch' :
    tab === 'encounter' ? isWorldLocation(item) : item.category !== 'rematch' && !isWorldLocation(item));
  const shown = category.filter(item => matchesWorldItem(item, query, game, text, categories));
  const active = shown.find(item => item.id === selected);
  return <div>
    <PageProgress done={items.filter(item => isDone(save, item)).length} total={items.filter(item => !isWorldLocation(item)).length} />
    <section className="focus-panel hall-panel">
      <div className="section-line"><h2>{text(hallTabs.find(([id]) => id === tab)![1])}</h2>
        <b>{tab === 'encounter' ? category.length : category.filter(item => isDone(save, item)).length + '/' + category.length}</b></div>
      <div className="segment">{hallTabs.map(([id, label]) => <button type="button" key={id} aria-pressed={id === tab} onClick={() => {
        setTab(id); setSelected(undefined); setQuery('');
      }}>{text(label)}</button>)}</div>
      <label className="inline-field">{text(['Buscar inimigo', 'Search enemies'])}<input type="search" value={query} onChange={event => setQuery(event.target.value)} /></label>
      {active && <div className="enemy-focus"><TotkCategoryIcon category={active.category} /><div><h3>{journalName(game, active.name)}</h3>
        <ObjectiveNote text={text} item={active} /><ItemActions {...props} item={active} /></div>
        <button type="button" className="action" onClick={() => setSelected(undefined)}>{text(['Fechar', 'Close'])}</button></div>}
      <div className="hall-list">{shown.map(item => <div className="hall-row" key={item.id}>
        <span className={'story-dot' + (isDone(save, item) ? ' done' : '')} aria-hidden="true" />
        <button type="button" className="enemy-thumb" aria-label={journalName(game, item.name)} onClick={() => setSelected(item.id)}><TotkCategoryIcon category={item.category} fallback /></button>
        <b><ObjectiveName done={isDone(save, item)}>{enemyName(game, text, item, regions)}</ObjectiveName></b><span>{itemState(text, save, item)}</span>
      </div>)}</div>
      {!shown.length && <p className="quiet">{text(['Nenhum inimigo encontrado.', 'No enemies found.'])}</p>}
    </section>
  </div>;
}

export function TotkSecrets({ islandItems, ...props }: TotkCollectionProps & { islandItems: WorldItem[] }) {
  const { game, pages: worldPages, byId: worldById, categories: worldCategories, regions: worldRegions } = useWorldJournal();
  const { text, save } = props;
  const [layer, setLayer] = useState<string>();
  const [limit, setLimit] = useState(36);
  const items = worldPages.secrets;
  // One card per region, as the Ocarina page has one per area. Every layer of a region counts toward it.
  const regions = [
    { id: 'island', name: text(['Grande Ilha Celeste', 'Great Sky Island']), items: islandItems },
    ...worldRegions.map(region => ({ id: region.id, name: journalName(game, region.name), items: items.filter(item => item.region === region.id) })),
  ].filter(region => region.items.length);
  const selected = regions.find(region => region.id === layer);
  const tracked = items.filter(item => !isWorldLocation(item));
  // A close crop of the map around the region's Skyview Tower, centered in the card.
  const photo = (id: string, size?: { width: number; height: number }) => {
    const tower = id === 'island' ? undefined : worldById.get(id)?.at;
    return <span className="easter-photo">{tower ? <TotkMapCrop layer="surface" at={tower} anchor={0.5} />
      : <img src={id === 'island' ? totkMapPreview('sky', [450, 1260], 5) : gameArtwork(game)} alt="" {...size} />}</span>;
  };
  const meter = (entries: WorldItem[]) => {
    const progress = entries.filter(item => !isWorldLocation(item));
    const done = progress.filter(item => isDone(save, item)).length;
    return <span className="easter-region-meter"><small>{journalMessage(['{done} de {total} descobertas', '{done} of {total} discoveries'],
      { done, total: progress.length })}</small>
      <progress className="page-progress-bar" value={done} max={progress.length || 1} aria-label={text(['Progresso das descobertas', 'Discovery progress'])} />
    </span>;
  };
  return <div className="easter-eggs">
    <PageProgress done={tracked.filter(item => isDone(save, item)).length} total={tracked.length} />
    {selected ? <section className="easter-area">
      <button className="action easter-back" type="button" onClick={() => setLayer(undefined)}>{text(['Voltar às regiões', 'Back to regions'])}</button>
      <div className="easter-area-banner">{photo(selected.id)}
        <div className="easter-area-body"><h2>{selected.name}</h2>{meter(selected.items)}</div></div>
      <ul className="easter-region">{selected.items.slice(0, limit).map(item => <li className="easter-entry" key={item.id}>
        <div className="easter-entry-heading"><h3><ObjectiveName done={isDone(save, item)}>{journalName(game, item.name)}</ObjectiveName></h3>
          <small>{itemState(text, save, item)}</small></div>
        <p className="easter-metadata">{text(worldCategories[item.category])}</p>
        <details className="easter-solution"><summary>{text(['Ver solução', 'Show solution'])}</summary>
          <ObjectiveNote item={item} text={text} /><ItemActions {...props} item={item} /></details>
      </li>)}</ul>
      {selected.items.length > limit && <button className="action" type="button" onClick={() => setLimit(limit + 36)}>
        {text(['Mostrar mais', 'Show more'])} · {limit}/{selected.items.length}</button>}
    </section> : <ul className="easter-gallery">{regions.map(region => <li key={region.id}>
      <button type="button" className="easter-region-card" onClick={() => { setLayer(region.id); setLimit(36); }}>
        {photo(region.id, { width: 320, height: 144 })}
        <span className="easter-region-preview"><strong>{region.name}</strong>{meter(region.items)}</span>
      </button>
    </li>)}</ul>}
  </div>;
}
