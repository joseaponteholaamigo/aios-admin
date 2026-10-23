// En qué cuenta puede desplegarse el panel (`infra/accounts.ts`, CA-34).
//
// EL DEFECTO QUE PREVIENE. El portal SSO abre varias cuentas, y desplegar en la equivocada no
// falla: crea tablas y llaves que quedan retenidas donde no van. La regla tiene que frenar antes
// de sintetizar, nombrando la cuenta esperada y la recibida, y no puede tener escape.
import { describe, expect, test } from 'vitest';
import { ENSO_ACCOUNT, requireAllowedAccount } from '../infra/accounts';

describe('requireAllowedAccount', () => {
  test('la cuenta enso pasa', () => {
    expect(requireAllowedAccount(ENSO_ACCOUNT)).toEqual({ ok: true, name: 'enso' });
  });

  test('⛔ cualquier otra cuenta frena, nombrando la esperada y la recibida', () => {
    expect(() => requireAllowedAccount('871640284887')).toThrow(/871640284887[\s\S]*901454175567/);
  });

  test('sin credenciales solo avisa: revisar la plantilla no habla con AWS', () => {
    const warnings: string[] = [];
    expect(requireAllowedAccount(undefined, (m) => warnings.push(m))).toEqual({ ok: false, reason: 'no-account' });
    expect(warnings).toHaveLength(1);
  });
});
