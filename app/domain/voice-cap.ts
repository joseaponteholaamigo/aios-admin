// El tope de la voz de ENSŌ (spec «Registro abierto» de aios-tower, CA-33; la pantalla es RP2): cuánto
// puede gastar cada persona al mes en la voz, en dólares. Rige un valor general para toda cuenta, y
// una cuenta puede tener su excepción. Sin React ni servidor: es dominio. Los nombres del backend se
// traducen en `shared/api/voice-cap-mapping.ts`.

/** El tope general: el que fijó el superadministrador, o el de por omisión si nadie lo cambió. */
export type GeneralVoiceCap = { usd: number; isDefault: boolean; changedBy: string | null; changedAt: string | null };

/** La excepción de una cuenta: su tope, en lugar del general. */
export type VoiceCapException = { accountId: string; accountName: string | null; usd: number; changedBy: string | null; changedAt: string | null };

export type VoiceCaps = {
  general: GeneralVoiceCap;
  /** El tope más alto que acepta el backend, para el general y para una excepción. */
  maxUsd: number;
  /** Las excepciones de las cuentas que el panel puede ver. */
  exceptions: VoiceCapException[];
  /** El filtro de clientes deja ver solo algunas cuentas: las excepciones de las demás no aparecen. */
  onlySome: boolean;
};

/** Un cambio: el tope general, o la excepción de una cuenta (`usd: null` la quita y la cuenta vuelve al general). */
export type VoiceCapChange =
  | { target: 'general'; usd: number; reason: string }
  | { target: 'account'; accountId: string; usd: number | null; reason: string };

/** Lo que había antes del cambio y lo que quedó. En una excepción, `null` es «sin excepción». */
export type VoiceCapChanged = { before: number | null; after: number | null };
