// El contenido de la pantalla, o su esqueleto mientras carga la siguiente. Sin esto, la pantalla
// anterior se queda quieta hasta que el backend responde, y parece que el panel falló.
import type { ReactNode } from 'react';
import { useNavigation } from 'react-router';
import { SKELETON_DELAY_MS, isPageLoading, useDelayedFlag } from './page-loading';
import { PageSkeleton } from './page-skeleton';

export function PageContent({ children }: { children: ReactNode }) {
  const loading = useDelayedFlag(isPageLoading(useNavigation()), SKELETON_DELAY_MS);
  return (
    <main className="adm-page" aria-busy={loading || undefined}>
      {loading ? <PageSkeleton /> : children}
    </main>
  );
}
