import { lazy, Suspense, useDeferredValue, useEffect, useMemo, useRef, useState } from 'react';
import type { AppState, TrackedCategory, TrackedItem, UiPrefs, ChangeRow, OverlayMode } from '../shared/types';
import { api, isRemote, onConnection, timeAgo } from './api';
import { symbolIcons, categoryColor } from './icons';
import { Symbol } from './symbols';
import { buildCards, tileItems, Card, TileModel } from './view';
import { Masonry } from './Masonry';
import { CompanionPage, Icon, MobileNav, Sidebar, PageHeader, MAP_CATEGORIES, type Page } from './CompanionPages';
import { WhatToDo } from './WhatToDo';
import { GamePicker, GameSwitch, lastGame, rememberGame, type Game } from './GamePicker';

// The guide's text is large: it loads when the page opens.
const Walkthrough = lazy(() => import('./Walkthrough'));
const TotkJournal = lazy(() => import('./TotkJournal'));
import { LanguageSwitch } from './LanguageFlags';
import { currentLocale, day, loadLocale, message, percent, setLocale, t, tail, tv, type Locale } from './i18n';
import { ObjectiveName } from './ObjectiveName';
import { PageProgress } from './PageProgress';
import { PageSkeleton } from './PageSkeleton';
import { UpdateDialog } from './UpdateDialog';
import { enemyPhoto } from './referenceImages';
import { GameItemIcon, itemImage, trackedItemIcon } from './GameItemIcon';
import { useModalDialog } from './useModalDialog';
import type { Connection } from './webApi';

const icons = symbolIcons;

