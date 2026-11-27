// «Reglas de acceso» de un Personalizado (spec «Reglas de acceso», CA-12 a CA-14): las reglas de hoy con
// «Volver a la base», el formulario para dar o quitar y la vista previa con «Guardar». Guarda qué vista
// previa se muestra: una nueva reemplaza a la anterior; tocar el formulario la esconde hasta volver a ver
// el cambio; un rechazo la deja a la vista, con «Guardar» disponible otra vez, salvo un conflicto, que la
// vuelve vieja. Sin pedido (recién cargada, o de vuelta de guardar) no hay vista previa.
import { useEffect, useMemo, useState } from 'react';
import type { CompanyAccessRules } from '../../../domain/access-rules';
import type { AccessAttempt, ShownAccessPreview } from '../access-change-form-data';
import { nameLookup } from '../access-change-labels';
import { AccessChangeForm } from './access-change-form';
import { AccessChangePreview } from './access-change-preview';
import { AccessChangeRejection } from './access-change-rejection';
import { AccessRulesCard } from './access-rules-card';
import './access-rules-editor.css';

type AccessRulesEditorProps = {
  companyId: string;
  access: CompanyAccessRules;
  /** Lo que respondió el último pedido, o `null` si no hubo. */
  attempt: AccessAttempt | null;
};

export function AccessRulesEditor({ companyId, access, attempt }: AccessRulesEditorProps) {
  const [shown, setShown] = useState<ShownAccessPreview | null>(attempt?.shown ?? null);
  const [edited, setEdited] = useState(false);
  useEffect(() => {
    if (!attempt) {
      setShown(null);
    } else if (attempt.shown) {
      setShown(attempt.shown);
      setEdited(false);
    } else if (attempt.rejection?.code === 'conflict') {
      // Las reglas cambiaron entre ver y guardar: lo que decía la vista previa ya no es cierto.
      setShown(null);
    }
  }, [attempt]);
  const names = useMemo(() => nameLookup(access.catalog), [access.catalog]);
  const preview = shown && !edited ? shown : null;
  // «Volver a la base» no sale del formulario: lo que mandó no lo llena.
  const values = attempt && attempt.values.action !== 'reset' ? attempt.values : null;
  return (
    <div className="access-editor">
      <AccessRulesCard access={access} names={names} editable />
      <AccessChangeForm
        companyId={companyId} catalog={access.catalog} values={values} errors={attempt?.errors ?? {}}
        previewShown={preview !== null} onEdit={() => setEdited(true)}
      />
      {attempt?.rejection && <AccessChangeRejection rejection={attempt.rejection} />}
      {preview && <AccessChangePreview shown={preview} names={names} />}
    </div>
  );
}
