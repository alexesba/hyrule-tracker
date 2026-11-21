import { readdirSync, readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { extendChecklist, type CompanionData } from '../src/core/companion.js';
import {
  chapterProgress, currentChapter, sectionStatuses, stepStatus, walkthroughTexts,
  type DoneLookup, type WalkthroughChapter, type WalkthroughFile,
} from '../src/core/walkthrough.js';

const read = (f: string) => JSON.parse(readFileSync(f, 'utf8'));
const guide: WalkthroughFile = read('data/walkthrough.json');
const strings: Record<string, string[]> = read('src/renderer/walkthrough-strings.json');
const locales = readdirSync('src/renderer/locales').filter(file => file.endsWith('.json'));
const icons = new Set(Object.keys(read('src/renderer/item-images.json')));
const places = new Set<string>(read('data/atlas.json').places.map((p: { id: string }) => p.id));
const checklist = read('data/checklist.json');
extendChecklist(checklist, read('data/save-mapping.json'), read('data/companion.json') as CompanionData);
const rows = new Set<string>(checklist.categories.flatMap((c: { items: { id: string }[] }) => c.items.map(i => i.id)));

// Every page of IGN's walkthrough tree (main path and the "Secondary Threads of Time" quests), in story order.
const IGN_TREE = [
  'kokiri-forest', 'deku-tree', 'princess-of-hyrule', 'kakariko-village', 'goron-city', 'dodongos-cavern',
  'zoras-domain', 'jabu-jabus-belly', 'forest-temple-mysteries', 'forest-temple', 'goron-city-disaster', 'fire-temple',
  'ice-cavern', 'water-temple', 'bottom-of-the-well', 'shadow-temple', 'gerudo-fortress', 'gerudo-training-ground',
  'spirit-temple', 'ganons-castle',
  'side-malons-friend', 'side-royal-family-song', 'side-happy-mask-shop', 'side-great-fairies', 'side-scarecrow', 'side-pocket-egg',
];

describe('walkthrough data', () => {
  const chapters = guide.chapters;
  const steps = chapters.flatMap(c => c.sections.flatMap(s => s.steps));

  it('covers the whole IGN walkthrough tree, in order', () => {
    expect(chapters.map(c => c.id)).toEqual(IGN_TREE);
  });

  it('keeps the story parts in order, side quests last', () => {
    const order = ['stones', 'medallions', 'ganon', 'side'];
    const parts = chapters.map(c => order.indexOf(c.part));
    expect(parts.every(p => p >= 0)).toBe(true);
    expect([...parts].sort((a, b) => a - b)).toEqual(parts);
  });

  it('gives every chapter a goal and main steps, and every section steps', () => {
    for (const c of chapters) {
      expect(c.goal.length, c.id).toBeGreaterThan(0);
      expect(c.sections.filter(s => !s.optional).flatMap(s => s.steps).length, c.id).toBeGreaterThan(0);
      for (const s of c.sections) expect(s.steps.length, s.id).toBeGreaterThan(0);
    }
  });

  it('uses unique chapter and section ids', () => {
    const ids = chapters.flatMap(c => [c.id, ...c.sections.map(s => s.id)]);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('links only to checklist rows that exist', () => {
    const linked = [...chapters.flatMap(c => c.goal), ...steps.flatMap(s => s.objectives ?? [])];
    expect(linked.filter(id => !rows.has(id))).toEqual([]);
  });

  it('links only to atlas places and item icons that exist', () => {
    const used = chapters.flatMap(c => [c.place, ...c.sections.map(s => s.place).filter((p): p is string => !!p)]);
    expect(used.filter(p => !places.has(p))).toEqual([]);
    expect(steps.flatMap(s => s.items ?? []).filter(i => !icons.has(i))).toEqual([]);
  });

  it('names a source page for every chapter', () => {
    for (const c of chapters) expect(new URL(c.source).hostname, c.id).toBe('www.ign.com');
  });

  it('translates every text to pt-BR and es-ES, keeping no stale entries', () => {
    const texts = new Set(walkthroughTexts(guide));
    expect([...texts].filter(t => !strings[t] || strings[t].length !== 2 || strings[t].some(x => !x.trim()))).toEqual([]);
    expect(Object.keys(strings).filter(k => !texts.has(k))).toEqual([]);
  });

  it.each(locales)('translates every walkthrough text for %s', file => {
    const texts = new Set(walkthroughTexts(guide));
    const localized: Record<string, string> = read(`src/renderer/walkthrough-locales/${file}`);
    const catalog: Record<string, string> = read(`src/renderer/locales/${file}`);
    expect([...texts].filter(text => !localized[text]?.trim())).toEqual([]);
    expect(Object.keys(localized).filter(text => !texts.has(text))).toEqual([]);
    expect(Object.values(localized).filter(text => /[–—]|Z\s*Q\s*\d+\s*Q\s*Z/i.test(text))).toEqual([]);
    expect(localized['Buy the Deku Shield']).toContain(catalog['Deku Shield']);
    expect(localized['Find the Kokiri Sword']).toContain(catalog['Kokiri Sword']);
    expect(localized['At night, Hookshot the Gold Skulltula at the top of the House of the Twins.'].replaceAll('’', "'")).toContain(catalog['Gold Skulltula']);
  });

  it('writes no dashes as punctuation', () => {
    const all = [...walkthroughTexts(guide), ...Object.values(strings).flat()];
    expect(all.filter(t => /[–—]/.test(t))).toEqual([]);
  });
});

describe('walkthrough progress', () => {
  const chapter = (id: string, part: WalkthroughChapter['part'], goal: string[], sections: WalkthroughChapter['sections']): WalkthroughChapter =>
    ({ id, part, title: id, summary: '', age: 'child', place: 'kokiri', goal, source: 'https://www.ign.com/', sections });
  const forest = chapter('forest', 'stones', ['equipment.kokiri_sword'], [
    { id: 'a', title: 'a', steps: [
      { text: 'walk' },
      { text: 'shield', objectives: ['equipment.deku_shield'] },
      { text: 'talk' },
      { text: 'sword', objectives: ['equipment.kokiri_sword', 'items.deku_sticks'] },
    ] },
    { id: 'b', title: 'b', optional: true, steps: [{ text: 'gs', objectives: ['gold_skulltulas.016'] }, { text: 'look' }] },
  ]);
  const tree = chapter('tree', 'stones', ['bosses.gohma'], [{ id: 'c', title: 'c', steps: [{ text: 'boss', objectives: ['bosses.gohma'] }] }]);
  const castle = chapter('castle', 'stones', ['songs.zeldas_lullaby'], [{ id: 'd', title: 'd', steps: [{ text: 'song', objectives: ['songs.zeldas_lullaby'] }] }]);
  const side = chapter('side', 'side', ['side_quests.malons_friend'], [{ id: 'e', title: 'e', steps: [{ text: 'horse', objectives: ['side_quests.malons_friend'] }] }]);
  const save = (...done: string[]): DoneLookup => id => done.includes(id);

  it('marks a step done only when all of its objectives are', () => {
    const sword = forest.sections[0].steps[3];
    expect(stepStatus(sword, save('equipment.kokiri_sword'))).toBe('todo');
    expect(stepStatus(sword, save('equipment.kokiri_sword', 'items.deku_sticks'))).toBe('done');
    expect(stepStatus(forest.sections[0].steps[0], save())).toBe('plain');
  });

  it('counts main steps and extras apart, and finishes on the goal', () => {
    expect(chapterProgress(forest, save())).toEqual({ done: 0, total: 2, extrasDone: 0, extrasTotal: 1, complete: false, started: false });
    expect(chapterProgress(forest, save('gold_skulltulas.016'))).toMatchObject({ done: 0, extrasDone: 1, started: true, complete: false });
    expect(chapterProgress(forest, save('equipment.kokiri_sword'))).toMatchObject({ done: 0, complete: true, started: true });
    expect(chapterProgress(forest, save('equipment.deku_shield', 'equipment.kokiri_sword', 'items.deku_sticks'))).toMatchObject({ done: 2, total: 2 });
  });

  it('treats plain steps before a done step, or in a finished chapter, as passed', () => {
    const [main, extra] = forest.sections;
    expect(sectionStatuses(main, save('equipment.deku_shield')).map(s => s.passed)).toEqual([true, true, false, false]);
    expect(sectionStatuses(main, save(), true).map(s => s.passed)).toEqual([true, false, true, false]);
    expect(sectionStatuses(extra, save(), true).map(s => s.passed)).toEqual([false, false]);
  });

  it('finds the chapter the player is on', () => {
    const list = [forest, tree, castle, side];
    expect(currentChapter(list, save())).toBe(0);
    expect(currentChapter(list, save('equipment.kokiri_sword'))).toBe(1);
    // A skipped chapter does not hold the guide back once a later one is finished.
    expect(currentChapter(list, save('bosses.gohma'))).toBe(2);
    // Everything after the furthest finished chapter is done: back to the first gap.
    expect(currentChapter(list, save('songs.zeldas_lullaby'))).toBe(0);
    expect(currentChapter(list, save('equipment.kokiri_sword', 'bosses.gohma', 'songs.zeldas_lullaby'))).toBe(-1);
  });
});
