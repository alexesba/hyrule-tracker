import { describe, expect, it, vi } from 'vitest';
import { currentLocale, fromSystem, languages, loadLocale, setLocale, t, type Locale } from '../src/renderer/i18n.js';

describe('first-run language', () => {
  it('picks the system language when the app has it', () => {
    expect(fromSystem(['fr-CA', 'en'])).toBe('fr-FR');
    expect(fromSystem(['pt-PT'])).toBe('pt-BR');
    expect(fromSystem(['ja'])).toBe('ja-JP');
  });
  it('tells traditional from simplified Chinese', () => {
    expect(fromSystem(['zh-TW'])).toBe('zh-TW');
    expect(fromSystem(['zh-Hant-HK'])).toBe('zh-TW');
    expect(fromSystem(['zh-CN'])).toBe('zh-CN');
    expect(fromSystem(['zh'])).toBe('zh-CN');
  });
  it('falls back to English', () => {
    expect(fromSystem(['sv-SE'])).toBe('en-US');
    expect(fromSystem([])).toBe('en-US');
  });
  it('has 12 languages', () => {
    expect(Object.keys(languages)).toHaveLength(12);
  });
});

// pt-BR and es-ES use the names the game's own Brazilian and European Spanish text uses; the other languages keep the English ones.
const OFFICIAL_NAMES: Partial<Record<Locale, { phantom: string; dark: string }>> = {
  'pt-BR': { phantom: 'Ganon Espectral', dark: 'Link Sombrio' },
  'es-ES': { phantom: 'Ganon fantasma', dark: 'Link oscuro' },
};

it('keeps character names in localized labels and hints', async () => {
  const previous = currentLocale();
  vi.stubGlobal('document', { documentElement: { lang: previous } });
  try {
    for (const locale of Object.keys(languages) as Locale[]) {
      await loadLocale(locale);
      setLocale(locale);
      const names = OFFICIAL_NAMES[locale] ?? { phantom: 'Phantom Ganon', dark: 'Dark Link' };
      expect(t('Phantom Ganon'), locale).toBe(names.phantom);
      expect(t('Dark Link'), locale).toBe(names.dark);
      expect(t('In the Water Temple, after Dark Link.'), locale).toContain(names.dark);
      expect(t("Dampé's race"), locale).toContain('Dampé');
    }
  } finally {
    setLocale(previous);
    vi.unstubAllGlobals();
  }
});
