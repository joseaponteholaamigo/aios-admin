// El build se detiene si algo de `app/` importa de `dev/` (CA-29): la identidad falsa nunca puede
// llegar al servidor que se despliega. `tests/structure.test.ts` lo revisa también sin build.
import { dirname, resolve, sep } from 'node:path';
import type { Plugin } from 'vite';

export function forbidDevImports(root: string): Plugin {
  const appDir = resolve(root, 'app') + sep;
  const devDir = resolve(root, 'dev');
  return {
    name: 'aios-admin-forbid-dev-imports',
    apply: 'build',
    resolveId(source, importer) {
      if (!importer?.startsWith(appDir) || !source.startsWith('.')) return null;
      const target = resolve(dirname(importer), source);
      if (target === devDir || target.startsWith(devDir + sep)) {
        this.error(`${importer} importa de dev/ («${source}»): la identidad falsa no puede entrar al build`);
      }
      return null;
    },
  };
}
