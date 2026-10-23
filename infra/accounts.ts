// En qué cuenta de AWS puede desplegarse el stack del panel. Una sola: `enso` (CA-34).
//
// Es la misma regla que `aios-backend/infra/cuentas.js`, por el mismo motivo: el portal SSO abre
// más de una cuenta, y apuntar a la equivocada no falla, crea recursos donde no van. Es una
// allow-list, y no hay variable de entorno que la salte: desplegar en otra cuenta exige editar
// esta lista, que deja rastro en el diff.

export const ENSO_ACCOUNT = '901454175567';

/** Las permitidas. El valor es el nombre humano, solo para el mensaje de error. */
export const ALLOWED_ACCOUNTS: Readonly<Record<string, string>> = Object.freeze({ [ENSO_ACCOUNT]: 'enso' });

export type AccountVerdict = { ok: true; name: string } | { ok: false; reason: 'no-account' | 'not-allowed' };

export function checkAccount(account: string | undefined): AccountVerdict {
  if (!account) return { ok: false, reason: 'no-account' };
  const name = ALLOWED_ACCOUNTS[account];
  return name ? { ok: true, name } : { ok: false, reason: 'not-allowed' };
}

export function accountMessage(account: string | undefined, reason: 'no-account' | 'not-allowed'): string {
  if (reason === 'no-account') {
    return [
      'No se sabe en qué cuenta de AWS se iba a desplegar: no hay credenciales activas.',
      'Para revisar la plantilla basta con esto (`cdk synth` no habla con AWS). Para desplegar, entra primero:',
      '',
      '  aws sso login --profile enso',
    ].join('\n');
  }
  const allowed = Object.entries(ALLOWED_ACCOUNTS).map(([id, name]) => `  · ${id}  (${name})`).join('\n');
  return [
    `⛔ Cuenta de AWS NO PERMITIDA: ${account}`,
    '',
    'El stack del panel solo puede desplegarse en:',
    allowed,
    '',
    'No hay variable que lo salte: si alguna vez hiciera falta otra cuenta, se agrega a',
    'ALLOWED_ACCOUNTS en infra/accounts.ts, y ese cambio se revisa como cualquier otro.',
  ].join('\n');
}

/**
 * **Lanza** si la cuenta es otra, antes de instanciar el stack. Sin credenciales solo avisa:
 * `cdk synth` no habla con AWS, y un `cdk deploy` sin credenciales falla de todos modos.
 */
export function requireAllowedAccount(account: string | undefined, warn: (message: string) => void = console.error): AccountVerdict {
  const verdict = checkAccount(account);
  if (verdict.ok) return verdict;
  if (verdict.reason === 'no-account') {
    warn(accountMessage(account, 'no-account'));
    return verdict;
  }
  throw new Error(accountMessage(account, 'not-allowed'));
}
