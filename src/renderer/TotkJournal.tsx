import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { islandObjectives, type IslandObjective, type IslandText } from '../core/totk-island';
import type { WorldCategory, WorldItem, WorldProgress } from '../core/totk-world';
import type { AppState, TotkIslandState } from '../shared/types';
import { api, isRemote, timeAgo } from './api';
import { Icon, PageHeaderFrame, SecondScreen, worldPageTitles, type Page } from './CompanionPages';
import { journalText, type Locale } from './i18n';
import { GameSwitch } from './GamePicker';
import { LanguageSwitch } from './LanguageFlags';
import { AvailableObjectives, JournalMilestones, JournalQuiz, JournalTimeline, TotkOverview } from './TotkJournalPages';
import { TotkWalkthrough } from './TotkWalkthrough';
import { TotkChecklist } from './TotkChecklist';
import { TotkHall, TotkMinigames, TotkSecrets, TotkThreads } from './TotkCollections';
import { TotkWorldMap } from './TotkWorldMap';
import { journals, WorldJournalContext, type WorldGame } from './WorldJournalContext';
import './totk-island.css';
import './totk-world.css';

const empty: TotkIslandState = { status: 'unlinked', slots: [], marks: {}, manual: [] };
const islandCategories: Record<IslandObjective['kind'], WorldCategory> = {
  shrine: 'shrine', korok: 'korok', cave: 'cave', bubbul: 'bubbul', gear: 'armor', place: 'location', secret: 'location',
};

const pageDescriptions: Partial<Record<Page, IslandText>> = {
  overview: ['Veja o progresso da sua partida e retome a jornada.', 'See your save progress and pick up where you left off.'],
  todo: ['Confira o próximo passo da história e os objetivos perto de Link.', 'Find the next story step and objectives near Link.'],
  walkthrough: ['Acompanhe os capítulos da história conforme avança no jogo.', 'Follow the story chapters as you advance through the game.'],
  map: ['Explore o céu, a superfície e as profundezas de Hyrule.', 'Explore Hyrule’s Sky, Surface, and Depths.'],
  checklist: ['Filtre os objetivos por categoria, camada ou região.', 'Filter objectives by category, layer, or region.'],
  threads: ['Acompanhe a história, as missões secundárias e as memórias.', 'Follow the story, side quests, and memories.'],
  minigames: ['Acompanhe as provas e os desafios de Hyrule.', 'Track challenges and minigames across Hyrule.'],
  hall: ['Confira chefes de campo, revanches e encontros.', 'Browse field bosses, rematches, and encounters.'],
  secrets: ['Explore descobertas e interações escondidas.', 'Explore discoveries and hidden interactions.'],
  timeline: ['Consulte o progresso registrado a cada dia.', 'Review progress recorded each day.'],
  medals: ['Confira os totais e marcos da jornada.', 'Review your totals and journey milestones.'],
  quiz: ['Teste seus conhecimentos no desafio diário.', 'Test your knowledge in the daily challenge.'],
  second: ['Acompanhe a jornada no celular ou tablet.', 'Follow the journey on a phone or tablet.'],
  settings: ['Configure o idioma e a origem da partida.', 'Set the language and choose your save source.'],
};

interface JournalProps {
  game: WorldGame;
  state: AppState | null;
  locale: Locale;
  onLanguage: (locale: Locale) => void;
  onBack: () => void;
  view: Page;
  onPage: (page: Page) => void;
  connectionLost: boolean;
}

