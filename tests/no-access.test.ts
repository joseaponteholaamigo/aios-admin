// La página «sin acceso» (CB-5).
//
// EL DEFECTO QUE PREVIENE. A «sin acceso» llega quien el backend rechaza, con la sesión de Cognito
// todavía abierta. Si «Volver a entrar» fuera al login, Cognito devolvería sola la misma cuenta y
// la persona caería otra vez aquí, sin forma de entrar con otra cuenta salvo borrando las cookies.
import { createElement } from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import { expect, test } from 'vitest';
import NoAccess from '../app/modules/auth/routes/no-access';

test('⛔ «Volver a entrar» pasa por la salida, que cierra también la sesión de Cognito', () => {
  const html = renderToStaticMarkup(createElement(NoAccess));
  const form = html.match(/<form([^>]*)>(.*?)<\/form>/);
  expect(form?.[2]).toContain('Volver a entrar');
  expect(form?.[1]).toContain('method="post"');
  expect(form?.[1]).toContain('action="/auth/logout"');
  expect(html).not.toContain('href="/auth/login"');
});
