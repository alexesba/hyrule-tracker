// The step-by-step guide (data/walkthrough.json) and how far the player is in it, from the checklist rows.
// No imports from Electron, Node or React: the renderer and the tests use it as is.

export type Age = 'child' | 'adult';

export interface WalkthroughStep {
  /** What to do, in a sentence or two (English; walkthrough-strings.json holds the translations). */
  text: string;
  /** Checklist rows this step gets you. The step reads as done once all of them are. */
  objectives?: string[];
  /** Game icons (item-images.json) for what you get or use in this step. */
  items?: string[];
  age?: Age;
  night?: boolean;
  /** A short extra hint shown under the step. */
  tip?: string;
}

export interface WalkthroughSection {
  id: string;
  title: string;
  /** Atlas place (atlas.json) the section happens in, for "View on map". */
  place?: string;
  /** Side content you can do at this point; it does not count toward the chapter's progress. */
  optional?: boolean;
  steps: WalkthroughStep[];
}

export type WalkthroughPart = 'stones' | 'medallions' | 'ganon' | 'side';

export interface WalkthroughChapter {
  id: string;
  part: WalkthroughPart;
  title: string;
  summary: string;
  age: Age | 'both';
  /** Atlas place the chapter is mostly about (map link and picture). */
  place: string;
  /** Checklist rows that mean the chapter is finished. */
  goal: string[];
  /** The page the facts were checked against. */
  source: string;
  sections: WalkthroughSection[];
}

export interface WalkthroughFile {
  note: string;
  chapters: WalkthroughChapter[];
}

/** Whether a checklist row is done (by save or by hand); undefined when the row is not in the checklist. */
export type DoneLookup = (id: string) => boolean | undefined;

export type StepStatus = 'done' | 'todo' | 'plain';

/** A step with objectives is done when all of them are; a step without any has nothing to check. */
export function stepStatus(step: WalkthroughStep, done: DoneLookup): StepStatus {
  if (!step.objectives?.length) return 'plain';
  return step.objectives.every(id => done(id) === true) ? 'done' : 'todo';
}

export interface ChapterProgress {
  /** Main-path steps with objectives, and how many of them are done. */
  done: number;
  total: number;
  /** The same for the optional sections. */
  extrasDone: number;
  extrasTotal: number;
  /** Every goal row is done. */
  complete: boolean;
  /** Any objective of the chapter, main or optional, is done. */
  started: boolean;
}

export function chapterProgress(chapter: WalkthroughChapter, done: DoneLookup): ChapterProgress {
  const out: ChapterProgress = { done: 0, total: 0, extrasDone: 0, extrasTotal: 0, complete: false, started: false };
  for (const section of chapter.sections) for (const step of section.steps) {
    const status = stepStatus(step, done);
    if (status === 'plain') continue;
    if (section.optional) { out.extrasTotal++; if (status === 'done') out.extrasDone++; }
    else { out.total++; if (status === 'done') out.done++; }
    if (step.objectives!.some(id => done(id) === true)) out.started = true;
  }
  out.complete = chapter.goal.length > 0 && chapter.goal.every(id => done(id) === true);
  if (out.complete) out.started = true;
  return out;
}

/**
 * The chapter the player is on: the first unfinished story chapter after the furthest finished one,
 * so a skipped errand early on does not pin the guide to the start. Falls back to the first unfinished
 * story chapter, and -1 when every story chapter is finished. Side chapters are never "current".
 */
export function currentChapter(chapters: WalkthroughChapter[], done: DoneLookup): number {
  const complete = chapters.map(c => c.part !== 'side' && chapterProgress(c, done).complete);
  const furthest = complete.lastIndexOf(true);
  const open = (from: number) => chapters.findIndex((c, i) => i >= from && c.part !== 'side' && !complete[i]);
  const next = open(furthest + 1);
  return next >= 0 ? next : open(0);
}

/**
 * Per step of one section: its own status, and whether the player is past it: a checked step that is done,
 * or a plain step followed by a done step in the same section, or any step of a finished chapter.
 */
export function sectionStatuses(section: WalkthroughSection, done: DoneLookup, chapterComplete = false): { status: StepStatus; passed: boolean }[] {
  const statuses = section.steps.map(step => stepStatus(step, done));
  const lastDone = statuses.lastIndexOf('done');
  return statuses.map((status, i) => ({
    status,
    passed: status === 'done' || (status === 'plain' && (i < lastDone || (chapterComplete && !section.optional))),
  }));
}

/** Every text of the guide that needs a translation, in file order. */
export function walkthroughTexts(file: WalkthroughFile): string[] {
  const out: string[] = [];
  for (const c of file.chapters) {
    out.push(c.title, c.summary);
    for (const s of c.sections) {
      out.push(s.title);
      for (const step of s.steps) { out.push(step.text); if (step.tip) out.push(step.tip); }
    }
  }
  return out;
}
