import { use, useMemo, useRef, useState, type CSSProperties, type RefObject } from 'react';
import type { AppState, TrackedCategory, TrackedItem } from '../shared/types';
import guide from '../../data/walkthrough.json';
import {
  chapterProgress, currentChapter, sectionStatuses, type ChapterProgress, type DoneLookup, type StepStatus,
  type WalkthroughChapter, type WalkthroughFile, type WalkthroughPart, type WalkthroughSection, type WalkthroughStep,
} from '../core/walkthrough';
import { areaShot, atlasKinds, atlasStages, categoryIcons, rowMarkers } from './CompanionPages';
import { GameItemIcon, trackedItemIcon } from './GameItemIcon';
import { currentLocale, message, percent, plural, t, tail, type Locale } from './i18n';
import { MarkerDetails, trackedMarkerDetails, type MarkerDetailsData } from './MarkerDetails';
import { useModalDialog } from './useModalDialog';
import { useNarrow } from './WhatToDo';
import './walkthrough.css';

const chapters = (guide as WalkthroughFile).chapters;
const localGuideFiles = import.meta.glob<Record<string, string>>('./walkthrough-locales/*.json', { import: 'default' });
const guideLoads = new Map<Locale, Promise<Record<string, string> | undefined>>();

type GuideText = (source: string) => string;

function useGuideLanguage(): { translate: GuideText; lang?: string } {
  const locale = currentLocale();
  if (locale === 'en-US') return { translate: source => source };
  let loading = guideLoads.get(locale);
  if (!loading) {
    const load = locale === 'pt-BR' || locale === 'es-ES'
      ? import('./walkthrough-strings.json').then(({ default: strings }) => Object.fromEntries(
        Object.entries(strings).map(([source, translations]) => [source, translations[locale === 'pt-BR' ? 0 : 1]]),
      ))
      : localGuideFiles[`./walkthrough-locales/${locale}.json`]?.();
    loading = load?.catch(error => {
      console.error(error);
      return undefined;
    }) ?? Promise.resolve(undefined);
    guideLoads.set(locale, loading);
  }
  const dictionary = use(loading);
  return dictionary ? { translate: source => dictionary[source] ?? source } : { translate: source => source, lang: 'en-US' };
}

const partTitles: Record<WalkthroughPart, string> = {
  stones: 'Parte 1: as Pedras Espirituais',
  medallions: 'Parte 2: os Medalhões',
  ganon: 'Parte 3: o Rei do Mal',
  side: 'Missões secundárias',
};
const parts = Object.keys(partTitles) as WalkthroughPart[];
const ageLabel = { child: 'Criança', adult: 'Adulto', both: 'Criança e adulto' } as const;

export default function Walkthrough({ state, onShowPlace }: {
  state: AppState;
  onShowPlace: (placeId: string) => void;
}) {
  const rows = useMemo(() => new Map(state.categories.flatMap(c => c.items.map(i => [i.id, { item: i, category: c }] as const))), [state.categories]);
  const markers = useMemo(() => rowMarkers(state.atlasLinks), [state.atlasLinks]);
  const hasSave = !!state.summary;
  const done = useMemo<DoneLookup>(() => id => (hasSave ? rows.get(id)?.item.done : false), [rows, hasSave]);
  const progress = useMemo(() => chapters.map(c => chapterProgress(c, done)), [done]);
  const current = useMemo(() => (hasSave ? currentChapter(chapters, done) : -1), [done, hasSave]);

  const [picked, setPicked] = useState<string>();
  const [objectiveId, setObjectiveId] = useState<string>();
  const index = Math.max(0, picked ? chapters.findIndex(c => c.id === picked) : current);
  const chapter = chapters[index];
  const [page, setPage] = useState<HTMLDivElement | null>(null);
  const compact = useNarrow(page, 760);
  const top = useRef<HTMLElement>(null);
  const sheet = useRef<HTMLDetailsElement>(null);
  const { translate, lang } = useGuideLanguage();
  const objective = objectiveId ? rows.get(objectiveId) : undefined;
  const marker = objectiveId ? markers.get(objectiveId) : undefined;

  const showObjective = (id: string) => {
    // Marking an objective can advance the save's current chapter while the player is still reading this one.
    setPicked(chapter.id);
    setObjectiveId(id);
  };

  const pick = (id: string) => {
    setPicked(id);
    if (sheet.current) sheet.current.open = false;
    const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
    requestAnimationFrame(() => top.current?.scrollIntoView({ block: 'start', behavior: reducedMotion ? 'auto' : 'smooth' }));
  };

  const list = <ChapterIndex hasSave={hasSave} progress={progress} current={current} selected={index} translate={translate} lang={lang} onPick={pick} />;
  return <div ref={setPage} className={`wt-page ${compact ? 'compact' : ''}`}>
    {compact ? <details ref={sheet} className="wt-index-sheet">
      <summary>
        <span className="wt-index-sheet-label">{t('Capítulos')}</span>
        <b lang={lang}>{index + 1}. {translate(chapter.title)}</b>
      </summary>
      {list}
    </details> : <aside className="wt-index" aria-label={t('Capítulos')}>{list}</aside>}
    <ChapterView key={chapter.id} chapterRef={top} chapter={chapter} number={index + 1} progress={progress[index]} isCurrent={index === current}
      hasSave={hasSave} done={done} rows={rows} translate={translate} lang={lang}
      onShowObjective={showObjective} onShowPlace={onShowPlace}
      previous={chapters[index - 1]} next={chapters[index + 1]} onPick={pick} />
    {objective && <ObjectivePopup key={objective.item.id} onClose={() => setObjectiveId(undefined)} marker={{
      ...trackedMarkerDetails(objective.item, marker && state.atlasStatus?.[marker.id]),
      name: marker?.name ?? objective.item.name,
      kind: t((marker && atlasKinds[marker.cat]) || objective.category.label),
      icon: categoryIcons[objective.category.id] ?? trackedItemIcon(objective.item),
      images: marker?.images ?? [],
    }} />}
  </div>;
}

