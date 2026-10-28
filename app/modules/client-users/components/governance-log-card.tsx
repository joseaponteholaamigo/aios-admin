// La bitácora de gobierno de una empresa: quién invitó, quitó o cambió de rol a quién, y las
// personas revocadas, que «Mi equipo» ya no muestra.
import type { CompanyPeople } from '../../../domain/client-users';
import { formatDate } from '../../../shared/ui/format';
import { Timeline } from '../../../shared/ui/timeline';

export function GovernanceLogCard({ log, revoked }: Pick<CompanyPeople, 'log' | 'revoked'>) {
  const items = log.map((entry, i) => ({
    key: `${entry.at}-${i}`,
    at: entry.at,
    title: <span><code>{entry.action}</code>{entry.about && <> · {entry.about}</>}</span>,
    detail: entry.actor ? `por ${entry.actor}` : undefined,
  }));
  return (
    <section className="card">
      <div className="card-h"><div><h2>Bitácora del equipo</h2><p>Las últimas 50 acciones de su admin y del equipo ensō.</p></div></div>
      <div className="card-b">
        <Timeline items={items} empty="Todavía no hay acciones anotadas." />
        {revoked.length > 0 && (
          <>
            <h3 className="eyebrow">Revocadas</h3>
            <ul className="chips" aria-label="Personas revocadas">
              {revoked.map((r) => <li key={r.email} className="chip">{r.email} · {formatDate(r.revokedAt)}</li>)}
            </ul>
          </>
        )}
      </div>
    </section>
  );
}
