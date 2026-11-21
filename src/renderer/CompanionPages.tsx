import { Fragment, lazy, Suspense, useEffect, useMemo, useRef, useState, type MouseEvent, type ReactNode, type RefObject } from 'react';
import type { Activity, AppState, PlayerState, SaveFolderChoice, TrackedCategory, TrackedItem } from '../shared/types';
import { LOCAL_NAMES, MASK_SALE_NAMES } from '../core/companion';
import { api, isRemote } from './api';
import { enemyPhoto, regionPhoto } from './referenceImages';
import { LanguageSwitch } from './LanguageFlags';
import { currentLocale, date, day, hour, languages, number, plural, t, tv, type Locale } from './i18n';
import { ObjectiveName } from './ObjectiveName';
import { GameItemIcon, trackedItemIcon } from './GameItemIcon';
import { Minigames } from './Minigames';
import { PageProgress } from './PageProgress';
import { PageSkeleton } from './PageSkeleton';
import { qrPath, qrTarget } from './qr';
import { ZoomPan } from './ZoomPan';
import { locatePlacement, type AtlasPlace as PositionPlace, type PlayerFix } from '../core/position';
import atlas from '../../data/atlas.json';
import { Quiz, useStored } from './Recreation';
import { useModalDialog } from './useModalDialog';
import './companion.css';

const EasterEggs = lazy(() => import('./EasterEggs').catch(error => {
  console.error(error);
  return { default: () => <div className="focus-panel">
    <p role="alert">{t('Não foi possível abrir o diário.')}</p>
    <button type="button" className="action" onClick={() => location.reload()}>{t('Tentar novamente')}</button>
  </div> };
}));

const pages = {
  overview: 'Visão geral', todo: 'O que fazer?', map: 'Mapa de Hyrule', checklist: 'Checklist 100%', threads: 'Fios do Tempo+',
  hall: 'Salão dos Inimigos', minigames: 'Minijogos', timeline: 'Registro do dia', medals: 'Meus dados',
  secrets: 'Easter Eggs and Secrets', quiz: 'Quiz diário', second: 'Segunda tela', settings: 'Configurações',
};
export type Page = keyof typeof pages;
const pageDescriptions: Record<Page, string> = {
  overview: 'Veja o progresso da sua partida e retome a jornada.',
  todo: 'O que você já consegue fazer agora com os itens que tem.',
  map: 'Explore as regiões de Hyrule e localize os colecionáveis.',
  checklist: 'Acompanhe os objetivos que faltam para completar 100% do jogo.',
  threads: 'Acompanhe os capítulos da história e as missões secundárias.',
  hall: 'Confira as estátuas de inimigos, as revanches e as provações.',
  minigames: 'Veja os minijogos que você já venceu, os prêmios e os recordes da partida.',
  timeline: 'Consulte o progresso registrado pelo tracker ao longo de cada dia.',
  medals: 'Veja seus totais e os marcos conquistados na jornada.',
  secrets: 'Explore interações escondidas, referências e diálogos do remake.',
  quiz: 'Teste seus conhecimentos sobre Hyrule no desafio diário.',
  second: 'Acompanhe a jornada no celular ou tablet enquanto joga na TV.',
  settings: 'Configure o idioma, a origem da partida e a janela flutuante.',
};
const navGroups: Page[][] = [
  ['overview', 'todo', 'map', 'checklist', 'threads', 'minigames', 'hall', 'secrets'],
  ['timeline', 'medals', 'quiz'],
  ['second', 'settings'],
];
const iconPaths: Record<string, string> = {
  overview: 'm3 11 9-8 9 8M5 10v10h5v-6h4v6h5V10',
  todo: 'M9 18h6m-5 3h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3Z',
  map: 'm3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15',
  checklist: 'M9 5h12M9 12h12M9 19h12M3 5l1 1 2-2m-3 8 1 1 2-2m-3 8 1 1 2-2',
  threads: 'M4 4h16v16H4zM8 8h8m-8 4h8m-8 4h5',
  hall: 'M12 2 4 6v5c0 5 4 8 8 11 4-3 8-6 8-11V6zM9 12l2 2 4-4',
  minigames: 'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Zm0 4a5 5 0 1 0 0 10 5 5 0 0 0 0-10Zm0 5h.01',
  timeline: 'M12 8v5l3 2M3 12a9 9 0 1 0 2.6-6.4L3 8m0-4v4h4',
  medals: 'M8 3h8v6l-4 4-4-4zM12 13a4 4 0 1 0 0 8 4 4 0 0 0 0-8Z',
  secrets: 'm21 21-5-5M19 10.5a8.5 8.5 0 1 1-17 0 8.5 8.5 0 0 1 17 0ZM10.5 7v7M7 10.5h7',
  quiz: 'M9 8a3 3 0 1 1 4.5 2.6c-1.5.8-1.5 1.5-1.5 3.4m0 4h.01M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Z',
  second: 'M2 4h13v10H2zM6 18h5m-2.5-4v4M17 8h5v13h-5zm2 10h1',
  settings: 'M3 6h7m4 0h7M3 12h12m4 0h2M3 18h2m4 0h12M10 4h4v4h-4zm5 6h4v4h-4zM5 16h4v4H5z',
  more: 'M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z',
  triangle: 'M12 3 2 21h20L12 3ZM7 12h10l-5 9z',
  refresh: 'M20 7v5h-5M4 17v-5h5M6 7a7 7 0 0 1 12-1l2 3M4 15l2 3a7 7 0 0 0 12-1',
};
export function Icon({ name, size = 20 }: { name: string; size?: number }) {
  return <svg aria-hidden="true" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.55" strokeLinecap="round" strokeLinejoin="round"><path d={iconPaths[name] ?? iconPaths.triangle} /></svg>;
}

function sourceName(state: AppState | null) {
  return state?.sourceLabel ?? t(state?.saveDir ? 'Partida local' : 'Aguardando partida');
}
/** Connection label (a key, translated where shown) and an already translated detail line. */
function connectionStatus(state: AppState | null): { label: string; detail?: string; connected: boolean } {
  if (!state) return { label: 'Buscando conexão', connected: false };
  // Why live reading isn't in use right now (e.g. the game is on another file), from the main process.
  const live = state.live;
  const liveDetail = !live.using && live.detail ? tv(live.detail, live.detailValues) : undefined;
  if (state.saveReadError) return { label: 'Falha ao ler o save', detail: liveDetail, connected: false };
  const using = live.using || state.player?.source === 'live';
  if (state.status === 'ok' && state.summary) return {
    label: using ? 'Ao vivo' : 'Save conectado',
    detail: using ? undefined : liveDetail ?? t('Acompanhando o último save'),
    connected: true,
  };
  if (state.status === 'loading' || live.status === 'searching') {
    return { label: 'Buscando conexão', detail: liveDetail, connected: false };
  }
  return { label: 'Sem partida', detail: liveDetail, connected: false };
}

/** Live tracking at a glance (always on): waiting for the game, looking for Link, or following him. */
function liveTracking(state: AppState, player: PlayerState | undefined): { tone: 'off' | 'wait' | 'on'; label: string; detail?: string } {
  const live = state.live;
  if (player?.source === 'live') return { tone: 'on', label: 'Rastreio ao vivo', detail: t('Link no mapa em tempo real') };
  if (live.status === 'unavailable') return { tone: 'off', label: 'Rastreio ao vivo indisponível', detail: live.detail ? tv(live.detail, live.detailValues) : undefined };
  if (live.status === 'off' || live.status === 'no-game') return { tone: 'wait', label: 'Ao vivo: aguardando o jogo', detail: live.detail ? tv(live.detail, live.detailValues) : t('Abra o jogo para o rastreio ao vivo começar.') };
  return { tone: 'wait', label: 'Ao vivo: procurando o Link', detail: live.detail ? tv(live.detail, live.detailValues) : t('Carregue seu arquivo no jogo.') };
}

function LiveIndicator({ state }: { state: AppState }) {
  const player = usePlayer(state);
  const s = liveTracking(state, player);
  return <div className={`sidebar-live ${s.tone}`} role="status" title={s.detail}>
    <span className="live-dot" aria-hidden="true" />
    <span><b>{t(s.label)}</b>{s.detail && <small>{s.detail}</small>}</span>
  </div>;
}

export function Sidebar({ page, onPage, state }: { page: Page; onPage: (p: Page) => void; state: AppState | null }) {
  const connection = connectionStatus(state);
  return <aside className="tracker-sidebar">
    <div className="tracker-brand"><img className="brand-icon" src="./brand/icon.webp" alt="" /><div><strong>Hyrule Tracker</strong><small>Ocarina of Time</small></div></div>
    <button className={connection.connected ? 'sidebar-source connected' : 'sidebar-source'} title={connection.detail ?? t(connection.label)} onClick={() => onPage('settings')}>
      <span className="status-dot" aria-hidden="true" />
      <b>{sourceName(state)}</b>
      <small>{t(connection.label)}</small>
    </button>
    {state && <LiveIndicator state={state} />}
    <nav aria-label={t("Menu principal")}>{navGroups.map(group => isRemote ? group.filter(p => p !== 'second') : group).map((group, index) => <div className="nav-group" key={index}>{group.map(p =>
      <button key={p} type="button" title={t(pages[p])} aria-current={p === page ? 'page' : undefined} onClick={() => onPage(p)}><Icon name={p} size={17} /><span>{t(pages[p])}</span></button>,
    )}</div>)}</nav>
    {state && <div className="sidebar-footer">v{state.version}</div>}
  </aside>;
}

