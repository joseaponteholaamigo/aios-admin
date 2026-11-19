// Los hosts que React Router acepta en una action (`server/action-origins.js`).
//
// EL DEFECTO QUE PREVIENE. Sin esta lista, detrás de CloudFront React Router compara `Origin`
// (el dominio de CloudFront) con `request.url` (el del endpoint de Lambda), no coinciden, y cada
// formulario legítimo responde 400. Se descubriría con el panel ya desplegado.
import { expect, test } from 'vitest';
import { actionOriginHosts } from '../server/action-origins.js';

test('los hosts salen de PUBLIC_ORIGINS, con el puerto si lo tienen', () => {
  expect(actionOriginHosts({ PUBLIC_ORIGINS: 'https://dxxxx.cloudfront.net, https://admin.beenso.com/, http://localhost:5173' }))
    .toEqual(['dxxxx.cloudfront.net', 'admin.beenso.com', 'localhost:5173']);
});
