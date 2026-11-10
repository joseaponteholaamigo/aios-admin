// Lo que dice el borrado de una cuenta (spec «Borrar cuentas y destrabar personas», CA-24 a CA-27):
// el aviso al volver a Empresas y el estado de cada persona en la vista previa.
import type { AccountKind } from '../../domain/companies';

const DELETED_PARAM = 'borrada';

/** A dónde vuelve un borrado completo (CA-25): a la pestaña de su tipo, con el id de la cuenta en el aviso. */
export function deletedAccountHref(id: string, kind: AccountKind | null): string {
  const params = new URLSearchParams({ ...(kind === 'personal' ? { kind: 'personal' } : {}), [DELETED_PARAM]: id });
  return `/companies?${params}`;
}

/** Lo que puede ser un id de cuenta: así un enlace armado no hace decir al panel cualquier cosa. */
const ACCOUNT_ID = /^[a-z0-9-]{1,80}$/;

/** El aviso de Empresas al volver de borrar, o `null`. */
export function deletedNotice(params: URLSearchParams): string | null {
  const id = params.get(DELETED_PARAM);
  return id && ACCOUNT_ID.test(id) ? `Se borró la cuenta ${id}.` : null;
}
