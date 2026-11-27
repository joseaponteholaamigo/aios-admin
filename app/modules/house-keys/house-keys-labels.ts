// Cómo se dicen en el panel las claves de la casa, su estado y sus cambios (spec «Compartir referentes» de
// aios-tower, D16, D20 y D21). Puras: las prueba `tests/house-keys.test.ts`.
import type { WriteRejection } from '../../domain/account-creation';
import {
  keyStateOf, type HouseKeyChange, type HouseKeyChangeRequest, type HouseKeyHistoryAction, type HouseKeyService, type HouseKeyStatus,
} from '../../domain/house-keys';
import type { Label } from '../../shared/ui/badge';
import { formatCount, formatDateTime } from '../../shared/ui/format';
import { rejectionMessage } from '../../shared/labels/write-rejection-labels';

/** Cómo se llama cada servicio, qué hace en ENSŌ (la fila de la lista), para qué sirve (la página) y qué se corta al apagarlo. */
export const SERVICE_INFO: Record<HouseKeyService, { name: string; purpose: string; lead: string; uses: string }> = {
  scrapecreators: {
    name: 'ScrapeCreators',
    purpose: 'Instagram y TikTok en Ideas',
    lead: 'Instagram y TikTok en Ideas (Referentes y «Lo que está funcionando») y las transcripciones del sistema de estilo de ENSŌ.',
    uses: 'Instagram y TikTok en ENSŌ',
  },
};

export const houseKeyHref = (service: HouseKeyService) => `/house-keys/${encodeURIComponent(service)}`;

/** La clave: «Puesta · termina en …a1b2», «Se cambió fuera del panel» o «Sin clave». Nunca más de sus últimos 4. */
export function keyStateLabel(status: Pick<HouseKeyStatus, 'keySet' | 'lastFour'>): Label {
  const state = keyStateOf(status);
  if (state.kind === 'set') return { text: `Puesta · termina en …${state.lastFour}`, tone: 'ok' };
  if (state.kind === 'changed-outside') return { text: 'Se cambió fuera del panel', tone: 'warn' };
  return { text: 'Sin clave', tone: 'bad' };
}

export const enabledLabel = (enabled: boolean): Label => (enabled ? { text: 'Encendido', tone: 'ok' } : { text: 'Apagado', tone: 'bad' });

/** El saldo de la casa en el proveedor, o que no se pudo leer (`Casa` no respondió). */
export const balanceLabel = (balance: number | null) => (balance === null ? 'No se pudo leer' : `${formatCount(balance)} créditos`);

/** Quién cambió la clave y cuándo. Sin quién, se cambió fuera del panel (la terminal o la consola de AWS). */
export function lastChangeLabel(change: HouseKeyChange): string {
  if (!change.changedAt && !change.changedBy) return '—';
  const who = change.changedBy ?? 'Fuera del panel';
  return change.changedAt ? `${who}, el ${formatDateTime(change.changedAt)}` : who;
}

/** Qué pasó en una entrada del historial. */
export function historyActionLabel(action: HouseKeyHistoryAction | null, service: HouseKeyService): string {
  const name = SERVICE_INFO[service].name;
  switch (action) {
    case 'set': return 'Puso la clave';
    case 'change': return 'Cambió la clave';
    case 'remove': return 'Quitó la clave';
    case 'enable': return `Encendió ${name}`;
    case 'disable': return `Apagó ${name}`;
    case null: return 'Otro cambio';
  }
}

/**
 * Lo que dice el formulario de la clave cuando no se pudo. Un rechazo del proveedor nombra al proveedor (CA-30);
 * un corte de la API no puede pedir «vuelve a oprimir el botón»: el campo de la clave ya quedó vacío.
 */
export function keyRejectionMessage(rejection: WriteRejection, service: HouseKeyService): string {
  const name = SERVICE_INFO[service].name;
  if (rejection.code === 'key-rejected') return `${name} rechazó esa clave. No se cambió nada.`;
  if (rejection.code === 'unavailable') {
    return 'La API no respondió a tiempo y no sabemos si la clave se cambió. Recarga la página y mira en qué termina la clave puesta: si no es la nueva, pégala otra vez.';
  }
  return rejectionMessage(rejection);
}

/** El aviso que viaja en la dirección después de un cambio que salió bien: solo qué se hizo. Nunca la clave ni un correo. */
export const NOTICE_PARAM = 'aviso';
const NOTICES = ['clave', 'quitada', 'encendido', 'apagado'] as const;
type Notice = (typeof NOTICES)[number];

function noticeOf(change: HouseKeyChangeRequest): Notice {
  if (change.action === 'key') return 'clave';
  if (change.action === 'remove') return 'quitada';
  return change.enabled ? 'encendido' : 'apagado';
}

/** La consulta de la dirección a la que vuelve la página después de un cambio que salió bien. */
export const houseKeyNoticeParams = (change: HouseKeyChangeRequest) => new URLSearchParams({ [NOTICE_PARAM]: noticeOf(change) }).toString();

/** El aviso de la dirección, con lo que quedó (lo que acaba de leer la página), o `null` si no hay uno o no es uno de la página. */
export function houseKeyNotice(params: URLSearchParams, status: HouseKeyStatus): string | null {
  const kind = params.get(NOTICE_PARAM);
  if (!NOTICES.includes(kind as Notice)) return null;
  const { name, uses } = SERVICE_INFO[status.service];
  switch (kind as Notice) {
    case 'clave':
      return status.enabled
        ? 'Listo: la clave nueva rige en ENSŌ en 15 minutos como mucho.'
        : `Listo: la clave nueva quedó guardada, pero ${name} sigue apagado: enciéndelo para que ENSŌ la use.`;
    case 'quitada':
      return `Listo: la clave se quitó y ${name} quedó apagado para todos. Revócala también en el panel de ${name}: quitarla aquí no la anula allá.`;
    case 'encendido':
      return status.keySet
        ? `Listo: ${name} quedó encendido. ${uses} vuelven para las cuentas con plan.`
        : `Listo: ${name} quedó encendido, pero no tiene clave: pon una para que ENSŌ lo use.`;
    case 'apagado':
      return `Listo: ${name} quedó apagado. ${uses} se cortan para todas las cuentas hasta que alguien lo encienda.`;
  }
}
