// Lo que responden los dos pedidos por detrás del diálogo de «Créditos» de una persona (spec «Créditos
// por persona» de aios-tower, CA-21 a CA-23): su saldo y una carga. Viven aquí, y no en sus rutas,
// porque el diálogo lo abren dos pantallas: las personas de una cuenta y la ficha de una cuenta personal.
import type { WriteRejection } from '../../domain/account-creation';
import type { LoadedLot, PersonCredits } from '../../domain/credits';
import type { ModuleErrorReason } from '../api/admin-loader.server';

export type PersonCreditsAnswer = { email: string } & ({ ok: true; credits: PersonCredits } | { ok: false; reason: ModuleErrorReason });

export type CreditLoadAnswer =
  | { ok: true; loaded: LoadedLot }
  | { ok: false; errors: Record<string, string>; rejection: WriteRejection | null };

/** Dónde se pide el saldo de una persona de `companyId`; la carga va a `${…}/load`. El correo viaja en el cuerpo. */
export const personCreditsPath = (companyId: string) => `/client-users/${encodeURIComponent(companyId)}/credits`;
