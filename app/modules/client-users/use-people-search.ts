// La búsqueda por correo de Usuarios de clientes: espera a que se deje de escribir y busca por
// detrás, con un fetcher (un pedido que no cambia de pantalla).
//
// ⛔ Va por POST y nunca cambia la dirección: lo que se escribe de un correo no puede quedar en la
// URL, en los logs ni en el historial del navegador. Por eso, al recargar, la búsqueda se limpia.
import { useEffect, useRef, useState } from 'react';
import { useFetcher } from 'react-router';
import type { PeopleSearch } from '../../domain/client-users';
import type { action } from './routes/client-users';

/** Cuánto se espera después de la última tecla antes de buscar. */
export const SEARCH_DELAY_MS = 500;

export type SearchState = { kind: 'idle' } | { kind: 'searching' } | { kind: 'done'; result: PeopleSearch };

/** Lo que se busca: el texto como lo compara el backend, sin espacios alrededor ni mayúsculas. */
export const searchQuery = (text: string) => text.trim().toLowerCase();

/**
 * El estado de la búsqueda: sin texto, nada; con una respuesta para este texto y esta empresa, esa;
 * si no, buscando. Una respuesta vieja (de otro texto o de otra empresa) no se muestra.
 */
export function searchState(query: string, company: string, data: { text: string; company: string; result: PeopleSearch } | undefined): SearchState {
  if (!query) return { kind: 'idle' };
  return data && data.text === query && data.company === company ? { kind: 'done', result: data.result } : { kind: 'searching' };
}

export function usePeopleSearch(company: string) {
  const fetcher = useFetcher<typeof action>();
  const [text, setText] = useState('');
  const query = searchQuery(text);
  // En una ref: si `submit` cambiara entre renders, el efecto volvería a buscar en cada respuesta.
  const submit = useRef(fetcher.submit);
  submit.current = fetcher.submit;
  useEffect(() => {
    if (!query) return undefined;
    const timer = setTimeout(() => { void submit.current({ text: query, company }, { method: 'post' }); }, SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [query, company]);
  return { text, setText, state: searchState(query, company, fetcher.data) };
}
