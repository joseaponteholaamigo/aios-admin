// Qué cambia al pasar la cuenta a cuenta personal o a empresa (spec «Pasar una empresa a cuenta personal, y al revés»,
// CA-12 y CA-13): lo que el backend dijo en la vista previa, nombrando a la persona si la mandó, o por qué no puede
// pasar y qué hacer.
import type { AccountKind } from '../../../domain/companies';
import { FormRejection } from '../../../shared/ui/form-rejection';
import type { TypeAnswer } from '../account-type-form-data';
import { TYPE_ACTION_TEXTS, TYPE_INTROS, typePreviewLines, typeRejectionMessage } from '../account-type-labels';

type AccountTypePreviewProps = {
  /** El tipo al que pasa. */
  target: AccountKind;
  /** La vista previa, o `undefined` mientras llega. */
  answer: TypeAnswer | undefined;
  /** El id del párrafo que describe el diálogo. */
  introId: string;
};

function PreviewLines({ target, answer }: Omit<AccountTypePreviewProps, 'introId'>) {
  if (!answer) return <li aria-busy="true">{TYPE_ACTION_TEXTS[target].loading}</li>;
  if (!answer.ok) return null;
  return (
    <>
      {typePreviewLines(answer.preview).map((effect) => (
        <li key={effect.text} className={effect.warn ? 'account-type-dialog__warn' : undefined}>{effect.text}</li>
      ))}
    </>
  );
}

export function AccountTypePreview({ target, answer, introId }: AccountTypePreviewProps) {
  const failed = answer && !answer.ok && answer.rejection ? answer.rejection : null;
  return (
    <>
      <p id={introId}>{TYPE_INTROS[target]}</p>
      <ul className="account-type-dialog__facts" aria-live="polite">
        <PreviewLines target={target} answer={answer} />
      </ul>
      {failed && <FormRejection rejection={failed} message={typeRejectionMessage(failed, 'preview')} />}
    </>
  );
}
