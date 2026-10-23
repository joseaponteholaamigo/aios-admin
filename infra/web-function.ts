// La Lambda Web Function del panel: su rol, sus logs, el bucket de su código, la revisión y el
// endpoint (plan §5.1, camino A; CA-33 y CA-35).
//
// ⚠️ Lo que aprendimos de la documentación y que no se ve en el código:
//   - El código entra como zip desde un bucket VERSIONADO, y cada revisión queda atada a la
//     versión exacta del objeto. Si esa versión se borra, la revisión pasa a `Failed` para
//     siempre: por eso el bucket no expira versiones viejas y la subida nunca poda (`prune: false`).
//   - Lambda marca la revisión «activa» aunque el servidor no arranque: después de cada
//     despliegue va `npm run smoke`.
//   - El endpoint es `IamAuth`: solo CloudFront (con OAC) lo puede llamar, no internet.
import { ArnFormat, Fn, RemovalPolicy, Stack, Validations } from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as s3deploy from 'aws-cdk-lib/aws-s3-deployment';
import * as ssm from 'aws-cdk-lib/aws-ssm';
import type { Construct, IDependable } from 'constructs';
import { BACKEND_PARAMETERS, ENDPOINT_NAME, FUNCTION_NAME, LOG_GROUP_NAMES, RUNTIME_PARAMETERS } from './names.ts';
import { grantSessions, type SessionStore } from './sessions.ts';

export const RUNTIME = 'nodejs24.x';
/** El archivo que arranca el servidor, dentro del paquete (`scripts/build-lambda-asset.mjs`). */
export const ENTRYPOINT = 'server/index.js';
const REQUEST_TIMEOUT_SECONDS = 30;
/** Plan §5.3: con el equipo de hoy sobran, y acotan lo que cuesta un abuso. */
export const MAX_ENVIRONMENTS = 2;
export const RATE_LIMIT = 100;

export type PanelFunction = {
  webFunction: lambda.CfnWebFunction;
  revision: lambda.CfnWebFunctionRevision;
  endpoint: lambda.CfnWebFunctionEndpoint;
  role: iam.Role;
};

/** La memoria de la función que sube el código y los estáticos: con la misma, las dos subidas la comparten. */
export const UPLOAD_MEMORY_MB = 512;

/** El validador de CDK todavía no conoce los tipos de las Web Functions; CloudFormation sí. */
function acknowledgeUnknownType(...constructs: Construct[]): void {
  for (const construct of constructs) {
    Validations.of(construct).acknowledge({
      id: 'CloudFormation-Validate::F3006',
      reason: 'Web Functions (2026-10-12): el validador local todavía no conoce el tipo',
    });
  }
}

/** El rol del servidor: logs, sesiones, los parámetros de su configuración y el secreto del cliente. */
function createRole(scope: Construct, sessions: SessionStore): iam.Role {
  const stack = Stack.of(scope);
  const role = new iam.Role(scope, 'PanelRole', {
    assumedBy: new iam.ServicePrincipal('lambda.amazonaws.com'),
    description: 'El servidor del panel del equipo (aios-admin)',
  });
  const logGroupArn = (name: string, region?: string) =>
    stack.formatArn({ service: 'logs', region, resource: 'log-group', resourceName: `${name}:*`, arnFormat: ArnFormat.COLON_RESOURCE_NAME });
  role.addToPrincipalPolicy(new iam.PolicyStatement({
    actions: ['logs:CreateLogGroup', 'logs:CreateLogStream', 'logs:PutLogEvents'],
    // El `.local` lleva región comodín: Lambda escribe ahí en cada región donde atiende.
    resources: [logGroupArn(LOG_GROUP_NAMES[0]), logGroupArn(LOG_GROUP_NAMES[1], '*')],
  }));
  role.addToPrincipalPolicy(new iam.PolicyStatement({
    actions: ['ssm:GetParameters'],
    resources: Object.values(RUNTIME_PARAMETERS).map((name) => stack.formatArn({ service: 'ssm', resource: 'parameter', resourceName: name.slice(1) })),
  }));
  // El secreto del cliente de Cognito se lee del pool al arrancar: nunca va en la plantilla.
  const poolId = ssm.StringParameter.valueForStringParameter(scope, BACKEND_PARAMETERS.COGNITO_POOL_ID);
  role.addToPrincipalPolicy(new iam.PolicyStatement({
    actions: ['cognito-idp:DescribeUserPoolClient'],
    resources: [stack.formatArn({ service: 'cognito-idp', resource: 'userpool', resourceName: poolId })],
  }));
  grantSessions(sessions, role);
  return role;
}

/** Los dos grupos de logs, creados antes que Lambda los cree sin retención. */
function createLogGroups(scope: Construct): logs.LogGroup[] {
  return LOG_GROUP_NAMES.map((logGroupName, i) =>
    new logs.LogGroup(scope, i === 0 ? 'Logs' : 'LocalLogs', { logGroupName, retention: logs.RetentionDays.ONE_MONTH }));
}

