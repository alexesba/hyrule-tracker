import { t } from './i18n';
import { useCallback, useRef, useState } from 'react';
import { quizImages } from './referenceImages';

const prefix = 'hyrule-tracker.';
const day = () => new Intl.DateTimeFormat('sv-SE').format(new Date());
/**
 * Functional updates use the latest value, including changes that React has yet to render.
 */
export function useStored<T>(key: string, initial: T) {
  const read = () => {
    try { const raw = localStorage.getItem(prefix + key); return raw ? JSON.parse(raw) as T : initial; }
    catch { return initial; }
  };
  const [item, setItem] = useState<{ key: string; value: T }>(() => ({ key, value: read() }));
  const value = item.key === key ? item.value : read();
  const latest = useRef(item);
  if (latest.current.key !== key) latest.current = { key, value };
  const change = useCallback((next: T | ((value: T) => T)) => {
    const current = latest.current.key === key ? latest.current.value : read();
    const updated = typeof next === 'function' ? (next as (v: T) => T)(current) : next;
    try { localStorage.setItem(prefix + key, JSON.stringify(updated)); } catch { /* storage may be unavailable */ }
    latest.current = { key, value: updated };
    setItem({ key, value: updated });
  }, [key]);
  return [value, change] as const;
}

export type Question = [string, string, string, string, string, string?, string?];
const normal: Question[] = [
  ['Quem acompanha Link desde Kokiri?', 'Navi', 'Malon', 'Sheik', 'Impa'],
  ['Quem ensina a canção de Epona?', 'Malon', 'Saria', 'Zelda', 'Ruto'],
  ['Qual arma pode voltar depois de arremessada?', 'Bumerangue', 'Estilingue', 'Martelo Megaton', 'Espada Kokiri'],
  ['Qual instrumento Link aprende a tocar?', 'Ocarina', 'Harpa', 'Flauta de Pã', 'Tambor'],
  ['Quantos pedaços formam um coração inteiro?', '4', '2', '3', '5'],
  ['Quantas Skulltulas douradas podem ser coletadas?', '100', '84', '50', '36'],
  ['Onde Zelda é encontrada pela primeira vez?', 'Castelo de Hyrule', 'Lago Hylia', 'Templo do Tempo', 'Vila Kakariko'],
  ['Qual é o nome do cavalo de Link?', 'Epona', 'Navi', 'Saria', 'Ingo'],
  ['Qual é a terra natal dos Kokiri?', 'Floresta Kokiri', 'Vale Gerudo', 'Campo de Hyrule', 'Cidade Goron'],
  ['Que raça vive no Domínio Zora?', 'Zora', 'Goron', 'Gerudo', 'Kokiri'],
  ['Quem é o antagonista principal?', 'Ganondorf', 'Darunia', 'Mido', 'Ingo'],
  ['Que item abre caminho explodindo pedras rachadas?', 'Bomba', 'Arco', 'Feijão mágico', 'Garrafa'],
  ['Onde fica o Rancho Lon Lon?', 'Campo de Hyrule', 'Domínio Zora', 'Castelo de Ganon', 'Bosque Perdido'],
  ['Qual é a moeda encontrada pelo caminho?', 'Rupee', 'Medalhão', 'Token', 'Pedra espiritual'],
  ['O que Link usa para refletir ataques?', 'Escudo', 'Bumerangue', 'Martelo', 'Botas de Ferro'],
];
const hard: Question[] = [
  ['Qual chefe espera no Templo da Floresta?', 'Phantom Ganon', 'Volvagia', 'Morpha', 'Twinrova'],
  ['Quem guarda a Pedra Espiritual da Água?', 'Ruto', 'Darunia', 'Nabooru', 'Saria'],
  ['Qual é a arma encontrada no Templo do Fogo?', 'Martelo Megaton', 'Arco das Fadas', 'Lente da Verdade', 'Bumerangue'],
  ['Em que templo aparece Dark Link?', 'Templo da Água', 'Templo dos Espíritos', 'Templo do Fogo', 'Templo das Sombras'],
  ['Qual a primeira masmorra de Link criança?', 'Grande Árvore Deku', 'Caverna dos Dodongos', 'Fundo do Poço', 'Barriga de Jabu-Jabu'],
  ['Quem se torna o Sábio do Fogo?', 'Darunia', 'Rauru', 'Mido', 'Talon'],
  ['Qual chefe é combatido no Templo das Sombras?', 'Bongo Bongo', 'Gohma', 'Twinrova', 'King Dodongo'],
  ['Qual canção transporta Link ao Lago Hylia?', 'Serenata da Água', 'Prelúdio da Luz', 'Bolero do Fogo', 'Minueto da Floresta'],
  ['Qual prova rende a Escala Dourada?', 'Pesca', 'Tiro ao alvo', 'Corrida de cavalos', 'Caça aos Poes'],
  ['Qual inimigo é derrotado na barriga de Jabu-Jabu?', 'Barinade', 'Morpha', 'Gohma', 'Volvagia'],
  ['Quantas Estátuas de Monstros existem no remake?', '84', '100', '36', '25'],
  ['Quantos Pedaços de Coração existem para coletar?', '36', '40', '17', '20'],
  ['Quem forja a espada de duas mãos na troca de adulto?', 'Biggoron', 'Darunia', 'Medigoron', 'Mido'],
  ['Qual é o nome do deserto entre a fortaleza e o Colosso?', 'Deserto Assombrado', 'Deserto Lanayru', 'Vale de Ikana', 'Areias de Nayru'],
  ['Quem é a Sábia dos Espíritos?', 'Nabooru', 'Impa', 'Ruto', 'Zelda'],
];
const testLength = 5;
/** Three different wrong answers for picture i, spread through the list; none if there aren't enough images. */
function wrongNames(names: string[], i: number): string[] | undefined {
  const others = names.filter((_, j) => j !== i);
  if (others.length < 3) return undefined;
  const picked = new Set<number>();
  for (const offset of [2, 6, 10]) {
    let j = (i + offset) % others.length;
    while (picked.has(j)) j = (j + 1) % others.length;
    picked.add(j);
  }
  return [...picked].map(j => others[j]);
}
function pictureQuestions(kind: 'enemy' | 'place'): Question[] {
  const images = quizImages(kind);
  const names = images.map(photo => photo.name);
  const label = kind === 'enemy' ? 'Que inimigo está na imagem?' : 'Que local está na imagem?';
  return images.flatMap((photo, i): Question[] => {
    const wrong = wrongNames(names, i);
    return wrong ? [[label, photo.name, wrong[0], wrong[1], wrong[2], photo.file]] : [];
  });
}
const normalBank = [...normal, ...pictureQuestions('place')];
const hardBank = [...hard, ...pictureQuestions('enemy')];
export function Quiz({ normalQuestions = normalBank, hardQuestions = hardBank, historyKey = 'quiz.results' }: {
  normalQuestions?: Question[]; hardQuestions?: Question[]; historyKey?: string;
} = {}) {
  const [level, setLevel] = useState<'normal' | 'hard'>('normal');
  const [history, setHistory] = useStored<Record<string, number>>(historyKey, {});
  const [index, setIndex] = useState(0);
  const [chosen, setChosen] = useState<string>();
  const [score, setScore] = useState(0);
  const [practice, setPractice] = useState(false);
  const key = `${day()}.${level}`;
  const bank = level === 'normal' ? normalQuestions : hardQuestions;
  const seed = Math.floor(Date.parse(day()) / 86400000);
  const question = bank[(seed + index * 2 + (practice ? 5 : 0)) % bank.length];
  const [label, answer, wrong1, wrong2, wrong3, photo, explanation] = question;
  const answers = [answer, wrong1, wrong2, wrong3];
  const rotate = (seed + index) % answers.length;
  function reset(next: boolean) { setPractice(next); setIndex(0); setChosen(undefined); setScore(0); }
  return <section className="focus-panel quiz-panel"><div className="section-line"><h2>{t("Conhecimentos de Hyrule")}</h2><span>{practice ? t('Treino') : t('Rodada diária')}</span></div>
    <div className="segment">{(['normal','hard'] as const).map(l => <button key={l} aria-pressed={level === l} onClick={() => { setLevel(l); reset(false); }}>{l === 'normal' ? t('Normal') : t('Difícil')}</button>)}</div>
    {index >= testLength || (!practice && history[key] != null) ? <>
      <p className="quiz-score">{!practice && history[key] != null ? history[key] : score} {t("de")} {testLength} {t("acertos")}</p>
      <button className="action primary" onClick={() => reset(true)}>{t("Jogar no modo treino")}</button>
    </> : <>
      <p className="quiet">{t("Questão")} {index + 1} {t("de")} {testLength}</p><h3>{t(label)}</h3>
      {photo && <img className="quiz-image" src={photo} alt={t('Imagem da pergunta')} />}
      <div className="quiz-answers">{[...answers.slice(rotate), ...answers.slice(0, rotate)].map((text, i) =>
        <button className="action" key={`${i}:${text}`} aria-pressed={chosen === text} disabled={!!chosen} onClick={() => { setChosen(text); if (text === answer) setScore(score + 1); }}>{t(text)}</button>,
      )}</div>
      {chosen && <><p className="notice" role="status">{chosen === answer ? t('Resposta correta.') : `${t('Resposta correta')} · ${t(answer)}.`}{explanation && ' ' + explanation}</p><button className="action primary" onClick={() => {
        if (!practice && index + 1 === testLength) setHistory({ ...history, [key]: score });
        setIndex(index + 1); setChosen(undefined);
      }}>{index + 1 === testLength ? t('Ver resultado') : t('Próxima questão')}</button></>}
    </>}
  </section>;
}
