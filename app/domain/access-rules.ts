// Las reglas de acceso de una empresa Personalizado desde el panel (spec «Reglas de acceso», CA-11 a
// CA-14): dar o quitar dominios y skills encima de su contenido de base, o volver a la base. Primero se
// ve el cambio; después se guarda. Los nombres del backend se traducen en
// `app/shared/api/access-rules-mapping.ts`: aquí no aparece ninguno.
import type { ContentBase } from './companies';

/** A qué apunta una regla: un dominio por su slug, o una skill por su nombre. */
export const ACCESS_TARGET_KINDS = ['domain', 'skill'] as const;
export type AccessTargetKind = (typeof ACCESS_TARGET_KINDS)[number];
export type AccessTarget = { kind: AccessTargetKind; name: string };

/** Lo que hace una regla de empresa. */
export const ACCESS_ACTIONS = ['grant', 'remove'] as const;
export type AccessAction = (typeof ACCESS_ACTIONS)[number];

/** Lo que hace una operación: dar, quitar, o volver a la base (borra la regla de ese dominio o esa skill). */
export type AccessOperationAction = AccessAction | 'reset';

/**
 * Una regla de empresa con su estado. `missing`: nombra algo que ya no está publicado y se ignora.
 * `inactive`: da algo que la empresa no tiene; vuelve a valer si lo recupera.
 */
export type CompanyRule = { target: AccessTarget; action: AccessAction | 'unknown'; missing: boolean; inactive: boolean };

/** Un dominio del catálogo: su nombre visible (`null` si no tiene), cuántas skills tiene y cuántas recibe la empresa. */
export type CatalogDomain = { slug: string; name: string | null; skills: number; received: number };

/** Una skill del catálogo: su nombre visible (`null` si no tiene), su dominio y si la empresa la recibe hoy. */
export type CatalogSkill = { name: string; label: string | null; domain: string | null; received: boolean };

export type AccessCatalog = { domains: CatalogDomain[]; skills: CatalogSkill[] };

/** Cuántas skills, agentes y cadenas recibe la empresa. */
export type ReceivedCounts = { skills: number; agents: number; chains: number };

export type CompanyAccessRules = {
  /** Si es un Personalizado: solo ahí existen las reglas de empresa (decisión 2). */
  custom: boolean;
  base: ContentBase | null;
  rules: CompanyRule[];
  receives: ReceivedCounts;
  catalog: AccessCatalog;
};

/**
 * Lo que se lee de las reglas de una empresa, o que no se pueden calcular porque falta publicar algo
 * (`missing`: qué, dicho por el backend).
 */
export type CompanyAccessReading = { published: true; access: CompanyAccessRules } | { published: false; missing: string | null };

/** Lo que pide el panel: una misma acción sobre uno o más dominios y skills (decisión 4). `previewOnly`: solo ver cómo quedaría. */
export type AccessChange = { action: AccessOperationAction; targets: AccessTarget[]; reason: string; previewOnly: boolean };

/** Las piezas por tipo: skills, agentes y cadenas, por su identificador. */
export type PieceLists = { skills: string[]; agents: string[]; chains: string[] };

/** Lo que el cambio exige confirmar. `empty`: la empresa queda sin ninguna skill. `unknown`: algo que el panel no nombra. */
export type AccessConfirmation = 'empty' | 'unknown';

export type AccessChangeResult = {
  previewOnly: boolean;
  /** `false`: lo pedido ya era lo que había, y no se escribió nada. */
  changed: boolean;
  /** Lo que deja de recibir: skills que salen, agentes y cadenas que dejan de estar completos. */
  leaves: PieceLists;
  /** Lo que empieza a recibir: skills que entran, agentes y cadenas que quedan completos. */
  enters: PieceLists;
  /** A cuántas personas les cambia lo que reciben. Sin correos (decisión 6). */
  affectedPeople: number;
  /** Cuántas reglas de roles o personas, de su admin, quedan inactivas (decisión 3). */
  inactiveRules: number;
  toConfirm: AccessConfirmation[];
};

/** Cómo se escribe un objetivo en el formulario y en la dirección: `domain:convert`, `skill:copy`. */
export const targetToken = ({ kind, name }: AccessTarget) => `${kind}:${name}`;

/** Un slug o un nombre de skill: minúsculas, números y guiones, como los del kernel. */
const NAME = /^[a-z0-9][a-z0-9-]*$/;

/** El objetivo que dice un texto `domain:convert`, o `null` si no tiene esa forma. */
export function parseTargetToken(token: string): AccessTarget | null {
  const [kind, name, ...rest] = token.split(':');
  if (rest.length || !ACCESS_TARGET_KINDS.includes(kind as AccessTargetKind) || !name || !NAME.test(name)) return null;
  return { kind: kind as AccessTargetKind, name };
}
