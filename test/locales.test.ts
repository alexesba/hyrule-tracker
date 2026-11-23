import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

// Every locales/<code>.json must translate every text the app has, keep the {placeholders} and be a known language.
const dir = path.join(__dirname, '..', 'src', 'renderer', 'locales');
const rows = fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'strings.txt'), 'utf8').trim().split('\n').map(r => r.trim().split('|'));
const catalog: Record<string, string[]> = JSON.parse(fs.readFileSync(path.join(__dirname, '..', 'src', 'renderer', 'catalog-strings.json'), 'utf8'));
const english = new Map<string, string>();
for (const [source, , en] of rows) if (!english.has(source)) english.set(source, en || source);
for (const source of Object.keys(catalog)) if (!english.has(source)) english.set(source, source);
const placeholders = (s: string) => [...s.matchAll(/\{(\w+)\}/g)].map(m => m[1]).sort().join(',');
const files = fs.existsSync(dir) ? fs.readdirSync(dir).filter(f => f.endsWith('.json')) : [];

describe.each(files)('locales/%s', file => {
  const dict: Record<string, unknown> = JSON.parse(fs.readFileSync(path.join(dir, file), 'utf8'));
  it('is one of the app languages', () => {
    expect(['fr-FR', 'de-DE', 'it-IT', 'nl-NL', 'ru-RU', 'ja-JP', 'ko-KR', 'zh-CN', 'zh-TW']).toContain(file.replace(/\.json$/, ''));
  });
  it('translates every text', () => {
    expect([...english.keys()].filter(k => typeof dict[k] !== 'string' || !(dict[k] as string).trim())).toEqual([]);
  });
  it('keeps the placeholders', () => {
    expect([...english].filter(([k, en]) => typeof dict[k] === 'string' && placeholders(dict[k] as string) !== placeholders(en)).map(([k]) => k)).toEqual([]);
  });
});

it('covers the same journal text and catalog entries in every translated language', () => {
  const journalDir = path.join(dir, '..', 'world-locales');
  const locales = [...files, 'pt-BR.json', 'es-ES.json'].sort();
  expect(fs.readdirSync(journalDir).sort()).toEqual(locales);
  type Dictionary = Record<'text' | 'botw' | 'totk', Record<string, string>>;
  const read = (file: string): Dictionary => JSON.parse(fs.readFileSync(path.join(journalDir, file), 'utf8'));
  const reference = read('pt-BR.json');
  for (const file of locales) {
    const dict = read(file);
    for (const category of ['text', 'botw', 'totk'] as const) {
      expect(Object.keys(dict[category]).sort(), file + '/' + category).toEqual(Object.keys(reference[category]).sort());
      const invalid = Object.entries(dict[category]).filter(([, value]) => !value.trim() || /[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value));
      expect(invalid, file + '/' + category).toEqual([]);
    }
    expect(Object.entries(dict.text).filter(([key, value]) => placeholders(key) !== placeholders(value)), file).toEqual([]);
  }
});
