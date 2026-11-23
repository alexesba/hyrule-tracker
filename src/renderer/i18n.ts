/// <reference types="vite/client" />
import entries from './strings.txt?raw';
import catalogEntries from './catalog-strings.json';
import { inDecky } from './decky';

/** Every language, by its own name (the order of the language menu). */
export const languages = {
  'en-US': 'English', 'pt-BR': 'Português (Brasil)', 'es-ES': 'Español', 'fr-FR': 'Français', 'de-DE': 'Deutsch',
  'it-IT': 'Italiano', 'nl-NL': 'Nederlands', 'ru-RU': 'Русский', 'ja-JP': '日本語', 'ko-KR': '한국어',
  'zh-CN': '简体中文', 'zh-TW': '繁體中文',
} as const;
export type Locale = keyof typeof languages;
/** The languages kept in strings.txt and catalog-strings.json; the others have a file in locales/. */
type BaseLocale = 'pt-BR' | 'en-US' | 'es-ES';
const isBase = (l: Locale): l is BaseLocale => l === 'pt-BR' || l === 'en-US' || l === 'es-ES';
const dictionariesByFile = import.meta.glob<Record<string, string>>('./locales/*.json', { import: 'default' });
const dictionaries: Partial<Record<Locale, Record<string, string>>> = {};
type WorldLanguage = Record<'text' | 'botw' | 'totk', Record<string, string>>;
const worldFiles = import.meta.glob<WorldLanguage>('./world-locales/*.json', { import: 'default' });
const worldLanguages: Partial<Record<Locale, WorldLanguage>> = {};

export async function loadLocale(next: Locale) {
  const pending: Promise<void>[] = [];
  if (!isBase(next) && !dictionaries[next]) {
    const load = dictionariesByFile[`./locales/${next}.json`];
    if (!load) throw new Error(`Missing dictionary for ${next}`);
    pending.push(load().then(dictionary => { dictionaries[next] = dictionary; }));
  }
  if (next !== 'en-US' && !worldLanguages[next]) {
    const load = worldFiles[`./world-locales/${next}.json`];
    if (!load) throw new Error(`Missing Hyrule journal dictionary for ${next}`);
    pending.push(load().then(dictionary => { worldLanguages[next] = dictionary; }));
  }
  await Promise.all(pending);
}
const storage = 'hyrule-tracker.locale';
function initial(): Locale {
  try {
    const saved = localStorage.getItem(storage);
    if (saved && Object.hasOwn(languages, saved)) return saved as Locale;
  } catch { /* browser storage unavailable */ }
  const deckyLocale = inDecky && new URLSearchParams(location.search).get('locale');
  if (deckyLocale && Object.hasOwn(languages, deckyLocale)) return deckyLocale as Locale;
  return fromSystem(typeof navigator === 'undefined' ? [] : navigator.languages ?? [navigator.language]);
}
/** First run: the system's language if the app has it (zh-Hant/HK/MO/TW -> traditional Chinese), else English. */
export function fromSystem(tags: readonly string[]): Locale {
  const codes = Object.keys(languages) as Locale[];
  for (const tag of tags) {
    const lower = tag.toLowerCase();
    if (/^zh-(hant|tw|hk|mo)/.test(lower)) return 'zh-TW';
    const exact = codes.find(c => c.toLowerCase() === lower);
    if (exact) return exact;
    const same = codes.find(c => c.split('-')[0] === lower.split('-')[0]);
    if (same) return same;
  }
  return 'en-US';
}
let locale = initial();
const translations = new Map(entries.trim().split('\n').map(row => {
  const [source, pt, en, es] = row.trim().split('|');
  return [source, { 'pt-BR': pt, 'en-US': en, 'es-ES': es }] as const;
}));
const catalog: Record<string, string[]> = catalogEntries;
/** A translation found in the dictionaries or by one of the structured patterns, or undefined. */
function lookup(source: string): string | undefined {
  if (!isBase(locale)) {
    const own = dictionaries[locale];
    const found = own && Object.hasOwn(own, source) ? own[source] : undefined;
    if (found) return found;
  }
  // A language with its own file falls back to the English text (the keys are partly Portuguese).
  const direct = translations.get(source)?.[isBase(locale) ? locale : 'en-US'];
  if (direct) return direct;
  if (locale !== 'en-US') {
    const labels = Object.hasOwn(catalog, source) ? catalog[source] : undefined;
    const translated = locale === 'pt-BR' ? labels?.[0] : locale === 'es-ES' ? labels?.[1] : undefined;
    if (translated) return translated;
    const age = /^(.+) \((child|adult)\)$/.exec(source);
    if (age) return `${t(age[1])} (${t(age[2])})`;
    const floor = /^(B)?(\d+)F$/.exec(source);
    if (floor) return t(floor[1] ? '{n} basement' : '{n} floor').replace('{n}', floor[2]);
  }
  const tokens = /^(\d+) Gold Skulltula tokens?$/.exec(source);
  if (tokens) return plural(Number(tokens[1]), '{n} Gold Skulltula token', '{n} Gold Skulltula tokens');
  const numbered = /^(Pensamento de fada|Chamado de Pierre|Entrada de gruta|Pedra falante|Rupees prateadas) (\d+)$/.exec(source);
  if (numbered) return `${t(numbered[1])} ${numbered[2]}`;
  return undefined;
}
export function t(source: string): string {
  const found = lookup(source);
  if (found !== undefined) return found;
  // "Area: spot" headings: translated only when both halves are known, never as a half-translated mix.
  const heading = source.indexOf(': ');
  if (heading > 0 && !/[.!?]$/.test(source)) {
    const head = lookup(source.slice(0, heading));
    const body = lookup(source.slice(heading + 2));
    if (head !== undefined && body !== undefined) return `${head}: ${body}`;
  }
  return source;
}

