import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { worldSections } from '../core/totk-journal';
import { canTickByHand, isWorldLocation, type WorldCategory, type WorldItem } from '../core/totk-world';
import type { TotkIslandState } from '../shared/types';
import { Masonry } from './Masonry';
import { PageProgress } from './PageProgress';
import { ObjectiveName } from './ObjectiveName';
import { TotkCategoryIcon } from './TotkCategoryIcon';
import { ObjectiveNote, markLabels, matchesWorldItem, worldCoordinates, type WorldText } from './TotkWorldMap';
import { useMatches } from './CompanionPages';
import { useModalDialog } from './useModalDialog';
import { useStored } from './Recreation';
import { journalName, t } from './i18n';
import { useWorldJournal } from './WorldJournalContext';

/** The Ocarina checklist's legend, so both journals read the same way. */
function Legend() {
  return <div className="panel legend">
    <div className="panel-head"><span>{t('Legend')}</span></div>
    <div className="leg"><span className="tile done mini" style={{ ['--c' as string]: '#4fc39b' }} />{t('Collected')}</div>
    <div className="leg"><span className="tile todo mini" style={{ ['--c' as string]: '#4fc39b' }} />{t('Not collected yet')}</div>
    <div className="leg"><span className="tile done manual mini" style={{ ['--c' as string]: '#4fc39b' }}><span className="badge m">M</span></span>{t('Ticked by hand')}</div>
    <p className="muted small">{t('Click an entry to see where it is and what you still need for it. Double-click to tick or untick it by hand.')}</p>
  </div>;
}

const colors = ['#aeca82', '#dcb86f', '#91b8d0', '#dd9384', '#bbabe5', '#8fcac0'];

