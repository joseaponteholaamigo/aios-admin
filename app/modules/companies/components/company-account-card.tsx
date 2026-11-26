// Los datos de la cuenta que el equipo mira antes de cambiarle algo (spec «Editar cuentas y personas»,
// CA-2 y CA-3): cuándo se creó, de dónde salió una cuenta personal, cuándo vence, si tiene cliente de
// Stripe, cuántos admins tiene una empresa y, para el superadministrador, el tope de la voz que le rige.
import { Link } from 'react-router';
import type { CompanyFile } from '../../../domain/companies';
import type { AccountVoiceCap } from '../../../domain/voice-cap';
import { voiceCapHref } from '../../../shared/routing/voice-href';
import { FactList, type Fact } from '../../../shared/ui/fact-list';
import { dollarsLabel, formatDate } from '../../../shared/ui/format';
import { badgeClass, expiryLabel } from '../company-labels';
import { originLabel } from '../personal-accounts-labels';
import './company-account-card.css';

/** El tope de la voz que rige para la cuenta, o que no se pudo leer. `null`: quien mira no es superadministrador. */
export type VoiceCapView = { ok: true; cap: AccountVoiceCap } | { ok: false } | null;

const VOICE_SOURCES: Record<AccountVoiceCap['source'], string> = { exception: 'su excepción', general: 'el general' };

function ExpiryValue({ file }: { file: CompanyFile }) {
  const badge = expiryLabel(file);
  const until = file.expiry.until ? formatDate(file.expiry.until) : 'Sin fecha de fin';
  return <>{until}{badge && <> <span className={badgeClass(badge.tone)}>{badge.text}</span></>}</>;
}

function VoiceCapValue({ view, accountId }: { view: Exclude<VoiceCapView, null>; accountId: string }) {
  const change = <Link to={voiceCapHref(accountId)}>Cambiar</Link>;
  if (!view.ok) return <>No se pudo leer ahora · {change}</>;
  return <>{dollarsLabel(view.cap.usd)} por persona al mes · {VOICE_SOURCES[view.cap.source]} · {change}</>;
}

/** Si tiene cliente de Stripe y, si su suscripción cobra, que lo dice: es lo que frena «Cambiar plan». */
const stripeText = (file: CompanyFile) => {
  if (!file.paysWithStripe) return 'No';
  return file.stripeCanCharge ? 'Sí · su suscripción cobra o puede volver a cobrar' : 'Sí';
};

function accountFacts(file: CompanyFile, voiceCap: VoiceCapView): Fact[] {
  const personal = file.kind === 'personal';
  return [
    { label: 'Creada', value: formatDate(file.createdAt) },
    ...(personal ? [{ label: 'Origen', value: originLabel(file.origin) }] : []),
    { label: 'Vence', value: <ExpiryValue file={file} /> },
    { label: 'Cliente de Stripe', value: stripeText(file) },
    // Una cuenta personal tiene una sola persona: contar sus admins la haría parecer una empresa a medio armar.
    ...(personal ? [] : [{ label: 'Admins', value: String(file.admins) }]),
    ...(voiceCap ? [{ label: 'Tope de la voz', value: <VoiceCapValue view={voiceCap} accountId={file.id} /> }] : []),
  ];
}

export function CompanyAccountCard({ file, voiceCap }: { file: CompanyFile; voiceCap: VoiceCapView }) {
  return (
    <section className="card company-account-card">
      <div className="card-h">
        <div>
          <h2>Cuenta</h2>
          <p>Lo que conviene mirar antes de cambiarle algo.</p>
        </div>
      </div>
      <div className="card-b">
        <FactList facts={accountFacts(file, voiceCap)} />
      </div>
    </section>
  );
}
