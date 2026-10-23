// La versión del código que lleva cada revisión (`infra/code-version.ts`).
//
// EL DEFECTO QUE PREVIENE. Si la versión nombrara un commit que no es el que corre (porque había
// cambios sin commitear), un error en los logs llevaría a mirar el código equivocado. Y si una
// máquina sin `git` no pudiera desplegar, una herramienta de diagnóstico bloquearía un arreglo.
import { describe, expect, test } from 'vitest';
import { codeVersion, requireCodeVersion } from '../infra/code-version';

const gitWith = (status: string) => (args: string[]) => (args[0] === 'rev-parse' ? '320fbec' : status);

describe('codeVersion', () => {
  test('con el árbol limpio es el commit corto', () => {
    expect(codeVersion(gitWith(''))).toBe('320fbec');
  });

  test('⛔ con cambios sin commitear lo dice, en vez de nombrar un commit que no es el que corre', () => {
    expect(codeVersion(gitWith(' M server/index.js'))).toBe('320fbec-sin-commitear');
  });

  test('sin git no frena el despliegue', () => {
    expect(codeVersion(() => { throw new Error('git: command not found'); })).toBe('desconocida');
  });
});

describe('requireCodeVersion', () => {
  test('acepta lo que da codeVersion y rechaza cualquier otra cosa', () => {
    for (const ok of ['320fbec', '320fbec-sin-commitear', 'desconocida']) expect(requireCodeVersion(ok)).toBe(ok);
    for (const bad of ['', 'v1.0.0', 'abc', '320fbec; rm', 'ABCDEF1']) expect(() => requireCodeVersion(bad), bad).toThrow(/versión/);
  });
});