/** Phones (portrait): tab bar at the bottom with the main pages; "More" opens a sheet with the rest. Hidden by CSS elsewhere. */
const tabPages: Page[] = ['overview', 'todo', 'map', 'checklist'];
const tabNames: Partial<Record<Page, string>> = { overview: 'Início', map: 'Mapa', checklist: 'Checklist' };
export function MobileNav({ page, onPage, state }: { page: Page; onPage: (p: Page) => void; state: AppState | null }) {
  const [open, setOpen] = useState(false);
  const dialog = useModalDialog(open);
  const connection = connectionStatus(state);
  const others = navGroups.flat().filter(p => !tabPages.includes(p) && !(isRemote && p === 'second'));
  const go = (p: Page) => { setOpen(false); onPage(p); };
  useEffect(() => {
    if (!open) return;
    const layout = matchMedia('(max-width: 640px)');
    const closeOnWideLayout = () => { if (!layout.matches) setOpen(false); };
    layout.addEventListener('change', closeOnWideLayout);
    return () => layout.removeEventListener('change', closeOnWideLayout);
  }, [open]);
  const moreActive = !tabPages.includes(page);
  return <>
    <nav className="mobile-tabs" aria-label={t('Menu principal')}>
      {tabPages.map(p => <button key={p} type="button" aria-current={p === page && !open ? 'page' : undefined} onClick={() => go(p)}>
        <span className="tab-icon"><Icon name={p} size={21} /></span><span className="tab-label">{t(tabNames[p] ?? pages[p])}</span>
      </button>)}
      <button type="button" aria-haspopup="dialog" aria-expanded={open} aria-current={moreActive && !open ? 'true' : undefined} className={open ? 'open' : undefined} onClick={() => setOpen(true)}>
        <span className="tab-icon"><Icon name="more" size={21} /></span><span className="tab-label">{t('Mais')}</span>
      </button>
    </nav>
    {open && <dialog className="mobile-sheet" ref={dialog} aria-labelledby="mobile-sheet-title" onCancel={e => { e.preventDefault(); setOpen(false); }}
      onClick={e => {
        if (e.target === e.currentTarget && e.clientY < e.currentTarget.getBoundingClientRect().top) setOpen(false);
      }}>
        <div className="sheet-heading">
          <h2 id="mobile-sheet-title">{t('Mais')}</h2>
          <button type="button" className="action" onClick={() => setOpen(false)}>{t('Fechar')}</button>
        </div>
        <div className={connection.connected ? 'sheet-source connected' : 'sheet-source'}>
          <span className="status-dot" aria-hidden="true" />
          <div><b>{sourceName(state)}</b><small>{connection.detail ?? t(connection.label)}</small></div>
        </div>
        <div className="sheet-grid">{others.map(p => <button key={p} type="button" aria-current={p === page ? 'page' : undefined} onClick={() => go(p)}>
          <Icon name={p} size={22} /><span>{t(pages[p])}</span>
        </button>)}</div>
    </dialog>}
  </>;
}

export function PageHeader({ page, state, headerActions, connectionLost }: { page: Page; state: AppState | null; headerActions: ReactNode; connectionLost: boolean }) {
  const connection = connectionStatus(state);
  return <header className="page-header">
    {connectionLost && <p className="notice connection-notice" role="alert">{t('Sem conexão com o PC. Tentando reconectar…')}</p>}
    <div><h1>{t(pages[page])}</h1><p className="page-description">{t(pageDescriptions[page])}</p></div>
    <div className="page-header-actions">
      <span className={connection.connected ? 'connection connected' : 'connection'} title={connection.detail} role="status"><i aria-hidden="true" />{t(connection.label)}</span>
      {headerActions}
    </div>
  </header>;
}

const value = (n: number | null | undefined) => n == null ? '—' : number(n);
/** 28237 -> "7h 50m"; under an hour -> "12m". */
export const playTime = (sec: number | null | undefined) => {
  if (sec == null || sec < 0) return '—';
  const h = Math.floor(sec / 3600), m = Math.floor(sec % 3600 / 60);
  return h ? `${number(h)}h ${String(m).padStart(2, '0')}m` : `${m}m`;
};

const saveProgramIcons = new Map([
  ['Triforce', 'triforce.png'], ['ReLink', 'relink.png'], ['Longshot', 'longshot.png'],
  ['Hookshot', 'hookshot.png'], ['Ocarina Reborn', 'ocarina-reborn.png'],
  ['Fritchii', 'lichii.png'], ['Lichii', 'lichii.png'], ['Eden', 'eden.ico'],
  ['Orchid', 'orchid.ico'], ['Eglantine', 'eglantine.ico'], ['PokeDinner', 'eglantine.ico'],
]);

function SaveActions({ activeDir, notFound = false }: { activeDir?: string; notFound?: boolean }) {
  const [browseError, setBrowseError] = useState('');
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<SaveFolderChoice[]>();
  const [searchError, setSearchError] = useState('');
  const [selecting, setSelecting] = useState(false);
  const searchId = useRef(0);
  const dialog = useModalDialog(open);
  async function find() {
    const id = ++searchId.current;
    setOpen(true);
    setChoices(undefined);
    setSearchError('');
    try {
      const found = await api.findSaveFolders();
      if (searchId.current === id) setChoices(found);
    } catch {
      if (searchId.current === id) setSearchError('Não foi possível buscar os saves. Tente novamente.');
    }
  }
  function close() {
    ++searchId.current;
    setOpen(false);
  }
  async function select(dir: string) {
    setSelecting(true);
    setSearchError('');
    try {
      if (await api.selectSaveFolder(dir)) { close(); return; }
    } catch { /* keep the picker open so another save can be selected */ }
    finally { setSelecting(false); }
    setSearchError('Não foi possível abrir a pasta escolhida. Tente novamente.');
  }
  async function browse() {
    setBrowseError('');
    try {
      const next = await api.browseFolder();
      // The main process reports a folder it can't use through the state message.
      if (next?.status === 'error' && next.message) setBrowseError(next.message);
    } catch { setBrowseError('Não foi possível abrir a pasta escolhida. Tente novamente.'); }
  }
  return <>
    <div className="page-actions">
      <button className={notFound ? 'action' : 'action primary'} onClick={() => void find()}>{t('Buscar saves')}</button>
      <button className={notFound ? 'action primary' : 'action'} onClick={() => void browse()}>{t("Escolher pasta")}</button>
    </div>
    {notFound && <p className="quiet">{t('Não encontrou? Selecione manualmente a pasta do perfil que contém as pastas slot_*.')}</p>}
    {browseError && <p className="notice" role="alert">{t(browseError)}</p>}
    {open && <dialog ref={dialog} className="save-picker" aria-labelledby="save-picker-title"
      onCancel={event => { event.preventDefault(); if (!selecting) close(); }}>
      <div className="save-picker-heading">
        <h2 id="save-picker-title">{t('Buscar saves')}</h2>
        <button type="button" className="action" disabled={selecting} onClick={close}>{t('Fechar')}</button>
      </div>
      {searchError && <p className="notice" role="alert">{t(searchError)}</p>}
      {choices === undefined && !searchError && <p className="quiet" role="status">{t('Buscando…')}</p>}
      {choices?.length === 0 && <p className="quiet" role="status">{t('Nenhuma partida encontrada. Abra o jogo e salve uma vez, ou selecione a pasta do jogo.')}</p>}
      {!!choices?.length && <ul className="save-picker-results">
        {choices.map(save => {
          const bundled = saveProgramIcons.get(save.program ?? '');
          const icon = bundled ? `./program-icons/${bundled}` : save.icon;
          return <li key={save.dir}>
            <button type="button" className="save-choice" aria-current={activeDir === save.dir || undefined} disabled={selecting}
              onClick={() => void select(save.dir)}>
              <span className="save-choice-program">
                <span className="save-program-icon" aria-hidden="true">
                  {icon ? <img src={icon} alt="" width={26} height={26} /> : <Icon name="minigames" size={19} />}
                </span>
                <strong>{save.program ?? t('Partida local')}</strong>
              </span>
              <time dateTime={new Date(save.lastSavedMs).toISOString()}>{day(save.lastSavedMs)}</time>
            </button>
          </li>;
        })}
      </ul>}
      {(searchError || choices?.length === 0) && <div className="page-actions">
        <button type="button" className="action" onClick={() => void find()}>{t('Tentar novamente')}</button>
        <button type="button" className="action" onClick={() => { close(); void browse(); }}>{t('Escolher pasta')}</button>
      </div>}
    </dialog>}
  </>;
}

export function CompanionPage({ page, state, onPage, onScan, scanning, onLanguage, headerActions, connectionLost, mapFocus, onShowInChecklist, todoView }: { mapFocus?: string; onShowInChecklist?: (id: string) => void; todoView?: ReactNode; page: Page; state: AppState; onPage: (page: Page) => void; onScan: () => void; scanning: boolean; onLanguage: (locale: Locale) => void; headerActions: ReactNode; connectionLost: boolean }) {
  const view = {
    overview: <Overview state={state} onPage={onPage} onScan={onScan} scanning={scanning} />,
    checklist: <Overview state={state} onPage={onPage} onScan={onScan} scanning={scanning} />,
    // Built by App (the page uses this module's map helpers, so it can't be imported here).
    todo: todoView,
    map: <HyruleMap state={state} focus={mapFocus} onShowInChecklist={onShowInChecklist} />,
    threads: <Threads state={state} />,
    hall: <Hall state={state} />,
    minigames: <Minigames state={state} />,
    timeline: <Timeline state={state} />,
    medals: <Medals state={state} />,
    secrets: <Suspense fallback={<PageSkeleton page="secrets" label="Carregando descobertas…" />}>
      <EasterEggs marks={state.easterEggs} offline={connectionLost} areaPhoto={areaShot} />
    </Suspense>,
    quiz: <Quiz />,
    second: <SecondScreen state={state} />,
    settings: <Settings state={state} onLanguage={onLanguage} />,
  };
  return <main className="companion-page" key={page}>
    <PageHeader page={page} state={state} headerActions={headerActions} connectionLost={connectionLost} />
    <div className="page-content">{view[page]}</div>
  </main>;
}

/**
 * "Second screen": serve the tracker on the local network and walk the user through opening it
 * on a phone or tablet, with this PC's address ready to type.
 */
function SecondScreen({ state }: { state: AppState }) {
  const lan = state.lan;
  const on = !!lan?.enabled && !lan.error;
  const [busy, setBusy] = useState(false);
  // Address the QR encodes when the PC has more than one; falls back to the first if it goes away.
  const [chosen, setChosen] = useState<string>();
  const urls = on ? lan!.urls : [];
  const target = qrTarget(urls, chosen);
  async function toggle(next: boolean) {
    setBusy(true);
    try { await api.setLan(next); } finally { setBusy(false); }
  }
  // The network may have changed since the app started (another Wi-Fi, profile switched to Private).
  useEffect(() => { if (!isRemote) void api.checkLan(); }, []);
  const publicNets = !isRemote && on ? lan!.publicNetworks ?? [] : [];
  const steps = [
    'A segunda tela já vem ativada. Se quiser, desative no quadro acima.',
    'Conecte o celular ou tablet à mesma rede Wi-Fi deste PC.',
    'Abra o navegador do aparelho (Chrome, Safari, Edge…) e digite o endereço mostrado.',
    'Pronto: o progresso atualiza sozinho enquanto você joga. Dica: adicione a página à tela inicial para abrir com um toque.',
  ];
  return <div className="second-screen">
    <section className="focus-panel setting-panel">
      <h2>{t('Jogue na TV, acompanhe na palma da mão')}</h2>
      <p>{t('Abra o Hyrule Tracker no celular, tablet ou em outro computador da sua casa. Mapa, checklist e o que fazer agora ficam sempre à mão, sem sair do jogo.')}</p>
      <label className="inline-field second-toggle"><input type="checkbox" checked={!!lan?.enabled} disabled={busy} onChange={e => void toggle(e.target.checked)} />{t('Ativar a segunda tela na rede local')}</label>
      {lan?.error && <p className="notice" role="alert">{tv('Não foi possível usar a porta {port}. Feche o programa que a usa e tente de novo.', { port: lan.port })}</p>}
      {on && (target
        ? <div className="second-connect">
            <AddressQr url={target} />
            <div className="second-urls">
              <span className="quiet">{t('Digite no navegador do aparelho:')}</span>
              {urls.length > 1
                ? urls.map(u => <button type="button" className="second-url" key={u} aria-pressed={u === target} onClick={() => setChosen(u)}><code>{u}</code></button>)
                : <code className="second-url">{target}</code>}
              {urls.length > 1 && <span className="quiet">{t('Mais de um endereço? Use o da rede em que o aparelho está (normalmente começa com 192.168).')} {t('Escolha um endereço para ver o código dele.')}</span>}
            </div>
          </div>
        : <p className="notice">{t('Este PC não está conectado a uma rede local.')}</p>)}
      {publicNets.length > 0 && <div className="notice with-action" role="alert">
        <p>{tv('O Windows marcou a rede “{name}” como pública, e o firewall bloqueia outros aparelhos nela. Mude o tipo da rede para privada.', { name: publicNets.join(', ') })}</p>
        <button className="action" onClick={() => void api.openNetworkSettings()}>{t('Abrir configurações de rede')}</button>
      </div>}
    </section>
    <section className="focus-panel setting-panel"><h2>{t('Como conectar')}</h2>
      <ol className="second-steps">{steps.map(s => <li key={s}>{t(s)}</li>)}</ol>
    </section>
    <section className="focus-panel setting-panel"><h2>{t('Se não abrir')}</h2>
      <ul className="second-steps">
        <li>{t('Confira se o aparelho está no mesmo Wi-Fi (não na rede de convidados nem nos dados móveis).')}</li>
        <li>{t('Na primeira vez, o sistema pode perguntar sobre o firewall: permita o Hyrule Tracker em redes privadas.')}</li>
        <li>{t('Qualquer aparelho na sua rede poderá ver o progresso e marcar itens. Desative quando não estiver usando.')}</li>
      </ul>
    </section>
  </div>;
}

