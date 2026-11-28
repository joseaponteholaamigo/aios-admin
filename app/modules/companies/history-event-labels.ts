// Cómo se llaman en la historia de la ficha los eventos que el panel sabe nombrar en palabras: los de revocar y
// reactivar una cuenta (spec «Revocar y reactivar una cuenta», CA-15), los de la analítica de una persona (spec
// «Analítica de una persona»), los de reanudar la casa (spec «Reanudar la casa») y el cambio de tipo, desde el panel o
// solo por un cambio de plan (spec «Pasar una empresa a cuenta personal, y al revés», CA-15). Van junto a su nombre
// técnico, que se sigue mostrando.
import type { HistoryEventKind } from '../../domain/companies';

export const HISTORY_EVENT_LABELS: Record<HistoryEventKind, string> = {
  'account-revoked': 'Cuenta revocada',
  'account-reactivated': 'Cuenta reactivada',
  'analytics-withdrawn': 'Una persona dejó de compartir su uso',
  'analytics-restored': 'Una persona volvió a compartir su uso',
  'house-pause-lifted': 'Se quitó la pausa de los servicios de ENSŌ',
  'house-lot-unfrozen': 'Se descongelaron créditos',
  'account-to-personal': 'Pasó a cuenta personal',
  'account-to-company': 'Pasó a empresa',
};
