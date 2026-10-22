import { reactRouter } from '@react-router/dev/vite';
import { defineConfig, loadEnv } from 'vite';
import { devIdentityPlugin } from './dev/identity/vite-plugin.ts';
import { forbidDevImports } from './tooling/forbid-dev-imports.ts';

/** El puerto de `npm run dev`. Fijo: `PUBLIC_ORIGINS` y `COGNITO_ISSUER` de `.env` lo nombran. */
const DEV_PORT = 5173;

export default defineConfig(({ mode }) => {
  // En desarrollo, el servidor lee su configuración de `.env` (copia de `.env.example`). Lo que ya
  // viene del entorno gana. Vite solo expone al navegador lo que empieza con `VITE_`, y el panel
  // no usa ninguna: todo lo que hay aquí se queda en el servidor.
  for (const [name, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    process.env[name] ??= value;
  }
  return {
    // La identidad falsa solo se aplica a `npm run dev`; el candado de `dev/`, solo al build.
    plugins: [devIdentityPlugin(), forbidDevImports(process.cwd()), reactRouter()],
    server: { port: DEV_PORT, strictPort: true },
  };
});
