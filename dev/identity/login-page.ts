// La pantalla «entrar como» de la identidad falsa: quién eres y con qué permisos. Sin contraseña
// ni MFA: en local no hay nada que proteger, y en AWS esta pantalla no existe.
import { MODULES, MODULE_LEVELS, type TeamMember } from '../../app/domain/permissions';

/** Va en la página para que la prueba del build compruebe que la identidad falsa no se coló (CA-29). */
export const DEV_IDENTITY_MARKER = 'aios-admin:dev-identity';

export type LoginForm = {
  email: string;
  name: string;
  isSuperadmin: boolean;
  suspended: boolean;
  permissions: TeamMember['permissions'];
};

export const EMPTY_FORM: LoginForm = { email: '', name: '', isSuperadmin: false, suspended: false, permissions: {} };

const escapeHtml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!);

function moduleRow(form: LoginForm, module: (typeof MODULES)[number]) {
  const options = ['', ...MODULE_LEVELS[module]].map((level) => {
    const checked = (form.permissions[module] ?? '') === level ? ' checked' : '';
    return `<label><input type="radio" name="perm_${module}" value="${level}"${checked}> ${level || '—'}</label>`;
  });
  return `<tr><th scope="row">${module}</th><td>${options.join(' ')}</td></tr>`;
}

/** La página, con los parámetros del pedido de login en campos ocultos para el envío. */
export function renderLoginPage({ params, form, error }: { params: URLSearchParams; form: LoginForm; error?: string }): string {
  const hidden = [...params].map(([k, v]) => `<input type="hidden" name="${escapeHtml(k)}" value="${escapeHtml(v)}">`).join('');
  return `<!doctype html>
<html lang="es">
<head>
<meta charset="utf-8">
<meta name="generator" content="${DEV_IDENTITY_MARKER}">
<title>Entrar como · identidad falsa</title>
<style>body{font-family:system-ui,sans-serif;max-width:40rem;margin:2rem auto;padding:0 1rem}
th{text-align:left;padding-right:1rem;font-weight:500}td label{margin-right:.75rem}
.error{background:#fde8e8;padding:.75rem;border-radius:.375rem}</style>
</head>
<body>
<h1>Entrar como</h1>
<p>Identidad falsa de desarrollo: solo existe en <code>npm run dev</code>. Lo que elijas se guarda en el backend local.</p>
${error ? `<p class="error" role="alert">${escapeHtml(error)}</p>` : ''}
<form method="post">
${hidden}
<p><label>Correo <input type="email" name="email" required value="${escapeHtml(form.email)}"></label></p>
<p><label>Nombre <input name="name" value="${escapeHtml(form.name)}"></label></p>
<p><label><input type="checkbox" name="superadmin" value="1"${form.isSuperadmin ? ' checked' : ''}> Superadministrador</label></p>
<p><label><input type="checkbox" name="suspended" value="1"${form.suspended ? ' checked' : ''}> Suspendida (el backend la rechaza)</label></p>
<table><tbody>${MODULES.map((m) => moduleRow(form, m)).join('')}</tbody></table>
<p><button type="submit">Entrar</button></p>
</form>
</body>
</html>`;
}