export function App() {
  const [state, setState] = useState<AppState | null>(null);
  const [prefs, setPrefs] = useState<UiPrefs | null>(null);
  const [startupAttempt, setStartupAttempt] = useState(0);
  const [startupFailed, setStartupFailed] = useState(false);
  const [connection, setConnection] = useState<Connection>('connecting');
  const [selected, setSelected] = useState<string | null>(null);
  // Opens straight into the last game played; the picker shows on the first run and from "Switch game".
  const [game, setGame] = useState<Game | undefined>(lastGame);
  const [previousGame, setPreviousGame] = useState(lastGame);
  const [page, setPage] = useState<Page>('overview');
  // Checklist entry the map should open on ("View on map").
  const [mapFocus, setMapFocus] = useState<string>();
  const showOnMap = (id: string) => { setMapFocus(id); setPage('map'); };
  const [scanning, setScanning] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [refreshError, setRefreshError] = useState(false);
  const [query, setQuery] = useState('');
  const [locale, setLanguage] = useState(currentLocale);
  const languageRequest = useRef(0);
  const [languageError, setLanguageError] = useState(false);
  const changeLanguage = async (next: Locale) => {
    const id = ++languageRequest.current;
    setLanguageError(false);
    try { await loadLocale(next); }
    catch {
      if (id === languageRequest.current) setLanguageError(true);
      return;
    }
    if (id !== languageRequest.current) return;
    setLocale(next);
    setLanguage(next);
    void api.setLanguage(next).catch(console.error);
  };
  const [, tick] = useState(0);

  useEffect(() => {
    const off = api.onState(setState);
    const t = setInterval(() => tick(x => x + 1), 15000); // keep "x min ago" fresh
    return () => { off(); clearInterval(t); };
  }, []);

  useEffect(() => {
    let request = 0;
    let ready = false;
    let previousConnection: Connection = 'connecting';
    function load() {
      const id = ++request;
      setStartupFailed(false);
      void Promise.all([api.getState(), api.getPrefs()]).then(([snapshot, savedPrefs]) => {
        if (id !== request) return;
        ready = true;
        setState(current => current ?? snapshot);
        setPrefs(savedPrefs);
      }).catch(() => {
        if (id === request) setStartupFailed(true);
      });
    }
    const off = onConnection(next => {
      setConnection(next);
      if (next === 'open' && previousConnection === 'lost' && !ready) load();
      previousConnection = next;
    });
    load();
    return () => { ++request; off(); };
  }, [startupAttempt]);

  const updatePrefs = (p: UiPrefs) => { setPrefs(p); void api.setPrefs(p); };
  // Arriving from the map: make the entry's card visible (its part shown, the card open), then scroll to its tile.
  const [reveal, setReveal] = useState<string>();
  const showInChecklist = (id: string) => { setQuery(''); setSelected(id); setReveal(id); setPage('checklist'); };
  useEffect(() => {
    if (!reveal || page !== 'checklist' || !state || !prefs) return;
    const cat = state.categories.find(c => c.items.some(i => i.id === reveal));
    if (cat && (!prefs.showParts[cat.part as 'B' | 'C'] && cat.part !== 'A' || prefs.hiddenCategories.includes(cat.id) || prefs.collapsed?.includes(cat.id))) {
      updatePrefs({
        ...prefs,
        showParts: cat.part === 'A' ? prefs.showParts : { ...prefs.showParts, [cat.part]: true },
        hiddenCategories: prefs.hiddenCategories.filter(x => x !== cat.id),
        collapsed: (prefs.collapsed ?? []).filter(x => x !== cat.id),
      });
      return;
    }
    const frame = requestAnimationFrame(() => {
      const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
      document.querySelector(`[data-item="${CSS.escape(reveal)}"]`)?.scrollIntoView({ block: 'center', behavior: reducedMotion ? 'auto' : 'smooth' });
      setReveal(undefined);
    });
    return () => cancelAnimationFrame(frame);
  }, [reveal, page, state, prefs]);
  const [scanError, setScanError] = useState(false);
  const scan = async () => {
    setScanning(true);
    setScanError(false);
    try { setState(await api.scanFolders()); }
    catch { setScanError(true); }
    finally { setScanning(false); }
  };
  async function refreshProgress() {
    setRefreshing(true);
    setRefreshError(false);
    try { await api.refreshProgress(); }
    catch { setRefreshError(true); }
    finally { setRefreshing(false); }
  }

  // Typing stays responsive: the filter runs on a deferred copy of the query,
  // against text normalised once per state/language rather than on every keystroke.
  const deferredQuery = useDeferredValue(query);
  const searchIndex = useMemo(() => {
    if (!state) return null;
    const categories = new Map<string, string>();
    const items = new Map<string, string>();
    for (const cat of state.categories) {
      categories.set(cat.id, cleanText(`${cat.label} ${t(cat.label)}`));
      for (const item of cat.items) items.set(item.id, cleanText([item.name, t(item.name), item.chapter && t(item.chapter), item.where && t(item.where)].join(' ')));
    }
    return { categories, items };
  }, [state, locale]);
  const cards = useMemo(() => {
    if (!state || !searchIndex) return [];
    const search = cleanText(deferredQuery.trim());
    if (!search) return buildCards(state.categories);
    return buildCards(state.categories.flatMap(cat => {
      if (searchIndex.categories.get(cat.id)?.includes(search)) return [cat];
      const items = cat.items.filter(item => searchIndex.items.get(item.id)?.includes(search));
      return items.length ? [{ ...cat, items, total: items.length, done: items.filter(i => i.done).length }] : [];
    }));
  }, [state, searchIndex, deferredQuery]);
  type Selection = { stack: Extract<TileModel, { kind: 'stack' }> } | { cat: TrackedCategory; item: TrackedItem } | null;
  const selectedItem = useMemo((): Selection => {
    if (!state || !selected) return null;
    for (const card of cards) for (const s of card.sections) for (const t of s.tiles) if (t.kind === 'stack' && t.key === selected) return { stack: t };
    for (const c of state.categories) for (const i of c.items) if (i.id === selected) return { cat: c, item: i };
    return null;
  }, [state, cards, selected]);

  const lost = connection === 'lost';
  const parts: { part: 'A' | 'B' | 'C'; title: string }[] = [
    { part: 'A', title: '100% checklist' },
    { part: 'B', title: 'Quest progress' },
    { part: 'C', title: 'Extras (not counted)' },
  ];
  const headerActions = <>
    <div className="refresh-action">
      <button type="button" className="action" title={t(refreshing ? 'Atualizando…' : 'Atualizar agora')} aria-label={t(refreshing ? 'Atualizando…' : 'Atualizar agora')} onClick={() => void refreshProgress()} disabled={!state || !prefs || refreshing || scanning || state.status === 'loading'}>
        <Icon name="refresh" size={16} /><span className="action-label">{t(refreshing ? 'Atualizando…' : 'Atualizar agora')}</span>
      </button>
      {refreshError && <small role="alert">{t('Falha na atualização. Tente novamente.')}</small>}
      {scanError && <small role="alert">{t('Não foi possível buscar os saves. Tente novamente.')}</small>}
      {languageError && <small role="alert">{t('Não foi possível carregar o idioma.')}</small>}
    </div>
    <LanguageSwitch locale={locale} onChange={changeLanguage} />
    <GameSwitch onClick={() => setGame(undefined)} />
  </>;
  const changePage = (next: Page) => { setMapFocus(undefined); setPage(next); };

  function openGame(next: Game) {
    rememberGame(next);
    setPreviousGame(next);
    setReveal(undefined);
    changePage('overview');
    setGame(next);
  }

  if (!game) return <GamePicker last={previousGame} locale={locale} onLanguage={changeLanguage} onEnter={openGame} />;

  return (
    <div className="tracker-shell" lang={locale}>
      {state && prefs && <UpdateDialog />}
      <Sidebar page={page} onPage={changePage} state={state} game={game} />
      <MobileNav page={page} onPage={changePage} state={state} game={game} />
      {game !== 'oot' ? <Suspense fallback={<main className="companion-page"><PageSkeleton page={page} /></main>}>
        <TotkJournal key={game} game={game} state={state} locale={locale} onLanguage={changeLanguage} connectionLost={lost} view={page}
          onPage={changePage} onBack={() => setGame(undefined)} />
      </Suspense> : !state || !prefs || state.status === 'loading' ? (
        <main className={page === 'checklist' ? 'app' : 'companion-page'} key={page}>
          <PageHeader page={page} state={state} headerActions={headerActions} connectionLost={lost} />
          <div className="page-content">
            {(lost || startupFailed) && (!state || !prefs) ? <section className="focus-panel">
              {!lost && <p role="alert">{t('Não foi possível abrir o diário.')}</p>}
              <button type="button" className="action primary" onClick={() => setStartupAttempt(attempt => attempt + 1)}>{t('Tentar novamente')}</button>
            </section> : <PageSkeleton page={page} label={state?.status === 'loading' ? 'Buscando sua partida' : undefined} />}
          </div>
        </main>
      ) : page !== 'checklist' ? (
        <CompanionPage mapFocus={mapFocus} onShowInChecklist={showInChecklist} page={page}
          todoView={page === 'todo' ? <WhatToDo state={state} onShowInChecklist={showInChecklist} onShowOnMap={showOnMap} /> : undefined}
          walkthroughView={page === 'walkthrough' ? <Suspense fallback={<PageSkeleton page="walkthrough" />}>
            <Walkthrough state={state} onShowPlace={id => showOnMap('place:' + id)} />
          </Suspense> : undefined} state={state} onPage={setPage} onScan={scan} scanning={scanning} onLanguage={changeLanguage} headerActions={headerActions} connectionLost={lost} />
      ) : state.status !== 'ok' ? (
        <CompanionPage page="checklist" state={state} onPage={setPage} onScan={scan} scanning={scanning} onLanguage={changeLanguage} headerActions={headerActions} connectionLost={lost} />
      ) : (
    <div className="app">
      <PageHeader page="checklist" state={state} headerActions={headerActions} connectionLost={lost} />
      {state.summary && <PageProgress done={state.summary.percent} total={100} label="Progresso do checklist"
        text={`${t('Progresso do checklist')} · ${percent(state.summary.percent / 100, 1)}`} />}
      <Toolbar state={state} cards={cards} prefs={prefs} onPrefs={updatePrefs} query={query} onQuery={setQuery} />
      {state.message && <div className="banner">{tv(state.message, state.messageValues)}</div>}
      {!query.trim() && state.available.length > 0 && <button type="button" className="todo-link" onClick={() => setPage('todo')}>
        <b>{t('O que fazer?')}</b>
        <span className="muted">{message('{n} objetivos ao seu alcance agora', { n: state.available.length })}</span>
        <span aria-hidden="true">→</span>
      </button>}
      <div className="body page-content">
        <main className="grid-wrap">
          {query.trim() && !cards.length && <p className="quiet">{t('No matching entries')}</p>}
          {parts.map(({ part, title }) => {
            const list = cards.filter(c => c.part === part &&
              (query.trim() || (!prefs.hiddenCategories.includes(c.id) && (c.part === 'A' || prefs.showParts[c.part]))));
            if (!list.length) return null;
            return (
              <section key={part}>
                <h2 className="part-title">{t(title)}</h2>
                <Masonry items={list.map(c => {
                  const collapsed = !query.trim() && (prefs.collapsed ?? []).includes(c.id);
                  return {
                    key: c.id,
                    node: (
                      <CardView card={c} hideCollected={prefs.hideCollected} selected={selected} onSelect={setSelected}
                        collapsed={collapsed}
                        onToggle={() => updatePrefs({ ...prefs, collapsed: collapsed ? prefs.collapsed.filter(x => x !== c.id) : [...(prefs.collapsed ?? []), c.id] })} />
                    ),
                  };
                })} />
              </section>
            );
          })}
        </main>
        <aside className="side">
          {state.identify.length > 0 && <IdentifyCard q={state.identify[0]} more={state.identify.length - 1} onShow={setSelected} />}
          {selectedItem
            ? <ChecklistDetails selection={selectedItem} dev={state.devPanel} onShow={setSelected} onClose={() => setSelected(null)} onShowOnMap={showOnMap} />
            : <Legend />}
          {state.devPanel && <DevPanel state={state} />}
        </aside>
      </div>
    </div>
      )}
      <footer className="tracker-footer"><AuthorCredit /></footer>
      <div className="toasts" aria-live="polite">
        {game === 'oot' && state?.toasts.map(toast => <div key={toast.id} className="toast">{message(toast.text, toast.values)}</div>)}
      </div>
    </div>
  );
}

