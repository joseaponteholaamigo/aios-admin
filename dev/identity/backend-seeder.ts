// Guarda en el backend local a la persona elegida en «entrar como» (`PUT /dev/equipo/{sub}`, que
// solo monta el servidor local del backend con DynamoDB Local). Sin su fila en `equipo`, `/yo`
// respondería «sin acceso».
import type { TeamMember } from '../../app/domain/permissions';
import { toApiPermissions } from '../../app/shared/api/team-member-mapping';

export type DevPerson = {
  sub: string;
  email: string;
  name: string | null;
  isSuperadmin: boolean;
  suspended: boolean;
  permissions: TeamMember['permissions'];
};

/** El backend local no pudo guardar a la persona. El mensaje dice qué hacer. */
export class DevSeedError extends Error {}

const TIMEOUT_MS = 5000;

export function createBackendSeeder({ adminApiUrl, fetchImpl = fetch }: { adminApiUrl: string; fetchImpl?: typeof fetch }) {
  return async function savePerson(person: DevPerson): Promise<void> {
    let response: Response;
    try {
      response = await fetchImpl(`${adminApiUrl}/dev/equipo/${encodeURIComponent(person.sub)}`, {
        method: 'PUT',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({
          correo: person.email,
          nombre: person.name,
          superadmin: person.isSuperadmin,
          estado: person.suspended ? 'suspendida' : 'activa',
          permisos: toApiPermissions(person.permissions),
        }),
        signal: AbortSignal.timeout(TIMEOUT_MS),
      });
    } catch {
      throw new DevSeedError(`No llegué al backend local en ${adminApiUrl}: ¿está corriendo \`npm run dev\` en aios-backend?`);
    }
    if (response.status === 404) {
      throw new DevSeedError(
        'El backend local no tiene la ruta de la identidad falsa: solo la monta contra DynamoDB Local (`npm run dev:aws` y después `npm run dev`).',
      );
    }
    if (!response.ok) {
      const body = (await response.json().catch(() => ({}))) as { error?: unknown };
      throw new DevSeedError(`El backend local no guardó a la persona (${response.status}): ${String(body.error ?? 'sin detalle')}`);
    }
  };
}
