// Las sesiones en DynamoDB (`SESSION_STORE=dynamodb`). La tabla la crea el stack del panel: clave
// de partición `idHash` y TTL en `expiresAt`.
import { DynamoDBClient } from '@aws-sdk/client-dynamodb';
import { DeleteCommand, DynamoDBDocumentClient, GetCommand, PutCommand } from '@aws-sdk/lib-dynamodb';
import type { SessionRecord, SessionStore } from './types';

type Sender = { send(command: unknown): Promise<unknown> };

/**
 * @param table  el nombre de la tabla de sesiones
 * @param client un cliente que responde a `send` (para pruebas); por defecto, el del SDK
 */
export function createDynamoSessionStore({ table, client }: { table: string; client?: Sender }): SessionStore {
  const doc: Sender = client ?? DynamoDBDocumentClient.from(new DynamoDBClient({}));
  return {
    async get(idHash) {
      // Consistente: una sesión recién cerrada no puede leerse de una copia vieja.
      const r = (await doc.send(new GetCommand({ TableName: table, Key: { idHash }, ConsistentRead: true }))) as { Item?: SessionRecord };
      return r.Item ?? null;
    },
    async put(record) {
      await doc.send(new PutCommand({ TableName: table, Item: record }));
    },
    async delete(idHash) {
      await doc.send(new DeleteCommand({ TableName: table, Key: { idHash } }));
    },
  };
}
