// Lo que el diálogo «Analítica y términos» sabe de la persona (spec «Analítica de una persona», CA-11 y CA-13): si
// comparte su uso y desde cuándo, y la prueba de los términos. Mientras llega, lo dice; si no se pudo leer, por qué.
import type { PersonAnalytics } from '../../domain/person-analytics';
import { FormRejection } from '../ui/form-rejection';
import type { AnalyticsAnswer } from './person-analytics-form-data';
import { ANALYTICS_LOADING, analyticsRejectionMessage, sharingStatusText } from './person-analytics-labels';
import { TermsAcceptanceTable } from './terms-acceptance-table';
import './analytics-overview.css';

type AnalyticsOverviewProps = {
  /** Lo que respondió ver al abrir, o `undefined` mientras llega. */
  answer: AnalyticsAnswer | undefined;
  /** Lo último que dijo el backend: lo guardado o, si no, lo visto al abrir. */
  current: PersonAnalytics | null;
};

export function AnalyticsOverview({ answer, current }: AnalyticsOverviewProps) {
  if (current) {
    return (
      <>
        <p className="analytics-overview__status" aria-live="polite"><strong>{sharingStatusText(current)}</strong></p>
        <TermsAcceptanceTable acceptances={current.termsAcceptances} />
      </>
    );
  }
  if (!answer) return <p className="analytics-overview__loading" aria-busy="true">{ANALYTICS_LOADING}</p>;
  if (!answer.ok && answer.rejection) return <FormRejection rejection={answer.rejection} message={analyticsRejectionMessage(answer.rejection, 'view')} />;
  return null;
}
