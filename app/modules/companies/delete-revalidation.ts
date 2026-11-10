// Cuándo la confirmación del borrado vuelve a pedir la vista previa después de un rechazo (spec
// «Borrar cuentas y destrabar personas», CB-20). Aparte de la ruta para poder probarla sin el servidor.
import type { ShouldRevalidateFunctionArgs } from 'react-router';

/**
 * Después de un rechazo, la vista previa se vuelve a pedir: así un borrado a medias aparece como
 * pendiente, y una cuenta que empezó a cobrar esconde el formulario. Salvo dos casos, en que pedirla
 * reemplazaría el formulario por la página de error y se perdería lo que se explica (CB-20):
 *   · `not-found`: el borrado anterior seguramente terminó; la vista previa también daría 404;
 *   · `unavailable`: la API no responde; no se sabe si se hizo, y lo escrito se tiene que quedar.
 */
export function shouldRevalidateAfterDeletion({ actionResult, defaultShouldRevalidate }: ShouldRevalidateFunctionArgs) {
  const code = (actionResult as { rejection?: { code?: string } } | undefined)?.rejection?.code;
  return code === 'not-found' || code === 'unavailable' ? false : defaultShouldRevalidate;
}

