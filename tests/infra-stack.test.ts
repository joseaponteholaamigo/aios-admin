// El stack del panel (`infra/`, CA-33 y CA-35) y su política de protección.
//
// EL DEFECTO QUE PREVIENE. Un endpoint `ApplicationManaged` quedaría abierto a internet sin pasar
// por CloudFront; un bucket de código que expire versiones viejas rompe para siempre la revisión que
// las usa; un secreto en las variables de la revisión queda a la vista de cualquiera que lea la
// función; una llave que otro rol pueda usar para descifrar expone los tokens de las sesiones; y un
// recurso con estado fuera de la política del stack se puede borrar con un despliegue.
//
// ⏱ Pasa el techo de 1 s a propósito: sintetiza el stack de verdad (cargar CDK y armar los assets
// tarda unos segundos), una sola vez para todo el archivo.
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterAll, beforeAll, describe, expect, test } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Match, Template } from 'aws-cdk-lib/assertions';
import { AdminPanelStack } from '../infra/admin-panel-stack';
import { SESSION_ENCRYPTION_CONTEXT } from '../infra/sessions';
import { ENTRYPOINT, MAX_ENVIRONMENTS, RATE_LIMIT, RUNTIME } from '../infra/web-function';
import { BACKEND_ALARM_TOPIC_NAME, LOG_GROUP_NAMES, PUBLIC_ORIGINS_PARAMETER, RUNTIME_PARAMETERS } from '../infra/names';
import { ENCRYPTION_CONTEXT } from '../app/shared/session/kms-cipher.server';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
/** Las políticas administradas de CloudFront: sus ids son fijos en todas las cuentas. */
const CACHING_DISABLED = '4135ea2d-6df8-44a3-9df3-4b5a84be39ad';
const CACHING_OPTIMIZED = '658327ea-f89d-4fab-a63d-7e88639e58f6';
const ALL_VIEWER_EXCEPT_HOST_HEADER = 'b689b0a8-53d0-40ab-baf2-68738e2966ac';
const SYNTH_TIMEOUT_MS = 60_000;

let dir: string;
let stack: AdminPanelStack;
let template: Template;

beforeAll(() => {
  dir = mkdtempSync(join(tmpdir(), 'aios-admin-infra-'));
  for (const [file, content] of [['code/server/index.js', ''], ['static/assets/app.js', '']] as const) {
    mkdirSync(dirname(join(dir, file)), { recursive: true });
    writeFileSync(join(dir, file), content);
  }
  const app = new App({ outdir: join(dir, 'cdk.out') });
  stack = new AdminPanelStack(app, 'AiosAdmin', { codeAssetPath: join(dir, 'code'), staticAssetPath: join(dir, 'static') });
  template = Template.fromStack(stack);
}, SYNTH_TIMEOUT_MS);

afterAll(() => {
  if (dir) rmSync(dir, { recursive: true, force: true });
});

const onlyResource = (type: string) => {
  const found = Object.values(template.findResources(type));
  expect(found, type).toHaveLength(1);
  return found[0] as { Properties: Record<string, any>; DeletionPolicy?: string };
};

const roleStatements = () => {
  const policies = Object.values(template.findResources('AWS::IAM::Policy', { Properties: { Roles: [{ Ref: Match.stringLikeRegexp('^PanelRole') }] } }));
  expect(policies).toHaveLength(1);
  return (policies[0] as { Properties: { PolicyDocument: { Statement: Record<string, any>[] } } }).Properties.PolicyDocument.Statement;
};

