// El stack del panel del equipo (`AiosAdmin`, cuenta `enso`): arma las piezas de los otros
// archivos de `infra/` en el orden en que dependen unas de otras.
//
// Despliegue completo, la primera vez (lo corre Jose; ver `aios-admin/CLAUDE.md`):
//   1. backend, primera pasada (`AIOS_ADMIN_URLS=primera-pasada`): crea el pool del equipo;
//   2. este stack: crea CloudFront y escribe su dirección en SSM. El panel responde 503 hasta el
//      paso 3, porque todavía no existen el cliente de Cognito ni la API de admin;
//   3. backend, segunda pasada (`AIOS_ADMIN_URLS=<PanelUrl>`): el panel toma solo los parámetros
//      nuevos, sin volver a desplegarse.
import { CfnOutput, Stack, type StackProps } from 'aws-cdk-lib';
import type { Construct } from 'constructs';
import { createAlarms } from './alarms.ts';
import { requireCodeVersion } from './code-version.ts';
import { createDistribution, createStaticSite } from './edge.ts';
import { createSessionStore } from './sessions.ts';
import { createPanelFunction } from './web-function.ts';

export type AdminPanelStackProps = StackProps & {
  /** El paquete del servidor (`npm run lambda:asset` → `.lambda-asset/`). */
  codeAssetPath: string;
  /** Los estáticos del build (`build/client/`). */
  staticAssetPath: string;
  /** La versión del código: el commit desde el que se armó (`code-version.ts`). */
  version: string;
};

export class AdminPanelStack extends Stack {
  constructor(scope: Construct, id: string, { codeAssetPath, staticAssetPath, version, ...props }: AdminPanelStackProps) {
    super(scope, id, {
      ...props,
      terminationProtection: true,
      description: 'Panel del equipo ENSO (aios-admin): Web Function, CloudFront, estaticos y sesiones',
    });
    const sessions = createSessionStore(this);
    const site = createStaticSite(this, staticAssetPath);
    const panel = createPanelFunction(this, { codeAssetPath, sessions, liveAfter: [site.upload], version: requireCodeVersion(version) });
    const distribution = createDistribution(this, panel, site.bucket);
    createAlarms(this);

    new CfnOutput(this, 'PanelUrl', {
      value: `https://${distribution.distributionDomainName}`,
      description: 'La dirección del panel: va en AIOS_ADMIN_URLS del backend (segunda pasada) y en npm run smoke',
    });
    new CfnOutput(this, 'DistributionId', { value: distribution.distributionId });
    new CfnOutput(this, 'EndpointDomain', { value: panel.endpoint.attrDomainName, description: 'Solo responde a pedidos firmados (IamAuth)' });
  }
}
