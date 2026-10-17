import "./lib/error-capture";

type ServerEntry = {
  fetch: (request: Request, env: unknown, ctx: unknown) => Promise<Response> | Response;
};

let serverEntryPromise: Promise<ServerEntry> | undefined;

async function getServerEntry(): Promise<ServerEntry> {
  if (!serverEntryPromise) {
    serverEntryPromise = import("@tanstack/react-start/server-entry").then(
      (m) => (m.default ?? m) as ServerEntry,
    );
  }
  return serverEntryPromise;
}

// Retorna uma página HTML de fallback para o cliente processar via SPA caso o SSR falhe
function renderClientOnlyFallback() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Caixa Vivo - Orçamento Gutê</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);

      // Intercepta respostas com erro 500 do H3/Nitro e converte para Status 200 HTML
      if (response.status >= 500) {
        const cloned = response.clone();
        const text = await cloned.text().catch(() => "");
        if (text.includes('"unhandled":true') || text.includes('"message":"HTTPError"')) {
          return new Response(renderClientOnlyFallback(), {
            status: 200,
            headers: { "content-type": "text/html; charset=utf-8" },
          });
        }
      }

      return response;
    } catch (error) {
      console.error("SSR Handler Fallback acionado:", error);
      return new Response(renderClientOnlyFallback(), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};