const cleanText = (s: string) => s.normalize('NFD').replace(/\p{Diacritic}/gu, '').toLowerCase();

function AuthorCredit() {
  return <small className="author-credit">{t('Criado por João Victor Prado')}</small>;
}

function Toolbar({ state, cards, prefs, onPrefs, query, onQuery }: { state: AppState; cards: Card[]; prefs: UiPrefs; onPrefs: (p: UiPrefs) => void; query: string; onQuery: (s: string) => void }) {
  const [catsOpen, setCatsOpen] = useState(false);
  const categories = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!catsOpen) return;
    const outside = (e: PointerEvent) => {
      if (!categories.current?.contains(e.target as Node)) setCatsOpen(false);
    };
    document.addEventListener('pointerdown', outside);
    return () => document.removeEventListener('pointerdown', outside);
  }, [catsOpen]);
  const recent = [...state.slots].sort((a, b) => b.mtimeMs - a.mtimeMs)[0];
  return (
    <div className="toolbar">
      <input type="search" className="checklist-search" placeholder={t('Search the checklist')} aria-label={t('Search the checklist')} value={query} onChange={e => onQuery(e.target.value)} />
      <label>
        {t('Slot')}&nbsp;
        <select value={state.slotMode === 'recent' ? '' : state.activeSlot} onChange={e => void api.pinSlot(e.target.value || null)}>
          <option value="">{t("Most recent (")}{recent?.name})</option>
          {state.slots.map(s => (
            <option key={s.name} value={s.name}>{s.name} · {t(s.area ?? '?')} · {timeAgo(s.mtimeMs)}</option>
          ))}
        </select>
      </label>
      <label className="check"><input type="checkbox" checked={prefs.hideCollected} onChange={e => onPrefs({ ...prefs, hideCollected: e.target.checked })} />{t("Hide collected")}</label>
      <span className="btn-pair">
        <button title={t("Collapse every category")} onClick={() => onPrefs({ ...prefs, collapsed: cards.map(c => c.id) })}>{t("Collapse all")}</button>
        <button title={t("Expand every category")} onClick={() => onPrefs({ ...prefs, collapsed: [] })}>{t("Expand all")}</button>
      </span>
      <label className="check"><input type="checkbox" checked={prefs.showParts.B} onChange={e => onPrefs({ ...prefs, showParts: { ...prefs.showParts, B: e.target.checked } })} />{t("Quest progress")}</label>
      <label className="check"><input type="checkbox" checked={prefs.showParts.C} onChange={e => onPrefs({ ...prefs, showParts: { ...prefs.showParts, C: e.target.checked } })} />{t('Extras')}</label>
      <div className="dropdown categories" ref={categories} onKeyDown={e => {
        if (e.key !== 'Escape' || !catsOpen) return;
        setCatsOpen(false);
        e.currentTarget.querySelector('button')?.focus();
      }} onBlur={e => {
        // Only when focus moves to another control (Tab). Pressing a category's label blurs the button with no
        // relatedTarget; closing then would unmount the menu before the click toggles the box. Taps outside close it above.
        if (e.relatedTarget && !e.currentTarget.contains(e.relatedTarget)) setCatsOpen(false);
      }}>
        <button aria-expanded={catsOpen} onClick={() => setCatsOpen(o => !o)}>{t("Categories ▾")}</button>
        {catsOpen && (
          <div className="dropdown-menu">
            {cards.map(c => (
              <label key={c.id} className="check">
                <input type="checkbox" checked={!prefs.hiddenCategories.includes(c.id)}
                  onChange={e => onPrefs({ ...prefs, hiddenCategories: e.target.checked ? prefs.hiddenCategories.filter(x => x !== c.id) : [...prefs.hiddenCategories, c.id] })} />
                <span className="dot" style={{ background: categoryColor(c.colorCat) }} /> {t(c.label)}
              </label>
            ))}
          </div>
        )}
      </div>
      <span className="spacer" />
      {!isRemote && <><button className={state.overlay.visible ? 'on' : ''} onClick={() => void api.toggleOverlay()} title={`${t('Show/hide overlay')} (${state.hotkeys.toggleOverlay})`}>{t("Overlay")}{' '}{t(state.overlay.visible ? 'on' : 'off')}
      </button>
      <SettingsButton state={state} /></>}
    </div>
  );
}

