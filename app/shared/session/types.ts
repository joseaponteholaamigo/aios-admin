// Los tipos de la sesión y sus dos puertos: dónde se guarda (`SessionStore`) y con qué se
// cifran los tokens (`TokenCipher`). Las implementaciones de AWS y las de memoria cumplen lo mismo.

/** Los tokens de Cognito de una persona. Nunca salen del servidor. */
export type SessionTokens = {
  accessToken: string;
  idToken: string;
  refreshToken: string;
  /** Cuándo vence el access token, en milisegundos. */
  accessTokenExpiresAt: number;
};

/** La fila de una sesión. La clave es el hash del id: quien lea la tabla no puede usar la cookie. */
export type SessionRecord = {
  idHash: string;
  sub: string;
  /** Los tokens, cifrados (`TokenCipher`). */
  sealedTokens: string;
  createdAt: number;
  lastActivityAt: number;
  /** El vencimiento absoluto en segundos: es el atributo TTL de DynamoDB. */
  expiresAt: number;
};

export interface SessionStore {
  get(idHash: string): Promise<SessionRecord | null>;
  put(record: SessionRecord): Promise<void>;
  delete(idHash: string): Promise<void>;
}

export interface TokenCipher {
  seal(plaintext: string): Promise<string>;
  open(sealed: string): Promise<string>;
}
