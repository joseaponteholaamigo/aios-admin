// Qué muestra la búsqueda por correo mientras se escribe.
//
// EL DEFECTO QUE PREVIENE. La búsqueda llega por detrás y tarde. Si la pantalla mostrara la
// respuesta de un texto o de una empresa anteriores, alguien vería «nadie con ana@» cuando ya escribió
// otra cosa, o las personas de otra empresa. Y si el texto vacío no volviera a la lista, la X no
// serviría para nada.
import { describe, expect, test } from 'vitest';
import { searchQuery, searchState } from '../app/modules/client-users/use-people-search';

const RESULT = { people: [], hasMore: false, onlySome: true };

describe('el estado de la búsqueda', () => {
  test('sin texto (o solo espacios) vuelve a la lista', () => {
    expect(searchState(searchQuery('   '), '', { text: 'ana', company: '', result: RESULT })).toEqual({ kind: 'idle' });
  });

  test('muestra la respuesta solo si es de este texto y de esta empresa', () => {
    expect(searchState('ana', 'acme', { text: 'ana', company: 'acme', result: RESULT })).toEqual({ kind: 'done', result: RESULT });
  });

  test('⛔ una respuesta de otro texto o de otra empresa se queda en «buscando»', () => {
    expect(searchState('ana@', 'acme', { text: 'ana', company: 'acme', result: RESULT })).toEqual({ kind: 'searching' });
    expect(searchState('ana', 'otra', { text: 'ana', company: 'acme', result: RESULT })).toEqual({ kind: 'searching' });
    expect(searchState('ana', '', undefined)).toEqual({ kind: 'searching' });
  });

  test('el texto se compara como lo guarda el backend: sin espacios alrededor ni mayúsculas', () => {
    expect(searchQuery('  Ana@ACME ')).toBe('ana@acme');
  });
});