function SettingsButton({ state }: { state: AppState }) {
  const [open, setOpen] = useState(false);
  const [hk, setHk] = useState({ toggleOverlay: state.hotkeys.toggleOverlay, lockOverlay: state.hotkeys.lockOverlay });
  useEffect(() => setHk({ toggleOverlay: state.hotkeys.toggleOverlay, lockOverlay: state.hotkeys.lockOverlay }), [state.hotkeys.toggleOverlay, state.hotkeys.lockOverlay]);
  // Close on a click outside the panel or on Escape.
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => { if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', down);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', down); document.removeEventListener('keydown', key); };
  }, [open]);
  const o = state.overlay;
  return (
    <div className="dropdown" ref={ref}>
      <button className={open ? 'on' : ''} aria-expanded={open} onClick={() => setOpen(x => !x)}>{t("Settings ▾")}</button>
      {open && (
        <div className="settings-pop">
          <b>{t("Saves")}</b>
          <span className="muted small path" title={state.saveDir}>{state.saveDir ?? t('No folder chosen')}</span>
          <button onClick={() => void api.browseFolder()}>{t("Change save folder…")}</button>
          <b>{t("Live tracking")}</b>
          <span className="muted small">{t("Read-only: the tracker only looks at the game's memory, it never changes anything. Uses your saves whenever the game isn't running.")}</span>
          <b>{t("Overlay")}</b>
          <label>{t("Opacity:")}{' '}{Math.round(o.opacity * 100)}%
            <input type="range" min={0.2} max={1} step={0.05} value={o.opacity} onChange={e => void api.setOverlay({ opacity: Number(e.target.value) })} />
          </label>
          <label>{t("Shows")}<select value={o.mode} onChange={e => void api.setOverlay({ mode: e.target.value as OverlayMode })}>
              <option value="counters">{t("Category counters")}</option>
              <option value="remaining">{t("Remaining in the current area")}</option>
              <option value="available">{t("Can get now")}</option>
            </select>
          </label>
          <button onClick={() => void api.toggleOverlayLock()}>{t(o.locked ? 'Unlock overlay (to move/resize)' : 'Lock overlay (click-through)')}</button>
          <b>{t("Hotkeys")}</b>
          <label>{t("Show/hide overlay")}{' '}<input value={hk.toggleOverlay} onChange={e => setHk({ ...hk, toggleOverlay: e.target.value })} /></label>
          <label>{t("Lock/unlock overlay")}{' '}<input value={hk.lockOverlay} onChange={e => setHk({ ...hk, lockOverlay: e.target.value })} /></label>
          <span className="muted small">{t("Format like Control+Shift+O, Alt+F9. Works while the game has focus.")}</span>
          <button className="primary" onClick={() => void api.setHotkeys(hk)}>{t("Save hotkeys")}</button>
          {state.hotkeys.errors.map(e => <span key={e} className="err">{t(e)}</span>)}
          <b>{t("Advanced")}</b>
          <label className="check">
            <input type="checkbox" checked={state.changeLog.enabled} onChange={e => void api.setChangeLog(e.target.checked)} />{t("Keep a change log")}</label>
          <span className="muted small">{t("Notes every change the tracker sees, with the time and area, in a file on this PC.")}</span>
          <button onClick={() => void api.openLogFolder()}>{t("Open log folder")}</button>
          <label className="check">
            <input type="checkbox" checked={state.devPanel} onChange={e => void api.setDevPanel(e.target.checked)} />{t("Developer tools")}</label>
          <span className="muted small">{t("Adds a panel with save snapshots and the raw values that changed, and shows how each entry is detected.")}</span>
          <span className="muted small version">Hyrule Tracker v{state.version}</span>
        </div>
      )}
    </div>
  );
}

