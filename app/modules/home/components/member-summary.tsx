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
    <section aria-labelledby="member-summary-title">
      <h2 id="member-summary-title">{name}</h2>
      {isSuperadmin && <p>Superadministrador: puedes usar todos los módulos.</p>}
      {modules.length === 0 ? (
        <p>Todavía no tienes módulos asignados. Pídeselos a quien administra el panel.</p>
      ) : (
        <ul>
          {modules.map(({ module, level }) => (
            <li key={module}>
              {MODULE_LABELS[module]}: {LEVEL_LABELS[level]}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
