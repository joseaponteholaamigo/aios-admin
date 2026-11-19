// Corre un middleware de React Router contra un pedido, sin servidor: dice si llegó a `next()`,
// qué respondió o qué lanzó, y deja el contexto para que la prueba lo lea.
import { RouterContextProvider, type MiddlewareFunction } from 'react-router';

export type MiddlewareRun = {
  reached: boolean;
  /** El estado de lo que lanzó (una redirección, un `data()` o un `Response`), si lanzó. */
  thrownStatus: number | null;
  thrown: unknown;
  context: RouterContextProvider;
};

export async function runMiddleware(
  middleware: MiddlewareFunction<Response>,
  path: string,
  context = new RouterContextProvider(),
): Promise<MiddlewareRun> {
  const args = { request: new Request(`https://dxxxx.cloudfront.net${path}`), context, params: {} } as unknown as Parameters<
    MiddlewareFunction<Response>
  >[0];
  let reached = false;
  try {
    await middleware(args, async () => {
      reached = true;
      return new Response('ok');
    });
    return { reached, thrownStatus: null, thrown: null, context };
  } catch (thrown) {
    return { reached, thrownStatus: statusOf(thrown), thrown, context };
  }
}

function statusOf(thrown: unknown): number | null {
  if (thrown instanceof Response) return thrown.status;
  const init = (thrown as { init?: { status?: number } } | null)?.init;
  return init?.status ?? null;
}
