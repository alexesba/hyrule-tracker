import type { ReactNode } from 'react';

export function JourneyProgress({ title, artwork, progress, description, action, place, variant }: {
  title: string;
  artwork?: string;
  progress?: { value: number; display: string; label: string };
  description: string;
  action: ReactNode;
  place?: ReactNode;
  variant?: string;
}) {
  return <section className={['focus-panel progress-panel', artwork && 'has-photo', variant].filter(Boolean).join(' ')}>
    {artwork && <img className="progress-photo" src={artwork} alt="" referrerPolicy="no-referrer"
      onError={event => { event.currentTarget.hidden = true; }} />}
    <div className="progress-copy">
      <h2>{title}</h2>
      {progress && <>
        <div className="big-progress">{progress.display}<span>%</span></div>
        <progress aria-label={progress.label} value={progress.value} max={100} />
      </>}
      <p>{description}</p>
      {action}
    </div>
    {place && <div className="progress-place">{place}</div>}
  </section>;
}

interface Metric {
  label: string;
  icon: ReactNode;
  value: ReactNode;
  max?: number;
  detail: string;
}

export function JourneyMetrics({ label, metrics }: { label: string; metrics: Metric[] }) {
  return <section className="metric-strip" aria-label={label}>
    {metrics.map(metric => <div className="metric" key={metric.label}>
      <span className="metric-label">{metric.icon}{metric.label}</span>
      <strong>{metric.value}{metric.max != null && <small>/{metric.max}</small>}</strong>
      <span>{metric.detail}</span>
    </div>)}
  </section>;
}
