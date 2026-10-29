// Cuándo una pantalla está cargando, y cuándo se nota.
import { useEffect, useState } from 'react';
import type { Navigation } from 'react-router';

/**
 * Lo que espera la persona antes de ver que algo carga: una pantalla que llega antes no parpadea.
 * Por debajo de lo que se percibe como «no respondió».
 */
export const SKELETON_DELAY_MS = 250;

/**
 * Qué se está cargando:
 * - `other-screen`: otra pantalla (un enlace del menú, una ficha). Sale el esqueleto.
 * - `same-screen`: la misma pantalla con otros filtros u otra página de la lista. La pantalla se
 *   queda (con lo que se está escribiendo) y su contenido se atenúa.
 * - `null`: nada, o lo que recarga después de un envío por POST: ahí la pantalla ya muestra el
 *   resultado que acaba de llegar.
 */
export function pageLoading(navigation: Pick<Navigation, 'state' | 'formMethod' | 'location'>, pathname: string): 'other-screen' | 'same-screen' | null {
  if (navigation.state !== 'loading') return null;
  if (navigation.formMethod !== undefined && navigation.formMethod !== 'GET') return null;
  return navigation.location?.pathname === pathname ? 'same-screen' : 'other-screen';
}

/** `on`, pero solo después de `delayMs` seguidos en verdadero. Vuelve a falso en cuanto `on` cae. */
export function useDelayedFlag(on: boolean, delayMs: number): boolean {
  const [shown, setShown] = useState(false);
  useEffect(() => {
    if (!on) {
      setShown(false);
      return undefined;
    }
    const timer = setTimeout(() => setShown(true), delayMs);
    return () => clearTimeout(timer);
  }, [on, delayMs]);
  return shown;
}
