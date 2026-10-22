import { reactRouter } from '@react-router/dev/vite';
import { defineConfig, loadEnv } from 'vite';

export default defineConfig(({ mode }) => {
  // En desarrollo, el servidor lee su configuración de `.env` (copia de `.env.example`). Lo que ya
  // viene del entorno gana. Vite solo expone al navegador lo que empieza con `VITE_`, y el panel
  // no usa ninguna: todo lo que hay aquí se queda en el servidor.
  for (const [name, value] of Object.entries(loadEnv(mode, process.cwd(), ''))) {
    process.env[name] ??= value;
  }
  return { plugins: [reactRouter()] };
});
