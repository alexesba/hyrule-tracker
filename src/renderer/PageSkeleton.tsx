import type { ReactNode } from 'react';
import atlas from '../../data/atlas.json';
import { isRemote } from './api';
import type { Page } from './CompanionPages';
import { t } from './i18n';
import { Masonry } from './Masonry';
import './easter-eggs.css';
import './skeleton.css';

const rows = [0, 1, 2];
const four = [0, 1, 2, 3];

function Shape({ width, height, className = '' }: { width?: number | string; height?: number; className?: string }) {
  return <span className={`skeleton-shape ${className}`} style={{ width, height }} />;
}

function Progress() {
  return <div className="page-progress skeleton-stack">
    <Shape width={220} height={18} />
    <Shape height={7} />
  </div>;
}

function Controls({ widths }: { widths: number[] }) {
  return <div className="segment skeleton-controls">
    {widths.map(width => <Shape key={width} className="skeleton-control" width={width} />)}
  </div>;
}

function ListRows() {
  return <div>
    {rows.map(row => <div className="skeleton-list-row" key={row}>
      <Shape width={10} height={10} />
      <Shape width={row === 1 ? 160 : 126} />
      <Shape width={36} />
    </div>)}
  </div>;
}

function ActivityRows() {
  return <ol className="activity-list">
    {rows.map(row => <li key={row}>
      <Shape width={34} />
      <div className="skeleton-stack"><Shape width={row === 1 ? 240 : 186} /><Shape width={108} height={10} /></div>
    </li>)}
  </ol>;
}