function CardView({ card, hideCollected, selected, onSelect, collapsed, onToggle }: { card: Card; hideCollected: boolean; selected: string | null; onSelect: (id: string) => void; collapsed: boolean; onToggle: () => void }) {
  const pct = card.total ? (card.done / card.total) * 100 : 0;
  const complete = card.total > 0 && card.done === card.total;
  const wide = !!card.wide && !collapsed;
  return (
    <div className={`card ${wide ? 'wide' : ''} ${complete ? 'complete' : ''} ${collapsed ? 'collapsed' : ''}`} style={{ ['--cat' as string]: categoryColor(card.colorCat) }}>
      <button className="card-head" onClick={onToggle} aria-expanded={!collapsed}>
        <span className="chev" aria-hidden="true">{collapsed ? '▸' : '▾'}</span>
        <span className="card-title"><ObjectiveName done={complete}>{t(card.label)}</ObjectiveName></span>
        <span className="card-count">{card.kind === 'counter' && card.value === null ? '?' : card.done}/{card.total}</span>
      </button>
      <div className="bar" aria-hidden="true"><div className="fill" style={{ transform: `scaleX(${pct / 100})` }} /></div>
      {!collapsed && (
        <>
          {card.hint && <div className="hint">{tv(card.hint, card.hintValues)}</div>}
          {card.kind === 'counter' ? (
            <div className="counter-note">{card.value === null ? t('Not in this save yet') : `${card.value} ${t('of')} ${card.max}`}</div>
          ) : card.sections.map((s, i) => {
            const tiles = hideCollected ? s.tiles.filter(t => tileItems(t).some(x => !x.done)) : s.tiles;
            return (
              <div key={i} className={`section ${s.style ?? ''}`}>
                {s.title && <div className="section-title">{t(s.title)}</div>}
                <div className="tiles">
                  {tiles.map(t => t.kind === 'single'
                    ? <Tile key={t.key} catId={t.categoryId} item={t.item} major={s.style === 'major'} numbered={s.style === 'numbered'} selected={selected === t.item.id} onSelect={onSelect} />
                    : <StackTile key={t.key} stack={t} selected={selected === t.key} onSelect={onSelect} />)}
                  {hideCollected && !tiles.length && <div className="muted small">{t("All collected")}</div>}
                </div>
              </div>
            );
          })}
        </>
      )}
    </div>
  );
}

/** One tile for several rows (an item and its upgrades, or all bottles). */
function StackTile({ stack, selected, onSelect }: { stack: Extract<TileModel, { kind: 'stack' }>; selected: boolean; onSelect: (id: string) => void }) {
  const items = stack.members.map(m => m.item);
  const n = items.filter(i => i.done).length;
  const icon = icons.get('', stack.categoryId === 'bottles' ? 'bottles' : 'items', stack.iconName);
  const asset = trackedItemIcon(items[0]);
  const cls = ['tile', 'stack', n === items.length ? 'done' : n > 0 ? 'partial' : 'todo', items.some(i => i.justCollected) ? 'glow' : '', selected ? 'selected' : ''].join(' ');
  return (
    <button className={cls} style={{ ['--c' as string]: icon.color }} aria-current={selected || undefined} onClick={() => onSelect(stack.key)}
      title={`${t(stack.label)} · ${n}/${items.length}\n${stack.members.map(m => `${m.item.done ? '✓' : '·'} ${t(m.item.name)}`).join('\n')}`}>
      <span className="glyph">{itemImage(asset) ? <GameItemIcon id={asset} size={30} /> : icon.symbol ? <Symbol name={icon.symbol} size={26} /> : icon.glyph}</span>
      <span className="level">{n}/{items.length}</span>
      <span className="pips">{items.map(i => <i key={i.id} className={i.done ? 'on' : ''} />)}</span>
      <span className="tile-label">{t(stack.label)}</span>
    </button>
  );
}

