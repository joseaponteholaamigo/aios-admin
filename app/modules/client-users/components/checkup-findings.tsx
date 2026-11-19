// Los hallazgos de la revisión de datos, uno por tipo, con lo que significa cada uno y a quién le
// duele. Los textos vienen de `npm run tenant -- doctor` y de `src/lib/doctor.js` del backend.
import type { DataCheckup, FindingKind } from '../../../domain/client-users';
import { FINDING_KINDS } from '../../../domain/client-users';

const KINDS: Record<FindingKind, { title: string; why: string; tone: 'bad' | 'warn' }> = {
  seatsWithoutIndex: { title: 'Personas que no pueden entrar', why: 'Su asiento no tiene índice de correo.', tone: 'bad' },
  seatsInAnotherCompany: { title: 'Correos que entran a otra empresa', why: 'Huella de una invitación a medias. No revoques ese asiento: borraría el índice de la otra empresa.', tone: 'bad' },
  companiesWithoutCredential: { title: 'Empresas cuya licencia no autentica', why: 'Su llave existe pero no tiene índice.', tone: 'bad' },
  companiesWithoutAdmin: { title: 'Empresas sin admin', why: 'Nadie puede gestionar su equipo; si paga por Stripe, nadie con sesión gestiona su suscripción.', tone: 'warn' },
  withoutPublishCredential: { title: 'Empresas sin credencial de publicación', why: 'Se arregla rotando la credencial.', tone: 'warn' },
  staleIndexes: { title: 'Correos que apuntan a donde ya no deben', why: 'Esa persona entra a ninguna parte, y nadie más la puede invitar.', tone: 'warn' },
  orphanCredentials: { title: 'Credenciales sin empresa', why: 'Apuntan a una empresa que ya no existe: responden 401.', tone: 'warn' },
};

export function CheckupFindings({ findings }: { findings: DataCheckup['findings'] }) {
  const withFindings = FINDING_KINDS.filter((kind) => findings[kind].length > 0);
  if (withFindings.length === 0) return <p className="empty">Sin inconsistencias en las empresas que el panel muestra.</p>;
  return (
    <>
      {withFindings.map((kind) => (
        <section key={kind} className="card">
          <div className="card-h">
            <div>
              <h2>{KINDS[kind].title} <span className={`badge ${KINDS[kind].tone}`}>{findings[kind].length}</span></h2>
              <p>{KINDS[kind].why}</p>
            </div>
          </div>
          <div className="tbl-wrap">
            <table className="tbl">
              <thead><tr><th>Empresa</th><th>Persona</th><th>Detalle</th></tr></thead>
              <tbody>
                {findings[kind].map((f, i) => (
                  <tr key={`${f.companyId}-${f.email ?? i}`}>
                    <td className="mono small">{f.companyId}</td>
                    <td className="small">{f.email ?? '—'}</td>
                    <td className="small muted">{f.detail ?? '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ))}
    </>
  );
}
