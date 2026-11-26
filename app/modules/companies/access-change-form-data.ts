// Lo que manda «Reglas de acceso» (spec «Reglas de acceso», CA-12 y CA-13), validado en su forma, y la
// huella del pedido que se vio. Los mismos dos pasos que «Cambiar plan»: ver el cambio, y guardar
// exactamente ese. Puro: lo prueba `tests/access-rules.test.ts`. Si cada dominio o skill existe lo juzga
// el backend, con su catálogo.
import type { WriteRejection } from '../../domain/account-creation';
import { ACCESS_ACTIONS, parseTargetToken, targetToken, type AccessChange, type AccessChangeResult, type AccessOperationAction, type AccessTarget } from '../../domain/access-rules';
import { REASON_MAX } from './plan-change-form-data';

export { INTENT_FIELD, PREVIEW_INTENT, PREVIEWED_FIELD, REASON_MAX, SAVE_INTENT } from './plan-change-form-data';

/** Dar o quitar, para todo lo elegido. */
export const ACTION_FIELD = 'action';
/** Cada dominio o skill elegido, como `domain:convert` o `skill:copy`. */
export const TARGET_FIELD = 'target';
export const REASON_FIELD = 'reason';
/** El botón «Volver a la base» de una regla: su valor es el objetivo de esa regla, y la operación es volver a la base. */
export const RESET_FIELD = 'reset';

/** Las operaciones que acepta el backend en un pedido: una red contra un pedido desbocado, no una regla de negocio. */
export const MAX_TARGETS = 50;

/** Lo escrito en el formulario, para volver a mostrarlo después de ver el cambio o de un rechazo. */
export type AccessFormValues = { action: string; targets: string[]; reason: string };

/** El pedido sin decir si es solo para verlo. */
export type AccessRequest = Omit<AccessChange, 'previewOnly'>;

/**
 * Una vista previa con el pedido que la pidió y su huella: «Guardar» manda ese mismo pedido. `stale`: se pidió guardar
 * otro pedido que el que se vio, así que esta es la vista previa nueva y no se guardó nada.
 */
export type ShownAccessPreview = { preview: AccessChangeResult; request: AccessRequest; previewed: string; stale: boolean };

type Errors = Record<string, string>;

/** Lo que vuelve a la pantalla después de un pedido: lo que se mandó, los errores, el rechazo y, si se pidió, la vista previa. */
export type AccessAttempt = { values: AccessFormValues; errors: Errors; rejection: WriteRejection | null; shown: ShownAccessPreview | null };

const OPERATIONS: readonly AccessOperationAction[] = [...ACCESS_ACTIONS, 'reset'];
const isOperation = (value: string): value is AccessOperationAction => OPERATIONS.includes(value as AccessOperationAction);
const texts = (values: FormDataEntryValue[]) => values.filter((v): v is string => typeof v === 'string');

/** Lo que trae el formulario. «Volver a la base» manda solo el objetivo de su regla. */
export function accessFormValues(form: FormData): AccessFormValues {
  const reset = form.get(RESET_FIELD);
  if (typeof reset === 'string') return { action: 'reset', targets: [reset], reason: '' };
  return { action: String(form.get(ACTION_FIELD) ?? ''), targets: texts(form.getAll(TARGET_FIELD)), reason: String(form.get(REASON_FIELD) ?? '') };
}

/** Los objetivos, sin repetir y en el orden en que vinieron, o `null` si alguno no tiene la forma de uno. */
function parseTargets(tokens: string[]): AccessTarget[] | null {
  const seen = new Map<string, AccessTarget>();
  for (const token of tokens) {
    const target = parseTargetToken(token);
    if (!target) return null;
    seen.set(targetToken(target), target);
  }
  return [...seen.values()];
}

/** El pedido (`{ change }`), o sus errores por campo (`{ errors }`). */
export function readAccessChange(form: FormData): { change: AccessRequest } | { errors: Errors } {
  const { action, targets: tokens, reason: rawReason } = accessFormValues(form);
  const reason = rawReason.trim();
  const targets = parseTargets(tokens);
  const errors: Errors = {};
  if (!isOperation(action)) errors.action = 'Elige si das o quitas.';
  if (!targets) errors.targets = 'Lo elegido no se entiende: vuelve a cargar la página.';
  else if (targets.length === 0) errors.targets = 'Elige al menos un dominio o una skill.';
  else if (targets.length > MAX_TARGETS) errors.targets = `Elige hasta ${MAX_TARGETS} a la vez.`;
  if (reason.length > REASON_MAX) errors.reason = `El motivo va hasta ${REASON_MAX} caracteres.`;
  if (Object.keys(errors).length || !targets || !isOperation(action)) return { errors };
  return { change: { action, targets, reason } };
}

/**
 * La huella de un pedido. «Guardar» manda la del que se vio: si el pedido que llega es otro, la acción vuelve a mostrar
 * la vista previa en vez de guardar algo que nadie vio (CA-13).
 */
export const accessChangeFingerprint = ({ action, targets, reason }: AccessRequest) => JSON.stringify({ action, targets: targets.map(targetToken), reason });
