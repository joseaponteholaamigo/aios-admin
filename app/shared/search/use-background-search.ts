// La búsqueda de las listas del panel (Usuarios de clientes y Empresas): espera a que se deje de
// escribir y busca por detrás, con un fetcher (un pedido que no cambia de pantalla).
//
// ⛔ El texto va al servidor por POST y nunca en la dirección del pedido: lo que se escribe de un
// correo no puede quedar en los logs de AWS. En la barra del navegador queda DESPUÉS DEL `#`
// (`#buscar=ana`), que el navegador nunca manda al servidor: así una búsqueda se puede compartir y
// recargar (spec «Cuentas personales», CA-19).
import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';

/** Cuánto se espera después de la última tecla antes de buscar. */
export const SEARCH_DELAY_MS = 500;

/** El texto más largo que se busca: el de un correo. El backend tampoco acepta más. */
export const MAX_SEARCH_LENGTH = 254;

/** La clave de la búsqueda después del `#`. */
const HASH_KEY = 'buscar';

export type SearchState<R> = { kind: 'idle' } | { kind: 'searching' } | { kind: 'done'; result: R };

/** Lo que responde la acción de una búsqueda: qué buscó (el texto y los filtros) y lo que encontró. */
export type SearchAnswer<R> = { text: string; scope: string; result: R };

/** Lo que se busca: el texto como lo compara el backend, sin espacios alrededor ni mayúsculas. */
export const searchQuery = (text: string) => text.trim().toLowerCase();

/** Los filtros que acompañan al texto, en una cadena que no depende del orden de las claves. */
export const searchScope = (filters: Record<string, string>) => new URLSearchParams(Object.entries(filters).sort(([a], [b]) => (a < b ? -1 : 1))).toString();

/**
 * El estado de la búsqueda: sin texto, nada; con una respuesta para este texto y estos filtros, esa;
 * si no, buscando. Una respuesta vieja (de otro texto o de otros filtros) no se muestra.
 */
export function searchState<R>(query: string, scope: string, data: SearchAnswer<R> | undefined): SearchState<R> {
  if (!query) return { kind: 'idle' };
  return data && data.text === query && data.scope === scope ? { kind: 'done', result: data.result } : { kind: 'searching' };
}

/**
 * El texto que trae la dirección después del `#`, o `''` si no trae uno válido: solo la clave
 * `buscar`, con texto, y no más largo que un correo (CB-7).
 */
export function textFromHash(hash: string): string {
  const params = new URLSearchParams(hash.replace(/^#/, ''));
  if ([...params.keys()].join() !== HASH_KEY) return '';
  const text = searchQuery(params.get(HASH_KEY) ?? '');
  return text.length <= MAX_SEARCH_LENGTH ? text : '';
}

/** Lo que va después del `#` para un texto, o nada sin texto. La `@` queda legible: en un `#` no hace falta codificarla. */
export const hashFor = (query: string) => (query ? `#${HASH_KEY}=${encodeURIComponent(query).replaceAll('%40', '@')}` : '');

/** Cambia lo que va después del `#` sin navegar: ni pide la página otra vez ni agrega una entrada al historial. */
function writeHash(query: string) {
  const url = new URL(window.location.href);
  url.hash = hashFor(query);
  window.history.replaceState(window.history.state, '', url);
}

/**
 * La búsqueda de una pantalla. `filters` viajan con el texto en el POST y deciden qué respuesta es
 * la vigente. Cuando `resetKey` cambia (otra pestaña), el texto se borra.
 */
export function useBackgroundSearch<R>(filters: Record<string, string>, resetKey = '') {
  const fetcher = useFetcher();
  const [text, setText] = useState('');
  const query = searchQuery(text);
  const scope = searchScope(filters);
  // En refs: si cambiaran entre renders, el efecto volvería a buscar en cada respuesta.
  const submit = useRef(fetcher.submit);
  submit.current = fetcher.submit;
  const latest = useRef(filters);
  latest.current = filters;
  /** El texto vino de la dirección: se busca sin esperar, y la dirección no se borra antes de leerlo. */
  const fromLink = useRef(false);
  /** La dirección tiene una búsqueda nuestra después del `#`. */
  const inHash = useRef(false);
  const lastReset = useRef(resetKey);

  useEffect(() => {
    const linked = textFromHash(window.location.hash);
    if (!linked) return;
    fromLink.current = true;
    inHash.current = true;
    setText(linked);
  }, []);

  useEffect(() => {
    if (lastReset.current === resetKey) return;
    lastReset.current = resetKey;
    setText('');
  }, [resetKey]);

  useEffect(() => {
    if (!query) {
      if (inHash.current && !fromLink.current) { writeHash(''); inHash.current = false; }
      return undefined;
    }
    const delay = fromLink.current ? 0 : SEARCH_DELAY_MS;
    fromLink.current = false;
    const timer = setTimeout(() => {
      writeHash(query);
      inHash.current = true;
      void submit.current({ text: query, ...latest.current }, { method: 'post' });
    }, delay);
    return () => clearTimeout(timer);
  }, [query, scope]);

  return { text, setText, state: searchState<R>(query, scope, fetcher.data as SearchAnswer<R> | undefined) };
}