export function journalText([pt, en]: readonly [string, string], language = locale): string {
  if (language === 'en-US') return en;
  if (language === 'pt-BR') return pt;
  return worldLanguages[language]?.text[en] ?? lookup(pt) ?? lookup(en) ?? en;
}

export function journalMessage(label: readonly [string, string], values: Record<string, string | number>): string {
  return journalText(label).replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    const value = Object.hasOwn(values, key) ? values[key] : undefined;
    return typeof value === 'number' ? number(value) : value ?? placeholder;
  });
}

export function journalName(game: 'botw' | 'totk', source: string, language = locale): string {
  const names = worldLanguages[language]?.[game];
  if (!names) return source;
  const key = source.normalize('NFC').replace(/[’‘]/g, "'").replace(/[“”]/g, '"').trim();
  if (Object.hasOwn(names, key)) return names[key];
  const numbered = /^(.+?)( (?:x?\d+|[A-Z]{1,3}\d{2,}))$/.exec(key);
  return numbered && Object.hasOwn(names, numbered[1]) ? names[numbered[1]] + numbered[2] : source;
}
/** Name without its "Area: " prefix, translated. Translates the tail alone when it is known, else the whole name and then cuts the prefix. */
export function tail(source: string): string {
  const cut = source.replace(/^[^:]+: /, '');
  const direct = t(cut);
  if (direct !== cut || cut === source) return direct;
  return t(source).replace(/^[^:]+: /, '');
}
export const currentLocale = () => locale;
export function setLocale(next: Locale) {
  locale = next;
  document.documentElement.lang = next;
  try { localStorage.setItem(storage, next); } catch { /* browser storage unavailable */ }
}
export const number = (value: number) => new Intl.NumberFormat(locale, { maximumFractionDigits: 1 }).format(value);
export function message(source: string, values: Record<string, string | number> = {}) {
  return t(source).replace(/\{(\w+)\}/g, (placeholder, key: string) => {
    const value = Object.hasOwn(values, key) ? values[key] : undefined;
    return typeof value === 'number' ? number(value) : value === undefined ? placeholder : t(value);
  });
}
export const date = (value: number) => new Intl.DateTimeFormat(locale, { dateStyle: 'short', timeStyle: 'short' }).format(value);
export const hour = (value: number) => new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(value);
/** 0.42 -> "42%" / "42 %" as the locale writes it. */
export const percent = (fraction: number, digits = 0) => new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: digits }).format(fraction);
export const day = (value: number | Date) => new Intl.DateTimeFormat(locale, { dateStyle: 'medium' }).format(value);
/** Picks the singular or plural key for `count` (Intl.PluralRules) and fills {n} and the other values. */
export function plural(count: number, one: string, other: string, values: Record<string, string | number> = {}) {
  const key = new Intl.PluralRules(locale).select(count) === 'one' ? one : other;
  return message(key, { n: count, ...values });
}
/** t() for plain text, message() when the main process sent values to fill in. */
export const tv = (source: string, values?: Record<string, string | number>) => (values ? message(source, values) : t(source));
