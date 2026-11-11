// El módulo «Códigos» del panel (spec «Códigos de registro»: CA-1 a CA-7, CB-13, CB-14).
//
// EL DEFECTO QUE PREVIENE. Una hora del formulario mandada sin zona hace que el código venza cinco
// horas antes en producción; un código escrito a mano que se manda sin tope se puede adivinar; un
// nombre del backend mal traducido pinta un estado o una duración equivocados, o deja ver el correo
// de una cuenta borrada; y una acción que no es pausar, reanudar ni revocar llegaría al backend como
// si lo fuera. Del lado de los permisos, si «codigos» no se tradujera, nadie del equipo vería el módulo.
import { RouterContextProvider } from 'react-router';
import { beforeEach, describe, expect, test, vi } from 'vitest';
import type { TeamMember } from '../app/domain/permissions';
import { actionsFor } from '../app/domain/codes';
import { sessionContext } from '../app/middleware/session.server';
import { teamMemberContext } from '../app/middleware/permissions.server';
import type { ActiveSession } from '../app/shared/session/session.server';
import { toBackendNewCode, toCodeDetail, toCodes } from '../app/shared/api/codes-mapping';
import { toWriteRejection } from '../app/shared/api/write-mapping';
import { toTeamMember } from '../app/shared/api/team-member-mapping';
import { readNewCode } from '../app/modules/codes/new-code-form-data';
import { durationLabel, statusLabel, usesLabel, creditsLabel } from '../app/modules/codes/code-labels';

const createCode = vi.fn();
const changeCodeState = vi.fn();
vi.mock('../app/shared/api/admin-write-api-service.server', () => ({ getAdminWriteApi: () => ({ createCode, changeCodeState }) }));
const { action: crear } = await import('../app/modules/codes/routes/code-new');
const { action: cambiar } = await import('../app/modules/codes/routes/code');

const member: TeamMember = { actor: 'equipo:sub', email: null, name: null, isSuperadmin: false, status: 'active', permissions: { codes: 'edit' } };
const KEY = '0123456789abcdef0123';

function formOf(fields: Record<string, string>) {
  const f = new FormData();
  for (const [k, v] of Object.entries(fields)) f.append(k, v);
  return f;
}

function post(url: string, fields: Record<string, string>, route: typeof crear, params: Record<string, string> = {}) {
  const context = new RouterContextProvider();
  context.set(sessionContext, { sub: 'sub-ana', tokens: { accessToken: 'token-ana' } } as unknown as ActiveSession);
  context.set(teamMemberContext, member);
  return route({ request: new Request(`https://dxxxx.cloudfront.net${url}`, { method: 'POST', body: formOf(fields) }), context, params } as never);
}

const FORM = { code: '', label: 'Webinar de noviembre', from: '', until: '2026-11-30T23:59', cap: '', durationKind: 'months', durationN: '2', monthlyCredits: '1000', dailyBrake: '200', reason: '', key: KEY };

beforeEach(() => { createCode.mockReset(); changeCodeState.mockReset(); });

describe('el formulario de un código nuevo', () => {
  test('⛔ las fechas van en hora de Bogotá, con su zona; un código vacío se genera', () => {
    const r = readNewCode(formOf(FORM));
    expect('code' in r && [r.code.code, r.code.until, r.code.from, r.code.duration]).toEqual([null, '2026-11-30T23:59:00-05:00', null, { kind: 'months', n: 2 }]);
  });

  test('⛔ CA-2 · uno escrito a mano va en mayúsculas, y sin tope no se acepta: se puede adivinar', () => {
    const sinTope = readNewCode(formOf({ ...FORM, code: 'webinar-nov' }));
    expect('errors' in sinTope && Object.keys(sinTope.errors)).toEqual(['cap']);
    const conTope = readNewCode(formOf({ ...FORM, code: 'webinar-nov', cap: '300' }));
    expect('code' in conTope && [conTope.code.code, conTope.code.cap]).toEqual(['WEBINAR-NOV', 300]);
  });

  test('⛔ CB-13 · lo que no tiene forma dice su campo', () => {
    const r = readNewCode(formOf({ ...FORM, until: '', monthlyCredits: '1001', durationN: '40', code: 'abc' }));
    expect('errors' in r && Object.keys(r.errors).sort()).toEqual(['code', 'monthlyCredits', 'until']);
    const sinDias = readNewCode(formOf({ ...FORM, durationN: '40' }));
    expect('errors' in sinDias && Object.keys(sinDias.errors)).toEqual(['durationN']);
  });

  test('una fecha fija y sin fin son duraciones', () => {
    const hasta = readNewCode(formOf({ ...FORM, durationKind: 'until', durationDate: '2027-01-31' }));
    const sinFin = readNewCode(formOf({ ...FORM, durationKind: 'no-end' }));
    expect(['code' in hasta && hasta.code.duration, 'code' in sinFin && sinFin.code.duration]).toEqual([{ kind: 'until', date: '2027-01-31' }, { kind: 'no-end' }]);
  });
});

