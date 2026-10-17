import "./lib/error-capture";

function renderClientAppHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Caixa Vivo - Orçamento Gutê</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/router.tsx"></script>
  </body>
</html>`;
}

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const serverEntryModule = await import("@tanstack/react-start/server-entry");
      const handler = (serverEntryModule.default ?? serverEntryModule) as any;
      const response = await handler.fetch(request, env, ctx);

      // Se o handler do Nitro responder qualquer código 500, força a resposta HTML 200
      if (response && response.status >= 500) {
        return new Response(renderClientAppHtml(), {
          status: 200,
          headers: { "content-type": "text/html; charset=utf-8" },
        });
      }

      return response;
    } catch (error) {
      console.error("SSR ignora erro de runtime e serve o cliente SPA:", error);
      return new Response(renderClientAppHtml(), {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      });
    }
  },
};