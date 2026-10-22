import type { Config } from '@react-router/dev/config';

// Con servidor: el panel resuelve el login, la sesión y los permisos del lado del servidor, y los
// tokens nunca llegan al navegador (plan §3.3).
export default {
  ssr: true,
  // `PANEL_BUILD_DIR` existe solo para que la prueba del build (CA-29) construya en una carpeta
  // temporal sin pisar `build/`. El servidor (`server/index.js`) siempre lee `build/`.
  buildDirectory: process.env.PANEL_BUILD_DIR || 'build',
} satisfies Config;
