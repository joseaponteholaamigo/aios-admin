// El servicio de sesiones del proceso, armado según la configuración (`SESSION_STORE`).
import { getConfig } from '../config/config.server';
import { createSessionService, type SessionService } from './session.server';
import { createMemorySessionStore } from './memory-store.server';
import { createLocalCipher } from './local-cipher.server';
import { createDynamoSessionStore } from './dynamodb-store.server';
import { createKmsCipher } from './kms-cipher.server';

let service: SessionService | null = null;

export function getSessionService(): SessionService {
  if (service) return service;
  const { sessionStore } = getConfig();
  service = sessionStore.kind === 'memory'
    ? createSessionService({ store: createMemorySessionStore(), cipher: createLocalCipher() })
    : createSessionService({
        store: createDynamoSessionStore({ table: sessionStore.table }),
        cipher: createKmsCipher({ keyId: sessionStore.kmsKeyId }),
      });
  return service;
}
