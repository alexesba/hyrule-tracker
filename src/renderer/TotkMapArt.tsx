import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { totkTilePixels, totkTileSpan, totkTiles, type TotkMapBounds } from '../core/totk-map-tiles';
import type { WorldLayer } from '../core/totk-world';
import type { IslandText } from '../core/totk-island';
import type { IslandPoint } from '../core/totk-island';
import { journals, useWorldJournal, type WorldGame } from './WorldJournalContext';

const sourceLayers: Record<WorldLayer, string> = { surface: 'Ground', sky: 'Sky', depths: 'Depths' };

export type ArtStatus = 'loading' | 'ready' | 'unavailable';
type Tile = ReturnType<typeof totkTiles>[number];

function tileUrl(game: WorldGame, layer: WorldLayer, level: number, tile: Tile) {
  const address = 'maptex/' + level + '/' + tile.x + '/' + tile.y;
  const source = journals[game].mapSource + 'game_files/';
  return game === 'botw' ? source + address + '.png' : source + 'map/' + sourceLayers[layer] + '/' + address + '.webp';
}

export function totkMapPreview(layer: WorldLayer, [x, z]: IslandPoint, level = 3, game: WorldGame = 'totk') {
  const [tile] = totkTiles({ west: x, east: x + 1, north: z, south: z + 1 }, level);
  return tile && tileUrl(game, layer, level, tile);
}

/**
 * A close crop of the game map around one point, for a region row or card. A single tile only holds the point
 * somewhere inside it; this lays out the tiles around it so the point sits at `anchor` across the box.
 */
export function TotkMapCrop({ layer, at: [x, z], level = 4, anchor = 0.68, className = '' }: {
  layer: WorldLayer; at: IslandPoint; level?: number; anchor?: number; className?: string;
}) {
  const { game } = useWorldJournal();
  const span = totkTileSpan(level);
  const tiles = totkTiles({ west: x - span * 2, east: x + span * 2, north: z - span, south: z + span }, level);
  return <span className={'totk-map-crop ' + className} aria-hidden="true">
    <span className="totk-map-crop-origin" style={{ left: anchor * 100 + '%' }}>
      {tiles.map(tile => <img key={tile.x + '/' + tile.y} alt="" draggable={false} decoding="async" loading="lazy"
        referrerPolicy="no-referrer" src={tileUrl(game, layer, level, tile)}
        style={{ left: (tile.west - x) / span * totkTilePixels, top: (tile.north - z) / span * totkTilePixels }} />)}
    </span>
  </span>;
}

function tileImage(game: WorldGame, layer: WorldLayer, bounds: TotkMapBounds, level: number, tile: Tile, onResult?: (loaded: boolean) => void) {
  const span = totkTileSpan(level);
  const width = bounds.east - bounds.west;
  const height = bounds.south - bounds.north;
  return <img key={level + '/' + tile.x + '/' + tile.y} alt="" draggable={false} decoding="async"
    referrerPolicy="no-referrer"
    src={tileUrl(game, layer, level, tile)}
    style={{
      left: (tile.west - bounds.west) / width * 100 + '%',
      top: (tile.north - bounds.north) / height * 100 + '%',
      width: span / width * 100 + '%',
      height: span / height * 100 + '%',
    }}
    onLoad={event => {
      event.currentTarget.dataset.loaded = 'true';
      onResult?.(true);
    }}
    onError={onResult && (() => onResult(false))} />;
}

export function TotkMapArt({ layer, bounds, baseLevel, fallback, onStatus }: {
  layer: WorldLayer;
  bounds: TotkMapBounds;
  baseLevel: number;
  fallback: ReactNode;
  onStatus: (status: ArtStatus) => void;
}) {
  const { game } = useWorldJournal();
  const art = useRef<HTMLDivElement>(null);
  const baseTiles = useMemo(() => totkTiles(bounds, baseLevel), [bounds, baseLevel]);
  const [loaded, setLoaded] = useState(0);
  const [failed, setFailed] = useState(false);
  const [detail, setDetail] = useState<{ level: number; tiles: Tile[]; key: string }>();
  const ready = loaded === baseTiles.length;

  useEffect(() => {
    onStatus(ready ? 'ready' : failed ? 'unavailable' : 'loading');
  }, [ready, failed, onStatus]);

  useEffect(() => {
    const artBox = art.current;
    const zoomLayer = artBox?.parentElement;
    const viewport = zoomLayer?.parentElement;
    if (!ready || !artBox || !zoomLayer || !viewport) return;

    let frame: number;
    const measure = () => {
      const map = artBox.getBoundingClientRect();
      const clip = viewport.getBoundingClientRect();
      if (!map.width || !map.height) return;
      const worldWidth = bounds.east - bounds.west;
      const worldHeight = bounds.south - bounds.north;
      const pixelsPerUnit = map.width * window.devicePixelRatio / worldWidth;
      const level = Math.min(7, Math.max(baseLevel, Math.ceil(Math.log2(
        pixelsPerUnit * totkTileSpan(0) / totkTilePixels,
      ))));
      if (level === baseLevel) {
        setDetail(undefined);
        return;
      }
      const visible = {
        west: Math.max(bounds.west, bounds.west + (clip.left - map.left) / map.width * worldWidth),
        east: Math.min(bounds.east, bounds.west + (clip.right - map.left) / map.width * worldWidth),
        north: Math.max(bounds.north, bounds.north + (clip.top - map.top) / map.height * worldHeight),
        south: Math.min(bounds.south, bounds.north + (clip.bottom - map.top) / map.height * worldHeight),
      };
      const tiles = totkTiles(visible, level);
      const key = level + '/' + tiles.map(tile => tile.x + ',' + tile.y).join('/');
      setDetail(current => current?.key === key ? current : { level, tiles, key });
    };
    const schedule = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(measure);
    };
    const resize = new ResizeObserver(schedule);
    resize.observe(artBox);
    resize.observe(viewport);
    const motion = new MutationObserver(schedule);
    motion.observe(zoomLayer, { attributes: true, attributeFilter: ['style'] });
    schedule();
    return () => {
      resize.disconnect();
      motion.disconnect();
      cancelAnimationFrame(frame);
    };
  }, [baseLevel, bounds, ready]);

  return <>
    {!ready && fallback}
    <div className="totk-map-art" data-ready={ready} ref={art} aria-hidden="true">
      {baseTiles.map(tile => tileImage(game, layer, bounds, baseLevel, tile, success => {
        if (success) setLoaded(count => count + 1);
        else setFailed(true);
      }))}
      {detail?.tiles.map(tile => tileImage(game, layer, bounds, detail.level, tile))}
    </div>
  </>;
}

export function TotkMapCredit({ status, text }: { status: ArtStatus; text: (label: IslandText) => string }) {
  const { mapSource, guideMap } = useWorldJournal();
  return <p className="island-note totk-map-credit">
    <span role="status">
      {status === 'loading' && text(['Carregando mapa do jogo…', 'Loading game map…'])}
      {status === 'unavailable' && text(['Imagem indisponível. Exibindo o mapa esquemático.', 'Artwork unavailable. Showing the schematic map.'])}
    </span>
    <span>{text(['Cartografia e ícones © Nintendo · ', 'Cartography and icons © Nintendo · '])}
      <a href={mapSource} target="_blank" rel="noreferrer">ZeldaMods</a>
      {' · '}<a href={guideMap} target="_blank" rel="noreferrer">Zelda Xtreme</a>
    </span>
  </p>;
}