function Content({ page }: { page: Page }): ReactNode {
  switch (page) {
    case 'overview':
      return <>
        <div className="focus-panel progress-panel">
          <div className="progress-photo skeleton-shape" />
          <div className="progress-copy skeleton-stack">
            <Shape width={158} height={16} /><Shape width={115} height={61} />
            <Shape width={240} height={7} /><Shape width={162} /><Shape width={120} className="skeleton-control" />
          </div>
          <div className="progress-place skeleton-stack"><Shape width={106} /><Shape width={76} height={10} /></div>
        </div>
        <div className="metric-strip">
          {[...four, 4].map(metric => <div className="metric" key={metric}>
            <div className="metric-label"><Shape width={23} height={23} /><Shape width={92} /></div>
            <strong><Shape width={56} height={29} /></strong>
            <Shape width={104} height={10} />
          </div>)}
        </div>
        <div className="home-grid">
          <div className="focus-panel"><Shape width={132} className="skeleton-heading" /><ListRows /></div>
          <div className="focus-panel"><Shape width={146} className="skeleton-heading" /><ActivityRows /></div>
        </div>
      </>;
    case 'todo':
      return <div className="todo-page">
        <div className="todo-hero"><Shape width={120} /><Shape width={308} height={33} /><Shape width={260} /><Controls widths={[120, 144]} /></div>
        <div className="todo-body">
          <div className="todo-regions">
            {rows.map(region => <div className="todo-region" key={region}>
              <header><Shape width={64} height={40} /><Shape width={140} height={16} /></header>
              <div className="skeleton-region-list"><ListRows /></div>
            </div>)}
          </div>
          <div className="todo-side focus-panel skeleton-stack">
            <Shape width={112} /><Shape width={225} height={23} /><Shape width={166} /><Shape className="skeleton-landscape" /><Controls widths={[112, 94]} />
          </div>
        </div>
      </div>;
    case 'walkthrough':
      return <div className="wt-page">
        <div className="wt-index focus-panel skeleton-stack"><Shape width={150} /><ListRows /><Shape width={130} /><ListRows /></div>
        <div className="wt-chapter">
          <div className="wt-hero skeleton-stack"><Shape width={110} /><Shape width={300} height={30} /><Shape width={260} /><Controls widths={[104, 118]} /></div>
          {rows.map(section => <div className="wt-section skeleton-list-row" key={section}><Shape width={28} height={28} /><Shape width={200} height={16} /></div>)}
        </div>
      </div>;
    case 'map':
      return <>
        <div className="filter-bar skeleton-controls">
          <Shape width={180} className="skeleton-control" /><Shape width={154} /><Shape width={87} />
        </div>
        <div className="map-stage">
          <div className="map-main">
            <div className="zoom-viewport skeleton-map-frame" style={{ aspectRatio: `${atlas.map.width} / ${atlas.map.height}` }}>
              <div className="skeleton-shape skeleton-map-surface" />
              <div className="zoom-controls">{rows.map(control => <Shape width={33} height={33} key={control} />)}</div>
            </div>
          </div>
          <div className="map-side">
            <div className="map-side-head"><Shape width={154} height={16} /></div>
            <div className="map-side-body"><Shape width={86} height={35} className="skeleton-heading" /><ListRows /><ListRows /></div>
          </div>
        </div>
      </>;
    case 'checklist':
      return <>
        <Progress />
        <div className="toolbar skeleton-checklist-filters">
          <Shape width={176} className="skeleton-control skeleton-search" /><Shape width={104} /><Shape width={143} /><Shape width={113} />
        </div>
        <div className="body">
          <div className="grid-wrap">
            <Shape width={136} className="skeleton-heading" />
            <Masonry items={four.map(card => ({ key: String(card), node: <div className="card skeleton-card">
              <div className="section-line"><Shape width={142} height={17} /><Shape width={29} /></div>
              <div className="skeleton-tiles">
                {Array.from({ length: card % 2 === 0 ? 12 : 8 }, (_, tile) => <Shape height={44} key={tile} />)}
              </div>
            </div> }))} />
          </div>
          <div className="side"><div className="focus-panel"><Shape width={108} className="skeleton-heading" /><ListRows /></div></div>
        </div>
      </>;
    case 'threads':
      return <>
        <Progress />
        <div className="story-grid">
          <div className="focus-panel"><Shape width={151} className="skeleton-heading" /><ListRows /><ListRows /></div>
          <div className="focus-panel"><Shape width={172} className="skeleton-heading" /><ListRows /></div>
        </div>
      </>;
    case 'minigames':
      return <>
        <Progress />
        <div className="section-line minigame-controls"><Controls widths={[77, 103, 90]} /></div>
        <div className="minigame-grid">
          {four.map(game => <div className="focus-panel minigame-card" key={game}>
            <div className="minigame-heading"><Shape width={28} height={28} /><Shape width={151} height={17} /></div>
            <ul className="minigame-objectives">{rows.map(row => <li key={row}><Shape width={138} /><Shape width={62} height={30} /></li>)}</ul>
          </div>)}
        </div>
      </>;
    case 'hall':
      return <>
        <Progress />
        <div className="focus-panel hall-panel">
          <Shape width={128} className="skeleton-heading" /><Controls widths={[81, 94, 101]} />
          <Shape width={226} className="skeleton-control skeleton-heading" />
          <div className="hall-list">{four.map(enemy => <div className="hall-row" key={enemy}>
            <Shape width={9} height={9} /><Shape width={46} height={38} /><Shape width={114} /><Shape width={65} />
          </div>)}</div>
        </div>
      </>;
    case 'secrets':
      return <div className="easter-eggs">
        <Progress />
        <ul className="easter-gallery">
          {four.map(region => <li key={region}><div className="easter-region-card">
            <div className="easter-photo skeleton-shape" />
            <div className="easter-region-preview"><Shape width={133} height={16} /><Shape width={68} /><Shape height={7} /></div>
          </div></li>)}
        </ul>
      </div>;
    case 'timeline':
      return <div className="focus-panel">
        <div className="section-line"><Shape width={157} height={18} /><Shape width={121} className="skeleton-control" /></div>
        <div className="timeline-stats">{[128, 163, 119].map(width => <span key={width}><Shape width={19} /><Shape width={width} /></span>)}</div>
        <ActivityRows />
      </div>;
    case 'medals':
      return <div className="focus-panel">
        <div className="skeleton-stack skeleton-heading"><Shape width={161} height={18} /><Shape width={286} /></div>
        <div className="medal-list">{four.map(milestone => <div className="medal-row" key={milestone}>
          <div><Shape width={102} /><Shape width={30} className="skeleton-medal-total" /></div>
          {four.map(medal => <div className="medal" key={medal}><Shape width={15} height={16} /><Shape width={20} /></div>)}
        </div>)}</div>
      </div>;
    case 'quiz':
      return <div className="focus-panel quiz-panel">
        <div className="section-line"><Shape width={192} height={18} /><Shape width={78} /></div>
        <Controls widths={[74, 82]} />
        <div className="skeleton-stack"><Shape width={96} /><Shape width={398} height={19} /><Shape className="quiz-image skeleton-quiz-image" /></div>
        <div className="quiz-answers">{four.map(answer => <Shape className="skeleton-control" key={answer} />)}</div>
      </div>;
    case 'second':
      return <div className="second-screen">
        <div className="focus-panel setting-panel skeleton-stack">
          <Shape width={316} height={18} /><Shape width={536} /><Shape width={383} />
          <Shape width={185} className="skeleton-control" /><Shape width={243} height={43} />
        </div>
        <div className="focus-panel setting-panel"><Shape width={145} className="skeleton-heading" /><ListRows /></div>
        <div className="focus-panel setting-panel"><Shape width={130} className="skeleton-heading" /><ListRows /></div>
      </div>;
    case 'settings':
      return <>
        <div className="focus-panel setting-panel skeleton-stack"><Shape width={76} height={18} /><Shape width={128} className="skeleton-control" /></div>
        <div className="focus-panel setting-panel skeleton-stack">
          <Shape width={140} height={18} /><Shape width={115} /><Shape width={332} height={30} />
          {!isRemote && <Controls widths={[105, 123]} />}
        </div>
        {!isRemote && <div className="focus-panel setting-panel skeleton-stack">
          <Shape width={112} height={18} /><Shape width={220} /><Shape width={191} className="skeleton-control" />
        </div>}
        <div className="focus-panel setting-panel skeleton-stack"><Shape width={84} height={18} /><Shape width={506} /><Shape width={362} /></div>
      </>;
  }
}

export function PageSkeleton({ page, label = 'Preparando o diário…' }: { page: Page; label?: string }) {
  return <>
    <span className="sr-only" role="status">{t(label)}</span>
    <div className={`page-skeleton skeleton-${page}`} aria-busy="true">
      <div className="skeleton-content" aria-hidden="true"><Content page={page} /></div>
    </div>
  </>;
}