/** QR code of a tracker address: dark modules on a light square, so phone cameras read it on the dark page. */
function AddressQr({ url }: { url: string }) {
  const { size, d } = useMemo(() => qrPath(url), [url]);
  return <figure className="second-qr">
    <svg viewBox={`0 0 ${size} ${size}`} role="img" aria-label={tv('Código QR de {url}', { url })} shapeRendering="crispEdges">
      <rect width={size} height={size} />
      <path d={d} />
    </svg>
    <figcaption className="quiet">{t('Aponte a câmera do aparelho para o código.')}</figcaption>
  </figure>;
}

function Overview({ state, onPage, onScan, scanning }: { state: AppState; onPage: (p: Page) => void; onScan: () => void; scanning: boolean }) {
  const s = state.summary;
  if (!s) return <section className="focus-panel empty-state">
    <img className="brand-icon big" src="./brand/icon.webp" alt="" /><h2>{t('Encontre a sua partida')}</h2>
    <p>{isRemote ? t('Abra o Hyrule Tracker no PC e selecione a pasta da partida.')
      : state.message ? tv(state.message, state.messageValues) : t('Procurando saves do remake nos locais de instalação.')}</p>
    {isRemote
      ? <button className="action" disabled={scanning} onClick={onScan}>{t(scanning ? 'Buscando…' : 'Buscar saves')}</button>
      : <SaveActions notFound />}
  </section>;
  const chests = state.categories.find(c => c.id === 'chests');
  const metrics = [
    { label: 'Corações', icon: 'heart', count: s.hearts, max: 20, detail: s.heartPiecesHeld == null ? t('Capacidade máxima') : plural(s.heartPiecesHeld, '{n}/4 pedaço para o próximo', '{n}/4 pedaços para o próximo') },
    { label: 'Skulltulas douradas', icon: 'gold_skulltula', count: s.tokens, max: 100, detail: s.tokens == null ? t('Not in this save yet') : s.claimable.length ? t('Recompensa disponível') : s.nextReward ? `${t('Próxima recompensa aos')} ${number(s.nextReward.tokens)}` : t('Todas as recompensas alcançadas') },
    { label: 'Baús abertos', icon: 'chest', count: chests?.done, max: chests?.total, detail: t('Exploração de Hyrule') },
    { label: 'Rupees', icon: 'rupee', count: state.companion?.rupees, detail: t('Saldo atual') },
    { label: 'Tempo de jogo', icon: 'song_of_time', count: null as number | null | undefined, text: playTime(state.companion?.playSeconds), detail: t('Até o último save') },
  ];
  const artwork = state.saveImage || regionPhoto('HyruleField')?.file;
  return <>
    <section className={artwork ? 'focus-panel progress-panel has-photo' : 'focus-panel progress-panel'}>
      {artwork && <img className="progress-photo" src={artwork} alt="" />}
      <div className="progress-copy">
        <h2>{t("Progresso da jornada")}</h2>
        <div className="big-progress">{value(s.percent)}<span>%</span></div>
        <progress aria-label={t("Progresso do checklist")} value={s.percent} max={100} />
        <p>{s.doneA} {t("de")} {s.totalA} {t("objetivos concluídos")}</p>
        <button className="action primary" onClick={() => onPage('checklist')}>{t("Abrir checklist")}</button>
      </div>
      <div className="progress-place">{s.area ? t(s.area) : sourceName(state)}<small>{s.lastSavedMs ? date(s.lastSavedMs) : t('Último save')}</small></div>
    </section>
    <section className="metric-strip" aria-label={t("Resumo da partida")}>
      {metrics.map(m => <div className="metric" key={m.label}><span className="metric-label"><GameItemIcon id={m.icon} size={25} />{t(m.label)}</span><strong>{'text' in m ? m.text : value(m.count)}{m.max != null && <small>/{m.max}</small>}</strong><span>{m.detail}</span></div>)}
    </section>
    <div className="home-grid">
      <section className="focus-panel"><div className="section-line"><h2>{t("Fios do Tempo+")}</h2><button className="text-action" onClick={() => onPage('threads')}>{t("Ver jornada")}</button></div>
        <div className="chapter-list">{state.companion?.chapters.map(c => <div className="chapter-line" key={c.id}>
          <span className={c.stages.every(t => t.done) ? 'story-dot done' : 'story-dot'} /><b><ObjectiveName done={c.stages.every(stage => stage.done)}>{t(c.title)}</ObjectiveName></b><small>{c.stages.filter(t => t.done).length}/{c.stages.length}</small>
        </div>)}</div>
      </section>
      <section className="focus-panel"><div className="section-line"><h2>{t("Atividade recente")}</h2><button className="text-action" onClick={() => onPage('timeline')}>{t("Abrir registro")}</button></div>
        {(state.activity ?? []).length ? <ActivityList activity={(state.activity ?? []).slice(0, 3)} /> : <p className="quiet">{t("Os próximos avanços aparecerão aqui durante a partida.")}</p>}
      </section>
    </div>
  </>;
}

function Settings({ state, onLanguage }: { state: AppState; onLanguage: (locale: Locale) => void }) {
  return <>
    <section className="focus-panel setting-panel"><h2>{t("Idioma")}</h2><LanguageSwitch locale={currentLocale()} onChange={onLanguage} labelled /></section>
    <section className="focus-panel setting-panel">
      <h2>{t("Fonte da partida")}</h2>
      <p>{sourceName(state)}</p>
      <code className="save-path">{state.saveDir || t('Pasta do save ainda não encontrada.')}</code>
      {state.message && <p className="notice" role="status">{tv(state.message, state.messageValues)}</p>}
      {!isRemote && <SaveActions activeDir={state.status === 'ok' ? state.saveDir : undefined} notFound={!state.saveDir} />}
      {state.profiles.length > 1 && <label className="inline-field">{t('Perfil')}<select value={state.chosenProfile ?? ''} onChange={e => void api.selectProfile(e.target.value || null)}>
        <option value="">{t('Seguir o perfil jogado por último')}</option>
        {state.profiles.map(profile => <option key={profile.id} value={profile.id}>{profile.name ?? profile.id.slice(0, 8)} · {date(profile.lastSavedMs)}</option>)}
      </select></label>}
      {!!state.slots.length && <label className="inline-field">{t('Slot')}<select value={state.slotMode === 'manual' ? state.activeSlot : ''} onChange={e => void api.pinSlot(e.target.value || null)}>
        <option value="">{t("Seguir o save mais recente")}</option>
        {state.slots.map(slot => <option key={slot.name} value={slot.name}>{slot.name} · {t(slot.area ?? '?')} · {date(slot.mtimeMs)}</option>)}
      </select></label>}
    </section>
    {!isRemote && <section className="focus-panel setting-panel"><h2>{t("Rastreamento")}</h2>
      <label className="inline-field"><input type="checkbox" checked={state.changeLog.enabled} onChange={e => void api.setChangeLog(e.target.checked)} />{t("Guardar o registro de atividade neste PC")}</label>
      {state.slotMode === 'manual' && <p className="notice">{t("Slot fixado. Selecione o save mais recente para voltar ao modo ao vivo.")}</p>}
      <button className="action" onClick={() => void api.toggleOverlay()}>
        {t(state.overlay.visible ? 'Ocultar painel no jogo' : 'Mostrar painel no jogo')}
        {state.hotkeys.toggleOverlay && ` (${state.hotkeys.toggleOverlay})`}
      </button>
    </section>}
    <section className="focus-panel setting-panel credits-panel"><h2>{t("Créditos")}</h2>
      <p>{t("Mapas de Hyrule e das masmorras, posições dos colecionáveis, fotos dos locais e a posição de Link no mapa: Ocarina Atlas, de antonioalvromero (licença MIT), que credita o atlas e as imagens de jogo ao Nintendúo.")}{' '}
        <a href="https://github.com/antonioalvromero/Ocarina-Atlas" target="_blank" rel="noreferrer">Ocarina Atlas</a>{' · '}
        <a href="https://www.nintenduo.com/" target="_blank" rel="noreferrer">Nintendúo</a></p>
      <p>{t("Imagens de itens, colecionáveis e HUD: Zelda Wiki e Mt. Wildwood Zelda Wiki. Imagens de inimigos e regiões: Mt. Wildwood Zelda Wiki.")}</p>
      <p>{t("Mapeamento do save e lógica do jogo: Clawshot, OOT-SW2SE, editor de save de dlr-developer e OoT Randomizer.")}</p>
      <p>{t("As imagens do jogo pertencem aos seus respectivos detentores de direitos.")}{' '}
        <a href="https://github.com/jv-prado/hyrule-tracker/blob/master/THIRD_PARTY_NOTICES.md" target="_blank" rel="noreferrer">{t("Ver todos os créditos")}</a></p>
    </section>
  </>;
}