describe('la traducción con el backend', () => {
  const CRUDO = {
    codigo: 'WEBINAR-NOV', etiqueta: 'Webinar', generado: false, desde: '2026-11-01T05:00:00.000Z', hasta: '2026-12-01T04:59:00.000Z',
    tope: 300, usos: 37, reservasVigentes: 4, duracion: { meses: 2 }, creditosAlMes: 1000, frenoDiario: 200, estado: 'pausado',
    motivoDePausa: 'freno-diario', creadoEl: '2026-11-01T05:00:00.000Z',
  };

  test('un código de la lista, con su estado y por qué está en pausa', () => {
    const c = toCodes({ codigos: [CRUDO] })[0]!;
    expect([c.status, c.pausedBy, c.duration, usesLabel(c), statusLabel(c).text]).toEqual(['paused', 'brake', { kind: 'months', n: 2 }, '37 de 300', 'En pausa por el freno del día']);
  });

  test('⛔ CA-4 · el canje de una cuenta borrada no trae ni correo ni cuenta', () => {
    const d = toCodeDetail({ codigo: { ...CRUDO, canjes: [{ correo: null, cuenta: null, canjeadoEl: '2026-11-02T00:00:00Z', borrada: true }] } });
    expect(d.redemptions).toEqual([{ email: null, accountId: null, redeemedAt: '2026-11-02T00:00:00Z', deleted: true }]);
  });

  test('el pedido de crear viaja en los nombres del backend; lo no elegido no viaja', () => {
    const r = readNewCode(formOf({ ...FORM, reason: 'para el webinar' }));
    expect('code' in r && toBackendNewCode(r.code)).toEqual({
      etiqueta: 'Webinar de noviembre', hasta: '2026-11-30T23:59:00-05:00', duracion: { meses: 2 }, creditosAlMes: 1000, frenoDiario: 200, motivo: 'para el webinar', clave: KEY,
    });
  });

  test('un rechazo con campo va junto a ese campo del formulario', () => {
    expect(toWriteRejection({ codigo: 'invalido', campo: 'duracion', error: 'x' })?.rejection).toEqual({ code: 'invalid', message: 'x', field: 'duration' });
    expect(toWriteRejection({ codigo: 'codigo-existe' })?.rejection).toEqual({ code: 'code-exists' });
  });

  test('⛔ el módulo «codigos» del backend es «Códigos» del panel: sin la traducción, nadie lo vería', () => {
    const m = toTeamMember({ actor: 'equipo:sub', estado: 'activa', superadmin: false, permisos: { codigos: 'ver' } }, () => {});
    expect(m.permissions).toEqual({ codes: 'view' });
  });

  test('cómo se dicen la duración y los créditos', () => {
    expect([durationLabel({ kind: 'days', n: 1 }), durationLabel({ kind: 'no-end' }), creditsLabel(0), creditsLabel(1000)]).toEqual(['1 día desde el canje', 'sin fin', 'sin créditos', '1.000 al mes']);
  });
});

describe('las rutas', () => {
  test('⛔ CA-1 · crear lleva al detalle del código nuevo, con el aviso', async () => {
    createCode.mockResolvedValue({ kind: 'ok', value: { code: 'ENSO-AAAA-BBBB-CCCC' } });
    const r = (await post('/codes/new', FORM, crear)) as Response;
    expect(createCode).toHaveBeenCalledWith('token-ana', expect.objectContaining({ key: KEY, until: '2026-11-30T23:59:00-05:00' }));
    expect(r.headers.get('Location')).toBe('/codes/ENSO-AAAA-BBBB-CCCC?aviso=creado');
  });

  test('un rechazo vuelve al formulario con lo escrito y la misma clave (CA-7)', async () => {
    createCode.mockResolvedValue({ kind: 'rejected', rejection: { code: 'code-exists' }, createdAccountId: null });
    const r = (await post('/codes/new', { ...FORM, code: 'WEBINAR-NOV', cap: '10' }, crear)) as { values: Record<string, string>; rejection: unknown };
    expect([r.values.key, r.values.code, r.rejection]).toEqual([KEY, 'WEBINAR-NOV', { code: 'code-exists' }]);
  });

  test('⛔ CA-5 · una acción del detalle llega al backend tal cual; una que no existe, no llega', async () => {
    changeCodeState.mockResolvedValue({ kind: 'ok', value: { code: 'WEBINAR-NOV' } });
    const r = (await post('/codes/WEBINAR-NOV', { accion: 'revoke', reason: ' se filtró ' }, cambiar as never, { code: 'WEBINAR-NOV' })) as Response;
    expect(changeCodeState).toHaveBeenCalledWith('token-ana', 'WEBINAR-NOV', 'revoke', 'se filtró');
    expect(r.headers.get('Location')).toBe('/codes/WEBINAR-NOV?aviso=revoke');
    changeCodeState.mockClear();
    await post('/codes/WEBINAR-NOV', { accion: 'borrar' }, cambiar as never, { code: 'WEBINAR-NOV' });
    expect(changeCodeState).not.toHaveBeenCalled();
  });

  test('un revocado no ofrece acciones; uno en pausa, reanudar o revocar', () => {
    expect([actionsFor({ status: 'revoked' }), actionsFor({ status: 'paused' }), actionsFor({ status: 'expired' })]).toEqual([[], ['resume', 'revoke'], ['pause', 'revoke']]);
  });
});
