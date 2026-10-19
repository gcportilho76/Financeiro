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

function renderFallbackHtml() {
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

      if (response && response.status >= 500) {
        return new Response(renderFallbackHtml(), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }

      return response;
    } catch (error) {
      console.error("Exceção de SSR capturada no server.ts:", error);
      return new Response(renderFallbackHtml(), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};