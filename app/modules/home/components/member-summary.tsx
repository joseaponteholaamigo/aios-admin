// Quién es la persona y qué módulos puede usar, con su nivel, tal como los da `/yo` (CA-31).
import type { Level, Module } from '../../../domain/permissions';
import { LEVEL_LABELS, MODULE_LABELS } from '../module-labels';

export type MemberSummaryProps = {
  name: string;
  isSuperadmin: boolean;
  modules: { module: Module; level: Level }[];
};

export function MemberSummary({ name, isSuperadmin, modules }: MemberSummaryProps) {
  return (
    <section className="card" aria-labelledby="member-summary-title">
      <div className="card-h">
        <div>
          <span className="eyebrow accent">Tu acceso</span>
          <h2 id="member-summary-title">{name}</h2>
          {isSuperadmin && <p>Superadministrador: puedes usar todos los módulos.</p>}
        </div>
      </div>
      <div className="card-b">
        {modules.length === 0 ? (
          <p className="empty">Todavía no tienes módulos asignados. Pídeselos a quien administra el panel.</p>
        ) : (
          // Chips y no una lista con viñetas: así se veían los módulos en el panel viejo.
          <div className="chips" role="list" aria-label="Tus módulos">
            {modules.map(({ module, level }) => (
              <span key={module} role="listitem" className={level === 'edit' ? 'chip accent' : 'chip'}>
                {MODULE_LABELS[module]}: {LEVEL_LABELS[level]}
              </span>
            ))}
          </div>
        )}
      </div>
    </section>
  );
}