export const atlasStages: Record<string, string> = {
  kokiri: 'KokiriForest', perdido: 'LostWood', prado: 'SacredForestMeadow', llanura: 'HyruleField',
  lonlon: 'LonLonRanch', ciudadela: 'Market', castillo: 'HyruleCastle', kakariko: 'KakarikoVillage', cementerio: 'Graveyard',
  sendero: 'DeathMountainTrail', goron: 'GoronCity', crater: 'DeathMountainCrater', rio: 'ZoraRiver',
  dominio: 'ZoraDomain', fuente: 'ZoraFountain', lago: 'LakeHylia', valle: 'GerudoValley',
  fortaleza: 'GerudoFortress', desierto: 'HountedWasteland', coloso: 'DesertColossus',
  deku: 'InsideTheDekuTree', dodongos: 'DodongoCavern', jabu: 'InsideJabuJabuBelly',
  bosque: 'ForestTemple', fuego: 'FireTemple', agua: 'WaterTemple', sombra: 'ShadowTemple',
  espiritu: 'SpiritTemple', pozo: 'BottomOfTheWell', hielo: 'IceCavern', gerudo: 'GerudoTrainingGround', ganon: 'InsideGanonCastle',
};
const atlasCategories: Record<string, string> = {
  gs: 'gold_skulltulas', heart: 'heart_pieces', container: 'heart_containers', bean: 'bean_spots', fairy: 'great_fairies',
  bottle: 'bottles', thought: 'fairy_thoughts',
};
/** What a marker is, in words (translated). */
export const atlasKinds: Record<string, string> = {
  gs: 'Skulltula dourada', heart: 'Pedaço de coração', container: 'Recipiente de coração', bean: 'Feijão mágico',
  fairy: 'Grande Fada', bottle: 'Garrafa', thought: 'Pensamento de fada',
};
const atlasIcons: Record<string, string> = {
  gs: 'gold_skulltula', heart: 'heart_piece', container: 'heart_container', bean: 'magic_bean', bottle: 'bottle',
};
const englishAliases: Record<string, string[]> = {
  InsideTheDekuTree: ['deku tree', 'great deku tree'], InsideJabuJabuBelly: ['jabu', "lord jabu-jabu's belly"],
  HountedWasteland: ['haunted wasteland', 'mirage desert'], Market: ['hyrule castle town', 'castle town'],
  DodongoCavern: ["dodongo's cavern"], HyruleCastle: ['outside ganon’s castle'],
  LostWood: ['lost woods', 'lost wood'], TimeTemple: ['temple of time'], GerudoTrainingGround: ['gerudo training ground', 'gerudo proving grounds'],
  BottomOfTheWell: ['bottom of the well'], DeathMountainTrail: ['death mountain trail'], ZoraDomain: ["zora's domain"],
  ZoraRiver: ["zora's river"], ZoraFountain: ["zora's fountain"], SacredForestMeadow: ['sacred grove'],
};
/** Link's position: from the state, then live updates on their own channel (twice a second while moving). */
function usePlayer(state: AppState): PlayerState | undefined {
  const [player, setPlayer] = useState(state.player);
  useEffect(() => setPlayer(state.player), [state.player]);
  useEffect(() => api.onPlayer(p => setPlayer(p ?? undefined)), []);
  return player;
}

/** Shown on the map while Link's arrow comes from the save, not from the running game. */
const SAVE_POSITION_NOTE = 'Nos recomps, a posição do Link é ao vivo. Nos emuladores, só atualiza quando você salva.';

/** Link on a map: a red arrow pointing where he faces (it pulses when it appears live). */
function PlayerPin({ at, yaw, live }: { at: { x: number; y: number }; yaw: number; live: boolean }) {
  const label = live ? t('Link (ao vivo)') : t('Link (último save)');
  return <div className={live ? 'player-pin live' : 'player-pin'} style={{ left: `${at.x * 100}%`, top: `${at.y * 100}%` }} title={label} aria-label={label} role="img">
    <svg className="player-heading" viewBox="-15 -15 30 30" style={{ transform: `rotate(${yaw}deg)` }} aria-hidden="true">
      <path d="M0,-13 L10,11 L0,5 L-10,11 Z" />
    </svg>
  </div>;
}

type Era ='all' | 'child' | 'adult';
/** One collectible placed on a region (by where its chest sits, or by the region the checklist names). */
interface MapRow { item: TrackedItem; cat: TrackedCategory; area: string; placed: boolean; era?: string; fixes: PlayerFix[] }
/** A tracked collectible drawn on a floor map. */
interface TrackedPin { item: TrackedItem; cat: TrackedCategory; at: { map: string; x: number; y: number } }
const atlasPlaces = atlas.places as unknown as PositionPlace[];
/** The projection clamps what falls outside a map to its border: those spots are not where they look, so they are not drawn. */
export const atEdge = (at: { x: number; y: number }) => at.x <= 0.021 || at.x >= 0.979 || at.y <= 0.021 || at.y >= 0.979;
export interface Spot { stage?: string; era?: 'child' | 'adult'; x?: number; y?: number; z?: number }
/** Where a placed collectible falls on the atlas (one fix per map it shows on). */
export const locateSpot = (spot: Spot): PlayerFix[] => spot.stage && spot.x != null && spot.y != null && spot.z != null
  ? locatePlacement(spot.stage, spot.era, { x: spot.x, y: spot.y, z: spot.z }, atlasPlaces) : [];
export const MAP_CATEGORIES = new Set(['heart_pieces', 'heart_containers', 'gold_skulltulas', 'chests', 'great_fairies', 'bottles', 'fairy_thoughts', 'scarecrow_spots', 'grottos', 'minigames', 'side_events', 'bean_spots', 'big_poe_spots', 'gossip_stones', 'silver_rupees', 'cow_rewards']);
/** Game icon of each category in the area panel. */
export const categoryIcons: Record<string, string> = {
  heart_pieces: 'heart_piece', heart_containers: 'heart_container', gold_skulltulas: 'gold_skulltula', chests: 'chest',
  great_fairies: 'double_magic', bottles: 'bottle', fairy_thoughts: 'fairy_ocarina', scarecrow_spots: 'scarecrows_song',
  grottos: 'bomb', minigames: 'gold_rupee', side_events: 'zeldas_letter', bean_spots: 'magic_bean', big_poe_spots: 'big_poe',
  gossip_stones: 'mask_of_truth', silver_rupees: 'purple_rupee', cow_rewards: 'lon_lon_milk',
};
const eras: [Era, string][] = [['all', 'Todas'], ['child', 'Criança'], ['adult', 'Adulto']];
const normalizeName = (s: string) => s.normalize('NFD').toLowerCase().replace(/ \(.+\)$/, '').replace(/[^a-z0-9]/g, '');
export const findRegion = (name: string) => Object.keys(LOCAL_NAMES).find(k =>
  normalizeName(k) === normalizeName(name) || normalizeName(LOCAL_NAMES[k]) === normalizeName(name) || englishAliases[k]?.some(a => normalizeName(a) === normalizeName(name)),
);
/** Game order for the region list: the atlas's order first, then any other region with items. */
/** In-game screenshot of each area for the progress list (picked from the atlas's location shots; no HUD dialogue in the middle, where the row crops to). */
const areaShots: Record<string, string> = {
  kokiri: 'd47a7cff2873afce.webp',
  perdido: '6b0eddcd7f5addd9.webp',
  prado: 'cba5d0058e101bb9.webp',
  llanura: '34c70292d11802e6.webp',
  lonlon: '91642ad57803f8af.webp',
  ciudadela: '6bcb2553b2880932.webp',
  castillo: '1a2730b6efd43b42.webp',
  kakariko: 'fb3f847e2ae7abe8.webp',
  cementerio: 'd7c9d1e96f6b2f07.webp',
  sendero: 'c90a06d525bd049f.webp',
  goron: '70f65ff0d0f7842e.webp',
  crater: 'db42d04fb15d706b.webp',
  rio: 'ee0d4916fd4db374.webp',
  dominio: '532dd5c6729880f1.webp',
  fuente: 'b6ccef48d89d5593.webp',
  lago: '3b36c9a09d21fd21.webp',
  valle: '5e6592a7228bc8ab.webp',
  fortaleza: '902e679ca926440d.webp',
  desierto: 'd77c310b8b567ad3.webp',
  coloso: '13114341bbebc7db.webp',
  deku: '007dfbd483e37f4c.webp',
  dodongos: '5163696cba9539ce.webp',
  jabu: 'cfa0683ff00b72c8.webp',
  bosque: '1ada9fcb97f1047e.webp',
  fuego: '1da52d01ff92b0e5.webp',
  agua: 'c4648f47b96fc9a7.webp',
  sombra: '7071f75c0caac948.webp',
  espiritu: 'e6fec2857c58bfc1.webp',
  pozo: '4a3a528aecdf510f.webp',
  hielo: '0fc9f3e25475a5ad.webp'
};
export const areaShot = (key: string) => {
  const place = Object.keys(atlasStages).find(id => atlasStages[id] === key);
  return place && areaShots[place] ? 'images/atlas/' + areaShots[place] : regionPhoto(key)?.file;
};
const regionOrder = [...new Set([...atlas.places.map(p => atlasStages[p.id]), ...Object.keys(LOCAL_NAMES)].filter(Boolean))];
/** Rounded down, so a region only reads 100% when everything in it is done. */
const percent = (done: number, total: number) => total ? Math.floor(done / total * 100) : 0;
const inEra = (r: MapRow, era: Era) => {
  if (era === 'all') return true;
  if (r.placed) return !r.era || r.era === era;
  const ages: string[] = r.item.logic?.ages ?? [];
  return !ages.length || ages.includes(era);
};

/**
 * The map's two scores: entries that count toward 100% (the same ones the Overview counts, those with a place)
 * and the extras the map also tracks (chests, grottos, Gossip Stones…), which don't.
 */
function SplitScore({ rows, overall }: { rows: MapRow[]; overall?: { done: number; total: number } }) {
  const tally = (list: MapRow[]) => ({ done: list.filter(r => r.item.done).length, total: list.length });
  const parts = [
    // On the Hyrule map the 100% line is the whole checklist (the Overview's number), not just what has a place.
    { key: 'main', label: 'Conta para o 100%', note: undefined, ...(overall ?? tally(rows.filter(r => r.cat.countsToward100))) },
    { key: 'extra', label: 'Extras do mapa', note: 'Não contam para o 100%', ...tally(rows.filter(r => !r.cat.countsToward100)) },
  ].filter(p => p.total);
  return <div className="split-score">{parts.map(p => (
    <div key={p.key} className={`split-row ${p.key}`}>
      <span className="split-label">{t(p.label)}</span>
      {/* One decimal, rounded down, like the Overview's progress. */}
      <b>{number(p.total ? Math.floor(p.done / p.total * 1000) / 10 : 0)}%</b>
      <small className="split-meta">{p.done}/{p.total}{p.note && <> · {t(p.note)}</>}</small>
      <span className="rate-track"><i style={{ width: `${percent(p.done, p.total)}%` }} /></span>
    </div>
  ))}</div>;
}

/** A checklist row's status as the map shows it (a hand tick counts as done). */
export const rowStatus = (item: TrackedItem): 'done' | 'todo' | 'unknown' =>
  item.done ? 'done' : item.state === 'unknown' || item.state === 'unmapped' ? 'unknown' : 'todo';

