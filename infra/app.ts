#!/usr/bin/env node
// Entrada de la app de CDK del panel (`cdk.json` la corre con `node`, que entiende TypeScript sin
// compilar desde Node 22.18). Solo revisa la cuenta y el paquete, e instancia el stack.
import { existsSync } from 'node:fs';
import { App } from 'aws-cdk-lib';
import { requireAllowedAccount } from './accounts.ts';
import { AdminPanelStack } from './admin-panel-stack.ts';

export const CODE_ASSET_PATH = '.lambda-asset';
export const STATIC_ASSET_PATH = 'build/client';

// Antes de instanciar nada: si la cuenta no es la esperada, mejor que ni se sintetice la plantilla.
requireAllowedAccount(process.env.CDK_DEFAULT_ACCOUNT);

const REQUIRED = [
  [`${CODE_ASSET_PATH}/server/index.js`, 'el paquete del servidor'],
  [STATIC_ASSET_PATH, 'los estáticos del build'],
] as const;
for (const [path, what] of REQUIRED) {
  if (!existsSync(path)) throw new Error(`Falta ${what} (${path}): corre primero npm run lambda:asset`);
}

const app = new App();
new AdminPanelStack(app, 'AiosAdmin', {
  // La cuenta y la región salen del perfil de quien despliega; el filtro de arriba impide que sea cualquiera.
  env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },
  codeAssetPath: CODE_ASSET_PATH,
  staticAssetPath: STATIC_ASSET_PATH,
});