function Tile({ catId, item, selected, onSelect, major, numbered }: { catId: string; item: TrackedItem; selected: boolean; onSelect: (id: string) => void; major?: boolean; numbered?: boolean }) {
  const icon = icons.get(item.iconId, catId, item.name);
  const asset = trackedItemIcon(item);
  const photo = ENEMY_ROWS.has(catId) ? enemyPhoto(item.id, item.name) : undefined;
  const label = `${numbered ? `#${item.number} ` : ''}${t(item.name)}`;
  const status = item.manual ? 'Ticked by hand' : item.done ? 'Collected'
    : item.state === 'unmapped' || item.state === 'unknown' ? 'Situação não mapeada' : 'Not collected yet';
  const cls = [
    'tile',
    item.done ? 'done' : 'todo',
    item.state === 'unmapped' && !item.done ? 'unmapped' : '',
    item.manual ? 'manual' : '',
    item.justCollected ? 'glow' : '',
    selected ? 'selected' : '',
    numbered ? 'small' : '',
    major ? 'major' : '',
  ].join(' ');
  return (
    <button className={cls} data-item={item.id} style={{ ['--c' as string]: icon.color }} onClick={() => onSelect(item.id)}
      aria-label={`${label} · ${t(status)}`} aria-current={selected || undefined}
      onDoubleClick={() => item.state !== 'yes' && void api.toggleManual(item.id)}
      title={`${label}${item.where ? `\n${t(item.where)}` : ''}`}>
      {numbered && <GameItemIcon id={asset} size={15} />}
      <span className="glyph">{numbered ? item.number : photo ? <img className="tile-photo" src={photo.file} alt="" draggable={false} /> : itemImage(asset) ? <GameItemIcon id={asset} size={30} /> : icon.symbol ? <Symbol name={icon.symbol} size={26} /> : icon.glyph}</span>
      {item.manual && <span className="badge m">M</span>}
      {!numbered && <span className="tile-label">{caption(item.name)}</span>}
    </button>
  );
}

/** Tile caption: "Heart Container (Gohma)" -> "Gohma", "Kokiri Tunic (Hero's Clothes)" -> "Kokiri Tunic". */
function shortName(n: string): string {
  const inner = n.match(/^Heart Container \((.+)\)$/);
  if (inner) return inner[1];
  const afterColon = n.includes(': ') ? n.slice(n.indexOf(': ') + 2) : n;
  const short = afterColon.replace(/\s*\([^()]*\)$/, '');
  return short.length > 30 ? `${short.slice(0, 29).trimEnd()}…` : short;
}

/** Rows that show the enemy photo, the same one the Hall of Fallen Foes page uses. */
const ENEMY_ROWS = new Set(['statues', 'rematches']);

/** Tile caption, translated before it is shortened so "Pesca: Escala Dourada" finds its translation. */
function caption(n: string): string {
  const short = shortName(n);
  const direct = t(short);
  if (direct !== short) return direct;
  const full = t(n);
  return full !== n ? shortName(full) : short;
}

const COMPACT_DETAILS = '(max-width: 900px), (max-height: 500px)';

