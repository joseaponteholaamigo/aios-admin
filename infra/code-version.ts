// La versión del código que lleva cada revisión (`PANEL_VERSION`): el commit desde el que se armó.
//
// Las métricas de una Web Function no dicen qué revisión respondió; con la versión en el log de
// arranque, un error en los logs se puede atar a su commit (lo recomienda la documentación de las
// Web Functions). Si hay cambios sin commitear, la versión lo dice, para que el log no nombre un
// commit que no es el que corre.
import { execFileSync } from 'node:child_process';

export const UNKNOWN_VERSION = 'desconocida';
export const UNCOMMITTED_SUFFIX = '-sin-commitear';

type Git = (args: string[]) => string;

const runGit: Git = (args) => execFileSync('git', args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim();

/** El commit corto de `HEAD`, con la marca si hay cambios sin commitear. Sin `git`, `desconocida`. */
export function codeVersion(git: Git = runGit): string {
  try {
    const commit = git(['rev-parse', '--short', 'HEAD']);
    const dirty = git(['status', '--porcelain']) !== '';
    return dirty ? `${commit}${UNCOMMITTED_SUFFIX}` : commit;
  } catch {
    return UNKNOWN_VERSION;
  }
}

/** **Lanza** si `version` no tiene la forma de `codeVersion()`: una variable inventada no llega a la revisión. */
export function requireCodeVersion(version: string): string {
  const valid = version === UNKNOWN_VERSION || new RegExp(`^[0-9a-f]{7,40}(${UNCOMMITTED_SUFFIX})?$`).test(version);
  if (!valid) throw new Error(`La versión del código «${version}» no es un commit (ni «${UNKNOWN_VERSION}»)`);
  return version;
}
