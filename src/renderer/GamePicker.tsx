import { useState } from 'react';
import { journalName, journalText, type Locale } from './i18n';
import { LanguageSwitch } from './LanguageFlags';
import './game-picker.css';

const games = [
  { id: 'oot', title: 'Ocarina of Time',
    cover: 'https://www.nintendo.com/eu/media/images/assets/nintendo_switch_2_games/thelegendofzeldaocarinaoftime/banners/16x9_PDP_NSwitch2_TloZOcarinaOfTime_AnniLogo_image1280w.jpg' },
  { id: 'totk', title: 'Tears of the Kingdom',
    cover: 'https://www.nintendo.com/eu/media/images/10_share_images/games_15/nintendo_switch_4/2x1_NSwitch_TloZTearsOfTheKingdom_Gamepage_image1280w.jpg' },
  { id: 'botw', title: 'Breath of the Wild',
    cover: 'https://www.nintendo.com/eu/media/images/10_share_images/games_15/wiiu_14/SI_WiiU_TheLegendOfZeldaBreathOfTheWild_image1280w.jpg' },
] as const;
export type Game = (typeof games)[number]['id'];
export function gameTitle(game: Game) {
  const title = games.find(entry => entry.id === game)?.title ?? '';
  return game === 'oot' ? title : journalName(game, title);
}
export const gameArtwork = (game: Game) => games.find(entry => entry.id === game)?.cover;
const storageKey = 'hyrule-tracker:last-game';

export function lastGame(): Game | undefined {
  try {
    const saved = localStorage.getItem(storageKey);
    return games.find(game => game.id === saved)?.id;
  } catch { return undefined; }
}

export function rememberGame(game: Game) {
  try { localStorage.setItem(storageKey, game); }
  catch { /* Storage unavailable in this window. */ }
}

export function GameSwitch({ onClick }: { onClick: () => void }) {
  const label = journalText(['Trocar jogo', 'Switch game']);
  return <button type="button" className="action game-switch" onClick={onClick} aria-label={label}>
    <span className="game-switch-full">{label}</span>
    <span className="game-switch-short" aria-hidden="true">{journalText(['Jogos', 'Games'])}</span>
  </button>;
}

interface GamePickerProps {
  last?: Game;
  locale: Locale;
  onLanguage: (locale: Locale) => void;
  onEnter: (game: Game) => void;
}

export function GamePicker({ last, locale, onLanguage, onEnter }: GamePickerProps) {
  const [selected, setSelected] = useState(last);
  return <main className="game-picker tracker-shell" lang={locale}>
    <form className="game-picker-form" onSubmit={event => {
      event.preventDefault();
      if (selected) onEnter(selected);
    }}>
      <div className="game-picker-brand">
        <span><img src="./brand/icon.webp" alt="" width={36} height={36} />Hyrule Tracker</span>
        <LanguageSwitch locale={locale} onChange={onLanguage} />
      </div>
      <h1>{journalText(['Escolha o jogo', 'Choose your game'])}</h1>
      <fieldset aria-label={journalText(['Jogo', 'Game'])}>
        {games.map(game => <label className="game-option" key={game.id}>
          <input name="game" type="radio" value={game.id} checked={selected === game.id} onChange={() => setSelected(game.id)} />
          <span className="game-cover" data-game={game.id} aria-hidden="true">
            <img src={game.cover} width={64} height={64} alt="" referrerPolicy="no-referrer"
              onError={event => { event.currentTarget.hidden = true; }} />
          </span>
          <span className="game-option-info"><strong>{gameTitle(game.id)}</strong></span>
          {game.id === last && <small className="game-last">{journalText(['Último jogo', 'Last played'])}</small>}
        </label>)}
      </fieldset>
      <button className="action primary" type="submit" disabled={!selected}>
        {journalText(['Abrir diário', 'Open journal'])}
      </button>
    </form>
  </main>;
}