describe('la Web Function', () => {
  test('corre en Node 24, arranca por su servidor y no lleva ningún secreto en sus variables', () => {
    const revision = onlyResource('AWS::Lambda::WebFunctionRevision').Properties;
    const env = revision.ServiceConfig.EnvironmentVariables as Record<string, unknown>;
    expect(revision.BuildConfig.RuntimeConfig.Runtime).toBe(RUNTIME);
    expect(env.AWS_LAMBDA_NODEJS_ENTRYPOINT).toBe(ENTRYPOINT);
    expect(env.SESSION_STORE).toBe('dynamodb');
    expect(JSON.parse(String(env.PANEL_SSM_PARAMETERS))).toEqual(RUNTIME_PARAMETERS);
    expect(Object.keys(env).filter((name) => /SECRET|PASSWORD|TOKEN|PRIVATE/.test(name))).toEqual([]);
  });

  test('⛔ la revisión queda atada a la versión exacta del zip, y nada borra versiones viejas', () => {
    const s3Object = onlyResource('AWS::Lambda::WebFunctionRevision').Properties.BuildConfig.CodeConfig.S3Object;
    expect(JSON.stringify(s3Object.VersionId)).toContain('SourceObjectVersionIds');
    const codeUpload = Object.values(template.findResources('Custom::CDKBucketDeployment', { Properties: { Extract: false } }));
    expect(codeUpload).toHaveLength(1);
    expect(codeUpload[0]).toMatchObject({ Properties: { Prune: false } });
    template.hasResourceProperties('AWS::S3::Bucket', {
      VersioningConfiguration: { Status: 'Enabled' },
      BucketEncryption: { ServerSideEncryptionConfiguration: [{ ServerSideEncryptionByDefault: { SSEAlgorithm: 'AES256' } }] },
      LifecycleConfiguration: Match.absent(),
    });
  });

  test('⛔ el endpoint solo acepta pedidos firmados, con 2 entornos y 100 pedidos por segundo', () => {
    expect(onlyResource('AWS::Lambda::WebFunctionEndpoint').Properties).toMatchObject({
      AuthType: 'IamAuth',
      EndpointType: 'HomeRegion',
      ScalingConfig: { MaxEnvironments: MAX_ENVIRONMENTS },
      ThrottleConfig: { RateLimit: RATE_LIMIT },
    });
  });

  test('⛔ solo esta distribución de CloudFront puede llamarlo', () => {
    const [statement] = onlyResource('AWS::Lambda::ResourcePolicy').Properties.PolicyDocument.Statement;
    expect(statement).toMatchObject({ Effect: 'Allow', Principal: { Service: 'cloudfront.amazonaws.com' }, Action: 'lambda:InvokeWebFunctionEndpoint' });
    expect(JSON.stringify(statement.Condition.ArnLike['aws:SourceArn'])).toContain('Distribution');
  });

  test('sus dos grupos de logs existen con 30 días', () => {
    for (const LogGroupName of LOG_GROUP_NAMES) template.hasResourceProperties('AWS::Logs::LogGroup', { LogGroupName, RetentionInDays: 30 });
  });
});

describe('CloudFront', () => {
  test('estáticos con caché; el resto sin caché, sin reenviar el Host y firmado con OAC de Lambda; sin web ACL', () => {
    const config = onlyResource('AWS::CloudFront::Distribution').Properties.DistributionConfig;
    expect(config.WebACLId).toBeUndefined();
    expect(config.DefaultCacheBehavior).toMatchObject({ CachePolicyId: CACHING_DISABLED, OriginRequestPolicyId: ALL_VIEWER_EXCEPT_HOST_HEADER });
    expect(config.CacheBehaviors).toEqual([expect.objectContaining({ PathPattern: '/assets/*', CachePolicyId: CACHING_OPTIMIZED })]);
    template.hasResourceProperties('AWS::CloudFront::OriginAccessControl', {
      OriginAccessControlConfig: { OriginAccessControlOriginType: 'lambda', SigningBehavior: 'always-amz-auth', SigningProtocol: 'sigv4' },
    });
  });

  test('su dirección queda en SSM, para que el servidor la lea al arrancar', () => {
    const value = JSON.stringify(onlyResource('AWS::SSM::Parameter').Properties);
    expect(value).toContain(PUBLIC_ORIGINS_PARAMETER);
    expect(value).toContain('https://');
  });
});

