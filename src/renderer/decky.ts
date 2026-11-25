export const inDecky = typeof window !== 'undefined' && window.parent !== window && new URLSearchParams(location.search).has('decky');

type Direction = 'up' | 'down' | 'left' | 'right';
const directions = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' } as const;
const controls = 'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), summary, [tabindex="0"]';

function activeDialog() {
  return Array.from(document.querySelectorAll<HTMLDialogElement>('dialog[open]')).at(-1);
}

/** Moves focus to the nearest control that way. False when there is none: the plugin hands the direction back to Steam. */
function moveFocus(direction: Direction): boolean {
  const items = Array.from((activeDialog() ?? document).querySelectorAll<HTMLElement>(controls)).filter(el => el.getClientRects().length);
  const active = document.activeElement;
  if (!(active instanceof HTMLElement) || !items.includes(active)) {
    items[0]?.focus();
    return !!items[0];
  }
  const from = active.getBoundingClientRect();
  const horizontal = direction === 'left' || direction === 'right';
  const sign = direction === 'up' || direction === 'left' ? -1 : 1;
  let closest: HTMLElement | undefined;
  let score = Infinity;
  for (const item of items) {
    const to = item.getBoundingClientRect();
    const dx = to.x + to.width / 2 - (from.x + from.width / 2);
    const dy = to.y + to.height / 2 - (from.y + from.height / 2);
    const forward = (horizontal ? dx : dy) * sign;
    const distance = forward + Math.abs(horizontal ? dy : dx) * 2;
    if (item === active || forward <= 1 || distance >= score) continue;
    closest = item;
    score = distance;
  }
  closest?.focus();
  closest?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  return !!closest;
}

export function chooseDeckyFolder(): Promise<string | undefined> {
  return new Promise(resolve => {
    function receive(event: MessageEvent) {
      if (event.source !== window.parent || event.data?.type !== 'hyrule:folder-selected') return;
      clearTimeout(timeout);
      window.removeEventListener('message', receive);
      resolve(typeof event.data.path === 'string' ? event.data.path : undefined);
    }
    const timeout = setTimeout(() => {
      window.removeEventListener('message', receive);
      resolve(undefined);
    }, 300_000);
    window.addEventListener('message', receive);
    window.parent.postMessage({ type: 'hyrule:pick-folder' }, '*');
  });
}

export function enableDeckyNavigation() {
  if (!inDecky) return;
  document.addEventListener('pointerdown', () => document.documentElement.classList.remove('decky-controller-focus'));
  window.addEventListener('message', event => {
    if (event.source !== window.parent || event.data?.type !== 'hyrule:control') return;
    const { action } = event.data;
    if (action === 'up' || action === 'down' || action === 'left' || action === 'right') {
      document.documentElement.classList.add('decky-controller-focus');
      // Nothing further that way: in the quick access menu the plugin lets Steam take the next press.
      window.parent.postMessage({ type: 'hyrule:moved', edge: moveFocus(action) ? null : action }, '*');
    }
    if (action === 'activate' && document.activeElement instanceof HTMLElement) document.activeElement.click();
    if (action === 'back') {
      const dialog = activeDialog();
      if (!dialog) window.parent.postMessage({ type: 'hyrule:back' }, '*');
      else if (typeof dialog.requestClose === 'function') dialog.requestClose();
      else if (dialog.dispatchEvent(new Event('cancel', { cancelable: true }))) dialog.close();
    }
  });
  document.addEventListener('keydown', event => {
    const target = event.target;
    const direction = directions[event.key as keyof typeof directions];
    if (!direction || event.defaultPrevented || (target instanceof HTMLElement && target.matches('input, textarea, select, [contenteditable]'))) return;
    event.preventDefault();
    moveFocus(direction);
  });
  window.parent.postMessage({ type: 'hyrule:ready' }, '*');
}
