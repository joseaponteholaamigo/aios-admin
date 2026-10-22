// Dónde escucha el servidor (`server/listen-address.js`).
//
// EL DEFECTO QUE PREVIENE. En una Lambda Web Function, escuchar en otra dirección que la de
// `AWS_LAMBDA_HTTP_ENDPOINT` no da error al desplegar: la revisión queda «activa» y cada pedido
// responde 502. La prueba rápida después del despliegue lo vería tarde; esta, antes.
import { describe, expect, test } from 'vitest';
import { listenAddress, LOCAL_PORT } from '../server/listen-address.js';

describe('listenAddress', () => {
  test('en una Web Function usa el host y el puerto que da Lambda, aunque haya PORT', () => {
    expect(listenAddress({ AWS_LAMBDA_HTTP_ENDPOINT: '169.254.100.6:8080', PORT: '3000' }))
      .toEqual({ host: '169.254.100.6', port: 8080 });
  });

  test('fuera de una Web Function usa PORT, o el puerto local, en la máquina local', () => {
    expect(listenAddress({ PORT: '4100' })).toEqual({ host: '127.0.0.1', port: 4100 });
    expect(listenAddress({})).toEqual({ host: '127.0.0.1', port: LOCAL_PORT });
  });

  test('un valor de Lambda sin la forma host:puerto falla al arrancar, no en el primer pedido', () => {
    for (const bad of ['8080', ':8080', '169.254.100.6:', '169.254.100.6:puerto']) {
      expect(() => listenAddress({ AWS_LAMBDA_HTTP_ENDPOINT: bad }), bad).toThrow(/host:puerto/);
    }
  });
});