export function TotkChecklist({ text, items: supplied, save, focus, disabled, onMap, onMark, onTodo, island, onScope }: {
  text: WorldText; items?: WorldItem[]; save: TotkIslandState; focus?: WorldItem; disabled: boolean;
  onMap: (item: WorldItem) => void; onMark: (id: string, checked: boolean) => void; onTodo: () => void;
  island: boolean; onScope: (island: boolean) => void;
}) {
  const { game, items: worldItems, layers, categories: worldCategories, regions: worldRegions } = useWorldJournal();
  const items = supplied ?? worldItems;
  const [query, setQuery] = useState('');
  const [layer, setLayer] = useState('');
  const [region, setRegion] = useState(game === 'botw' ? focus?.region ?? '' : '');
  const [edition, setEdition] = useState('');
  const [hideDone, setHideDone] = useStored(game + '.checklist.hideDone', false);
  const [hidden, setHidden] = useStored<WorldCategory[]>(game + '.checklist.hidden', []);
  const [collapsed, setCollapsed] = useStored<WorldCategory[]>(game + '.checklist.collapsed', []);
  const [limits, setLimits] = useState<Partial<Record<WorldCategory, number>>>({});
  const [selected, setSelected] = useState<WorldItem | undefined>(focus);
  const grid = useRef<HTMLDivElement>(null);
  const compact = useMatches('(max-width: 900px)');
  const sheet = useModalDialog(compact && !!selected);
  useEffect(() => {
    if (focus) grid.current?.querySelector<HTMLElement>(`[data-item="${CSS.escape(focus.id)}"]`)?.scrollIntoView({ block: 'nearest' });
  }, [focus]);
  const grouped = useMemo(() => {
    const byCategory = new Map<WorldCategory, WorldItem[]>();
    items.forEach(item => {
      const group = byCategory.get(item.category) ?? [];
      group.push(item);
      byCategory.set(item.category, group);
    });
    return byCategory;
  }, [items]);
  const done = (item: WorldItem) => save.manual.includes(item.id) || save.world?.marks[item.id] === 'done' || save.marks[item.id] === 'done';
  const trackable = items.filter(item => !isWorldLocation(item));
  const finished = trackable.filter(done).length;
  const savedDone = (item: WorldItem) => save.world?.marks[item.id] === 'done' || save.marks[item.id] === 'done';
  const byHand = (item: WorldItem) => save.manual.includes(item.id) && !savedDone(item);
  const details = selected && <div className="panel details">
    <div className="panel-head">
      <TotkCategoryIcon category={selected.category} seeds={selected.seeds} />
      <b id="totk-checklist-detail">{journalName(game, selected.name)}</b>
      <button className="x" type="button" aria-label={text(['Fechar', 'Close'])} onClick={() => setSelected(undefined)}>×</button>
    </div>
    <div className="members"><div className="member">
      <span className="mark" aria-hidden="true">{done(selected) ? '✓' : '·'}</span>
      <div className="member-body">
        <span className="muted small">{text(worldCategories[selected.category])}{selected.at && ' · ' + worldCoordinates(selected.at)}</span>
        <p>{text(isWorldLocation(selected) ? ['Localização', 'Location'] : markLabels[done(selected) ? 'done' : save.world?.marks[selected.id] ?? save.marks[selected.id] ?? 'unknown'])}</p>
        <ObjectiveNote item={selected} text={text} />
        <div className="result-actions">
          {selected.at && <button className="small-btn" type="button" onClick={() => onMap(selected)}>{text(['Ver no mapa', 'Show on map'])}</button>}
          {canTickByHand(selected, savedDone(selected)) && <button className="small-btn" type="button" disabled={disabled} onClick={() => onMark(selected.id, !done(selected))}>
            {text(done(selected) ? ['Desmarcar', 'Uncheck'] : ['Marcar como feito', 'Mark complete'])}
          </button>}
        </div>
      </div>
    </div></div>
  </div>;
  const filter = (category: WorldCategory, values: WorldCategory[], set: (next: WorldCategory[]) => void) =>
    set(values.includes(category) ? values.filter(value => value !== category) : [...values, category]);
  const groups = worldSections.map((section, index) => ({
    ...section, color: colors[index], cards: section.categories.flatMap(category => {
      const group = grouped.get(category);
      const pinned = selected?.category === category && selected.id === focus?.id ? selected : undefined;
      if (!group || hidden.includes(category) && !query.trim() && !pinned) return [];
      const visible = group.filter(item => item.id === pinned?.id || ((!layer || item.layer === layer) && (!region || item.region === region)
        && (!edition || (item.edition ?? 'base') === edition) && (!hideDone || !done(item)) && matchesWorldItem(item, query, game, text, worldCategories)));
      if (!visible.length && (query.trim() || layer || region || edition)) return [];
      const count = group.filter(done).length;
      const expanded = !collapsed.includes(category) || !!query.trim() || !!pinned;
      const limit = limits[category] ?? 12;
      const tiles = visible.slice(0, limit);
      if (pinned && !tiles.some(item => item.id === pinned.id)) tiles.unshift(pinned);
      const color = { '--cat': colors[index] } as CSSProperties;
      return [{ key: category, node: <div className={`card ${expanded ? '' : 'collapsed'}`} style={color}>
        <button className="card-head" type="button" aria-expanded={expanded} onClick={() => filter(category, collapsed, setCollapsed)}>
          <span className="chev" aria-hidden="true">{expanded ? '▾' : '▸'}</span>
          <span className="card-title"><ObjectiveName done={count === group.length}>{text(worldCategories[category])}</ObjectiveName></span>
          <span className="card-count">{count}/{group.length}</span>
        </button>
        <div className="bar" aria-hidden="true"><div className="fill" style={{ transform: `scaleX(${count / group.length})` }} /></div>
        {expanded && <div className="section">
          <div className="tiles">{tiles.map(item => <button key={item.id} type="button"
            className={`tile ${done(item) ? 'done' : ''} ${byHand(item) ? 'manual' : ''} ${selected?.id === item.id ? 'selected' : ''}`} data-item={item.id}
            style={{ '--c': colors[index] } as CSSProperties} onClick={() => setSelected(item)} title={journalName(game, item.name)} aria-label={journalName(game, item.name)}
            onDoubleClick={() => { if (canTickByHand(item, savedDone(item)) && !disabled) onMark(item.id, !done(item)); }}>
              {byHand(item) && <span className="badge m">M</span>}
              <span className="glyph"><TotkCategoryIcon category={item.category} seeds={item.seeds} fallback /></span>
              <span className="tile-label">{journalName(game, item.name)}</span>
          </button>)}</div>
          {!visible.length && <p className="quiet">{text(['Nenhum objetivo pendente.', 'No remaining objectives.'])}</p>}
          {visible.length > limit && <button className="small-btn" type="button" onClick={() => setLimits({ ...limits, [category]: limit + 24 })}>
            {text(['Mostrar mais', 'Show more'])} · {limit}/{visible.length}
          </button>}
        </div>}
      </div> }];
    }),
  }));
  return <>
    <PageProgress done={finished} total={trackable.length} label={text(['Progresso do checklist', 'Checklist progress'])}
      text={text(['Progresso do checklist', 'Checklist progress']) + ' · ' + Math.floor(finished / Math.max(1, trackable.length) * 100) + '%'} />
    <div className="toolbar">
      <input className="checklist-search" type="search" aria-label={text(['Buscar no checklist', 'Search the checklist'])}
        placeholder={text(['Buscar no checklist', 'Search the checklist'])} value={query} onChange={event => setQuery(event.target.value)} />
      <label className="check"><input type="checkbox" checked={hideDone} onChange={event => setHideDone(event.target.checked)} />
        {text(['Ocultar concluídos', 'Hide completed'])}</label>
      {game === 'totk' && <select aria-label={text(['Área do diário', 'Journal area'])} value={island ? 'island' : 'world'} onChange={event => onScope(event.target.value === 'island')}>
        <option value="world">{text(['Mundo', 'World'])}</option>
        <option value="island">{text(['Grande Ilha Celeste', 'Great Sky Island'])}</option>
      </select>}
      {game === 'totk' && !island && <select aria-label={text(['Camada', 'Layer'])} value={layer} onChange={event => setLayer(event.target.value)}>
        <option value="">{text(['Todas as camadas', 'All layers'])}</option>
        {Object.entries(layers).map(([id, name]) => <option key={id} value={id}>{text(name)}</option>)}
      </select>}
      {game === 'botw' && <select aria-label={text(['Edição', 'Edition'])} value={edition} onChange={event => setEdition(event.target.value)}>
        <option value="">{text(['Todas as edições', 'All editions'])}</option>
        <option value="base">{text(['Jogo base', 'Base game'])}</option>
        <option value="dlc">DLC</option>
        <option value="switch2">Nintendo Switch 2</option>
      </select>}
      {!island && <select aria-label={text(['Região', 'Region'])} value={region} onChange={event => setRegion(event.target.value)}>
        <option value="">{text(['Todas as regiões', 'All regions'])}</option>
        {worldRegions.map(entry => <option key={entry.id} value={entry.id}>{journalName(game, entry.name)}</option>)}
      </select>}
      <details className="dropdown categories totk-check-categories">
        <summary className="action">{text(['Categorias', 'Categories'])} ▾</summary>
        <div className="dropdown-menu">{[...grouped.keys()].map(category => <label className="check" key={category}>
          <input type="checkbox" checked={!hidden.includes(category)} onChange={() => filter(category, hidden, setHidden)} />
          {text(worldCategories[category])}</label>)}</div>
      </details>
    </div>
    {!query.trim() && <button type="button" className="todo-link" onClick={onTodo}>
      <b>{text(['O que fazer?', 'What can I do?'])}</b><span className="muted">{text(save.world?.player
        ? ['Objetivos perto do último save', 'Objectives near the last save'] : ['O próximo passo da história', 'The next story step'])}</span>
      <span aria-hidden="true">→</span>
    </button>}
    <div className="body page-content">
      <div className="grid-wrap" ref={grid}>
        {!groups.some(group => group.cards.length) && <p className="quiet">{text(['Nenhum objetivo com esses filtros.', 'No matching objectives.'])}</p>}
        {groups.filter(group => group.cards.length).map(group => <section key={group.id}>
          <h2 className="part-title">{text(group.label)}</h2><Masonry items={group.cards} />
        </section>)}
      </div>
      <aside className="side">{compact ? <dialog className="checklist-sheet" ref={sheet} aria-labelledby="totk-checklist-detail"
        onCancel={event => { event.preventDefault(); setSelected(undefined); }}>{details}</dialog> : details ?? <Legend />}</aside>
    </div>
  </>;
}
