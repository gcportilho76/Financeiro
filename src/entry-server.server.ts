import { createStartHandler } from "@tanstack/react-start/server";
import { createRouter } from "./router";

const handler = createStartHandler({
  createRouter,
});

export default async function (event: any) {
  try {
    return await handler(event);
  } catch (error) {
    console.error("Exceção capturada no entry-server:", error);
    return new Response(
      `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
    <title>Caixa Vivo - Orçamento Gutê</title>
  </head>
  <body>
    <div id="root"></div>
  </body>
</html>`,
      {
        status: 200,
        headers: { "content-type": "text/html; charset=utf-8" },
      }
    );
  }
}