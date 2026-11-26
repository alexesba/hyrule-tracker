import { callable, definePlugin, FileSelectionType, openFilePicker, routerHook } from '@decky/api';
import { ButtonItem, Focusable, GamepadButton, Navigation, PanelSection, PanelSectionRow, staticClasses, type GamepadEvent } from '@decky/ui';
import { useEffect, useRef, useState, type CSSProperties } from 'react';
import logo from '../../src/renderer/public/brand/icon-256.png';

const route = '/decky-hyrule-tracker';
const getTracker = callable<[], { url: string; home: string }>('get_tracker');
const getLog = callable<[], string>('get_log');
const pt = navigator.language.startsWith('pt');
const text = (ptText: string, en: string) => pt ? ptText : en;
const directions: Partial<Record<GamepadButton, string>> = {
  [GamepadButton.DIR_UP]: 'up',
  [GamepadButton.DIR_DOWN]: 'down',
  [GamepadButton.DIR_LEFT]: 'left',
  [GamepadButton.DIR_RIGHT]: 'right',
};
/** How long the page may take to say it is ready once the tracker answered. */
const LOAD_MS = 20_000;

type Stage = 'starting' | 'loading' | 'ready' | 'failed';
interface Failure { stage: 'starting' | 'loading'; error?: string; log?: string }

/**
 * Starts the tracker (or reuses it) and follows its page in an iframe: the stage it is at, and when it fails, where
 * and the end of its log, so a screenshot says what went wrong.
 */
