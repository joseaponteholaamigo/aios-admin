// Qué pasa al revocar o reactivar la cuenta (spec «Revocar y reactivar una cuenta», CA-12 y CA-13): lo que vale
// siempre y lo que el backend dijo en la vista previa —cuántas personas, a qué estado vuelve—, o por qué no se pudo ver.
import type { AccountStatusAction } from '../../../domain/account-status';
import { FormRejection } from '../../../shared/ui/form-rejection';
import type { StatusAnswer } from '../account-status-form-data';
import { REVOKE_CUTS, REVOKE_KEEPS, STATUS_INTROS, STATUS_PREVIEW_LOADING, statusPreviewLines, statusRejectionMessage } from '../account-status-labels';

type AccountStatusPreviewProps = {
  action: AccountStatusAction;
  /** La vista previa, o `undefined` mientras llega. */
  answer: StatusAnswer | undefined;
  /** El id del párrafo que describe el diálogo. */
  introId: string;
};

function PreviewLines({ action, answer }: Omit<AccountStatusPreviewProps, 'introId'>) {
  if (!answer) return <li aria-busy="true">{STATUS_PREVIEW_LOADING[action]}</li>;
  if (!answer.ok) return null;
  return <>{statusPreviewLines(answer.preview).map((line) => <li key={line}>{line}</li>)}</>;
}

export function AccountStatusPreview({ action, answer, introId }: AccountStatusPreviewProps) {
  const failed = answer && !answer.ok && answer.rejection ? answer.rejection : null;
  return (
    <>
      <p id={introId}>{STATUS_INTROS[action]}</p>
      <ul className="account-status-dialog__facts" aria-live="polite">
        {action === 'revoke' && REVOKE_CUTS.map((line) => <li key={line}>{line}</li>)}
        <PreviewLines action={action} answer={answer} />
        {action === 'revoke' && REVOKE_KEEPS.map((line) => <li key={line}>{line}</li>)}
      </ul>
      {failed && <FormRejection rejection={failed} message={statusRejectionMessage(failed, action, 'preview')} />}
    </>
  );
}