export default function TotkJournal({ game, state: snapshot, locale, onLanguage, onBack, view, onPage, connectionLost }: JournalProps) {
  const save = snapshot?.[game] ?? empty;
  const journal = journals[game];
  const botw = game === 'botw';
  const saveApi = botw
    ? { browse: api.browseBotwFolder, mark: api.markBotwExtra, pin: api.pinBotwSlot, refresh: api.refreshBotw }
    : { browse: api.browseTotkFolder, mark: api.markTotkExtra, pin: api.pinTotkSlot, refresh: api.refreshTotk };
  const text = useCallback((label: IslandText) => journalText(label, locale), [locale]);
  const islandItems = useMemo(() => botw ? [] : islandObjectives.map((item): WorldItem => ({
    id: item.id, name: text(item.name), category: islandCategories[item.kind], at: item.at, layer: 'sky',
    key: item.rule?.key, hint: item.hint, seeds: item.seeds,
  })), [botw, text]);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState<IslandText>();
  const [saving, setSaving] = useState(false);
  const [island, setIsland] = useState(false);
  const [openedStep, setOpenedStep] = useState<string>();
  const [mapTarget, setMapTarget] = useState<WorldItem>();
  const [checklistTarget, setChecklistTarget] = useState<WorldItem>();
  const main = useRef<HTMLElement>(null);
  const focusAfterNavigation = useRef<string>(undefined);
  const status = ({
    ok: ['Save conectado', 'Save connected'],
    waiting: ['Aguardando save', 'Waiting for save'],
    error: ['Falha ao ler o save', 'Could not read save'],
    unlinked: ['Sem save conectado', 'No save connected'],
  } as const)[save.status];
  const connected = save.status === 'ok' && !connectionLost;
  const islandProgress: WorldProgress | undefined = save.updatedAt == null ? undefined : {
    marks: save.marks, firstSteps: [],
    player: save.position ? { at: save.position, layer: 'sky' } : undefined,
  };

  useEffect(() => {
    if (!focusAfterNavigation.current) return;
    main.current?.querySelector<HTMLElement>(focusAfterNavigation.current)?.focus();
    focusAfterNavigation.current = undefined;
  }, [view, mapTarget, checklistTarget, openedStep]);

  async function saveAction(action: () => Promise<unknown>, message: IslandText) {
    setWorking(true);
    setError(undefined);
    try { if (await action() === false) setError(message); }
    catch { setError(message); }
    finally { setWorking(false); }
  }

  const connectSave = () => void saveAction(saveApi.browse, botw
    ? ['Escolha a pasta da partida que contém game_data.sav ou os slots numerados.', 'Choose the save folder containing game_data.sav or the numbered slots.']
    : ['A pasta não tem um save de Tears of the Kingdom legível.', 'This folder has no readable Tears of the Kingdom save.']);

  async function mark(id: string, checked: boolean) {
    setSaving(true);
    setError(undefined);
    try {
      if (!await saveApi.mark(id, checked)) throw new Error('Mark was rejected');
    } catch { setError(['Não foi possível guardar a marcação.', 'Could not save the check mark.']); }
    finally { setSaving(false); }
  }

  function showOnMap(item: WorldItem) {
    setMapTarget(item);
    setIsland(islandItems.some(entry => entry.id === item.id));
    focusAfterNavigation.current = '.map-region select';
    onPage('map');
  }

  function showInChecklist(item: WorldItem) {
    setChecklistTarget(item);
    setIsland(islandItems.some(entry => entry.id === item.id));
    focusAfterNavigation.current = '.checklist-search';
    onPage('checklist');
  }

  const collectionProps = { text, save, onMap: showOnMap, onMark: mark, markingDisabled: saving || connectionLost };
  const scope = { island, onScope: (next: boolean) => { setIsland(next); setMapTarget(undefined); setChecklistTarget(undefined); setOpenedStep(undefined); } };
  const settings = <>
    <section className="focus-panel setting-panel"><h2>{text(['Idioma', 'Language'])}</h2>
      <LanguageSwitch locale={locale} onChange={onLanguage} labelled /></section>
    <section className="focus-panel setting-panel">
      <h2>{text(['Fonte da partida', 'Save source'])}</h2>
      <p>{text(status)}</p>
      <code className="save-path">{save.activeSlot ?? text(['Pasta do save ainda não selecionada.', 'Save folder has not been selected.'])}</code>
      {save.updatedAt && <p className="quiet">{text(['Último save', 'Last saved'])} {timeAgo(save.updatedAt)}</p>}
      {!isRemote && <div className="page-actions"><button type="button" className="action primary" disabled={working} onClick={connectSave}>
        {text(['Escolher pasta', 'Choose folder'])}</button></div>}
      {save.slots.length > 0 && <label className="inline-field">{text(['Slot', 'Slot'])}
        <select value={save.pinnedSlot ?? ''} disabled={working || connectionLost}
          onChange={event => void saveAction(() => saveApi.pin(event.target.value || null), ['Não foi possível trocar de slot.', 'Could not switch save slots.'])}>
          <option value="">{text(['Seguir o save mais recente', 'Follow the most recent save'])}</option>
          {save.slots.map(slot => <option key={slot} value={slot}>{slot}</option>)}
        </select>
      </label>}
    </section>
    <section className="focus-panel setting-panel">
      <h2>{text(['Rastreamento', 'Tracking'])}</h2>
      <p>{text(['O tracker lê o save, atualiza o checklist e guarda o registro de progresso neste PC.', 'The tracker reads your save, updates the checklist, and stores the progress log on this PC.'])}</p>
      {/* The same floating window as the Ocarina journal, showing this game's progress. */}
      {!isRemote && snapshot && <button type="button" className="action" onClick={() => void api.toggleOverlay()}>
        {text(snapshot.overlay.visible ? ['Ocultar painel no jogo', 'Hide in-game panel'] : ['Mostrar painel no jogo', 'Show in-game panel'])}
        {snapshot.hotkeys.toggleOverlay && ` (${snapshot.hotkeys.toggleOverlay})`}
      </button>}
    </section>
    <section className="focus-panel setting-panel credits-panel">
      <h2>{text(['Créditos', 'Credits'])}</h2>
      <p>{text(['Cartografia e ícones © Nintendo.', 'Cartography and icons © Nintendo.'])}{' '}
        <a href={journal.mapSource} target="_blank" rel="noreferrer">ZeldaMods</a>{' · '}
        <a href={journal.guideMap} target="_blank" rel="noreferrer">Zelda Xtreme</a></p>
    </section>
  </>;

  const pages: Record<Page, ReactNode> = {
    overview: <TotkOverview text={text} save={save} onPage={onPage} onConnect={isRemote ? undefined : connectSave} connecting={working} />,
    todo: <AvailableObjectives text={text} save={save} onPage={onPage} onMap={showOnMap} onChecklist={showInChecklist}
      onMark={mark} markingDisabled={saving || connectionLost} />,
    walkthrough: <TotkWalkthrough text={text} save={save} island={island} onMap={showOnMap} onIslandMap={id => {
      const item = islandItems.find(entry => entry.id === id);
      if (item?.at) showOnMap(item);
    }} onIsland={() => scope.onScope(!island)} jump={openedStep} />,
    map: <TotkWorldMap key={(mapTarget?.id ?? 'map') + '/' + island} text={text}
      progress={island ? islandProgress : save.world} entries={island ? islandItems : undefined} mapTarget={mapTarget}
      manual={save.manual} onMark={mark} markingDisabled={saving || connectionLost} onChecklist={showInChecklist} onGuide={island ? id => {
        setOpenedStep(id); focusAfterNavigation.current = '.wt-hero-actions button'; onPage('walkthrough');
      } : undefined} {...scope} />,
    checklist: <TotkChecklist key={(checklistTarget?.id ?? 'list') + '/' + island} text={text} items={island ? islandItems : undefined}
      save={save} focus={checklistTarget} disabled={saving || connectionLost} onMap={showOnMap} onMark={mark} onTodo={() => onPage('todo')} {...scope} />,
    threads: <TotkThreads {...collectionProps} />,
    minigames: <TotkMinigames {...collectionProps} />,
    hall: <TotkHall {...collectionProps} />,
    secrets: <TotkSecrets islandItems={islandItems.filter(item => item.category !== 'shrine')} {...collectionProps} />,
    timeline: <JournalTimeline text={text} entries={save.history} />,
    medals: <JournalMilestones text={text} save={save} />,
    quiz: <JournalQuiz text={text} />,
    second: snapshot && <SecondScreen state={snapshot} />,
    settings,
  };
  const description: IslandText | undefined = botw && (view === 'map' || view === 'checklist')
    ? view === 'map' ? ['Explore as regiões de Hyrule e localize seus objetivos.', 'Explore Hyrule’s regions and find your objectives.']
      : ['Filtre objetivos por categoria, região ou edição.', 'Filter objectives by category, region, or edition.']
    : pageDescriptions[view];
  return <WorldJournalContext.Provider value={journal}><main className={view === 'checklist' ? 'app totk-checklist-page' : 'companion-page'} ref={main}>
    <PageHeaderFrame title={text(worldPageTitles[view])} description={description && text(description)}
      disconnected={connectionLost ? text(['Sem conexão com o PC. Tentando reconectar…', 'Disconnected from the PC. Trying to reconnect…']) : undefined}
      actions={<>
        <span className={connected ? 'connection connected' : 'connection'} title={text(status)} role="status"><i aria-hidden="true" />{text(status)}</span>
        {save.status !== 'unlinked' && <button className="action totk-refresh" type="button" disabled={working || connectionLost}
          aria-label={text(['Atualizar agora', 'Refresh now'])} title={text(['Atualizar agora', 'Refresh now'])}
          onClick={() => void saveAction(saveApi.refresh, ['Não foi possível atualizar o save.', 'Could not refresh the save.'])}>
          <Icon name="refresh" size={16} /><span>{text(['Atualizar agora', 'Refresh now'])}</span>
        </button>}
        <LanguageSwitch locale={locale} onChange={onLanguage} />
        <GameSwitch onClick={onBack} />
      </>} />
    {error && <p className="notice" role="alert">{text(error)}</p>}
    {save.unverifiedFormat && <p className="notice" role="status">{text(['Formato do save ainda não validado. Confira o progresso com o jogo.', 'Save format pending verification. Check your progress against the game.'])}</p>}
    {view === 'checklist' ? pages.checklist : <div className={view === 'overview' ? 'page-content totk-overview' : 'page-content'} key={view}>{pages[view]}</div>}
  </main></WorldJournalContext.Provider>;
}
