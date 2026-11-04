// Lo que el formulario de crear una cuenta le manda al backend (spec «Crear empresas e invitar
// personas», CA-3, CA-17 y CA-21).
//
// EL DEFECTO QUE PREVIENE. Si el formulario leyera mal un campo, el backend crearía otra cosa que la
// que se ve en pantalla: una cuenta personal con equipo, un cupo vacío como «cero» en vez de «sin
// tope», o el «mover» encendido sin que nadie oprimiera el botón, que borra una cuenta.
import { describe, expect, test } from 'vitest';
import { readNewAccount } from '../app/modules/companies/new-account-form-data';

const KEY = 'clave-de-prueba-0001';

function formOf(fields: Record<string, string>) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, v);
  return form;
}

const EMPRESA = {
  kind: 'company', name: ' Acme ', plan: 'custom', adminEmail: ' Ana@Acme.com ', reason: ' contrato firmado ', key: KEY,
  content: 'all', seats: '3', team: 'on', schedules: 'on', endsOn: '', 'quota-radar': '5', 'quota-projects': '', 'quota-skills': '', 'quota-chains': '0',
};

describe('el formulario de crear una cuenta', () => {
  test('un Personalizado llega con sus condiciones; un cupo vacío no viaja y queda sin tope', () => {
    expect(readNewAccount(formOf(EMPRESA))).toEqual({
      account: {
        kind: 'company', name: 'Acme', plan: 'custom', adminEmail: 'ana@acme.com', reason: 'contrato firmado', key: KEY, moveFromPersonal: false,
        conditions: { content: 'all', seats: 3, team: true, schedules: true, endsOn: null, quotas: { radar: 5, chains: 0 } },
      },
    });
  });

  test('⛔ CA-3 · una cuenta personal es de una persona aunque el formulario mande otros asientos o equipo', () => {
    const r = readNewAccount(formOf({ ...EMPRESA, kind: 'personal' }));
    expect('account' in r && r.account.conditions).toMatchObject({ seats: 1, team: false });
  });

  test('Free no lleva condiciones, aunque el formulario las traiga', () => {
    const r = readNewAccount(formOf({ ...EMPRESA, plan: 'free' }));
    expect('account' in r && r.account.conditions).toBeNull();
  });

  test('⛔ mover solo se enciende con el botón de mover', () => {
    const sin = readNewAccount(formOf(EMPRESA));
    const con = readNewAccount(formOf({ ...EMPRESA, move: '1' }));
    expect(['account' in sin && sin.account.moveFromPersonal, 'account' in con && con.account.moveFromPersonal]).toEqual([false, true]);
  });

  test('cada campo mal escrito vuelve con su error, junto a su campo', () => {
    const r = readNewAccount(formOf({ ...EMPRESA, name: ' ', adminEmail: 'ana-acme', reason: '', seats: '0', endsOn: '4/11/2026', 'quota-radar': '-1' }));
    expect('errors' in r && Object.keys(r.errors).sort()).toEqual(['adminEmail', 'name', 'reason']);
    const plan = readNewAccount(formOf({ ...EMPRESA, seats: '0', endsOn: '4/11/2026', 'quota-radar': '-1' }));
    expect('errors' in plan && Object.keys(plan.errors).sort()).toEqual(['endsOn', 'quota-radar', 'seats']);
  });

  test('sin la clave del formulario no se manda nada', () => {
    const r = readNewAccount(formOf({ ...EMPRESA, key: '' }));
    expect('errors' in r && r.errors.key).toBeTruthy();
  });
});
