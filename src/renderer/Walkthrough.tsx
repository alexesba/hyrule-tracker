import { useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { AppState, TrackedItem } from '../shared/types';
import guide from '../../data/walkthrough.json';
import translations from './walkthrough-strings.json';
import {
  chapterProgress, currentChapter, sectionStatuses, type ChapterProgress, type DoneLookup, type StepStatus,
  type WalkthroughChapter, type WalkthroughFile, type WalkthroughPart, type WalkthroughSection, type WalkthroughStep,
} from '../core/walkthrough';
import { areaShot, atlasStages, MAP_CATEGORIES } from './CompanionPages';
import { GameItemIcon, trackedItemIcon } from './GameItemIcon';
import { currentLocale, message, percent, plural, t, tail } from './i18n';
import { useNarrow } from './WhatToDo';
import './walkthrough.css';

const chapters = (guide as WalkthroughFile).chapters;
const strings: Record<string, string[]> = translations;

/** The guide's own text in pt-BR or es-ES; every other language reads the English source (marked with its lang). */
function guideLanguage() {
  const locale = currentLocale();
  return locale === 'pt-BR' ? { index: 0, lang: undefined } : locale === 'es-ES' ? { index: 1, lang: undefined } : { index: -1, lang: locale === 'en-US' ? undefined : 'en-US' };
}
const g = (text: string, index: number) => (index >= 0 ? strings[text]?.[index] : undefined) ?? text;

const partTitles: Record<WalkthroughPart, string> = {
  stones: 'Parte 1: as Pedras Espirituais',
  medallions: 'Parte 2: os Medalhões',
  ganon: 'Parte 3: o Rei do Mal',
  side: 'Missões secundárias',
};
const parts = Object.keys(partTitles) as WalkthroughPart[];
const ageLabel = { child: 'Criança', adult: 'Adulto', both: 'Criança e adulto' } as const;

/**
 * "Walkthrough": the whole story step by step, chapter by chapter, with each step ticked from the save
 * (its checklist rows), the chapter the player is on picked out, and links to the checklist and the map.
 */
export default function Walkthrough({ state, onShowInChecklist, onShowOnMap, onShowPlace }: {
  state: AppState;
  onShowInChecklist: (id: string) => void;
  onShowOnMap: (id: string) => void;
  onShowPlace: (placeId: string) => void;
}) {
  const rows = useMemo(() => new Map(state.categories.flatMap(c => c.items.map(i => [i.id, { item: i, category: c.id }] as const))), [state.categories]);
  const hasSave = !!state.summary;
  const done = useMemo<DoneLookup>(() => id => (hasSave ? rows.get(id)?.item.done : false), [rows, hasSave]);
  const progress = useMemo(() => chapters.map(c => chapterProgress(c, done)), [done]);
  const current = useMemo(() => (hasSave ? currentChapter(chapters, done) : -1), [done, hasSave]);

  const [picked, setPicked] = useState<string>();
  const index = Math.max(0, picked ? chapters.findIndex(c => c.id === picked) : current);
  const chapter = chapters[index];
  const [page, setPage] = useState<HTMLDivElement | null>(null);
  const compact = useNarrow(page, 760);
  const top = useRef<HTMLElement>(null);
  const sheet = useRef<HTMLDetailsElement>(null);
  const language = guideLanguage();

  const pick = (id: string) => {
    setPicked(id);
    if (sheet.current) sheet.current.open = false;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => top.current?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' }));
  };

  const list = <ChapterIndex hasSave={hasSave} progress={progress} current={current} selected={index} language={language.index} lang={language.lang} onPick={pick} />;
  return <div ref={setPage} className={`wt-page ${compact ? 'compact' : ''}`}>
    {compact ? <details ref={sheet} className="wt-index-sheet">
      <summary>
        <span className="wt-index-sheet-label">{t('Capítulos')}</span>
        <b lang={language.lang}>{index + 1}. {g(chapter.title, language.index)}</b>
      </summary>
      {list}
    </details> : <aside className="wt-index" aria-label={t('Capítulos')}>{list}</aside>}
    <ChapterView key={chapter.id} chapterRef={top} chapter={chapter} number={index + 1} progress={progress[index]} isCurrent={index === current}
      hasSave={hasSave} done={done} rows={rows} language={language.index} lang={language.lang}
      onShowInChecklist={onShowInChecklist} onShowOnMap={onShowOnMap} onShowPlace={onShowPlace}
      previous={chapters[index - 1]} next={chapters[index + 1]} onPick={pick} />
  </div>;
}

function ChapterIndex({ hasSave, progress, current, selected, language, lang, onPick }: {
  hasSave: boolean; progress: ChapterProgress[]; current: number; selected: number; language: number; lang?: string; onPick: (id: string) => void;
}) {
  return <nav className="wt-index-list">{parts.map(part => (
    <section key={part}>
      <h2>{t(partTitles[part])}</h2>
      <ol>{chapters.map((c, i) => c.part !== part ? null : (
        <li key={c.id}>
          <button type="button" aria-current={i === selected ? 'true' : undefined} onClick={() => onPick(c.id)}
            className={`${progress[i].complete ? 'complete' : ''} ${i === current ? 'here' : ''}`}>
            <span className="wt-index-number" aria-hidden="true">{progress[i].complete ? <Check /> : i + 1}</span>
            <span className="wt-index-text">
              <b lang={lang}>{g(c.title, language)}</b>
              <small>
                {i === current ? t('Você está aqui') : progress[i].complete ? t('Concluído') : hasSave && progress[i].total ? `${progress[i].done}/${progress[i].total}` : t(ageLabel[c.age])}
              </small>
            </span>
            {hasSave && progress[i].total > 0 && <span className="wt-index-rate" aria-hidden="true"><i style={{ width: `${rate(progress[i])}%` }} /></span>}
          </button>
        </li>
      ))}</ol>
    </section>
  ))}</nav>;
}

const rate = (p: ChapterProgress) => (p.complete ? 100 : p.total ? Math.floor(p.done / p.total * 100) : 0);

type Rows = Map<string, { item: TrackedItem; category: string }>;

function ChapterView({ chapter, chapterRef, number, progress, isCurrent, hasSave, done, rows, language, lang, onShowInChecklist, onShowOnMap, onShowPlace, previous, next, onPick }: {
  chapter: WalkthroughChapter; chapterRef: RefObject<HTMLElement | null>; number: number; progress: ChapterProgress; isCurrent: boolean; hasSave: boolean;
  done: DoneLookup; rows: Rows; language: number; lang?: string;
  onShowInChecklist: (id: string) => void; onShowOnMap: (id: string) => void; onShowPlace: (placeId: string) => void;
  previous?: WalkthroughChapter; next?: WalkthroughChapter; onPick: (id: string) => void;
}) {
  const statuses = useMemo(() => new Map(chapter.sections.map(s => [s.id, sectionStatuses(s, done, progress.complete)])), [chapter, done, progress.complete]);
  // Open by default: the main sections the player has not gone through yet. Side content starts folded.
  const openByDefault = (s: WalkthroughSection) => !s.optional && !statuses.get(s.id)!.every(x => x.passed);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const isOpen = (s: WalkthroughSection) => open[s.id] ?? openByDefault(s);
  const allOpen = chapter.sections.every(isOpen);
  const setAll = (value: boolean) => setOpen(Object.fromEntries(chapter.sections.map(s => [s.id, value])));
  // Absolute, so the url() does not resolve against the stylesheet's folder.
  const area = areaShot(atlasStages[chapter.place]);
  const shot = area && new URL(area, document.baseURI).href;

  return <article className="wt-chapter" ref={chapterRef} aria-labelledby="wt-chapter-title">
    <header className={`wt-hero ${shot ? 'has-shot' : ''}`} style={shot ? { '--wt-shot': `url("${shot}")` } as CSSProperties : undefined}>
      <span className={`wt-eyebrow ${isCurrent ? 'here' : ''}`}>{isCurrent ? t('Você está aqui') : t(partTitles[chapter.part])}</span>
      <h2 id="wt-chapter-title" lang={lang}><span className="wt-hero-number">{number}.</span> {g(chapter.title, language)}</h2>
      <p lang={lang}>{g(chapter.summary, language)}</p>
      {hasSave && <div className="wt-hero-progress">
        <span className="wt-hero-rate" aria-hidden="true"><i style={{ width: `${rate(progress)}%` }} /></span>
        <small>
          {progress.complete ? t('Capítulo concluído') : message('{done} de {total} passos', { done: progress.done, total: progress.total })}
          {progress.extrasTotal > 0 && <> · {message('Extras: {done}/{total}', { done: progress.extrasDone, total: progress.extrasTotal })}</>}
          {' · '}{percent(rate(progress) / 100)}
        </small>
      </div>}
      <div className="wt-hero-actions">
        <button type="button" className="action" onClick={() => onShowPlace(chapter.place)}>{t('Ver no mapa')}</button>
        <button type="button" className="action" aria-pressed={allOpen} onClick={() => setAll(!allOpen)}>{t(allOpen ? 'Recolher tudo' : 'Expandir tudo')}</button>
      </div>
    </header>
    {!hasSave && <p className="wt-notice">{t('Encontre um save para ver no guia o que você já fez.')}</p>}

    <div className="wt-sections">{chapter.sections.map((section, i) => (
      <Section key={section.id} section={section} number={i + 1} statuses={statuses.get(section.id)!} open={isOpen(section)}
        onToggle={() => setOpen(o => ({ ...o, [section.id]: !isOpen(section) }))} rows={rows} hasSave={hasSave}
        language={language} lang={lang} onShowInChecklist={onShowInChecklist} onShowOnMap={onShowOnMap} onShowPlace={onShowPlace} />
    ))}</div>

    <footer className="wt-chapter-footer">
      <div className="wt-pager">
        {previous ? <button type="button" className="action" onClick={() => onPick(previous.id)}>
          <small>{t('Capítulo anterior')}</small><span lang={lang}>{g(previous.title, language)}</span>
        </button> : <span />}
        {next && <button type="button" className="action next" onClick={() => onPick(next.id)}>
          <small>{t('Próximo capítulo')}</small><span lang={lang}>{g(next.title, language)}</span>
        </button>}
      </div>
      <p className="wt-credit">{t('Texto escrito para o tracker. Fatos conferidos no guia da IGN:')}{' '}
        <a href={chapter.source} target="_blank" rel="noreferrer">{t('abrir a página do capítulo')}</a></p>
    </footer>
  </article>;
}

function Section({ section, number, statuses, open, onToggle, rows, hasSave, language, lang, onShowInChecklist, onShowOnMap, onShowPlace }: {
  section: WalkthroughSection; number: number; statuses: { status: StepStatus; passed: boolean }[]; open: boolean; onToggle: () => void;
  rows: Rows; hasSave: boolean; language: number; lang?: string;
  onShowInChecklist: (id: string) => void; onShowOnMap: (id: string) => void; onShowPlace: (placeId: string) => void;
}) {
  const checked = statuses.filter(s => s.status !== 'plain');
  const finished = statuses.every(s => s.passed);
  const body = `wt-section-${section.id}`;
  return <section className={`wt-section ${section.optional ? 'optional' : ''} ${hasSave && finished ? 'finished' : ''}`}>
    <h3>
      <button type="button" aria-expanded={open} aria-controls={body} onClick={onToggle}>
        <span className="wt-section-number" aria-hidden="true">{hasSave && finished ? <Check /> : section.optional ? '+' : number}</span>
        <span className="wt-section-title">
          <span lang={lang}>{g(section.title, language)}</span>
          <small>{section.optional ? t('Opcional') : null}{section.optional && hasSave && checked.length > 0 ? ' · ' : null}
            {hasSave && checked.length > 0 ? `${checked.filter(s => s.status === 'done').length}/${checked.length}` : null}
            {!section.optional && !(hasSave && checked.length) ? plural(section.steps.length, '{n} passo', '{n} passos') : null}</small>
        </span>
        <svg className="wt-chevron" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.2 4.3 6 8l3.8-3.7" /></svg>
      </button>
    </h3>
    {open && <div id={body} className="wt-section-body">
      {section.place && <button type="button" className="small-btn wt-section-map" onClick={() => onShowPlace(section.place!)}>{t('Ver no mapa')}</button>}
      <ol className="wt-steps">{section.steps.map((step, i) => (
        <Step key={i} step={step} number={i + 1} state={statuses[i]} rows={rows} hasSave={hasSave} language={language} lang={lang}
          onShowInChecklist={onShowInChecklist} onShowOnMap={onShowOnMap} />
      ))}</ol>
    </div>}
  </section>;
}

function Step({ step, number, state, rows, hasSave, language, lang, onShowInChecklist, onShowOnMap }: {
  step: WalkthroughStep; number: number; state: { status: StepStatus; passed: boolean }; rows: Rows; hasSave: boolean; language: number; lang?: string;
  onShowInChecklist: (id: string) => void; onShowOnMap: (id: string) => void;
}) {
  const objectives = (step.objectives ?? []).map(id => rows.get(id)).filter((r): r is NonNullable<typeof r> => !!r);
  const shown = new Set(objectives.map(o => trackedItemIcon(o.item)));
  // Icons the objectives already show are not repeated.
  const items = (step.items ?? []).filter(i => !shown.has(i));
  const mark = hasSave && state.status === 'done' ? 'done' : hasSave && state.passed ? 'passed' : state.status === 'todo' ? 'todo' : 'plain';
  const markLabel = mark === 'done' ? 'Concluído' : mark === 'todo' && hasSave ? 'Aguardando' : undefined;
  return <li className={`wt-step ${mark}`}>
    <span className="wt-step-mark" role={markLabel ? 'img' : undefined} aria-label={markLabel ? t(markLabel) : undefined} title={markLabel ? t(markLabel) : undefined}>
      {mark === 'done' || mark === 'passed' ? <Check /> : <span aria-hidden="true">{number}</span>}
    </span>
    <div className="wt-step-body">
      <p lang={lang}>{g(step.text, language)}
        {(step.age || step.night) && <span className="todo-badges wt-step-badges">
          {step.age && <span className={`age ${step.age}`}>{t(ageLabel[step.age])}</span>}
          {step.night && <span className="age night">{t('night')}</span>}
        </span>}
      </p>
      {step.tip && <p className="wt-tip" lang={lang}>{g(step.tip, language)}</p>}
      {(items.length > 0 || objectives.length > 0) && <div className="wt-step-links">
        {items.map(i => <span key={i} className="wt-item"><GameItemIcon id={i} size={22} /></span>)}
        {objectives.map(({ item, category }) => <span key={item.id} className={`wt-objective ${hasSave && item.done ? 'done' : ''}`}>
          <button type="button" onClick={() => onShowInChecklist(item.id)} title={t('Ver na checklist')}>
            <GameItemIcon id={trackedItemIcon(item)} size={20} />
            <span>{category === 'gold_skulltulas' ? `#${item.number} · ` : ''}{tail(item.name)}</span>
            {hasSave && item.done && <Check />}
          </button>
          {MAP_CATEGORIES.has(category) && <button type="button" className="wt-objective-map" onClick={() => onShowOnMap(item.id)}
            aria-label={`${t('Ver no mapa')}: ${tail(item.name)}`} title={t('Ver no mapa')}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="m3 6 6-3 6 3 6-3v15l-6 3-6-3-6 3zM9 3v15m6-12v15" /></svg>
          </button>}
        </span>)}
      </div>}
    </div>
  </li>;
}

function Check() {
  return <svg className="wt-check" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 6.3 2.3 2.3 4.7-5" /></svg>;
}
