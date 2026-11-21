import { useState, type ReactNode } from 'react';
import type { AtlasStatus } from '../core/atlas';
import type { TrackedItem } from '../shared/types';
import { api } from './api';
import { GameItemIcon } from './GameItemIcon';
import { t } from './i18n';
import { ObjectiveName } from './ObjectiveName';

export interface MarkerDetailsData {
  icon?: string;
  kind: string;
  name: string;
  status: AtlasStatus;
  images: string[];
  item?: TrackedItem;
  tick?: { id: string; on: boolean };
}

export function markerStatusLabel(status: AtlasStatus) {
  return t(status === 'done' ? 'Coletado' : status === 'todo' ? 'Pendente' : 'Situação não mapeada');
}

export function trackedMarkerDetails(item: TrackedItem, markerStatus: AtlasStatus = 'unknown'): Pick<MarkerDetailsData, 'item' | 'status' | 'tick'> {
  return {
    item,
    status: item.done ? 'done' : item.state === 'unknown' || item.state === 'unmapped' ? markerStatus : 'todo',
    tick: item.state !== 'yes' ? { id: item.id, on: item.done } : undefined,
  };
}

export function MarkerDetails({ marker, onClose, actions }: { marker: MarkerDetailsData; onClose: () => void; actions?: ReactNode }) {
  const [shot, setShot] = useState(0);
  const { icon, kind, name, status, images, item, tick } = marker;
  const cycle = (step: number) => setShot(index => (index + step + images.length) % images.length);
  return <>
    <div className="marker-card-head">
      <span className="marker-kind"><GameItemIcon id={icon} size={15} />{kind}</span>
      <button type="button" className="marker-close" aria-label={t('Fechar')} onClick={onClose}>×</button>
    </div>
    <h3><ObjectiveName done={status === 'done'}>{t(name)}</ObjectiveName></h3>
    <small className={`marker-status ${status}`} aria-live="polite">{markerStatusLabel(status)}</small>
    {item?.where && <p className="marker-where">{t(item.where)}</p>}
    {(tick || actions) && <div className="result-actions">
      {tick && <button type="button" className="action" onClick={() => void api.toggleManual(tick.id)}>{t(tick.on ? 'Desmarcar' : 'Concluí')}</button>}
      {actions}
    </div>}
    {images.length > 0 && <div className="marker-photo">
      <img src={images[shot % images.length]} alt={t('Local no jogo')} />
      {images.length > 1 && <>
        <button type="button" className="photo-nav prev" aria-label={t('Foto anterior')} onClick={() => cycle(-1)}>‹</button>
        <button type="button" className="photo-nav next" aria-label={t('Próxima foto')} onClick={() => cycle(1)}>›</button>
        <span className="photo-count">{shot % images.length + 1}/{images.length}</span>
      </>}
    </div>}
  </>;
}
