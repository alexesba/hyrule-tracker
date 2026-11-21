import { useCallback, useEffect, useRef, useState, type CSSProperties, type PointerEvent, type MouseEvent, type ReactNode } from 'react';
import { t } from './i18n';

interface View { z: number; x: number; y: number }
const MIN_ZOOM = 1;
const MAX_ZOOM = 6;

/**
 * Resize the layer when zooming so percentage positions track the map and markers keep their size.
 * The overlay stays anchored to the viewport.
 */
export function ZoomPan({ ratio, className = '', children, overlay, controls }: { ratio: number; className?: string; children: ReactNode; overlay?: ReactNode; controls?: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const layer = useRef<HTMLDivElement>(null);
  const [view, setView] = useState<View>({ z: 1, x: 0, y: 0 });
  const dragged = useRef(false);
  const gesture = useRef<AbortController | null>(null);
  // Zoom the layer is drawn at right now: its size in the DOM includes it.
  const drawnZoom = useRef(1);
  drawnZoom.current = view.z;
  const viewRef = useRef(view);
  viewRef.current = view;

  const clamp = useCallback((v: View): View => {
    const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z));
    const b = box.current, l = layer.current;
    if (z <= MIN_ZOOM || !b || !l) return { z, x: 0, y: 0 };
    const mx = Math.abs(l.offsetWidth / drawnZoom.current * z - b.clientWidth) / 2 + 60;
    const my = Math.abs(l.offsetHeight / drawnZoom.current * z - b.clientHeight) / 2 + 60;
    return { z, x: Math.min(mx, Math.max(-mx, v.x)), y: Math.min(my, Math.max(-my, v.y)) };
  }, []);

  /** Zooms by `factor` keeping the point (qx, qy), relative to the box center, in place. */
  const zoomAt = useCallback((factor: number, qx = 0, qy = 0) => {
    setView(v => {
      const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, v.z * factor));
      const k = z / v.z;
      return clamp({ z, x: qx - (qx - v.x) * k, y: qy - (qy - v.y) * k });
    });
  }, [clamp]);

  // React registers wheel listeners as passive, so page scrolling can only be stopped with a native one.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const wheel = (e: WheelEvent) => {
      // Scrolling a card or the progress list on the map should move that list, not zoom.
      if (e.target instanceof Element && e.target.closest('.map-side, .map-cats, .marker-card, .map-hud')) return;
      if (e.deltaY > 0 && drawnZoom.current <= MIN_ZOOM) return;
      e.preventDefault();
      const r = el.getBoundingClientRect();
      zoomAt(Math.exp(-e.deltaY * 0.0015), e.clientX - r.left - r.width / 2, e.clientY - r.top - r.height / 2);
    };
    el.addEventListener('wheel', wheel, { passive: false });
    return () => el.removeEventListener('wheel', wheel);
  }, [zoomAt]);

  // The box can change size (window resized): keep the map inside it.
  useEffect(() => {
    const el = box.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const measure = () => {
      setView(v => {
        const kept = clamp(v);
        return kept.z === v.z && kept.x === v.x && kept.y === v.y ? v : kept;
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [clamp]);

  useEffect(() => () => gesture.current?.abort(), []);

  // Touch: two fingers zoom around their midpoint and pan together, one finger pans a zoomed map and a double tap
  // zooms in. One finger on an unzoomed map is left to the browser (touch-action: pan-y) so the page still scrolls.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    let mode: 'none' | 'pan' | 'pinch' = 'none';
    let start = { x: 0, y: 0, d: 1, v: { z: 1, x: 0, y: 0 } };
    let press = { t: 0, x: 0, y: 0 };
    let lastTap = { t: 0, x: 0, y: 0 };
    let moved = false;
    /** A touch point (or the midpoint of two) relative to the box center. */
    const local = (a: Touch, b?: Touch) => {
      const r = el.getBoundingClientRect();
      const x = b ? (a.clientX + b.clientX) / 2 : a.clientX, y = b ? (a.clientY + b.clientY) / 2 : a.clientY;
      return { x: x - r.left - r.width / 2, y: y - r.top - r.height / 2 };
    };
    const onChrome = (e: TouchEvent) => e.target instanceof Element && !!e.target.closest('.zoom-controls, .zoom-overlay');
    const begin = (touches: TouchList) => {
      const [a, b] = [touches[0], touches[1]];
      const v = viewRef.current;
      if (a && b) start = { ...local(a, b), d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) || 1, v };
      else if (a && v.z > MIN_ZOOM) start = { ...local(a), d: 1, v };
      mode = a && b ? 'pinch' : a && v.z > MIN_ZOOM ? 'pan' : 'none';
    };
    const touchStart = (e: TouchEvent) => {
      if (e.touches.length === 1) {
        moved = false;
        dragged.current = false;
        if (onChrome(e)) { mode = 'none'; return; }
        const t = e.touches[0];
        press = { t: e.timeStamp, x: t.clientX, y: t.clientY };
      } else {
        // A pinch ends in no click.
        moved = dragged.current = true;
        if (e.cancelable) e.preventDefault();
      }
      begin(e.touches);
    };
    const touchMove = (e: TouchEvent) => {
      // Not cancelable: the page is already scrolling with this gesture.
      if (mode === 'none' || !e.cancelable) return;
      e.preventDefault();
      const [a, b] = [e.touches[0], e.touches[1]];
      if (mode === 'pinch' && a && b) {
        const m = local(a, b), s = start;
        const z = Math.min(MAX_ZOOM, Math.max(MIN_ZOOM, s.v.z * Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) / s.d));
        const k = z / s.v.z;
        setView(clamp({ z, x: m.x - (s.x - s.v.x) * k, y: m.y - (s.y - s.v.y) * k }));
      } else if (mode === 'pan' && a) {
        const m = local(a), dx = m.x - start.x, dy = m.y - start.y;
        if (!moved && Math.hypot(dx, dy) < 6) return;
        moved = dragged.current = true;
        setView(v => clamp({ z: v.z, x: start.v.x + dx, y: start.v.y + dy }));
      }
    };
    const touchEnd = (e: TouchEvent) => {
      // One finger lifted from a pinch: the other one keeps panning.
      if (e.touches.length) { if (mode !== 'none') begin(e.touches); return; }
      mode = 'none';
      const t = e.changedTouches[0];
      const tap = t && e.type === 'touchend' && !moved && e.timeStamp - press.t < 350 && Math.hypot(t.clientX - press.x, t.clientY - press.y) < 10;
      // Double tap on the map itself (not a marker or a card) zooms in, and back out at the limit.
      if (!tap || onChrome(e) || (e.target instanceof Element && e.target.closest('button, a, select, input, [role="dialog"]'))) { lastTap.t = 0; return; }
      if (e.timeStamp - lastTap.t < 320 && Math.hypot(t.clientX - lastTap.x, t.clientY - lastTap.y) < 30) {
        lastTap.t = 0;
        if (e.cancelable) e.preventDefault();
        const q = local(t);
        if (viewRef.current.z >= MAX_ZOOM) setView({ z: 1, x: 0, y: 0 });
        else zoomAt(2, q.x, q.y);
      } else lastTap = { t: e.timeStamp, x: t.clientX, y: t.clientY };
    };
    const options = { passive: false };
    el.addEventListener('touchstart', touchStart, options);
    el.addEventListener('touchmove', touchMove, options);
    el.addEventListener('touchend', touchEnd, options);
    el.addEventListener('touchcancel', touchEnd, options);
    return () => {
      el.removeEventListener('touchstart', touchStart);
      el.removeEventListener('touchmove', touchMove);
      el.removeEventListener('touchend', touchEnd);
      el.removeEventListener('touchcancel', touchEnd);
    };
  }, [clamp, zoomAt]);

  function startDrag(e: PointerEvent<HTMLDivElement>) {
    // Fingers are handled by the touch listeners above. Controls drawn on the map are not the map.
    if (e.pointerType === 'touch' || !e.isPrimary || e.button !== 0) return;
    if (e.target instanceof Element && e.target.closest('.zoom-controls, .map-side, .map-cats, .map-cats-toggle, .marker-filter, .marker-card, .map-panel-show, .map-back, .map-hud')) return;
    gesture.current?.abort();
    dragged.current = false;
    if (view.z <= MIN_ZOOM) return;
    const controller = new AbortController();
    gesture.current = controller;
    const { pointerId } = e;
    const start = { x: e.clientX, y: e.clientY, vx: view.x, vy: view.y };
    const move = (ev: globalThis.PointerEvent) => {
      if (ev.pointerId !== pointerId) return;
      const dx = ev.clientX - start.x, dy = ev.clientY - start.y;
      if (!dragged.current && Math.hypot(dx, dy) < 4) return;
      dragged.current = true;
      setView(v => clamp({ z: v.z, x: start.vx + dx, y: start.vy + dy }));
    };
    const end = (ev: globalThis.PointerEvent) => { if (ev.pointerId === pointerId) controller.abort(); };
    const options = { signal: controller.signal };
    window.addEventListener('pointermove', move, options);
    window.addEventListener('pointerup', end, options);
    window.addEventListener('pointercancel', end, options);
    window.addEventListener('blur', () => controller.abort(), options);
  }
  // A drag ends in a click on whatever is under the cursor: swallow it.
  function swallowDragClick(e: MouseEvent<HTMLDivElement>) {
    if (!e.detail || !dragged.current) return;
    dragged.current = false;
    e.stopPropagation();
    e.preventDefault();
  }

  const style = { '--ratio': ratio } as CSSProperties;
  const layerStyle = { '--zoom': view.z, transform: `translate(-50%, -50%) translate(${view.x}px, ${view.y}px)` } as CSSProperties;
  return <div ref={box} className={view.z > MIN_ZOOM ? 'zoom-viewport zoomed' : 'zoom-viewport'} style={style} onPointerDown={startDrag} onClickCapture={swallowDragClick}>
    <div ref={layer} className={`zoom-layer ${className}`} style={layerStyle}>{children}</div>
    <div className="zoom-controls" onPointerDown={e => {
      dragged.current = false;
      e.stopPropagation();
    }}>
      {controls}
      <button type="button" aria-label={t('Ampliar')} title={t('Ampliar')} disabled={view.z >= MAX_ZOOM} onClick={() => zoomAt(1.5)}>+</button>
      <button type="button" aria-label={t('Reduzir')} title={t('Reduzir')} disabled={view.z <= MIN_ZOOM} onClick={() => zoomAt(1 / 1.5)}>−</button>
      <button type="button" aria-label={t('Reiniciar zoom')} title={t('Reiniciar zoom')} disabled={view.z <= MIN_ZOOM && !view.x && !view.y} onClick={() => setView({ z: 1, x: 0, y: 0 })}>⌖</button>
    </div>
    {/* The wheel and drag hint is hidden on touch screens, where pinching is the expected gesture. */}
    <span className="zoom-hint">{Math.round(view.z * 100)}%<span className="zoom-hint-how"> · {t('Role para ampliar · Arraste para mover')}</span></span>
    <div className="zoom-overlay">{overlay}</div>
  </div>;
}