function ChapterIndex({ hasSave, progress, current, selected, translate, lang, onPick }: {
  hasSave: boolean; progress: ChapterProgress[]; current: number; selected: number; translate: GuideText; lang?: string; onPick: (id: string) => void;
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
              <b lang={lang}>{translate(c.title)}</b>
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

type Rows = Map<string, { item: TrackedItem; category: TrackedCategory }>;

function ChapterView({ chapter, chapterRef, number, progress, isCurrent, hasSave, done, rows, translate, lang, onShowObjective, onShowPlace, previous, next, onPick }: {
  chapter: WalkthroughChapter; chapterRef: RefObject<HTMLElement | null>; number: number; progress: ChapterProgress; isCurrent: boolean; hasSave: boolean;
  done: DoneLookup; rows: Rows; translate: GuideText; lang?: string;
  onShowObjective: (id: string) => void; onShowPlace: (placeId: string) => void;
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
      <h2 id="wt-chapter-title" lang={lang}><span className="wt-hero-number">{number}.</span> {translate(chapter.title)}</h2>
      <p lang={lang}>{translate(chapter.summary)}</p>
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
        translate={translate} lang={lang} onShowPlace={onShowPlace} onShowObjective={id => {
          setOpen(o => ({ ...o, [section.id]: true }));
          onShowObjective(id);
        }} />
    ))}</div>

    <footer className="wt-pager">
      {previous && <button type="button" className="action" onClick={() => onPick(previous.id)}>
          <small>{t('Capítulo anterior')}</small><span lang={lang}>{translate(previous.title)}</span>
      </button>}
      {next && <button type="button" className="action next" onClick={() => onPick(next.id)}>
          <small>{t('Próximo capítulo')}</small><span lang={lang}>{translate(next.title)}</span>
      </button>}
    </footer>
  </article>;
}

function Section({ section, number, statuses, open, onToggle, rows, hasSave, translate, lang, onShowObjective, onShowPlace }: {
  section: WalkthroughSection; number: number; statuses: { status: StepStatus; passed: boolean }[]; open: boolean; onToggle: () => void;
  rows: Rows; hasSave: boolean; translate: GuideText; lang?: string;
  onShowObjective: (id: string) => void; onShowPlace: (placeId: string) => void;
}) {
  const checked = statuses.filter(s => s.status !== 'plain');
  const finished = statuses.every(s => s.passed);
  const body = `wt-section-${section.id}`;
  return <section className={`wt-section ${section.optional ? 'optional' : ''} ${hasSave && finished ? 'finished' : ''}`}>
    <h3>
      <button type="button" aria-expanded={open} aria-controls={body} onClick={onToggle}>
        <span className="wt-section-number" aria-hidden="true">{hasSave && finished ? <Check /> : section.optional ? '+' : number}</span>
        <span className="wt-section-title">
          <span lang={lang}>{translate(section.title)}</span>
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
        <Step key={i} step={step} number={i + 1} state={statuses[i]} rows={rows} hasSave={hasSave} translate={translate} lang={lang}
          onShowObjective={onShowObjective} />
      ))}</ol>
    </div>}
  </section>;
}

function Step({ step, number, state, rows, hasSave, translate, lang, onShowObjective }: {
  step: WalkthroughStep; number: number; state: { status: StepStatus; passed: boolean }; rows: Rows; hasSave: boolean; translate: GuideText; lang?: string;
  onShowObjective: (id: string) => void;
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
      <p lang={lang}>{translate(step.text)}
        {(step.age || step.night) && <span className="todo-badges wt-step-badges">
          {step.age && <span className={`age ${step.age}`}>{t(ageLabel[step.age])}</span>}
          {step.night && <span className="age night">{t('night')}</span>}
        </span>}
      </p>
      {step.tip && <p className="wt-tip" lang={lang}>{translate(step.tip)}</p>}
      {(items.length > 0 || objectives.length > 0) && <div className="wt-step-links">
        {items.map(i => <span key={i} className="wt-item"><GameItemIcon id={i} size={22} /></span>)}
        {objectives.map(({ item, category }) => <button key={item.id} type="button" aria-haspopup="dialog"
          className={`wt-objective ${hasSave && item.done ? 'done' : ''}`} onClick={() => onShowObjective(item.id)}>
          <GameItemIcon id={trackedItemIcon(item)} size={20} />
          <span>{category.id === 'gold_skulltulas' ? `#${item.number} · ` : ''}{tail(item.name)}</span>
          {hasSave && item.done && <Check />}
        </button>)}
      </div>}
    </div>
  </li>;
}

function ObjectivePopup({ marker, onClose }: { marker: MarkerDetailsData; onClose: () => void }) {
  const dialog = useModalDialog(true);
  return <dialog ref={dialog} className="marker-card wt-objective-popup" aria-label={t(marker.name)}
    onCancel={e => { e.preventDefault(); onClose(); }}
    onClick={e => {
      if (e.target !== e.currentTarget) return;
      const { left, right, top, bottom } = e.currentTarget.getBoundingClientRect();
      if (e.clientX < left || e.clientX > right || e.clientY < top || e.clientY > bottom) onClose();
    }}>
    <MarkerDetails marker={marker} onClose={onClose} />
  </dialog>;
}

function Check() {
  return <svg className="wt-check" viewBox="0 0 12 12" aria-hidden="true"><path d="m2.5 6.3 2.3 2.3 4.7-5" /></svg>;
}
