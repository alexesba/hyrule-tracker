import { nearbyObjectives, worldTotals } from '../core/totk-journal';
import { isWorldLocation, worldLayers, type WorldCategory, type WorldItem } from '../core/totk-world';
import type { IslandPoint, IslandText } from '../core/totk-island';
import type { AppState } from '../shared/types';
import { TotkCategoryIcon } from './TotkCategoryIcon';
import { journalMessage, journalName, journalText, number, type Locale } from './i18n';
import { gameTitle } from './GamePicker';
import { useWorldJournal } from './WorldJournalContext';

/** The overlay's counters: the same totals the Tears of the Kingdom overview shows. */
const counters: { category: WorldCategory; label?: IslandText }[] = [
  { category: 'shrine' }, { category: 'lightroot' }, { category: 'tower' },
  { category: 'korok', label: ['Sementes Korok', 'Korok Seeds'] }, { category: 'main-quest' }, { category: 'chest' },
];
/** The region whose Skyview Tower is closest to the point: the save stores a position, not a region. */
function regionAt([x, z]: IslandPoint, towers: { id: string; name: string; at: IslandPoint }[]) {
  return towers.reduce((best, tower) =>
    Math.hypot(tower.at[0] - x, tower.at[1] - z) < Math.hypot(best.at[0] - x, best.at[1] - z) ? tower : best, towers[0]);
}

/** The overlay for Tears of the Kingdom: same window, modes and layout as the Ocarina one, filled from the TotK save. */
export function TotkOverlay({ state, locale }: { state: AppState; locale: Locale }) {
  const { game, items: worldItems, byId, checklist: worldChecklistItems, categories: worldCategories, totals, regions } = useWorldJournal();
  const text = (label: IslandText) => journalText(label, locale);
  const save = state[game];
  const world = save?.world;
  if (!save || !world) return <div className="ov-msg">{journalMessage(['Aguardando um save de {game}…', 'Waiting for a {game} save…'],
    { game: gameTitle(game) })}</div>;
  const manual = new Set(save.manual);
  const done = (item: WorldItem) => world.marks[item.id] === 'done' || manual.has(item.id);
  const counts = worldTotals(world.marks, worldItems);
  const seeds = worldItems.reduce((sum, item) => sum + (item.category === 'korok' && world.marks[item.id] === 'done' ? item.seeds ?? 1 : 0), 0);
  const value = (category: WorldCategory) => category === 'korok' ? seeds : counts[category] ?? 0;
  const percent = Math.floor(worldChecklistItems.filter(done).length / worldChecklistItems.length * 100);
  const player = world.player;
  const here = player && regionAt(player.at, regions.flatMap(region => {
    const at = byId.get(region.id)?.at;
    return at ? [{ ...region, at }] : [];
  }));
  const mode = state.overlay.mode;
  return <>
    <div className="ov-head">
      <span className="ov-here">{here ? journalName(game, here.name) + ' · ' + text(worldLayers[player.layer]) : text(['Posição desconhecida', 'Unknown position'])}</span>
      <span className="ov-src" title={text(['Posição do último save', 'Position from the last save'])}>{text(['Save', 'Save'])}</span>
    </div>
    <div className="ov-summary">
      <span title={text(worldCategories.shrine)}><TotkCategoryIcon category="shrine" /> {number(value('shrine'))}</span>
      <span title={text(['Sementes Korok', 'Korok Seeds'])}><TotkCategoryIcon category="korok" /> {number(seeds)}</span>
      <span className="ov-pct">{percent}%</span>
    </div>
    {mode === 'counters' ? <div className="ov-list">{counters.map(counter => {
      const { category, label } = game === 'botw' && counter.category === 'lightroot' ? { category: 'memory' as const, label: undefined } : counter;
      const total = totals[category] ?? 0;
      return <div key={category} className={`ov-row ${value(category) === total ? 'full' : ''}`}>
        <span className="ov-icon"><TotkCategoryIcon category={category} /></span>
        <span className="ov-label">{text(label ?? worldCategories[category])}</span>
        <span className="ov-num">{number(value(category))}/{number(total)}</span>
      </div>;
    })}</div> : mode === 'available' ? <Rows text={text} items={nearbyObjectives(world, worldItems).map(({ item }) => item)}
      empty={['Nada por perto agora', 'Nothing nearby right now']} /> : <Rows text={text}
      head={here && journalName(game, here.name)}
      items={here ? worldItems.filter(item => item.region === here.id && item.layer === player.layer && !isWorldLocation(item) && !done(item)) : []}
      empty={here ? ['Nada faltando aqui 🎉', 'Nothing left here 🎉'] : ['Salve no jogo para saber onde Link está.', 'Save in the game to know where Link is.']} />}
  </>;
}

function Rows({ text, items, head, empty }: { text: (label: IslandText) => string; items: WorldItem[]; head?: string; empty: IslandText }) {
  const { game } = useWorldJournal();
  return <div className="ov-list">
    {head && <div className="ov-area">{head} · {number(items.length)} {text(['faltando', 'left'])}</div>}
    {!items.length && <div className="ov-row muted">{text(empty)}</div>}
    {items.slice(0, 40).map(item => <div key={item.id} className="ov-row">
      <span className="ov-icon"><TotkCategoryIcon category={item.category} seeds={item.seeds} /></span>
      <span className="ov-label">{journalName(game, item.name)}</span>
    </div>)}
  </div>;
}