/** Checklist row id -> the atlas marker that stands for it on the map. */
export function rowMarkers(links: Record<string, string> | undefined) {
  const byId = new Map(atlas.items.map(m => [m.id, m]));
  const out = new Map<string, (typeof atlas.items)[number]>();
  for (const [marker, row] of Object.entries(links ?? {})) { const m = byId.get(marker); if (m && !out.has(row)) out.set(row, m); }
  return out;
}

export function HyruleMap({ state, focus, onShowInChecklist }: { state: AppState; focus?: string; onShowInChecklist?: (id: string) => void }) {
  const player = usePlayer(state);
  // The region opened by hand ('' = the world map).
  const [picked, setPicked] = useState('');
  const [era, setEra] = useState<Era>('all');
  const [filter, setFilter] = useState('all');
  const [hideDone, setHideDone] = useState(false);
  const [hideUnknown, setHideUnknown] = useStored('map.hideUnknown', false);
  // On by default: the map opens where Link is and keeps up with him.
  const [follow, setFollow] = useStored('map.follow', true);
  const [panelOpen, setPanelOpen] = useStored('map.panel', true);
  const [hudOpen, setHudOpen] = useStored('map.hud', false);
  const [active, setActive] = useState<TrackedItem>();
  const mapView = useRef<HTMLDivElement>(null);
  const [mapOnly, toggleMapOnly] = useMapOnlyView(mapView);
  // Phone portrait: the map is too short to carry the panel, so it sits below the map until full screen.
  const panelBelow = useMatches(PANEL_BELOW) && !mapOnly;
  const inGame = (player && atlasStages[player.placeId]) || findRegion(state.summary?.area?.replace(/ \(.+\)$/, '') ?? '');
  const selected = follow && inGame ? inGame : picked;
  const inRegion = selected !== '';
  const seen = new Set([...(state.companion?.visited ?? []), ...(inGame ? [inGame] : [])]);
  const places = useMemo(() => new Map(Object.entries(state.placements ?? {}).flatMap(([id, rows]) =>
    rows.map(c => [id + '.0x' + c.hash.toString(16), c] as const))), [state.placements]);
  const spots = state.worldMarkers;
  const markerOf = useMemo(() => rowMarkers(state.atlasLinks), [state.atlasLinks]);
  const rows = useMemo<MapRow[]>(() => state.categories.filter(c => MAP_CATEGORIES.has(c.id)).flatMap(cat => cat.items.map(item => {
    const spot: Spot | undefined = places.get(item.id) ?? spots?.[item.id];
    const fixes = spot ? locateSpot(spot) : [];
    const marker = markerOf.get(item.id);
    // Placed items belong to the region their map is in (the ranch and the lake are part of the Hyrule Field scene);
    // rows with an atlas marker to the marker's region; the rest to the region the checklist names.
    const area = spot ? atlasStages[fixes[0]?.placeId] ?? (spot.stage || 'unknown')
      : (marker && atlasStages[marker.place]) || (findRegion(item.chapter ?? item.logic?.region ?? '') ?? '');
    return { item, cat, placed: !!spot, era: spot?.era, fixes, area };
  })), [state.categories, places, spots, markerOf]);
  // Completion of every region (all eras), for the world map's list.
  const progress = useMemo(() => {
    const byKey = new Map<string, { done: number; total: number }>();
    for (const r of rows) {
      const entry = byKey.get(r.area) ?? { done: 0, total: 0 };
      entry.total++;
      if (r.item.done) entry.done++;
      byKey.set(r.area, entry);
    }
    const regions = regionOrder.filter(key => LOCAL_NAMES[key] && byKey.has(key)).map(key => ({ key, ...byKey.get(key)! }));
    return { byKey, regions, done: regions.reduce((n, r) => n + r.done, 0), total: regions.reduce((n, r) => n + r.total, 0) };
  }, [rows]);

  const local = rows.filter(r => r.area === selected && inEra(r, era));
  const visible = local.filter(r => (!hideDone || !r.item.done) && (filter === 'all' || filter === r.cat.id));
  const counters = [...local.reduce((map, r) => {
    const entry = map.get(r.cat.id) ?? { cat: r.cat, icon: categoryIcons[r.cat.id] ?? trackedItemIcon(r.item), done: 0, total: 0 };
    entry.total++;
    if (r.item.done) entry.done++;
    return map.set(r.cat.id, entry);
  }, new Map<string, { cat: TrackedCategory; icon: string; done: number; total: number }>()).values()];
  const showLocation = !hideUnknown || seen.has(selected);
  const place = atlas.places.find(p => atlasStages[p.id] === selected);
  // Rows with an atlas marker are drawn by that marker (with its photos), not a second time.
  const tracked: TrackedPin[] = place ? local.filter(r => !markerOf.has(r.item.id)).flatMap(r => r.fixes
    .filter(f => f.placeId === place.id && f.mapId && f.at && !atEdge(f.at)).map(f => ({ item: r.item, cat: r.cat, at: { map: f.mapId!, x: f.at!.x, y: f.at!.y } }))) : [];
  const regionName = selected === 'unknown' ? t('Baús sem posição mapeada') : t(LOCAL_NAMES[selected] ?? selected);

  // Arriving from a checklist entry: open its region and highlight it.
  useEffect(() => {
    const row = focus ? rows.find(r => r.item.id === focus) : undefined;
    if (!row) return;
    setPicked(row.area);
    setFollow(false);
    setFilter('all');
    setEra('all');
    setHideDone(false);
    setPanelOpen(true);
    setActive(row.item);
    // Only when the requested entry changes; later state refreshes must not pull the map back.
  }, [focus]);

  function open(key: string) { setPicked(key); setFollow(false); setActive(undefined); setFilter('all'); }
  const back = () => open('');
  const selectItem = (item: TrackedItem) => setActive(item.id === active?.id ? undefined : item);
  const activeItem = local.find(({ item }) => active?.id === item.id)?.item;
  const showPanel = !panelOpen ? <button type="button" className="map-panel-show" aria-expanded="false" onClick={() => setPanelOpen(true)}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M7.9 2.2 4.1 6l3.8 3.8" /></svg>{t('Mostrar painel')}</button> : undefined;
  const rate = (key: string) => { const r = progress.byKey.get(key); return r ? percent(r.done, r.total) : 0; };
  const listed = progress.regions.filter(r => !hideUnknown || seen.has(r.key));
  const unknownRate = progress.byKey.get('unknown');
      const sideChrome = panelOpen ? <aside className="map-side" aria-label={inRegion ? t('Conclusão da área') : t('Progresso de conclusão')}>
        <div className="map-side-head">
          <button type="button" className="map-side-collapse" aria-label={t('Recolher painel')} title={t('Recolher painel')} aria-expanded="true" onClick={() => setPanelOpen(false)}><svg viewBox="0 0 12 12" aria-hidden="true"><path d="M4.1 2.2 7.9 6 4.1 9.8" /></svg></button>
          <b>{inRegion ? t('Conclusão da área') : t('Progresso de conclusão')}</b>
        </div>
        {!inRegion ? <div className="map-side-body">
          <div className="side-score"><span className="side-region">{t('Hyrule')}</span></div>
          <SplitScore rows={rows.filter(r => LOCAL_NAMES[r.area])} overall={state.summary ? { done: state.summary.doneA, total: state.summary.totalA } : undefined} />
          <p className="side-sub">{t('Taxa de conclusão por região')}</p>
          <div className="region-rates">
            {listed.map(r => <button key={r.key} type="button" className="region-rate" style={areaShot(r.key) ? { backgroundImage: `linear-gradient(90deg, #14121100 0%, #141211a0 52%, #141211 88%), url("${areaShot(r.key)}")` } : undefined} onClick={() => open(r.key)}>
              <span className="rate-name">{t(LOCAL_NAMES[r.key])}</span><b>{rate(r.key)}%</b>
              <span className="rate-track"><i style={{ width: `${rate(r.key)}%` }} /></span>
            </button>)}
            {!hideUnknown && unknownRate && <button type="button" className="region-rate" onClick={() => open('unknown')}>
              <span className="rate-name">{t('Baús sem posição mapeada')}</span><b>{unknownRate.done}/{unknownRate.total}</b>
              <span className="rate-track"><i style={{ width: `${percent(unknownRate.done, unknownRate.total)}%` }} /></span>
            </button>}
          </div>
        </div> : <div className="map-side-body">
          <div className="side-score"><span className="side-region">{regionName}</span></div>
          {showLocation && <SplitScore rows={local} />}
          <div className="era-tabs" role="radiogroup" aria-label={t('Era')}>{eras.map(([id, label]) =>
            <button key={id} type="button" role="radio" aria-checked={era === id} onClick={() => { setEra(id); setActive(undefined); }}>{t(label)}</button>)}</div>
          {!showLocation ? <p className="quiet">{t("Visite a região para ver os itens.")}</p> : <>
            {!!counters.length && <div className="side-counters">{counters.map(c =>
              <button key={c.cat.id} type="button" aria-pressed={filter === c.cat.id} title={t('Filtrar a lista por esta categoria')} onClick={() => setFilter(filter === c.cat.id ? 'all' : c.cat.id)}>
                <span className="counter-icon"><GameItemIcon id={c.icon} size={18} /></span><span>{t(c.cat.label)}</span><b>{c.done}/{c.total}</b>
              </button>)}</div>}
            <div className="side-list-head"><h3>{t('Coletáveis')}</h3><small>{visible.length}</small>
              <label><input type="checkbox" checked={hideDone} onChange={e => setHideDone(e.target.checked)} />{t("Só pendentes")}</label></div>
            {visible.length ? <div className="result-list">{visible.map(({ item, cat }) => <Fragment key={item.id}><button aria-expanded={item.id === active?.id} aria-pressed={item.id === active?.id} onClick={() => selectItem(item)}><span className={item.done ? 'story-dot done' : 'story-dot'} /><span><ObjectiveName done={item.done}>{t(item.name)}</ObjectiveName><small>{t(cat.label)} · {item.done ? t('Coletado') : item.state === 'unknown' || item.state === 'unmapped' ? t('Situação não mapeada') : t('Pendente')}</small></span></button>
              {item.id === activeItem?.id && <div className="result-detail"><p>{activeItem.where ? t(activeItem.where) : t(cat.label)}</p>
                <div className="result-actions">
                  {activeItem.state !== 'yes' && <button className="action" onClick={() => void api.toggleManual(activeItem.id)}>{activeItem.done ? t('Desmarcar') : t('Concluí')}</button>}
                  {onShowInChecklist && <button className="small-btn" onClick={() => onShowInChecklist(activeItem.id)}>{t('Ver na checklist')}</button>}
                </div></div>}</Fragment>)}</div> : <p className="quiet">{t("Nenhum item para este filtro.")}</p>}
          </>}
        </div>}
      </aside> : showPanel;
  const onMap = panelBelow ? undefined : sideChrome;
  const regionMenu = <label className="map-region"><span>{t("Região")}</span><select value={selected} onChange={e => open(e.target.value)}><option value="">{t("Mapa de Hyrule")}</option>{Object.entries(LOCAL_NAMES).filter(([key]) => !hideUnknown || seen.has(key) || key === selected).map(([key, name]) => <option key={key} value={key}>{t(name)}</option>)}{!hideUnknown && <option value="unknown">{t("Baús sem posição mapeada")}</option>}</select></label>;
  const mapModes = <div className="map-hud-modes">
    <label className="map-switch"><input type="checkbox" checked={hideUnknown} onChange={e => setHideUnknown(e.target.checked)} /><span>{t("Ocultar regiões não vistas")}</span></label>
    <label className="map-switch"><input type="checkbox" checked={follow} onChange={e => { setFollow(e.target.checked); setActive(undefined); }} /><span>{t("Seguir Link")}</span></label>
  </div>;


  return <div ref={mapView} className={mapOnly ? 'map-view map-only' : 'map-view'}>
    {player?.source === 'save' && <p className="map-note">{t(SAVE_POSITION_NOTE)}</p>}
    <div className={panelOpen ? 'map-stage' : 'map-stage no-panel'}>
      <section className="map-main">
        {!inRegion ? <ZoomPan key="world" ratio={atlas.map.width / atlas.map.height} className="world-map" overlay={<><MapHud open={hudOpen} onToggle={() => setHudOpen(!hudOpen)} where={regionMenu} how={<><span className="map-hud-divider" aria-hidden="true" />{mapModes}</>} />{onMap}</>} controls={<MapScreenButton on={mapOnly} toggle={toggleMapOnly} />}>
          <img className="map-art" src={atlas.map.image} alt={t("Mapa de Hyrule")} draggable={false} />
          {atlas.places.filter(p => !hideUnknown || seen.has(atlasStages[p.id])).map(p => {
            const key = atlasStages[p.id];
            const label = t(LOCAL_NAMES[key] ?? p.name);
            const entry = progress.byKey.get(key);
            const title = entry ? `${label} · ${rate(key)}%` : label;
            const state = key === inGame ? ' in-game' : entry && entry.done === entry.total ? ' complete' : '';
            return <button key={key} className={`map-node ${p.kind}${state}`} style={{ left: `${p.pin.x * 100}%`, top: `${p.pin.y * 100}%` }} title={title} aria-label={title} onClick={() => open(key)}><span>{label}</span></button>;
          })}
          {player && <PlayerPin at={player.world} yaw={player.yaw} live={player.source === 'live'} />}
        </ZoomPan> : showLocation && place ? <RegionAtlas key={selected} place={place} state={state} era={era} onEra={next => { setEra(next); setActive(undefined); }} filter={filter} hideDone={hideDone} player={player} follow={follow} regionMenu={regionMenu} mapModes={mapModes} overlay={onMap} onBack={back} hudOpen={hudOpen} onHud={() => setHudOpen(!hudOpen)} controls={<MapScreenButton on={mapOnly} toggle={toggleMapOnly} />} tracked={tracked}
            focusItem={activeItem?.id} onPickItem={item => setActive(item)} onShowInChecklist={onShowInChecklist} />
          : <div className="zoom-viewport map-unmapped">
            <MapHud open={hudOpen} onToggle={() => setHudOpen(!hudOpen)} where={<><button type="button" className="map-back" aria-label={t('Voltar ao mapa de Hyrule')} title={t('Voltar ao mapa de Hyrule')} onClick={back}><Icon name="map" size={16} /></button>{regionMenu}</>} how={<><span className="map-hud-divider" aria-hidden="true" />{mapModes}</>} />
            {onMap}
            <p className="map-unmapped-note">{showLocation ? t('Esta região não tem mapa próprio.') : t('Visite a região para ver os itens.')}</p>
          </div>}
        {panelBelow && sideChrome}
      </section>
    </div>
  </div>;
}