describe('las sesiones', () => {
  test('tabla con TTL, protegida contra borrado y conservada si se borra el stack', () => {
    const table = onlyResource('AWS::DynamoDB::Table');
    expect(table.DeletionPolicy).toBe('Retain');
    expect(table.Properties).toMatchObject({
      KeySchema: [{ AttributeName: 'idHash', KeyType: 'HASH' }],
      TimeToLiveSpecification: { AttributeName: 'expiresAt', Enabled: true },
      DeletionProtectionEnabled: true,
    });
  });

  test('⛔ la llave niega descifrar a todo rol que no sea el del panel', () => {
    const key = onlyResource('AWS::KMS::Key');
    expect(key.Properties.EnableKeyRotation).toBe(true);
    const deny = key.Properties.KeyPolicy.Statement.find((s: Record<string, unknown>) => s.Effect === 'Deny');
    expect(deny).toMatchObject({ Action: 'kms:Decrypt', Principal: { AWS: '*' } });
    expect(JSON.stringify(deny.Condition.ArnNotEquals['aws:PrincipalArn'])).toContain('PanelRole');
  });

  test('el panel cifra con el mismo contexto que pide la política de la llave', () => {
    expect(SESSION_ENCRYPTION_CONTEXT).toEqual(ENCRYPTION_CONTEXT);
    const kms = roleStatements().find((s) => JSON.stringify(s.Action).includes('kms:'));
    expect(kms?.Condition).toEqual({ StringEquals: { 'kms:EncryptionContext:purpose': ENCRYPTION_CONTEXT.purpose } });
  });
});

describe('el rol del panel (CA-35)', () => {
  test('⛔ de Cognito solo puede leer la configuración del cliente, y solo en el pool del equipo', () => {
    const cognito = roleStatements().filter((s) => JSON.stringify(s.Action).includes('cognito-idp:'));
    expect(cognito).toHaveLength(1);
    expect(cognito[0]?.Action).toBe('cognito-idp:DescribeUserPoolClient');
    expect(JSON.stringify(cognito[0]?.Resource)).toMatch(/userpool\/.*SsmParameterValueaiosequipopoolid/);
  });

  test('⛔ de SSM solo lee los parámetros de su configuración', () => {
    const ssm = roleStatements().filter((s) => JSON.stringify(s.Action).includes('ssm:'));
    expect(ssm).toHaveLength(1);
    expect(ssm[0]?.Action).toBe('ssm:GetParameters');
    const resources = JSON.stringify(ssm[0]?.Resource);
    for (const name of Object.values(RUNTIME_PARAMETERS)) expect(resources).toContain(`parameter${name}`);
    expect((ssm[0]?.Resource as unknown[]).length).toBe(Object.keys(RUNTIME_PARAMETERS).length);
  });
});

describe('las alarmas', () => {
  test('errores 5xx y pedidos frenados, al tema de alarmas del backend', () => {
    const alarms = Object.values(template.findResources('AWS::CloudWatch::Alarm'));
    expect(alarms).toHaveLength(2);
    const text = JSON.stringify(alarms);
    expect(text).toContain('HTTPResponseStatusClass5XX');
    expect(text).toContain('EndpointRequestThrottles');
    for (const alarm of alarms) expect(JSON.stringify((alarm as { Properties: { AlarmActions: unknown } }).Properties.AlarmActions)).toContain(BACKEND_ALARM_TOPIC_NAME);
  });
});

describe('la protección del stack', () => {
  const protectedIds = () => {
    const policy = JSON.parse(readFileSync(join(root, 'infra', 'stack-policy.json'), 'utf8')) as { Statement: { Effect: string; Resource: string | string[] }[] };
    return policy.Statement.filter((s) => s.Effect === 'Deny').flatMap((s) => [s.Resource].flat()).map((r) => r.replace('LogicalResourceId/', ''));
  };

  test('el stack no se puede borrar sin quitar antes la protección', () => {
    expect(stack.terminationProtection).toBe(true);
  });

  test('⛔ cada recurso con estado está en la política del stack, y la política no nombra recursos que no existen', () => {
    const resources = template.toJSON().Resources as Record<string, { Type: string }>;
    const stateful = Object.entries(resources)
      .filter(([, r]) => /^AWS::(DynamoDB::Table|KMS::Key|S3::Bucket|Lambda::WebFunction)$/.test(r.Type))
      .map(([id]) => id);
    expect(stateful.length).toBeGreaterThan(0);
    expect(stateful.filter((id) => !protectedIds().includes(id))).toEqual([]);
    expect(protectedIds().filter((id) => !(id in resources))).toEqual([]);
  });
});
