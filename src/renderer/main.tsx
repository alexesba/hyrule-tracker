import { createRoot } from 'react-dom/client';
import { App } from './App';
import { currentLocale, loadLocale, setLocale } from './i18n';
import { enableDeckyNavigation } from './decky';
import './styles.css';
import './responsive.css';

const isOverlay = new URLSearchParams(location.search).has('overlay');
const locale = currentLocale();
void loadLocale(locale).catch(console.error).then(async () => {
  setLocale(locale);
  const root = createRoot(document.getElementById('root')!);
  if (isOverlay) {
    const { Overlay } = await import('./Overlay');
    root.render(<Overlay />);
  } else root.render(<App />);
  enableDeckyNavigation();
});