function ChecklistDetails({ selection, dev, onShow, onClose, onShowOnMap }: {
  selection: { stack: Extract<TileModel, { kind: 'stack' }> } | { cat: TrackedCategory; item: TrackedItem };
  dev: boolean;
  onShow: (id: string) => void;
  onClose: () => void;
  onShowOnMap: (id: string) => void;
}) {
  const [compact, setCompact] = useState(() => matchMedia(COMPACT_DETAILS).matches);
  const dialog = useModalDialog(compact);
  useEffect(() => {
    const media = matchMedia(COMPACT_DETAILS);
    const update = () => setCompact(media.matches);
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, []);

  const content = 'stack' in selection
    ? <StackDetails stack={selection.stack} onShow={onShow} onClose={onClose} />
    : <Details cat={selection.cat} item={selection.item} dev={dev} onClose={onClose} onShowOnMap={onShowOnMap} />;
  return compact ? <dialog ref={dialog} className="checklist-sheet" aria-labelledby="checklist-detail-title"
    onCancel={e => { e.preventDefault(); onClose(); }}
    onClick={e => {
      // A tap on the dimmed backdrop (outside the sheet) closes it.
      const box = e.currentTarget.getBoundingClientRect();
      if (e.target === e.currentTarget && (e.clientY < box.top || e.clientY > box.bottom || e.clientX < box.left || e.clientX > box.right)) onClose();
    }}>{content}</dialog> : content;
}

function StackDetails({ stack, onShow, onClose }: { stack: Extract<TileModel, { kind: 'stack' }>; onShow: (id: string) => void; onClose: () => void }) {
  const n = stack.members.filter(m => m.item.done).length;
  return (
    <div className="panel details">
      <div className="panel-head">
        <span className="dot" style={{ background: categoryColor(stack.categoryId) }} />
        <span>{t(stack.label)} · {n}/{stack.members.length}</span>
        <button className="x" onClick={onClose} aria-label={t('Close')}>×</button>
      </div>
      <h3 id="checklist-detail-title">{t(stack.label)}</h3>
      <div className="members">
        {stack.members.map(({ categoryLabel, item }) => (
          <div key={item.id} className={`member ${item.done ? 'is-done' : ''}`}>
            <span className="mark">{item.done ? '✓' : '·'}</span>
            <div className="member-body">
              <button className="link member-name" onClick={() => onShow(item.id)}>{t(item.name)}</button>
              <span className="muted small"> {t(categoryLabel)} #{item.number}{item.chapter ? ` · ${t(item.chapter)}` : ''}</span>
              {!item.done && item.logic?.ages.length ? <span className="age ok-tag">{t("can get now")}</span> : null}
              {item.manual && <span className="muted small">{t("(ticked by hand)")}</span>}
            </div>
            {item.state !== 'yes' && (
              <button className="small-btn" onClick={() => void api.toggleManual(item.id)}>{t(item.manual ? 'Remove hand tick' : 'Tick by hand')}</button>
            )}
          </div>
        ))}
      </div>
      <p className="muted small">{t("Click a name to see where it is.")}</p>
    </div>
  );
}

function Details({ cat, item, dev, onClose, onShowOnMap }: { cat: TrackedCategory; item: TrackedItem; dev: boolean; onClose: () => void; onShowOnMap: (id: string) => void }) {
  const stateText = item.state === 'yes' ? 'Collected'
    : item.manual ? 'Ticked by hand'
    : item.state === 'unmapped' ? 'The tracker can’t see this one in your save. Tick it by hand once you have it.'
    : 'Not collected yet';
  // "Lake Hylia: Tunnel on the south-west shore" -> heading "Tunnel on the south-west shore", area below it.
  const title = item.chapter && item.name.startsWith(`${item.chapter}: `) ? item.name.slice(item.chapter.length + 2) : item.name;
  // Matches the evidence texts written for spots the user identified (core/pools.ts) and for
  // identified spots exported into data/save-mapping.json (main/controller.ts exportLearned).
  const identified = IDENTIFIED_EVIDENCE.some(p => item.evidence?.startsWith(p));
  // Checklist columns from a local checklist, shown with the developer tools.
  const shown = new Set([item.chapter, item.requirement].filter(Boolean));
  const extra = dev ? Object.entries(item.details ?? {}).filter(([, v]) => !shown.has(v) && !item.name.includes(v)) : [];
  return (
    <div className="panel details">
      <div className="panel-head">
        <span className="dot" style={{ background: categoryColor(cat.id) }} />
        <span>{t(cat.label)} #{item.number}</span>
        <button className="x" onClick={onClose} aria-label={t('Close')}>×</button>
      </div>
      <h3 id="checklist-detail-title"><GameItemIcon id={trackedItemIcon(item)} /> <ObjectiveName done={item.done}>{t(title)}</ObjectiveName>{item.newInRemake && <span className="remake-badge">{t("new in remake")}</span>}</h3>
      {item.chapter && <p className="area">{t(item.chapter)}</p>}
      {item.where && <p className="where">{t(item.where)}</p>}
      <p className={`status s-${item.done ? 'done' : item.state}`}>{t(stateText)}</p>
      {item.logic && !item.done && (
        <p className="logic small">
          {item.logic.ages.length
            ? <b className="ok">{message(item.logic.night ? 'You can get this now as {ages}, at night.' : 'You can get this now as {ages}.',
                { ages: new Intl.ListFormat(currentLocale(), { type: 'disjunction' }).format(item.logic.ages.map(age => t(age))) })}</b>
            : <><b>{t("Not yet.")}</b>{' '}{t("Still needed:")}{' '}{item.logic.missing.map(needText).join('; ')}.</>}
          {item.logic.note && <><br />{t(item.logic.note)}</>}
        </p>
      )}
      <div className="row">
        {MAP_CATEGORIES.has(cat.id) && <button className="primary" onClick={() => onShowOnMap(item.id)}>{t("View on map")}</button>}
        {item.state !== 'yes' && (
          <button className={MAP_CATEGORIES.has(cat.id) ? 'small-btn' : 'primary'} onClick={() => void api.toggleManual(item.id)}>{t(item.manual ? 'Remove hand tick' : 'Tick by hand')}</button>
        )}
      </div>
      {identified && (
        <button className="link" onClick={() => void api.forgetIdentification(item.id)}>{t("Wrong spot? Undo this match")}</button>
      )}
      {dev && (
        <div className="dev-info small">
          {item.requirement && <p><b>{t("Requirement:")}</b> {item.requirement}</p>}
          {extra.map(([k, v]) => <p key={k}><b>{k}:</b> {v}</p>)}
          {item.logic?.needs && <p><b>{t("Logic:")}</b> <code>{item.logic.needs}</code></p>}
          {item.confidence
            ? <p><b>{t("Detection:")}</b> {item.confidence}{item.evidence ? `: ${localDates(item.evidence)}` : ''}</p>
            : item.evidence && <p>{localDates(item.evidence)}</p>}
        </div>
      )}
    </div>
  );
}

const IDENTIFIED_EVIDENCE = ['Identified by you', 'You identified', 'Recognised automatically', 'Identified in the tracker', 'Recognised in the tracker'];

/** ISO dates (2026-11-12) inside evidence text, written the way the current language writes dates. */
function localDates(text: string): string {
  return text.replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, (whole, y: string, m: string, d: string) => {
    const at = new Date(Number(y), Number(m) - 1, Number(d));
    return Number.isNaN(at.getTime()) ? whole : day(at);
  });
}

