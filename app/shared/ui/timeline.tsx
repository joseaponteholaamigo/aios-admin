// Una línea de tiempo, como la de la ficha del panel viejo: cuándo, un punto y qué pasó.
import type { ReactNode } from 'react';
import { formatDateTime } from './format';
import './timeline.css';

export type TimelineItem = { key: string; at: string; title: ReactNode; detail?: ReactNode };

export function Timeline({ items, empty }: { items: TimelineItem[]; empty: string }) {
  if (items.length === 0) return <p className="empty">{empty}</p>;
  return (
    <div className="timeline">
      <ul>
        {items.map((item) => (
          <li key={item.key}>
            <span className="ts">{formatDateTime(item.at)}</span>
            <span className="pt" aria-hidden="true" />
            <span className="what">
              {item.title}
              {item.detail && <span className="small muted">{item.detail}</span>}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
