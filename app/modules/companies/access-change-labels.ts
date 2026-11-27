// Lo que dice «Reglas de acceso» (spec «Reglas de acceso», CA-11 a CA-13): el nombre visible de cada
// dominio y skill con su identificador, el estado de una regla, la vista previa en palabras y el aviso
// al guardar. Puras: las prueba `tests/access-rules.test.ts`.
import type {
  AccessCatalog, AccessChange, AccessChangeResult, AccessConfirmation, AccessOperationAction, AccessTarget, AccessTargetKind, CompanyRule,
} from '../../domain/access-rules';
import type { Label } from '../../shared/ui/badge';

/** Por qué no se ofrece el formulario en un plan que no es Personalizado (decisión 2). */
export const NOT_CUSTOM_REASON = 'Las reglas de empresa son solo de un Personalizado: pásala primero a Personalizado.';

/** Lo que dice la pantalla ante `conflicto`: las reglas cambiaron entre ver el cambio y guardarlo. */
export const CONFLICT_MESSAGE = 'Las reglas de esta empresa cambiaron mientras mirabas, y no se guardó nada: vuelve a ver el cambio.';

export const OPERATION_LABELS: Record<AccessOperationAction, string> = { grant: 'Dar', remove: 'Quitar', reset: 'Volver a la base' };
export const RULE_ACTION_LABELS: Record<CompanyRule['action'], string> = { grant: 'Da', remove: 'Quita', unknown: '—' };
export const TARGET_KIND_LABELS: Record<AccessTargetKind, string> = { domain: 'Dominio', skill: 'Skill' };

/** El estado de una regla de empresa, con el tono de su insignia. La ficha y la pantalla lo dicen igual. */
export function ruleStateLabel({ missing, inactive }: { missing: boolean; inactive: boolean }): Label {
  if (missing) return { text: 'Ya no existe', tone: 'bad' };
  if (inactive) return { text: 'Inactiva: la empresa no lo tiene', tone: 'warn' };
  return { text: 'Vale', tone: 'ok' };
}

/** El nombre visible de un dominio o una skill, o `null` si el catálogo no le da uno (o ya no está publicado). */
export type NameLookup = (target: AccessTarget) => string | null;

/** Busca nombres visibles en el catálogo: el `nombre` del dominio y el `label` de la skill (decisión 5). */
export function nameLookup(catalog: AccessCatalog): NameLookup {
  const domains = new Map(catalog.domains.map((d) => [d.slug, d.name]));
  const skills = new Map(catalog.skills.map((s) => [s.name, s.label]));
  return ({ kind, name }) => (kind === 'domain' ? domains.get(name) : skills.get(name)) ?? null;
}

/** Cómo se lee un objetivo en una línea: su nombre visible con el identificador al lado, o solo el identificador. */
export function targetText(target: AccessTarget, names: NameLookup): string {
  const name = names(target);
  return name && name !== target.name ? `${name} (${target.name})` : target.name;
}

/** Lo pedido en una línea, para la vista previa: «Dar: dominio Convertir (convert), skill copy». */
export function requestSummary({ action, targets }: Pick<AccessChange, 'action' | 'targets'>, names: NameLookup): string {
  return `${OPERATION_LABELS[action]}: ${targets.map((t) => `${TARGET_KIND_LABELS[t.kind].toLowerCase()} ${targetText(t, names)}`).join(', ')}`;
}

/** Un grupo de piezas de la vista previa: las que entran (`enters`) o las que salen (`leaves`). */
export type PieceGroup = { title: string; direction: 'enters' | 'leaves'; items: string[] };

/** Lo que entra y sale, solo los grupos que tienen algo. Las skills, con su nombre visible; agentes y cadenas, por su id. */
export function pieceGroups(result: Pick<AccessChangeResult, 'enters' | 'leaves'>, names: NameLookup): PieceGroup[] {
  const skills = (list: string[]) => list.map((name) => targetText({ kind: 'skill', name }, names));
  const groups: PieceGroup[] = [
    { title: 'Skills que entran', direction: 'enters', items: skills(result.enters.skills) },
    { title: 'Skills que salen', direction: 'leaves', items: skills(result.leaves.skills) },
    { title: 'Agentes que quedan completos', direction: 'enters', items: result.enters.agents },
    { title: 'Agentes que dejan de estar completos', direction: 'leaves', items: result.leaves.agents },
    { title: 'Cadenas que quedan completas', direction: 'enters', items: result.enters.chains },
    { title: 'Cadenas que dejan de estar completas', direction: 'leaves', items: result.leaves.chains },
  ];
  return groups.filter((g) => g.items.length > 0);
}

/** Lo que hay que confirmar, dicho para quien va a oprimir «Guardar». */
export function confirmationLabel(confirmation: AccessConfirmation): string {
  switch (confirmation) {
    case 'empty': return 'La empresa queda sin ninguna skill: sus personas no reciben nada hasta que se le vuelva a dar algo.';
    case 'unknown': return 'Hay algo más que confirmar que el panel no sabe nombrar.';
  }
}

export function affectedPeopleLabel(count: number): string {
  if (count === 0) return 'A ninguna persona le cambia lo que recibe.';
  return count === 1 ? 'A 1 persona le cambia lo que recibe.' : `A ${count} personas les cambia lo que reciben.`;
}

export function inactiveRulesLabel(count: number): string {
  if (count === 0) return 'Ninguna regla de sus roles o personas queda inactiva.';
  return count === 1
    ? '1 regla de sus roles o personas queda inactiva: no se borra, y vuelve a valer si la empresa lo recupera.'
    : `${count} reglas de sus roles o personas quedan inactivas: no se borran, y vuelven a valer si la empresa lo recupera.`;
}

// El aviso al volver de guardar: un texto fijo, nunca uno que venga en la dirección.
const SAVED = 'acceso';

export function accessSavedNoticeParams({ changed }: { changed: boolean }) {
  return new URLSearchParams({ aviso: SAVED, ...(changed ? {} : { igual: '1' }) });
}

/** Qué dice la pantalla al volver de guardar, o `null` si no viene de ahí. */
export function accessSavedNotice(params: URLSearchParams): string | null {
  if (params.get('aviso') !== SAVED) return null;
  if (params.get('igual') === '1') return 'Lo pedido ya era lo que tenía: no cambió nada.';
  return 'Se guardaron las reglas de acceso. ENSŌ las toma la próxima vez que lo abran.';
}
