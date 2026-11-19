// Dónde viven las sesiones del panel: la tabla y la llave que cifra sus tokens (plan §3.3, CA-33).
import { RemovalPolicy } from 'aws-cdk-lib';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as kms from 'aws-cdk-lib/aws-kms';
import type { Construct } from 'constructs';
import { SESSIONS_KEY_ALIAS, SESSIONS_TABLE_NAME } from './names.ts';

/**
 * El contexto de cifrado con que el panel pide y abre sus llaves de datos. Es el de
 * `app/shared/session/kms-cipher.server.ts`: `tests/infra-stack.test.ts` revisa que coincidan.
 */
export const SESSION_ENCRYPTION_CONTEXT = { purpose: 'aios-admin-session' } as const;

export type SessionStore = { table: dynamodb.Table; key: kms.Key };

export function createSessionStore(scope: Construct): SessionStore {
  // Clave = hash del id de la sesión; `expiresAt` en segundos para el TTL. Sin PITR: una sesión
  // perdida solo pide volver a entrar.
  const table = new dynamodb.Table(scope, 'SessionsTable', {
    tableName: SESSIONS_TABLE_NAME,
    partitionKey: { name: 'idHash', type: dynamodb.AttributeType.STRING },
    billingMode: dynamodb.BillingMode.PAY_PER_REQUEST,
    timeToLiveAttribute: 'expiresAt',
    deletionProtection: true,
    removalPolicy: RemovalPolicy.RETAIN,
  });
  const key = new kms.Key(scope, 'SessionsKey', {
    alias: SESSIONS_KEY_ALIAS,
    description: 'Cifra los tokens de las sesiones del panel del equipo (aios-admin)',
    enableKeyRotation: true,
    removalPolicy: RemovalPolicy.RETAIN,
  });
  return { table, key };
}

/**
 * Lo que el rol del panel puede hacer con las sesiones. ⚠️ La llave niega `kms:Decrypt` a todo
 * otro rol, aunque tenga permisos de administrador: los tokens de una sesión solo los abre el panel.
 */
export function grantSessions({ table, key }: SessionStore, role: iam.Role): void {
  table.grant(role, 'dynamodb:GetItem', 'dynamodb:PutItem', 'dynamodb:DeleteItem');
  role.addToPrincipalPolicy(new iam.PolicyStatement({
    actions: ['kms:GenerateDataKey', 'kms:Decrypt'],
    resources: [key.keyArn],
    conditions: { StringEquals: { 'kms:EncryptionContext:purpose': SESSION_ENCRYPTION_CONTEXT.purpose } },
  }));
  key.addToResourcePolicy(new iam.PolicyStatement({
    sid: 'OnlyThePanelDecrypts',
    effect: iam.Effect.DENY,
    principals: [new iam.AnyPrincipal()],
    actions: ['kms:Decrypt'],
    resources: ['*'],
    conditions: { ArnNotEquals: { 'aws:PrincipalArn': role.roleArn } },
  }));
}
