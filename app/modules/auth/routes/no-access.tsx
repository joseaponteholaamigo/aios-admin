// `/auth/no-access`: a donde va quien el backend ya no reconoce como parte activa del equipo
// (CB-5). Su sesión ya se borró. Es pública: sin sesión tiene que poder verse.
export default function NoAccess() {
  return (
    <main>
      <h1>No pudimos confirmar tu acceso al panel</h1>
      <p>
        Puede que tu cuenta del equipo ya no esté activa, o que tu sesión haya vencido. Vuelve a entrar; si sigue
        pasando, avísale a quien administra el panel.
      </p>
      <a href="/auth/login">Volver a entrar</a>
    </main>
  );
}
