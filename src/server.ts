import "./lib/error-capture";

function renderAppHtml() {
  return `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Caixa Vivo - Orçamento Gutê</title>
    <link rel="stylesheet" href="/src/styles.css" />
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/start.ts"></script>
  </body>
</html>`;
}

export default {
  async fetch(request: Request) {
    try {
      const url = new URL(request.url);
      
      // Se for uma requisição para ativos estáticos ou API, deixa passar
      if (url.pathname.includes(".") && !url.pathname.endsWith(".html")) {
        return fetch(request);
      }
    } catch (e) {}

    return new Response(renderAppHtml(), {
      status: 200,
      headers: { 
        "content-type": "text/html; charset=utf-8",
        "cache-control": "no-cache"
      },
    });
  },
};