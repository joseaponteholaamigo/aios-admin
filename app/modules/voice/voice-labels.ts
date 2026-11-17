// Cómo se dicen el tope de la voz y sus cambios en el panel (spec «Registro abierto» de aios-tower,
// CA-33). Puras: las prueba `tests/voice-cap.test.ts`.
import type { VoiceCapChange, VoiceCapChanged } from '../../domain/voice-cap';
import { ACCOUNT_ID } from './voice-form-data';

/** «US$10» o «US$7,50»: los centavos solo si los hay, con coma. */
export function dollarsLabel(usd: number): string {
  return Number.isInteger(usd) ? `US$${usd}` : `US$${usd.toFixed(2).replace('.', ',')}`;
}

/** Desde cuándo vale un cambio (CA-33): quien lo hace tiene que saber que las llaves vivas tardan hasta un día. */
export const WHEN_IT_APPLIES = 'Las llaves nuevas lo usan desde ya; las que ya existen, desde el próximo barrido diario.';

/** El aviso que viaja en la dirección después de un cambio: qué cambió, el antes, el después y la cuenta. Nunca un correo. */
export const NOTICE_PARAM = 'aviso';
const NOTICE = { general: 'tope-general', set: 'excepcion', removed: 'sin-excepcion' } as const;

const asParam = (usd: number | null) => (usd === null ? '' : String(usd));

/** La consulta de la dirección a la que vuelve la pantalla después de un cambio que salió bien. */
export function voiceCapNoticeParams(change: VoiceCapChange, changed: VoiceCapChanged): string {
  const values = { antes: asParam(changed.before), despues: asParam(changed.after) };
  if (change.target === 'general') return new URLSearchParams({ [NOTICE_PARAM]: NOTICE.general, ...values }).toString();
  return new URLSearchParams({ [NOTICE_PARAM]: change.usd === null ? NOTICE.removed : NOTICE.set, cuenta: change.accountId, ...values }).toString();
}

/** Un monto de la dirección: `null` si va vacío (sin excepción), `undefined` si no es un monto. */
function amountOf(raw: string | null): number | null | undefined {
  if (raw === null || raw === '') return null;
  const n = Number(raw);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}

function generalNotice(before: number | null, after: number | null): string | null {
  if (after === null) return null;
  if (before === after) return `El tope general ya era ${dollarsLabel(after)}: no cambió nada.`;
  return `${before === null ? 'Tope general fijado' : `Tope general cambiado de ${dollarsLabel(before)}`} a ${dollarsLabel(after)}. ${WHEN_IT_APPLIES}`;
}

function exceptionNotice(account: string, before: number | null, after: number | null): string | null {
  if (after === null) return null;
  if (before === after) return `La cuenta ${account} ya tenía un tope de ${dollarsLabel(after)}: no cambió nada.`;
  const from = before === null ? 'en lugar del general' : `antes tenía ${dollarsLabel(before)}`;
  return `La cuenta ${account} queda con un tope de ${dollarsLabel(after)} (${from}). ${WHEN_IT_APPLIES}`;
}

function removalNotice(account: string, before: number | null): string {
  if (before === null) return `La cuenta ${account} no tenía excepción: sigue con el tope general.`;
  return `La cuenta ${account} ya no tiene excepción: vuelve al tope general. ${WHEN_IT_APPLIES}`;
}

/** El aviso de la dirección, o `null` si no hay uno o no tiene la forma de uno que puso la pantalla. */
export function voiceCapNotice(params: URLSearchParams): string | null {
  const kind = params.get(NOTICE_PARAM);
  const before = amountOf(params.get('antes'));
  const after = amountOf(params.get('despues'));
  if (before === undefined || after === undefined) return null;
  if (kind === NOTICE.general) return generalNotice(before, after);
  const account = params.get('cuenta') ?? '';
  if (!ACCOUNT_ID.test(account)) return null;
  if (kind === NOTICE.set) return exceptionNotice(account, before, after);
  if (kind === NOTICE.removed) return removalNotice(account, before);
  return null;
}