/** El bucket del código, con permiso para que Lambda lea las versiones de sus revisiones. */
function createCode(scope: Construct, codeAssetPath: string) {
  const stack = Stack.of(scope);
  const bucket = new s3.Bucket(scope, 'CodeBucket', {
    versioned: true,
    encryption: s3.BucketEncryption.S3_MANAGED,
    blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
    enforceSSL: true,
    removalPolicy: RemovalPolicy.RETAIN,
  });
  bucket.addToResourcePolicy(new iam.PolicyStatement({
    sid: 'LambdaReadsRevisionCode',
    principals: [new iam.ServicePrincipal('lambda.amazonaws.com')],
    actions: ['s3:GetObject', 's3:GetObjectVersion'],
    resources: [bucket.arnForObjects('*')],
    conditions: { ArnLike: { 'aws:SourceArn': stack.formatArn({ service: 'lambda', resource: 'web-function', resourceName: `${FUNCTION_NAME}/revision/*` }) } },
  }));
  // Sube el zip tal cual (`extract: false`) y da la clave y la versión del objeto subido.
  const upload = new s3deploy.BucketDeployment(scope, 'CodeUpload', {
    sources: [s3deploy.Source.asset(codeAssetPath)],
    destinationBucket: bucket,
    extract: false,
    prune: false,
    retainOnDelete: true,
    memoryLimit: UPLOAD_MEMORY_MB,
  });
  return { bucket, upload };
}

/** Las variables de la revisión. Nada secreto: la configuración de Cognito y la API sale de SSM al arrancar. */
function environment(scope: Construct, sessions: SessionStore): Record<string, string> {
  return {
    NODE_ENV: 'production',
    AWS_LAMBDA_NODEJS_ENTRYPOINT: ENTRYPOINT,
    PANEL_REGION: Stack.of(scope).region,
    SESSION_STORE: 'dynamodb',
    SESSION_TABLE: sessions.table.tableName,
    SESSION_KMS_KEY_ID: sessions.key.keyArn,
    PANEL_SSM_PARAMETERS: JSON.stringify(RUNTIME_PARAMETERS),
  };
}

/** Una revisión: el zip subido, fijado a su versión, con su rol y sus variables. */
function createRevision(
  scope: Construct,
  { webFunction, code, role, sessions }: { webFunction: lambda.CfnWebFunction; code: ReturnType<typeof createCode>; role: iam.Role; sessions: SessionStore },
): lambda.CfnWebFunctionRevision {
  const s3Object = { bucket: code.bucket.bucketName, key: Fn.select(0, code.upload.objectKeys), versionId: Fn.select(0, code.upload.objectVersionIds) };
  return new lambda.CfnWebFunctionRevision(scope, 'Revision', {
    functionName: webFunction.attrFunctionArn,
    buildConfig: { codeConfig: { s3Object }, runtimeConfig: { runtime: RUNTIME } },
    serviceConfig: { executionRoleArn: role.roleArn, timeoutSeconds: REQUEST_TIMEOUT_SECONDS, environmentVariables: environment(scope, sessions) },
  });
}

/**
 * La Web Function con su revisión y su endpoint. `liveAfter`: lo que tiene que estar listo antes de
 * que el endpoint pase el tráfico a la revisión nueva (los estáticos que su HTML nombra).
 */
export function createPanelFunction(
  scope: Construct,
  { codeAssetPath, sessions, liveAfter }: { codeAssetPath: string; sessions: SessionStore; liveAfter: IDependable[] },
): PanelFunction {
  const role = createRole(scope, sessions);
  const logGroups = createLogGroups(scope);
  const code = createCode(scope, codeAssetPath);
  const webFunction = new lambda.CfnWebFunction(scope, 'WebFunction', { functionName: FUNCTION_NAME });
  const revision = createRevision(scope, { webFunction, code, role, sessions });
  // Lambda revisa al crear la revisión que puede leer el código, y el servidor escribe logs al arrancar.
  revision.node.addDependency(code.bucket.policy!, role, ...logGroups);
  const endpoint = new lambda.CfnWebFunctionEndpoint(scope, 'Endpoint', {
    functionName: webFunction.attrFunctionArn,
    endpointName: ENDPOINT_NAME,
    endpointType: 'HomeRegion',
    authType: 'IamAuth',
    revisionWeights: [{ revisionId: revision.attrRevisionId, weight: 100 }],
    scalingConfig: { maxEnvironments: MAX_ENVIRONMENTS },
    throttleConfig: { rateLimit: RATE_LIMIT },
  });
  endpoint.node.addDependency(...liveAfter);
  acknowledgeUnknownType(webFunction, revision, endpoint);
  return { webFunction, revision, endpoint, role };
}
