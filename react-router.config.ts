import type { Config } from '@react-router/dev/config';

// Con servidor: el panel resuelve el login, la sesión y los permisos del lado del servidor, y los
// tokens nunca llegan al navegador (plan §3.3).
export default {
  ssr: true,
} satisfies Config;
