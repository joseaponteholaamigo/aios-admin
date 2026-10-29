// El contenido de la pantalla mientras carga lo siguiente. Sin esto, la pantalla anterior se queda
// quieta hasta que el backend responde, y parece que el panel falló.
// - Otra pantalla: su esqueleto.
// - La misma con otros filtros u otra página: se queda, con su contenido atenuado. Un esqueleto ahí
//   borraría lo que la persona está escribiendo en los filtros.
import type { ReactNode } from 'react';
import { useLocation, useNavigation } from 'react-router';
import { SKELETON_DELAY_MS, pageLoading, useDelayedFlag } from './page-loading';
import { PageSkeleton } from './page-skeleton';

export function PageContent({ children }: { children: ReactNode }) {
  const loading = pageLoading(useNavigation(), useLocation().pathname);
  const noticed = useDelayedFlag(loading !== null, SKELETON_DELAY_MS);
  const refreshing = noticed && loading === 'same-screen';
  return (
    <main className={refreshing ? 'adm-page adm-page--refreshing' : 'adm-page'} aria-busy={noticed || undefined}>
      {noticed && loading === 'other-screen' ? <PageSkeleton /> : children}
    </main>
  );
}