/** One bar over the map. The groups disappear on a wide window so the controls stay one row. On a phone the extra rows start folded. */
function MapHud({ where, how, open, onToggle }: { where: ReactNode; how: ReactNode; open: boolean; onToggle: () => void }) {
  const label = t(open ? 'Ocultar opções do mapa' : 'Mostrar opções do mapa');
  return <div className="map-float-tools"><div className={open ? 'map-hud' : 'map-hud is-collapsed'}>
    <div className="map-hud-where">
      {where}
      <button type="button" className="map-hud-toggle" aria-expanded={open} aria-label={label} title={label} onClick={onToggle}>
        <svg viewBox="0 0 12 12" aria-hidden="true"><path d={open ? 'M2.2 7.7 6 4l3.8 3.7' : 'M2.2 4.3 6 8l3.8-3.7'} /></svg>
      </button>
    </div>
    <div className="map-hud-how">{how}</div>
  </div></div>;
}

/** Icon button for the map's zoom cluster: enter or leave the dedicated map view. */
function MapScreenButton({ on, toggle }: { on: boolean; toggle: () => void }) {
  const label = t(on ? 'Sair da tela cheia' : 'Tela cheia');
  return <button type="button" className="map-only-toggle" aria-pressed={on} aria-keyshortcuts={on ? 'Escape' : undefined} aria-label={label} title={on ? `${label} (Esc)` : label} onClick={toggle}>
    <svg viewBox="0 0 16 16" aria-hidden="true">
      {on
        ? <path d="M2 6h4V2M10 2v4h4M14 10h-4v4M6 14v-4H2" />
        : <path d="M6 2H2v4M10 2h4v4M14 10v4h-4M2 10v4h4" />}
    </svg>
  </button>;
}

/**
 * Map alone, for a dedicated monitor: the map view covers the window and the browser goes fullscreen where it allows it.
 * iPhone Safari only grants fullscreen to videos, so there the view just covers the page. Leaving browser fullscreen
 * (Esc, F11) leaves the view too. The rest of the app turns inert meanwhile, so Tab stays on the map.
 */
function useMapOnlyView(view: RefObject<HTMLElement | null>) {
  const [on, setOn] = useState(false);
  useEffect(() => {
    const el = view.current;
    if (!on || !el) return;
    const hidden: Element[] = [];
    for (let node: Element = el; node.parentElement && node !== document.body; node = node.parentElement) {
      for (const sibling of Array.from(node.parentElement.children)) {
        if (sibling !== node && !sibling.hasAttribute('inert')) { sibling.setAttribute('inert', ''); hidden.push(sibling); }
      }
    }
    const left = () => { if (!document.fullscreenElement) setOn(false); };
    // On window, after the document listeners: Escape that closed a marker card first is already handled.
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape' && !e.defaultPrevented) setOn(false); };
    document.addEventListener('fullscreenchange', left);
    window.addEventListener('keydown', key);
    return () => {
      for (const sibling of hidden) sibling.removeAttribute('inert');
      document.removeEventListener('fullscreenchange', left);
      window.removeEventListener('keydown', key);
      if (document.fullscreenElement === document.documentElement) document.exitFullscreen().catch(() => undefined);
    };
  }, [on, view]);
  function toggle() {
    if (on) return setOn(false);
    setOn(true);
    // Asked from the click itself: browsers only grant fullscreen during a user gesture.
    const root = document.documentElement;
    if (!document.fullscreenElement && root.requestFullscreen) root.requestFullscreen().catch(() => undefined);
  }
  return [on, toggle] as const;
}

/** Screens where the marker card docks to the map's edge instead of floating beside its marker. */
const DOCKED_CARD = '(max-width: 640px), (max-height: 500px), (pointer: coarse)';
/** Phone portrait (the 760px block in companion.css): the progress panel sits below the map instead of on it. */
const PANEL_BELOW = '(max-width: 760px)';
function useMatches(query: string) {
  const [matches, setMatches] = useState(() => matchMedia(query).matches);
  useEffect(() => {
    const media = matchMedia(query);
    const update = () => setMatches(media.matches);
    update();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  }, [query]);
  return matches;
}

type AtlasPlace = (typeof atlas.places)[number];
/** One marker on a floor map: an atlas location or a tracked collectible. */
interface Pin { id: string; filter?: string; icon?: string; kind: string; name: string; at?: { map: string; x: number; y: number }; status: 'done' | 'todo' | 'unknown'; images: string[]; item?: TrackedItem; tick?: { id: string; on: boolean } }

