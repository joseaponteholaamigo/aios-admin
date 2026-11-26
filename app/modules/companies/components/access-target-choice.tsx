// Un dominio o una skill para marcar, en «Reglas de acceso» (spec «Reglas de acceso», CA-12): su nombre
// visible, el identificador al lado (si son distintos) y si la empresa ya lo recibe.
import type { Label } from '../../../shared/ui/badge';
import { badgeClass } from '../../../shared/ui/badge';
import { TARGET_FIELD } from '../access-change-form-data';
import './access-target-choice.css';

type AccessTargetChoiceProps = {
  /** Lo que viaja con el formulario: `domain:convert`, `skill:copy`. */
  token: string;
  /** El nombre visible, o el identificador si no tiene uno. */
  title: string;
  id: string;
  badge: Label;
  checked: boolean;
};

export function AccessTargetChoice({ token, title, id, badge, checked }: AccessTargetChoiceProps) {
  return (
    <label className="access-choice">
      <input type="checkbox" name={TARGET_FIELD} value={token} defaultChecked={checked} />
      <span className="access-choice__title">{title}</span>
      {title !== id && <code className="mono small access-choice__id">{id}</code>}
      <span className={badgeClass(badge.tone)}>{badge.text}</span>
    </label>
  );
}