function useTracker(frame: React.RefObject<HTMLIFrameElement | null>, onBack: () => void) {
  const [tracker, setTracker] = useState<Awaited<ReturnType<typeof getTracker>>>();
  const [stage, setStage] = useState<Stage>('starting');
  const [failure, setFailure] = useState<Failure>();
  const [attempt, setAttempt] = useState(0);
  /** The direction the page had nothing further in: the next press of it goes to Steam. */
  const edge = useRef<string | null>(null);

  function fail(at: Failure['stage'], error?: string) {
    setStage('failed');
    void getLog().catch(() => '').then(log => setFailure({ stage: at, error, log: log || undefined }));
  }

  useEffect(() => {
    let current = true;
    void getTracker().then(result => {
      if (!current) return;
      setTracker(result);
      setStage('loading');
    }).catch((e: unknown) => { if (current) fail('starting', String((e as Error)?.message ?? e)); });
    return () => { current = false; };
  }, [attempt]);

  // Whether the iframe got any page at all: tells a blocked address from a page whose script didn't answer.
  const frameLoaded = useRef(false);
  useEffect(() => {
    if (stage !== 'loading') return;
    frameLoaded.current = false;
    const timer = setTimeout(() => fail('loading', frameLoaded.current
      ? text('A página abriu, mas não respondeu.', 'The page opened but did not answer.')
      : text('O menu do Steam não abriu a página.', 'The Steam menu did not open the page.')), LOAD_MS);
    return () => clearTimeout(timer);
  }, [stage, attempt]);

  useEffect(() => {
    if (!tracker) return;
    const { url, home } = tracker;
    const origin = new URL(url).origin;
    let picking = false;
    async function receive(event: MessageEvent) {
      const source = frame.current?.contentWindow;
      if (!source || event.source !== source || event.origin !== origin) return;
      const type = event.data?.type;
      if (type === 'hyrule:ready') { setStage('ready'); setFailure(undefined); }
      if (type === 'hyrule:moved') edge.current = typeof event.data.edge === 'string' ? event.data.edge : null;
      if (type === 'hyrule:back') onBack();
      if (type !== 'hyrule:pick-folder' || picking) return;
      picking = true;
      let path: string | undefined;
      try {
        const picked = await openFilePicker(FileSelectionType.FOLDER, home);
        path = picked?.realpath || picked?.path;
      } catch { /* picker dismissed */ }
      finally {
        picking = false;
        source.postMessage({ type: 'hyrule:folder-selected', path }, origin);
      }
    }
    window.addEventListener('message', receive);
    return () => window.removeEventListener('message', receive);
  }, [tracker]);

  function send(action: string) {
    if (!tracker || stage !== 'ready') return false;
    frame.current?.contentWindow?.postMessage({ type: 'hyrule:control', action }, new URL(tracker.url).origin);
    return true;
  }

  /** A d-pad press for the page. With `release`, a press the page had nothing further in is left to Steam. */
  function direction(event: GamepadEvent, release: boolean) {
    const action = directions[event.detail.button];
    if (!action) return;
    if (release && edge.current === action) { edge.current = null; return; }
    if (!send(action)) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function press(event: GamepadEvent, action: string) {
    if (!send(action)) return;
    event.preventDefault();
    event.stopPropagation();
  }

  function retry() {
    setTracker(undefined);
    setFailure(undefined);
    setStage('starting');
    edge.current = null;
    setAttempt(n => n + 1);
  }

  return { tracker, stage, failure, direction, press, retry, onFrameLoad: () => { frameLoaded.current = true; } };
}

function openInBrowser(url: string | undefined) {
  if (!url) return;
  Navigation.NavigateToExternalWeb(url);
  Navigation.CloseSideMenus();
}

function Status({ stage, failure, url, onRetry }: { stage: Stage; failure?: Failure; url?: string; onRetry: () => void }) {
  const message = stage === 'starting' ? text('Iniciando o tracker…', 'Starting the tracker…')
    : stage === 'loading' ? text('Carregando o diário…', 'Loading the journal…')
    : failure?.stage === 'starting' ? text('O tracker não iniciou.', "The tracker didn't start.")
    : text('O tracker iniciou, mas a página não carregou.', 'The tracker started, but its page did not load.');
  return <>
    <PanelSectionRow><p role="status" style={{ margin: 0 }}>{message}</p></PanelSectionRow>
    {stage === 'failed' && failure?.error && <PanelSectionRow><p style={{ margin: 0, opacity: 0.8, wordBreak: 'break-word' }}>{failure.error}</p></PanelSectionRow>}
    {stage === 'failed' && failure?.log && <PanelSectionRow>
      <pre style={{ margin: 0, maxHeight: 160, overflow: 'auto', fontSize: 10, whiteSpace: 'pre-wrap', wordBreak: 'break-word', opacity: 0.8 }}>{failure.log}</pre>
    </PanelSectionRow>}
    {stage === 'failed' && <PanelSectionRow><ButtonItem layout="below" onClick={onRetry}>{text('Tentar novamente', 'Try again')}</ButtonItem></PanelSectionRow>}
    {stage === 'failed' && url && <PanelSectionRow><ButtonItem layout="below" onClick={() => openInBrowser(url)}>{text('Abrir no navegador do Steam', 'Open in the Steam browser')}</ButtonItem></PanelSectionRow>}
  </>;
}

function Frame({ url, ready, frame, style, onLoad }: { url?: string; ready: boolean; frame: React.RefObject<HTMLIFrameElement | null>; style: CSSProperties; onLoad: () => void }) {
  if (!url) return null;
  return <iframe ref={frame} src={url} title="Hyrule Tracker" allowFullScreen onLoad={onLoad}
    style={{ display: 'block', width: '100%', border: 0, visibility: ready ? 'visible' : 'hidden', ...style }} />;
}

/** The journal inside the quick access menu, in the phone layout its width calls for. */
function QuickPanel() {
  const frame = useRef<HTMLIFrameElement>(null);
  const t = useTracker(frame, () => undefined);
  const [focused, setFocused] = useState(false);
  const ready = t.stage === 'ready';
  return <>
    <PanelSection>
      <PanelSectionRow><ButtonItem layout="below" onClick={() => { Navigation.Navigate(route); Navigation.CloseSideMenus(); }}>
        {text('Tela cheia', 'Full screen')}
      </ButtonItem></PanelSectionRow>
      {!ready && <Status stage={t.stage} failure={t.failure} url={t.tracker?.url} onRetry={t.retry} />}
    </PanelSection>
    {/* The d-pad and A go to the page while it has focus. B stays with Steam, which closes the menu. */}
    <Focusable noFocusRing onGamepadFocus={() => setFocused(true)} onGamepadBlur={() => setFocused(false)}
      onGamepadDirection={e => t.direction(e, true)} onOKButton={e => t.press(e, 'activate')}
      style={{ margin: '0 -16px', borderRadius: 4, outline: focused && ready ? '2px solid #8bddac' : 'none', height: ready ? undefined : 0, overflow: 'hidden' }}>
      <Frame url={t.tracker?.url} ready={ready} frame={frame} onLoad={t.onFrameLoad} style={{ height: 'min(620px, calc(100vh - 210px))' }} />
    </Focusable>
  </>;
}

/** Full screen, from the menu's button: the same journal at the size of the screen. */
function TrackerPage() {
  const frame = useRef<HTMLIFrameElement>(null);
  const t = useTracker(frame, () => Navigation.NavigateBack());
  const ready = t.stage === 'ready';
  return <Focusable preferredFocus noFocusRing onGamepadDirection={e => t.direction(e, false)}
    onOKButton={e => t.press(e, 'activate')} onCancelButton={e => t.press(e, 'back')}
    style={{ position: 'absolute', inset: 0, background: '#151515', display: 'grid', alignItems: 'center' }}>
    <Frame url={t.tracker?.url} ready={ready} frame={frame} onLoad={t.onFrameLoad} style={{ position: 'absolute', inset: 0, height: '100%' }} />
    {!ready && <PanelSection title="Hyrule Tracker">
      <Status stage={t.stage} failure={t.failure} url={t.tracker?.url} onRetry={t.retry} />
      <PanelSectionRow><ButtonItem layout="below" onClick={() => Navigation.NavigateBack()}>{text('Voltar', 'Back')}</ButtonItem></PanelSectionRow>
    </PanelSection>}
  </Focusable>;
}

export default definePlugin(() => {
  routerHook.addRoute(route, TrackerPage, { exact: true });
  return {
    name: 'Hyrule Tracker',
    titleView: <div className={staticClasses.Title}>Hyrule Tracker</div>,
    icon: <img src={logo} width={22} height={22} alt="" />,
    content: <QuickPanel />,
    onDismount: () => routerHook.removeRoute(route),
  };
});
