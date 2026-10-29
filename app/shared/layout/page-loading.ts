// Cuándo una pantalla está cargando, y cuándo se nota.
import { useEffect, useState } from 'react';
import type { Navigation } from 'react-router';

/**
 * Lo que espera la persona antes de ver el esqueleto: una pantalla que llega antes no parpadea.
 * Por debajo de lo que se percibe como «no respondió».
 */
export const SKELETON_DELAY_MS = 250;

/**
 * ¿Se está cargando otra pantalla (un enlace, una página de la lista, una búsqueda por GET)? Lo que
 * recarga después de un envío por POST no cuenta: ahí la pantalla sigue y su botón ya dice
 * «Buscando…». Taparla escondería el resultado que acaba de llegar.
 */
export function isPageLoading(navigation: Pick<Navigation, 'state' | 'formMethod'>): boolean {
  return navigation.state === 'loading' && (navigation.formMethod === undefined || navigation.formMethod === 'GET');
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