function RegionAtlas({ place, state, era, onEra, filter, hideDone, player, follow, regionMenu, mapModes, overlay, onBack, hudOpen, onHud, controls, tracked, focusItem, onPickItem, onShowInChecklist }: {
  place: AtlasPlace; state: AppState; era: Era; onEra: (era: Era) => void; filter: string; hideDone: boolean; player?: PlayerState; follow: boolean; regionMenu?: ReactNode; mapModes?: ReactNode; overlay?: ReactNode; onBack?: () => void; hudOpen: boolean; onHud: () => void; controls?: ReactNode; tracked: TrackedPin[];
  /** Checklist row picked outside the map (side list, "View on map"): its marker gets selected. */
  focusItem?: string; onPickItem?: (item: TrackedItem) => void; onShowInChecklist?: (id: string) => void;
}) {
  const here = player && player.placeId === place.id ? player : undefined;
  const [floor, setFloor] = useState(here?.mapId ?? place.startMap ?? '');
  // Following Link: keep his floor / era on screen as he moves between them.
  useEffect(() => { if (follow && here?.mapId) setFloor(here.mapId); }, [follow, here?.mapId]);
  const [active, setActive] = useState('');
  const [shot, setShot] = useState(0);
  const [show, setShow] = useStored<'all' | 'todo' | 'done'>('map.show', 'all');
  // Close the marker card with Escape.
  useEffect(() => {
    if (!active) return;
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.preventDefault(); setActive(''); } };
    document.addEventListener('keydown', key);
    return () => document.removeEventListener('keydown', key);
  }, [active]);
  const status = state.atlasStatus ?? {};
  const currentFloor = place.maps.find(map => map.id === floor) ?? place.maps[0];
  const kindOf = (cat: string) => t(atlasKinds[cat] ?? cat);
  const rowsById = useMemo(() => new Map(state.categories.flatMap(c => c.items.map(i => [i.id, i] as const))), [state.categories]);
  const atlasPins: Pin[] = atlas.items.filter(item => item.place === place.id && (era === 'all' || !item.age || item.age === 'both' || item.age === era)).map(m => {
    const base = { id: m.id, filter: atlasCategories[m.cat], icon: categoryIcons[atlasCategories[m.cat]] ?? atlasIcons[m.cat], kind: kindOf(m.cat), name: m.name, at: m.at ?? undefined, images: m.images };
    const row = rowsById.get(state.atlasLinks?.[m.id] ?? '');
    // A marker with a checklist row shows that row: same status, same hand tick, same description.
    if (row) return { ...base, item: row, status: rowStatus(row) === 'unknown' ? status[m.id] ?? 'unknown' : rowStatus(row), tick: row.state !== 'yes' ? { id: row.id, on: row.done } : undefined };
    // Detected in the save: nothing to tick. Otherwise tick (or untick a hand tick).
    return { ...base, status: status[m.id] ?? 'unknown', tick: status[m.id] !== 'done' || state.atlasManual?.[m.id] ? { id: m.id, on: !!state.atlasManual?.[m.id] } : undefined };
  });
  const trackedPins: Pin[] = tracked.map(p => ({
    id: p.item.id + '@' + p.at.map, filter: p.cat.id, icon: categoryIcons[p.cat.id], kind: t(p.cat.label), name: p.item.name, at: p.at, images: [], item: p.item,
    tick: p.item.state !== 'yes' ? { id: p.item.id, on: p.item.done } : undefined,
    status: rowStatus(p.item),
  }));
  const pool = [...atlasPins, ...trackedPins].filter(p => filter === 'all' || p.filter === filter);
  const doneCount = pool.filter(m => m.status === 'done').length;
  const markers = pool.filter(m => (!hideDone || m.status !== 'done') &&
    (show === 'all' || (show === 'done' ? m.status === 'done' : m.status !== 'done')));
  const selected = markers.find(item => item.id === active);
  const select = (id: string) => {
    setActive(id);
    setShot(0);
    const item = pool.find(p => p.id === id)?.item;
    if (item && item.id !== focusItem) onPickItem?.(item);
  };
  // A row picked outside the map: open its floor and its marker.
  useEffect(() => {
    // A row can have a marker on several floors (child and adult): keep the floor on screen when it has one.
    const pins = focusItem ? pool.filter(p => p.item?.id === focusItem && p.at) : [];
    const pin = pins.find(p => p.at!.map === currentFloor?.id) ?? pins[0];
    if (!pin || pins.some(p => p.id === active)) return;
    setFloor(pin.at!.map);
    setActive(pin.id);
    setShot(0);
  }, [focusItem]);
  const statusLabel = (s: Pin['status']) => t(s === 'done' ? 'Coletado' : s === 'todo' ? 'Pendente' : 'Situação não mapeada');
  const docked = useMatches(DOCKED_CARD);
  // Beside its marker on a large screen. On phones and touch screens it docks to the map's edge away from the marker,
  // outside the zoom layer, so it stays on screen at any zoom and scrolls with a finger.
  const onMap = !!(currentFloor && selected?.at?.map === currentFloor.id && selected.at);
  const card = selected && (onMap || !currentFloor) && <div role="dialog" aria-label={t(selected.name)} className={!currentFloor ? 'marker-card map-unmapped-card' : docked ? `marker-card docked ${selected.at!.y > 0.5 ? 'docked-top' : 'docked-bottom'}` : 'marker-card'}
    style={!currentFloor ? undefined : docked ? (selected.at!.y > 0.5 ? { top: 8 } : { bottom: 8 }) : {
      transformOrigin: `${selected.at!.x > 0.5 ? 'right' : 'left'} ${selected.at!.y > 0.5 ? 'bottom' : 'top'}`,
      ...(selected.at!.x > 0.5 ? { right: `calc(${(1 - selected.at!.x) * 100}% + 16px)` } : { left: `calc(${selected.at!.x * 100}% + 16px)` }),
      ...(selected.at!.y > 0.5 ? { bottom: `max(8px, calc(${(1 - selected.at!.y) * 100}% - 40px))` } : { top: `max(8px, calc(${selected.at!.y * 100}% - 40px))` }),
    }}>
    <div className="marker-card-head">
      <span className="marker-kind"><GameItemIcon id={selected.icon} size={15} />{selected.kind}</span>
      <button className="marker-close" aria-label={t('Fechar')} onClick={() => setActive('')}>×</button>
    </div>
    <h3><ObjectiveName done={selected.status === 'done'}>{t(selected.name)}</ObjectiveName></h3>
    <small className={`marker-status ${selected.status}`}>{statusLabel(selected.status)}</small>
    {selected.item?.where && <p className="marker-where">{t(selected.item.where)}</p>}
    <div className="result-actions">
      {selected.tick && <button className="action" onClick={() => void api.toggleManual(selected.tick!.id)}>{selected.tick.on ? t('Desmarcar') : t('Concluí')}</button>}
      {selected.item && onShowInChecklist && <button className="small-btn" onClick={() => onShowInChecklist(selected.item!.id)}>{t('Ver na checklist')}</button>}
    </div>
    {!!selected.images.length && <div className="marker-photo">
      <img src={selected.images[shot]} alt={t("Local no jogo")} />
      {selected.images.length > 1 && <>
        <button className="photo-nav prev" aria-label={t("Foto anterior")} onClick={() => setShot((shot + selected.images.length - 1) % selected.images.length)}>‹</button>
        <button className="photo-nav next" aria-label={t("Próxima foto")} onClick={() => setShot((shot + 1) % selected.images.length)}>›</button>
        <span className="photo-count">{shot + 1}/{selected.images.length}</span>
      </>}
    </div>}
  </div>;
  const markerFilter = !!pool.length && <div className="marker-filter" role="radiogroup" aria-label={t("Mostrar no mapa")}>
    {([['all', 'Todos', pool.length], ['todo', 'Faltam', pool.length - doneCount], ['done', 'Coletados', doneCount]] as const).map(([id, label, n]) =>
      <button key={id} role="radio" aria-checked={show === id} className={`filter-${id}`} onClick={() => { setShow(id); setActive(''); }}>{t(label)} <b>{n}</b></button>)}
  </div>;
  const floorSelect = place.maps.length > 1 && currentFloor && <label className="map-region map-floor"><span>{t("Andar / era")}</span><select value={currentFloor.id} onChange={e => { setFloor(e.target.value); select(''); }}>{place.maps.map(m => <option key={m.id} value={m.id}>{t(m.label)}</option>)}</select></label>;
  const eraLabel = t(eras.find(([id]) => id === era)?.[1] ?? 'Todas');
  const pickEra = (event: MouseEvent<HTMLButtonElement>) => {
    // A click picks the side it lands on. Enter and Space carry no position (detail 0): they step all, child, adult.
    if (!event.detail) onEra(era === 'all' ? 'child' : era === 'child' ? 'adult' : 'all');
    else {
      const box = event.currentTarget.getBoundingClientRect();
      const next: Era = event.clientX > box.left + box.width / 2 ? 'adult' : 'child';
      onEra(era === next ? 'all' : next);
    }
    setActive('');
  };
  const eraName = `${t('Era')}: ${eraLabel}`;
  const eraChoice = <button type="button" className={`era-toggle era-${era}`} aria-label={eraName} title={eraName} onClick={pickEra}>
    <span className="era-toggle-track">
      <span className="era-toggle-knob" aria-hidden="true" />
      <span className="era-toggle-face era-child" aria-hidden="true"><svg viewBox="0 0 16 16"><circle cx="8" cy="5.2" r="2.15" /><path d="M4.5 13.6c.35-2.5 1.7-3.7 3.5-3.7s3.15 1.2 3.5 3.7z" /></svg></span>
      <span className="era-toggle-face era-adult" aria-hidden="true"><svg viewBox="0 0 16 16"><path d="M3.2 4.6h9.6c-.2.9-1.3 1.5-2.3 1.5H5.5C4.5 6.1 3.4 5.5 3.2 4.6z" /><circle cx="8" cy="7.1" r="1.9" /><path d="M4.2 14c.5-2.6 1.9-3.8 3.8-3.8s3.3 1.2 3.8 3.8z" /></svg></span>
    </span>
    <span className="era-toggle-label">{eraLabel}</span>
  </button>;
  const mapTools = <MapHud open={hudOpen} onToggle={onHud} where={<>
      {onBack && <button type="button" className="map-back" aria-label={t('Voltar ao mapa de Hyrule')} title={t('Voltar ao mapa de Hyrule')} onClick={onBack}><Icon name="map" size={16} /></button>}
      {regionMenu}
      {floorSelect}
    </>} how={<>
      {markerFilter}
      {eraChoice}
      <span className="map-hud-divider" aria-hidden="true" />
      {mapModes}
    </>} />;
  return <div className="region-atlas">
    {currentFloor ? <ZoomPan key={currentFloor.id} ratio={currentFloor.aspect ?? 1.6} className="floor-map" controls={controls} overlay={<>{mapTools}{overlay}{docked && card}</>}>
      <div className="floor-fill" aria-label={t("Mapa da região")}
        onClick={e => { if (e.target === e.currentTarget || (e.target as HTMLElement).classList.contains('map-art')) setActive(''); }}>
        <img className="map-art" src={currentFloor.image} alt="" draggable={false} />
        {markers.filter(m => m.at?.map === currentFloor.id).map(m => {
          const tipBelow = m.at!.y < 0.22;
          return <button key={m.id} aria-label={`${m.kind}: ${t(m.name)} · ${statusLabel(m.status)}`} aria-pressed={active === m.id} aria-expanded={active === m.id}
            className={`plot-point atlas-marker ${m.status}`} style={{ left: `${m.at!.x * 100}%`, top: `${m.at!.y * 100}%` }}
            onClick={() => active === m.id ? setActive('') : select(m.id)}>
            <GameItemIcon id={m.icon} size={14} />
            {active !== m.id && <span className={`marker-tip ${tipBelow ? 'below' : ''} ${m.at!.x > 0.75 ? 'end' : m.at!.x < 0.25 ? 'start' : ''}`} aria-hidden="true">
              <span className="marker-kind"><GameItemIcon id={m.icon} size={13} />{m.kind}</span>
              <b>{t(m.name)}</b>
              <small className={`marker-status ${m.status}`}>{statusLabel(m.status)}</small>
            </span>}
          </button>;
        })}
        {here?.at && here.mapId === currentFloor.id && <PlayerPin at={here.at} yaw={here.yaw} live={here.source === 'live'} />}
        {!docked && card}
      </div>
    </ZoomPan> : <div className="zoom-viewport map-unmapped">
      {mapTools}
      {overlay}
      <div className="map-unmapped-pick">
        {markers.length ? <label className="inline-field marker-pick">{t("Mostrar local")}<select value={selected ? active : ''} onChange={e => select(e.target.value)}><option value="">{t("Escolha um marcador")}</option>{markers.map(m => <option key={m.id} value={m.id} className={m.status === 'done' ? 'completed-title' : undefined}>{m.status === 'done' && '✓ '}{m.kind}: {t(m.name)}</option>)}</select></label> : <p className="map-unmapped-note">{t('Esta região não tem mapa próprio.')}</p>}
        {card}
      </div>
    </div>}
    {!!currentFloor && !!markers.length && <label className="inline-field marker-pick">{t("Mostrar local")}<select value={selected ? active : ''} onChange={e => {
      const next = markers.find(m => m.id === e.target.value);
      if (next?.at?.map) setFloor(next.at.map);
      select(e.target.value);
    }}><option value="">{t("Escolha um marcador")}</option>{markers.map(m => <option key={m.id} value={m.id} className={m.status === 'done' ? 'completed-title' : undefined}>{m.status === 'done' && '✓ '}{m.kind}: {t(m.name)}</option>)}</select></label>}
  </div>;
}

