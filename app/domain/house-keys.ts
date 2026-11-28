// Las claves de la casa (spec «Compartir referentes» de aios-tower, D14 a D21 y D30): las claves con que
// ENSŌ paga a sus proveedores. El panel nunca ve una clave entera: sabe si está puesta, sus últimos 4
// caracteres, quién la cambió, si el proveedor está encendido para todos y el saldo de la casa. Sin
// React ni servidor: es dominio. Los nombres del backend se traducen en `shared/api/house-keys-mapping.ts`.

/** Los servicios que el panel administra. Por ahora solo ScrapeCreators (D14 y D18): cada uno nuevo es una fila más. */
export const HOUSE_KEY_SERVICES = ['scrapecreators'] as const;
export type HouseKeyService = (typeof HOUSE_KEY_SERVICES)[number];

export const isHouseKeyService = (value: unknown): value is HouseKeyService => HOUSE_KEY_SERVICES.includes(value as HouseKeyService);

/**
 * El último cambio de la clave. `changedBy` es `null` si se cambió fuera del panel (la terminal o la
 * consola de AWS): la fecha sale del secreto, y quién y el motivo, de lo que escribió el panel.
 */
export type HouseKeyChange = { changedAt: string | null; changedBy: string | null; reason: string | null };

/** Cómo está la clave de un servicio y su proveedor. */
export type HouseKeyStatus = {
  service: HouseKeyService;
  /** Hay una clave en el secreto. */
  keySet: boolean;
  /** Sus últimos 4 caracteres, guardados al escribirla desde el panel. `null` si se cambió fuera del panel o no hay clave. */
  lastFour: string | null;
  lastChange: HouseKeyChange;
  /** El interruptor del proveedor: apagado, ENSŌ no lo ofrece a nadie. */
  enabled: boolean;
  /** El saldo de la casa en el proveedor (créditos de ScrapeCreators). `null` si no se pudo leer. */
  balance: number | null;
};

/** Lo que pasó en una entrada del historial. `null`: una acción que el panel no conoce todavía. */
export type HouseKeyHistoryAction = 'set' | 'change' | 'remove' | 'enable' | 'disable';

export type HouseKeyHistoryEntry = { at: string | null; by: string | null; action: HouseKeyHistoryAction | null; reason: string | null };

/** Cuántas entradas del historial muestra la página: las últimas. */
export const HISTORY_SIZE = 20;

/** La página de un servicio: su estado y el historial de la clave y del interruptor, el más nuevo primero. */
export type HouseKeyDetail = HouseKeyStatus & { history: HouseKeyHistoryEntry[] };

/** La clave, como se dice en pantalla: puesta (y en qué termina), puesta pero cambiada fuera del panel, o sin clave. */
export type KeyState = { kind: 'set'; lastFour: string } | { kind: 'changed-outside' } | { kind: 'none' };

export function keyStateOf(status: Pick<HouseKeyStatus, 'keySet' | 'lastFour'>): KeyState {
  if (!status.keySet) return { kind: 'none' };
  return status.lastFour ? { kind: 'set', lastFour: status.lastFour } : { kind: 'changed-outside' };
}

/**
 * Un cambio desde el panel. Todos llevan motivo (queda en la auditoría, nunca la clave):
 *   · `key`: poner o cambiar la clave. El backend la prueba antes de guardarla; `enable` enciende además el proveedor.
 *   · `remove`: vaciar la clave y apagar el proveedor en un mismo paso.
 *   · `switch`: encender o apagar el proveedor. Va el estado que se quiere, no «cambiar»: dos pedidos iguales dan lo mismo.
 */
export type HouseKeyChangeRequest =
  | { action: 'key'; key: string; reason: string; enable: boolean }
  | { action: 'remove'; reason: string }
  | { action: 'switch'; enabled: boolean; reason: string };
