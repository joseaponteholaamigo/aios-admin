// El paso entre las páginas de una lista por cursor (spec «Registro abierto» de aios-tower, CA-24):
// «Primera página» y «Siguiente». Un cursor solo sabe seguir, así que no hay números ni «Anterior»:
// para volver está el navegador. Cada página es un enlace con su cursor en la dirección, que se puede
// recargar y compartir, y un clic pide una sola página, nunca de más.
//
// Mientras una de las dos carga, las dos se bloquean y la oprimida dice «Cargando…», con `aria-busy`
// (regla «Front-end interaction» del CLAUDE.md global). Lleva las clases de la paginación numerada
// (`pager.css`), que la pantalla atenúa mientras carga.
import type { ReactNode } from 'react';
import { Link, useNavigation } from 'react-router';
import '../../../shared/ui/pager.css';
import './cursor-pager.css';

type NavigationLike = { state: string; location?: { pathname: string; search: string } | null };

/** La dirección de este paginador que se está cargando, o `null`: con ella se bloquean los dos pasos y se marca el oprimido. */
export function loadingHref(navigation: NavigationLike, hrefs: readonly (string | null)[]): string | null {
  if (navigation.state !== 'loading' || !navigation.location) return null;
  const target = `${navigation.location.pathname}${navigation.location.search}`;
  return hrefs.find((href) => href !== null && href === target) ?? null;
}

type Props = {
  /** Lo que muestra la página: «50 cuentas personales en esta página…». */
  summary: string;
  /** La primera página, o `null` si esta ya es la primera. */
  firstHref: string | null;
  /** La página siguiente, o `null` en la última. */
  nextHref: string | null;
};

export function CursorPager({ summary, firstHref, nextHref }: Props) {
  const loading = loadingHref(useNavigation(), [firstHref, nextHref]);
  /** Un paso: el que carga dice «Cargando…»; sin destino, o mientras el otro carga, va desactivado. */
  const step = (href: string | null, label: string, rel?: string): ReactNode => {
    if (href !== null && href === loading) {
      return (
        <a className="pag-step cursor-pager__loading" role="link" aria-disabled="true" aria-busy="true">
          <span className="cursor-pager__spinner" aria-hidden="true" />Cargando…
        </a>
      );
    }
    if (href === null || loading !== null) return <a className="pag-step" role="link" aria-disabled="true">{label}</a>;
    return <Link className="pag-step" to={href} rel={rel}>{label}</Link>;
  };
  return (
    <nav className="pag" aria-label="Páginas">
      <span>{summary}</span>
      {(firstHref !== null || nextHref !== null) && (
        <span className="btns">
          {firstHref !== null && step(firstHref, 'Primera página')}
          {step(nextHref, 'Siguiente', 'next')}
        </span>
      )}
    </nav>
  );
}
