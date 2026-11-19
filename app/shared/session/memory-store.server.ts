// Las sesiones en memoria: para las pruebas y para `npm run dev` (`SESSION_STORE=memory`).
// En AWS van en DynamoDB: en memoria, cada entorno de la Lambda tendría las suyas.
import type { SessionRecord, SessionStore } from './types';

export function createMemorySessionStore(): SessionStore & { size(): number } {
  const rows = new Map<string, SessionRecord>();
  return {
    async get(idHash) {
      const row = rows.get(idHash);
      return row ? { ...row } : null;
    },
    async put(record) {
      rows.set(record.idHash, { ...record });
    },
    async delete(idHash) {
      rows.delete(idHash);
    },
    size: () => rows.size,
  };
}
