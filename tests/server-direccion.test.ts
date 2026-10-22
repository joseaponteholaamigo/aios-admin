// Dónde escucha el servidor (`server/direccion.js`).
//
// EL DEFECTO QUE PREVIENE. En una Lambda Web Function, escuchar en otra dirección que la de
// `AWS_LAMBDA_HTTP_ENDPOINT` no da error al desplegar: la revisión queda «activa» y cada pedido
// responde 502. La prueba rápida después del despliegue lo vería tarde; esta, antes.
import { describe, expect, test } from 'vitest';
import { direccionDeEscucha, PUERTO_LOCAL } from '../server/direccion.js';

describe('direccionDeEscucha', () => {
  test('en una Web Function usa el host y el puerto que da Lambda, aunque haya PORT', () => {
    expect(direccionDeEscucha({ AWS_LAMBDA_HTTP_ENDPOINT: '169.254.100.6:8080', PORT: '3000' }))
      .toEqual({ host: '169.254.100.6', port: 8080 });
  });

  test('fuera de una Web Function usa PORT, o el puerto local, en la máquina local', () => {
    expect(direccionDeEscucha({ PORT: '4100' })).toEqual({ host: '127.0.0.1', port: 4100 });
    expect(direccionDeEscucha({})).toEqual({ host: '127.0.0.1', port: PUERTO_LOCAL });
  });

  test('un valor de Lambda sin la forma host:puerto falla al arrancar, no en el primer pedido', () => {
    for (const malo of ['8080', ':8080', '169.254.100.6:', '169.254.100.6:puerto']) {
      expect(() => direccionDeEscucha({ AWS_LAMBDA_HTTP_ENDPOINT: malo }), malo).toThrow(/host:puerto/);
    }
  });
});
