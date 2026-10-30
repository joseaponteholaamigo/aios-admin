// La búsqueda de las listas del panel mientras se escribe, y la búsqueda que queda en la dirección
// después del `#` (Usuarios de clientes y Empresas; spec «Cuentas personales», CA-19 y CB-7).
//
// EL DEFECTO QUE PREVIENE. La búsqueda llega por detrás y tarde. Si la pantalla mostrara la
// respuesta de un texto o de unos filtros anteriores, alguien vería «nadie con ana@» cuando ya
// escribió otra cosa, o las cuentas de otra pestaña. Si el texto vacío no volviera a la lista, la X
// no serviría para nada. Y si un enlace con `#buscar=` trajera algo que no se puede buscar, la
// página lo mandaría igual.
import { describe, expect, test } from 'vitest';
import { hashFor, searchQuery, searchScope, searchState, textFromHash } from '../app/shared/search/use-background-search';

const RESULT = { people: [], hasMore: false, onlySome: true };
const ACME = searchScope({ company: 'acme' });

describe('el estado de la búsqueda', () => {
  test('sin texto (o solo espacios) vuelve a la lista', () => {
    expect(searchState(searchQuery('   '), ACME, { text: 'ana', scope: ACME, result: RESULT })).toEqual({ kind: 'idle' });
  });

  test('muestra la respuesta solo si es de este texto y de estos filtros', () => {
    expect(searchState('ana', ACME, { text: 'ana', scope: ACME, result: RESULT })).toEqual({ kind: 'done', result: RESULT });
  });

  test('⛔ una respuesta de otro texto o de otros filtros se queda en «buscando»', () => {
    expect(searchState('ana@', ACME, { text: 'ana', scope: ACME, result: RESULT })).toEqual({ kind: 'searching' });
    expect(searchState('ana', searchScope({ company: 'otra' }), { text: 'ana', scope: ACME, result: RESULT })).toEqual({ kind: 'searching' });
    expect(searchState('ana', ACME, undefined)).toEqual({ kind: 'searching' });
  });

  test('los filtros se comparan sin importar en qué orden se escribieron', () => {
    expect(searchScope({ plan: 'pro', kind: 'personal' })).toBe(searchScope({ kind: 'personal', plan: 'pro' }));
    expect(searchScope({ plan: 'pro', kind: 'personal' })).not.toBe(searchScope({ kind: 'company', plan: 'pro' }));
  });

  test('el texto se compara como lo guarda el backend: sin espacios alrededor ni mayúsculas', () => {
    expect(searchQuery('  Ana@ACME ')).toBe('ana@acme');
  });
});

describe('la búsqueda en la dirección, después del #', () => {
  test('lo que se escribe queda legible después del #, y se lee igual al abrir el enlace', () => {
    expect(hashFor('maria@gmail.com')).toBe('#buscar=maria@gmail.com');
    for (const texto of ['maria@gmail.com', 'ana+ventas@x.co', 'ávila hnos', 'a&b=c#d']) {
      expect(textFromHash(hashFor(texto)), texto).toBe(texto);
    }
  });

  test('sin texto no queda nada después del #', () => {
    expect(hashFor('')).toBe('');
  });

  test('al abrir, el texto llega como lo compara el backend', () => {
    expect(textFromHash('#buscar=%20Maria@GMAIL.com%20')).toBe('maria@gmail.com');
  });

  test('⛔ CB-7 · una búsqueda vacía, más larga que un correo o con otras claves se ignora', () => {
    for (const malo of ['', '#', '#buscar=', '#buscar=%20%20', `#buscar=${'a'.repeat(255)}`, '#buscar=ana&otra=1', '#otra=ana', '#seccion']) {
      expect(textFromHash(malo), malo.slice(0, 30)).toBe('');
    }
  });
});
