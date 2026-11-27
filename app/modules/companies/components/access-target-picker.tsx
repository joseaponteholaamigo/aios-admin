// Los dominios y las skills del catálogo para elegir a qué aplicar la acción, en «Reglas de acceso»
// (spec «Reglas de acceso», CA-12): cada uno con su nombre visible, el identificador al lado y si la
// empresa ya lo recibe. Las skills van agrupadas por dominio y cerradas, para no ser una lista sin fin.
import type { AccessCatalog, CatalogDomain, CatalogSkill } from '../../../domain/access-rules';
import { targetToken } from '../../../domain/access-rules';
import type { Label } from '../../../shared/ui/badge';
import { AccessTargetChoice } from './access-target-choice';
import './access-target-picker.css';

type AccessTargetPickerProps = {
  catalog: AccessCatalog;
  /** Los objetivos marcados (`domain:convert`), al volver de ver el cambio o de un rechazo. */
  checked: ReadonlySet<string>;
};

/** Un grupo de skills: las de un dominio, o las que no tienen (`domain: null`). */
type SkillGroup = { domain: CatalogDomain | null; title: string; skills: CatalogSkill[] };

const byText = (a: string, b: string) => a.localeCompare(b, 'es');
const domainTitle = (d: CatalogDomain) => d.name ?? d.slug;
const skillTitle = (s: CatalogSkill) => s.label ?? s.name;

/** Las skills por dominio (ya ordenados), por su nombre visible. Las de un dominio que no está en la lista van en «Sin dominio». */
function groupSkills(domains: CatalogDomain[], skills: CatalogSkill[]): SkillGroup[] {
  const known = new Set(domains.map((d) => d.slug));
  const sorted = [...skills].sort((a, b) => byText(skillTitle(a), skillTitle(b)));
  const groups: SkillGroup[] = domains.map((d) => ({ domain: d, title: domainTitle(d), skills: sorted.filter((s) => s.domain === d.slug) }));
  const loose = sorted.filter((s) => !s.domain || !known.has(s.domain));
  return [...groups.filter((g) => g.skills.length > 0), ...(loose.length ? [{ domain: null, title: 'Sin dominio', skills: loose }] : [])];
}

function domainBadge({ skills, received }: CatalogDomain): Label {
  if (received === 0) return { text: `No recibe ninguna (${skills})`, tone: '' };
  if (received >= skills) return { text: `Recibe todas (${skills})`, tone: 'ok' };
  return { text: `Recibe ${received} de ${skills}`, tone: 'warn' };
}

const skillBadge = (s: CatalogSkill): Label => (s.received ? { text: 'La recibe', tone: 'ok' } : { text: 'No la recibe', tone: '' });

export function AccessTargetPicker({ catalog, checked }: AccessTargetPickerProps) {
  const domains = [...catalog.domains].sort((a, b) => byText(domainTitle(a), domainTitle(b)));
  const groups = groupSkills(domains, catalog.skills);
  return (
    <div className="access-picker">
      <fieldset className="access-picker__set">
        <legend>Dominios <span className="small muted">· todas sus skills, también las que se publiquen después</span></legend>
        {domains.length === 0 ? <p className="small muted">El catálogo no tiene dominios.</p> : (
          <div className="access-picker__list">
            {domains.map((d) => {
              const token = targetToken({ kind: 'domain', name: d.slug });
              return <AccessTargetChoice key={token} token={token} title={domainTitle(d)} id={d.slug} badge={domainBadge(d)} checked={checked.has(token)} />;
            })}
          </div>
        )}
      </fieldset>
      <fieldset className="access-picker__set">
        <legend>Skills <span className="small muted">· una por una, por dominio</span></legend>
        {groups.length === 0 ? <p className="small muted">El catálogo no tiene skills.</p> : groups.map((group) => {
          const items = group.skills.map((skill) => ({ skill, token: targetToken({ kind: 'skill', name: skill.name }) }));
          const received = group.skills.filter((s) => s.received).length;
          return (
            // Abierto si tiene algo marcado: lo elegido nunca queda escondido.
            <details key={group.domain?.slug ?? ''} className="access-picker__group" open={items.some((item) => checked.has(item.token)) || undefined}>
              <summary>{group.title} <span className="small muted">· {group.skills.length} skills, recibe {received}</span></summary>
              <div className="access-picker__list">
                {items.map(({ skill, token }) => (
                  <AccessTargetChoice key={token} token={token} title={skillTitle(skill)} id={skill.name} badge={skillBadge(skill)} checked={checked.has(token)} />
                ))}
              </div>
            </details>
          );
        })}
      </fieldset>
    </div>
  );
}
