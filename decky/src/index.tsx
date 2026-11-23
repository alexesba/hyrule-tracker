import { callable, definePlugin, FileSelectionType, openFilePicker, routerHook } from '@decky/api';
import { ButtonItem, Focusable, GamepadButton, Navigation, PanelSection, PanelSectionRow, staticClasses, type GamepadEvent } from '@decky/ui';
import { useEffect, useRef, useState } from 'react';
import logo from '../../src/renderer/public/brand/icon-256.png';

const route = '/decky-hyrule-tracker';
const getTracker = callable<[], { url: string; home: string }>('get_tracker');
const pt = navigator.language.startsWith('pt');
const commands: Partial<Record<GamepadButton, string>> = {
  [GamepadButton.DIR_UP]: 'up',
  [GamepadButton.DIR_DOWN]: 'down',
  [GamepadButton.DIR_LEFT]: 'left',
  [GamepadButton.DIR_RIGHT]: 'right',
  [GamepadButton.OK]: 'activate',
  [GamepadButton.CANCEL]: 'back',
};

function TrackerPage() {
  const iframe = useRef<HTMLIFrameElement>(null);
  const [tracker, setTracker] = useState<Awaited<ReturnType<typeof getTracker>>>();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let current = true;
    void getTracker().then(result => {
      if (current) setTracker(result);
    }).catch(() => { if (current) setFailed(true); });
    return () => { current = false; };
  }, [attempt]);

  useEffect(() => {
    if (ready) return;
    const timer = setTimeout(() => setFailed(true), 15_000);
    return () => clearTimeout(timer);
  }, [attempt, ready]);

  useEffect(() => {
    if (!tracker) return;
    const { url, home } = tracker;
    const origin = new URL(url).origin;
    let picking = false;
    async function receive(event: MessageEvent) {
      const source = iframe.current?.contentWindow;
      if (!source || event.source !== source || event.origin !== origin) return;
      if (event.data?.type === 'hyrule:ready') { setReady(true); setFailed(false); }
      if (event.data?.type === 'hyrule:back') Navigation.NavigateBack();
      if (event.data?.type !== 'hyrule:pick-folder' || picking) return;
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

  function forward(event: GamepadEvent) {
    const action = commands[event.detail.button];
    if (!action || !tracker || !ready) return;
    event.preventDefault();
    event.stopPropagation();
    iframe.current?.contentWindow?.postMessage({ type: 'hyrule:control', action }, new URL(tracker.url).origin);
  }

  function retry() {
    setTracker(undefined);
    setFailed(false);
    setReady(false);
    setAttempt(n => n + 1);
  }

  return <Focusable preferredFocus noFocusRing onGamepadDirection={forward} onOKButton={forward} onCancelButton={forward}
    style={{ position: 'absolute', inset: 0, background: '#151515', display: 'grid', alignItems: 'center' }}>
    {tracker && <iframe ref={iframe} src={tracker.url} title="Hyrule Tracker" allowFullScreen
      style={{ position: 'absolute', inset: 0, display: 'block', width: '100%', height: '100%', border: 0, visibility: ready ? 'visible' : 'hidden' }} />}
    {!ready && <PanelSection title="Hyrule Tracker">
      <PanelSectionRow>
        <p role="status">{failed
          ? (pt ? 'Não foi possível abrir o tracker.' : 'Could not open the tracker.')
          : (pt ? 'Abrindo o tracker…' : 'Opening the tracker…')}</p>
      </PanelSectionRow>
      {failed && <PanelSectionRow><ButtonItem layout="below" onClick={retry}>{pt ? 'Tentar novamente' : 'Try again'}</ButtonItem></PanelSectionRow>}
      <PanelSectionRow><ButtonItem layout="below" onClick={() => Navigation.NavigateBack()}>{pt ? 'Voltar' : 'Back'}</ButtonItem></PanelSectionRow>
    </PanelSection>}
  </Focusable>;
}

export default definePlugin(() => {
  routerHook.addRoute(route, TrackerPage, { exact: true });
  return {
    name: 'Hyrule Tracker',
    titleView: <div className={staticClasses.Title}>Hyrule Tracker</div>,
    icon: <img src={logo} width={22} height={22} alt="" />,
    content: <PanelSection>
      <PanelSectionRow><ButtonItem layout="below" onClick={() => {
        Navigation.Navigate(route);
        Navigation.CloseSideMenus();
      }}>{pt ? 'Abrir Hyrule Tracker' : 'Open Hyrule Tracker'}</ButtonItem></PanelSectionRow>
    </PanelSection>,
    onDismount: () => routerHook.removeRoute(route),
  };
});
