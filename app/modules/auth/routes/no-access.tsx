// `/auth/no-access`: a donde va quien el backend ya no reconoce como parte activa del equipo
// (CB-5). Su sesión ya se borró. Es pública: sin sesión tiene que poder verse.
//
// ⚠️ «Volver a entrar» pasa por la salida (POST a `/auth/logout`), no por el login: la sesión de
// Cognito sigue abierta, así que el login devolvería solo a la misma cuenta, y de ahí otra vez
// aquí. La salida cierra también la de Cognito: el login vuelve a pedir la cuenta, y se puede
// entrar con otra. Es un `<form>` del navegador: funciona aunque el JavaScript no cargue.
export default function NoAccess() {
  return (
    <main className="card pad">
      <h1>No pudimos confirmar tu acceso al panel</h1>
      <p>
        Puede que tu cuenta del equipo ya no esté activa, o que tu sesión haya vencido. Vuelve a entrar; si sigue
        pasando, avísale a quien administra el panel.
      </p>
      <form method="post" action="/auth/logout">
        <button type="submit" className="btn primary">Volver a entrar</button>
      </form>
    </main>
  );
}