function Threads({ state }: { state: AppState }) {
  const chapters = state.companion?.chapters ?? [];
  const side = state.categories.find(c => c.id === 'side_quests');
  const stages = chapters.flatMap(chapter => chapter.stages);
  const done = stages.filter(stage => stage.done).length + (side?.done ?? 0);
  const total = stages.length + (side?.total ?? 0);
  return <div>
    <PageProgress done={done} total={total} />
    <div className="story-grid">
      <section className="focus-panel"><h2>{t("História principal")}</h2>
        {chapters.length ? chapters.map(c => <details className="story-chapter" key={c.id}>
          <summary><span className={c.stages.every(s => s.done) ? 'story-dot done' : 'story-dot'} /><ObjectiveName done={c.stages.every(s => s.done)}>{t(c.title)}</ObjectiveName><small>{c.stages.filter(s => s.done).length}/{c.stages.length}</small></summary>
          <ul>{c.stages.map(s => <li key={s.label}><span><ObjectiveName done={s.done}>{t(s.label)}</ObjectiveName></span><small>{s.done ? t('Concluído') : s.started ? t('Em andamento') : t('Aguardando')}</small></li>)}</ul>
        </details>) : <p className="quiet">{t("Encontre um save para ver a história.")}</p>}
      </section>
      <section className="focus-panel"><h2>{t("Missões secundárias")}{' '}{side && <small>{side.done}/{side.total}</small>}</h2>
        {side?.items.length ? side.items.map(i => {
          const sold = i.id === 'side_quests.happy_mask_shopkeeper' ? state.companion?.maskSales : null;
          const fountains = i.id === 'side_quests.to_the_great_fairy' ? state.categories.find(c => c.id === 'great_fairies') : undefined;
          const status = i.done ? 'Concluído' : sold || fountains?.done ? 'Em andamento' : i.state === 'unknown' ? 'Situação não mapeada' : 'Aguardando';
          return (
            <details className="story-chapter side-quest" key={i.id}>
              <summary>
                <span className={i.done ? 'story-dot done' : 'story-dot'} aria-hidden="true" />
                <b><ObjectiveName done={i.done}>{t(i.name)}</ObjectiveName></b>
                <small>{t(status)}{sold != null && ` · ${sold}/${MASK_SALE_NAMES.length}`}{fountains && ` · ${fountains.done}/${fountains.total}`}</small>
              </summary>
              <p>{t(i.where ?? 'Detalhes da missão indisponíveis.')}</p>
              {sold != null && <ul aria-label={t('Vendas de máscaras')}>{MASK_SALE_NAMES.map((mask, index) => (
                <li key={mask}>
                  <span><ObjectiveName done={index < sold}>{t(mask)}</ObjectiveName></span>
                  <small>{t(index < sold ? 'Vendida' : 'Aguardando')}</small>
                </li>
              ))}</ul>}
              {fountains && <ul aria-label={t('Grandes Fadas')}>{fountains.items.map(f => (
                <li key={f.id}>
                  <span><ObjectiveName done={f.done}>{t(f.name)}</ObjectiveName></span>
                  <small>{t(f.done ? 'Concluído' : 'Aguardando')}</small>
                </li>
              ))}</ul>}
            </details>
          );
        }) : <p className="quiet">{t("Encontre um save para ver as missões secundárias.")}</p>}
      </section>
    </div>
  </div>;
}

const hallTabs = [['statues', 'Estátuas'], ['rematches', 'Revanches'], ['trials', 'Provações']] as const;

function Hall({ state }: { state: AppState }) {
  const [tab, setTab] = useState<typeof hallTabs[number][0]>('statues');
  const categories = state.categories.filter(category => hallTabs.some(([id]) => category.id === id));
  const cat = categories.find(category => category.id === tab);
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<string>();
  const highlighted = cat?.items.find(item => item.id === selected);
  const highlightedPhoto = highlighted ? enemyPhoto(highlighted.id, highlighted.name) : undefined;
  // The photo opens above the list; on a long list (phones) the tapped row is far below it.
  // Closing it brings that row back into view so the reader keeps their place.
  const focusRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => { if (selected) focusRef.current?.scrollIntoView({ block: 'nearest' }); }, [selected]);
  const closeFocus = () => {
    const row = selected ? listRef.current?.querySelector<HTMLElement>(`[data-hall-id="${CSS.escape(selected)}"]`) : null;
    setSelected(undefined);
    if (row) requestAnimationFrame(() => row.scrollIntoView({ block: 'center' }));
  };
  const done = categories.reduce((count, category) => count + category.done, 0);
  const total = categories.reduce((count, category) => count + category.total, 0);
  return <div>
    <PageProgress done={done} total={total} />
    <section className="focus-panel hall-panel">
      <div className="section-line"><h2>{t(cat?.label ?? 'Salão dos Inimigos')}</h2>{cat && <b>{cat.done}/{cat.total}</b>}</div>
      <div className="segment">{hallTabs.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{t(label)}</button>)}</div>
      {tab !== 'trials' && <label className="inline-field">{t("Buscar inimigo")}<input type="search" value={query} onChange={e => setQuery(e.target.value)} /></label>}
      {highlightedPhoto && <div className="enemy-focus" ref={focusRef}><img src={highlightedPhoto.file} alt={highlighted?.name} /><div><h3><ObjectiveName done={highlighted?.done}>{highlighted?.name}</ObjectiveName></h3><span>{highlighted?.done ? t('Obtido') : t('Pendente')}</span></div><button className="action" onClick={closeFocus}>{t("Fechar")}</button></div>}
      <div className="hall-list" ref={listRef}>{cat?.items.filter(i => tab === 'trials' || i.name.toLowerCase().includes(query.toLowerCase())).map(i => {
        const trial = state.companion?.trials.find(t => i.id.endsWith('.' + t.id));
        const rematch = state.companion?.rematches.find(r => r.id === i.id);
        const frames = trial?.frames ?? rematch?.frames;
        const photo = enemyPhoto(i.id, i.name);
        return <div className="hall-row" key={i.id} data-hall-id={i.id}><span className={i.done ? 'story-dot done' : 'story-dot'} />{photo && <button className="enemy-thumb" aria-label={i.name} onClick={() => setSelected(i.id)}><img src={photo.file} alt="" loading="lazy" /></button>}<b><ObjectiveName done={i.done}>{t(i.name)}</ObjectiveName></b>
          <span>{i.done && frames != null && frames > 0 && frames < 216000 ? `${t('Recorde')} · ${number(frames / 60)} s` : i.done ? t('Concluído') : i.state === 'unknown' ? t('Indisponível') : t('Pendente')}</span>
        </div>;
      })}</div>
      {!cat && <p className="quiet">{t("Encontre um save para ver o Salão.")}</p>}
    </section>
  </div>;
}

function dayStamp(ts = Date.now()) { const d = new Date(ts); return [d.getFullYear(), d.getMonth() + 1, d.getDate()].map(n => String(n).padStart(2, '0')).join('-'); }
function activityText(a: Activity) {
  return [...(a.hearts ? [plural(a.hearts, '+{n} Coração', '+{n} Corações')] : []), ...(a.pieces ? [plural(a.pieces, '+{n} Pedaço de coração', '+{n} Pedaços de coração')] : []),
    ...a.entries.slice(0, 4).map(e => t(e)), ...(a.enemies ? [plural(a.enemies, '+{n} inimigo', '+{n} inimigos')] : []), ...(a.rupees ? [plural(a.rupees, '+{n} Rupee', '+{n} Rupees')] : [])].join(' · ');
}
function ActivityList({ activity, photos = false }: { activity: Activity[]; photos?: boolean }) {
  return <ol className="activity-list">{activity.map((a, index) => <li key={`${a.ms}-${index}`}>
    <time>{hour(a.ms)}</time><div><b>{activityText(a)}</b><small>{t(a.area ?? 'Hyrule')} · {t(a.source === 'live' ? 'Ao vivo' : 'Último save')}</small></div>
    {photos && a.screenshot && <img src={a.screenshot} alt={t("Captura do momento")} />}
  </li>)}</ol>;
}
function Timeline({ state }: { state: AppState }) {
  // Follows today (also past midnight) until the user picks another day.
  const [picked, setDay] = useState<string>();
  const day = picked ?? dayStamp();
  const events = (state.activity ?? []).filter(a => dayStamp(a.ms) === day);
  const totals = events.reduce((a, e) => [a[0] + (e.enemies ?? 0), a[1] + (e.rupees ?? 0), a[2] + (e.pieces ?? 0)], [0, 0, 0]);
  return <section className="focus-panel timeline-panel"><div className="section-line"><h2>{t("Atividade da partida")}</h2><label className="inline-field">{t("Dia")}{' '}<input type="date" value={day} onChange={e => setDay(e.target.value)} /></label></div>
    <div className="timeline-stats"><span><b>{totals[0]}</b>{t("inimigos contabilizados")}</span><span><b><GameItemIcon id="rupee" /> {totals[1]}</b>{t("rupees de ganhos observados")}</span><span><b><GameItemIcon id="heart_piece" /> {totals[2]}</b>{t("pedaços registrados")}</span></div>
    {events.length ? <ActivityList activity={events} photos /> : <p className="quiet">{t("Nenhum avanço foi registrado neste dia com o tracker aberto.")}</p>}
  </section>;
}

function Medals({ state }: { state: AppState }) {
  const s = state.summary;
  const chests = state.categories.find(c => c.id === 'chests');
  const statues = state.categories.find(c => c.id === 'statues');
  const milestones = [
    ['Corações', s?.hearts, [5,10,15,20]], ['Skulltulas douradas', s?.tokens, [10,30,50,100]],
    ['Baús abertos', chests?.done, [20,50,100,chests?.total ?? 206]], ['Estátuas', statues?.done, [20,40,60,84]],
    ['Inimigos derrotados', state.companion?.enemies, [50,100,250,500]], ['Checklist (%)', s?.percent, [25,50,75,100]],
  ] as const;
  return <section className="focus-panel"><h2>{t("Medalhas da jornada")}</h2><p className="quiet">{t("Marcos locais calculados a partir do seu progresso.")}</p>
    <div className="medal-list">{milestones.map(([name, n, thresholds]) => <div className="medal-row" key={name}>
      <div><b>{t(name)}</b><small>{value(n)}</small></div>{thresholds.map(x => {
        const earned = n != null && n >= x;
        return <span className={earned ? 'medal earned' : 'medal'} key={x} title={t(earned ? 'Medalha conquistada' : 'Medalha pendente')}><Icon name="medals" /><ObjectiveName done={earned}>{x}</ObjectiveName></span>;
      })}
    </div>)}</div>
  </section>;
}
