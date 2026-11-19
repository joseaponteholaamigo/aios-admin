// El servicio de sesiones del proceso, armado según la configuración (`SESSION_STORE`).
import { getConfig } from '../config/config.server';
import { createSessionService, type SessionService } from './session.server';
import { createMemorySessionStore } from './memory-store.server';
import { createLocalCipher } from './local-cipher.server';
import { createDynamoSessionStore } from './dynamodb-store.server';
import { createKmsCipher } from './kms-cipher.server';
import type { SessionStore, TokenCipher } from './types';

export type SessionInfrastructure = { store: SessionStore; cipher: TokenCipher };

let infrastructure: SessionInfrastructure | null = null;
let service: SessionService | null = null;

/** El almacén y el cifrador de las sesiones. Los usa también el login pendiente (`pending-login`). */
export function getSessionInfrastructure(): SessionInfrastructure {
  if (infrastructure) return infrastructure;
  const { sessionStore } = getConfig();
  infrastructure = sessionStore.kind === 'memory'
    ? { store: createMemorySessionStore(), cipher: createLocalCipher() }
    : { store: createDynamoSessionStore({ table: sessionStore.table }), cipher: createKmsCipher({ keyId: sessionStore.kmsKeyId }) };
  return infrastructure;
}

export function getSessionService(): SessionService {
  service ??= createSessionService(getSessionInfrastructure());
  return service;
}
