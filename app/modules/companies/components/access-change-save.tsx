// «Guardar» de «Reglas de acceso» (spec «Reglas de acceso», CA-13): manda el mismo pedido que se vio —la
// acción, los objetivos y el motivo— con su huella; la acción lo guarda con la confirmación solo si la
// huella es la de ese pedido. Con algo que confirmar, el botón lo dice.
import { Form } from 'react-router';
import { targetToken } from '../../../domain/access-rules';
import { SubmitButton } from '../../../shared/ui/submit-button';
import { ACTION_FIELD, INTENT_FIELD, PREVIEWED_FIELD, REASON_FIELD, SAVE_INTENT, TARGET_FIELD, type ShownAccessPreview } from '../access-change-form-data';

export function AccessChangeSave({ shown }: { shown: ShownAccessPreview }) {
  const { request, previewed, preview } = shown;
  return (
    <Form method="post" className="access-preview__save">
      <input type="hidden" name={ACTION_FIELD} value={request.action} />
      {request.targets.map((target) => <input key={targetToken(target)} type="hidden" name={TARGET_FIELD} value={targetToken(target)} />)}
      <input type="hidden" name={REASON_FIELD} value={request.reason} />
      <input type="hidden" name={PREVIEWED_FIELD} value={previewed} />
      <SubmitButton name={INTENT_FIELD} value={SAVE_INTENT} label={preview.toConfirm.length ? 'Confirmar y guardar' : 'Guardar'} busyLabel="Guardando…" />
    </Form>
  );
}
