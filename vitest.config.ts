import { defineConfig } from 'vitest/config';

// Sin el plugin de React Router: las pruebas corren la lógica, los loaders y las actions como
// funciones, no el servidor de desarrollo.
export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
});
