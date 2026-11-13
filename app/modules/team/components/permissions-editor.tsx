// El editor de permisos de una persona del equipo (spec «Equipo ENSŌ», CA-16): una fila por módulo
// con pantalla, agrupadas como el menú, con «Sin acceso» y los niveles que admite cada uno; la marca
// de superadministrador, con confirmación; y el adelanto del menú que va a ver. Controlado: el estado
// vive en el formulario que lo usa (el alta o la página de la persona).
import { useState } from 'react';
import { MODULE_LEVELS, type Level, type Module } from '../../../domain/permissions';
import type { TeamPermissions } from '../../../domain/team';
import { LEVEL_LABELS, MODULE_LABELS } from '../../../shared/labels/permission-labels';
import { MENU_GROUPS, MENU_GROUP_LABELS } from '../../../shared/routing/route-table';
import { menuGroupOf, modulesWithScreen } from '../../../shared/routing/route-access';
import { SUPERADMIN_FIELD, permissionField } from '../team-form-data';
import { MenuPreview } from './menu-preview';
import { SuperadminConfirmDialog } from './superadmin-confirm-dialog';
import './permissions-editor.css';

type Props = {
  /** Los módulos con pantalla y su nivel. */
  value: TeamPermissions;
  /** Lo que ya tenía en módulos sin pantalla: viaja oculto, para no perderse al guardar (decisión 3). */
  hidden: TeamPermissions;
  isSuperadmin: boolean;
  onChange: (next: TeamPermissions) => void;
  onSuperadminChange: (next: boolean) => void;
};

/** Los módulos que se ofrecen, agrupados como el menú. Salen de la tabla de rutas. */
const GROUPS = MENU_GROUPS.map((group) => ({ group, modules: modulesWithScreen().filter((m) => menuGroupOf(m) === group) }))
  .filter((g) => g.modules.length > 0);

export function PermissionsEditor({ value, hidden, isSuperadmin, onChange, onSuperadminChange }: Props) {
  const [confirming, setConfirming] = useState(false);
  const set = (module: Module, level: Level | '') => {
    const next = { ...value };
    if (level) next[module] = level;
    else delete next[module];
    onChange(next);
  };
  return (
    <div className="permissions-editor">
      <label className="permissions-editor__super">
        <input
          type="checkbox" name={SUPERADMIN_FIELD} value="1" checked={isSuperadmin}
          onChange={(e) => (e.target.checked ? setConfirming(true) : onSuperadminChange(false))}
        />
        <span><b>Superadministrador</b> — puede todo, también administrar al equipo.</span>
      </label>
      {GROUPS.map(({ group, modules }) => (
        // ⚠️ Atenuado y NO `disabled`: un campo desactivado no viaja con el formulario, y guardar con la
        // marca puesta borraría los módulos que tenía para cuando se la quiten.
        <fieldset key={group} className={isSuperadmin ? 'permissions-editor__group permissions-editor__group--muted' : 'permissions-editor__group'}>
          <legend>{MENU_GROUP_LABELS[group]}</legend>
          {modules.map((module) => (
            <div key={module} className="permissions-editor__row" role="radiogroup" aria-label={MODULE_LABELS[module]}>
              <span className="permissions-editor__module">{MODULE_LABELS[module]}</span>
              {(['', ...MODULE_LEVELS[module]] as const).map((level) => (
                <label key={level || 'none'} className="permissions-editor__level">
                  <input type="radio" name={permissionField(module)} value={level} checked={(value[module] ?? '') === level} onChange={() => set(module, level)} />
                  {level ? LEVEL_LABELS[level] : 'Sin acceso'}
                </label>
              ))}
            </div>
          ))}
        </fieldset>
      ))}
      {isSuperadmin && <p className="small muted">Con la marca de superadministrador, los módulos no cuentan: entra a todo.</p>}
      {Object.entries(hidden).map(([module, level]) => <input key={module} type="hidden" name={permissionField(module as Module)} value={level} />)}
      <MenuPreview permissions={{ ...hidden, ...value }} isSuperadmin={isSuperadmin} />
      {confirming && (
        <SuperadminConfirmDialog onConfirm={() => { setConfirming(false); onSuperadminChange(true); }} onCancel={() => setConfirming(false)} />
      )}
    </div>
  );
}