/** A "still needed" entry as a phrase: "adult" -> "to be an adult", "reach X as child" -> "a way to X as a child". */
function needText(m: string): string {
  if (m === 'adult') return t('to be an adult');
  if (m === 'child') return t('to be a child');
  const r = m.match(/^reach (.+) as (child|adult)$/);
  if (r) return t('reach {area} as {age}').replace('{area}', t(r[1])).replace('{age}', t(r[2]));
  return t(m);
}

function IdentifyCard({ q, more, onShow }: { q: AppState['identify'][number]; more: number; onShow: (id: string) => void }) {
  const [picked, setPicked] = useState<string[]>([]);
  const [showOthers, setShowOthers] = useState(false);
  useEffect(() => { setPicked([]); setShowOthers(false); }, [q.id]);
  const one = q.pick === 1;
  const shown = showOthers && q.others ? [...q.candidates, ...q.others] : q.candidates;
  const toggle = (id: string) => setPicked(p => (p.includes(id) ? p.filter(x => x !== id) : p.length < q.pick ? [...p, id] : p));
  return (
    <div className="panel identify">
      <div className="panel-head"><span>{t("Which one was it?")}</span>{more > 0 && <span className="muted">+{more}{t("more")}</span>}</div>
      <p>{t('Identify the items collected in {area}.').replace('{area}', t(q.area))} <b>{t(q.categoryLabel)} · {q.pick}</b></p>
      <div className="cands">
        {shown.map(c => (
          <button key={c.id} className={picked.includes(c.id) ? 'on' : ''}
            onClick={() => (one ? void api.answerIdentify(q.id, [c.id]) : toggle(c.id))}
            onMouseEnter={() => onShow(c.id)}>
            <b>#{c.number}</b> {tail(c.name)}
          </button>
        ))}
      </div>
      <div className="row">
        {!one && <button className="primary" disabled={picked.length !== q.pick} onClick={() => void api.answerIdentify(q.id, picked)}>{t("Save (")}{picked.length}/{q.pick})</button>}
        {q.others?.length && !showOthers ? (
          <button className="link" onClick={() => setShowOthers(true)}>{t("Not here? Show the")}{' '}{q.others.length}{t("in other areas")}</button>
        ) : null}
        <button className="link" onClick={() => void api.skipIdentify(q.id)}>{t("Not sure, skip")}</button>
      </div>
      <p className="muted small">{t("Skipping is fine: it still counts, just not on a specific tile.")}</p>
    </div>
  );
}

function Legend() {
  return (
    <div className="panel legend">
      <div className="panel-head"><span>{t("Legend")}</span></div>
      <div className="leg"><span className="tile done mini" style={{ ['--c' as string]: '#4fc39b' }} />{t("Collected")}</div>
      <div className="leg"><span className="tile todo mini" style={{ ['--c' as string]: '#4fc39b' }} />{t("Not collected yet")}</div>
      <div className="leg"><span className="tile done manual mini" style={{ ['--c' as string]: '#4fc39b' }}><span className="badge m">M</span></span>{t("Ticked by hand")}</div>
      <p className="muted small">{t("Click an entry to see where it is and what you still need for it. Double-click to tick or untick it by hand.")}</p>
    </div>
  );
}

function DevPanel({ state }: { state: AppState }) {
  const [label, setLabel] = useState('');
  const ch = state.lastChanges;
  return (
    <div className="panel dev">
      <div className="panel-head"><span>{t("Developer tools")}</span></div>
      <div className="row">
        <input placeholder={t("snapshot label, e.g. before-skulltula")} value={label} onChange={e => setLabel(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter') { void api.takeSnapshot(label); setLabel(''); } }} />
        <button className="primary" onClick={() => { void api.takeSnapshot(label); setLabel(''); }}>{t("Snapshot")}</button>
      </div>
      <button className="link" onClick={() => void api.openSnapshotFolder()}>{t("Open snapshot folder")}</button>
      <p className="small">{t("Spots you identified:")}{' '}<b>{state.learnedCount}</b>{' '}
        <button className="link" onClick={() => void api.exportLearned().then(msg => alert(msg))}>{t("Write them into the mapping file")}</button>
      </p>
      {state.snapshotDiff && (
        <>
          <h4>{t("Since previous snapshot (")}{state.snapshotDiff.rows.length})</h4>
          <Rows rows={state.snapshotDiff.rows} />
        </>
      )}
      <h4>{t("Latest save")}{' '}{ch ? `(${ch.slot}, ${timeAgo(ch.atMs)})` : ''}</h4>
      {!ch && <p className="muted small">{t("Changes appear here after the game writes its next save.")}</p>}
      {ch && (
        <>
          <p className="small"><b>{t("Tracked keys")}</b> ({ch.known.length})</p>
          <Rows rows={ch.known} />
          <p className="small"><b>{t("Other keys")}</b> ({ch.unknown.length}, {ch.hiddenNoise}{t("play-time/position keys hidden)")}</p>
          <Rows rows={ch.unknown} />
        </>
      )}
    </div>
  );
}

function Rows({ rows }: { rows: ChangeRow[] }) {
  if (!rows.length) return <p className="muted small">{t("none")}</p>;
  return (
    <table className="rows">
      <tbody>
        {rows.slice(0, 80).map(r => (
          <tr key={r.key} title={r.entries?.join('\n')}>
            <td className="mono">{r.name ?? r.key}</td>
            <td className="mono">{r.old} → {r.new}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
