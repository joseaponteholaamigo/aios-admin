// Cómo se nombra cada sitio donde vive lo de una cuenta (spec «Borrar cuentas y destrabar personas»,
// CA-24 y CA-27): en la vista previa del borrado y en el aviso de un borrado a medias.
import type { DeletionSite, DeletionSiteKey } from '../../domain/account-deletion';

const SITE_LABELS: Record<DeletionSiteKey, string> = {
  record: 'La ficha de la cuenta',
  seats: 'Los asientos de sus personas',
  events: 'Su bitácora',
  governance: 'La bitácora de gobierno',
  publications: 'Lo que publicó su equipo',
  capabilities: 'Las capacidades compartidas',
  sharedWork: 'El trabajo compartido',
  access: 'Las reglas de acceso',
  invitationCap: 'El contador de invitaciones',
  credentials: 'Sus license keys',
  emailIndex: 'Los correos con los que entran',
  stripe: 'El vínculo con Stripe',
  panelSignups: 'Las altas desde el panel',
  pendingMoves: 'Los mover a medias',
  packages: 'Los paquetes de su equipo (archivos)',
  logins: 'Los logins de sus personas',
  audit: 'La anotación del borrado en la auditoría',
};

/** El nombre de un sitio por su clave del panel. */
export const deletionSiteKeyLabel = (key: DeletionSiteKey): string => SITE_LABELS[key];

/** El nombre de un sitio. Uno que el panel no conoce se nombra como lo dice el backend. */
export const deletionSiteLabel = (site: DeletionSite): string => (site.key === 'other' ? site.raw : SITE_LABELS[site.key]);
