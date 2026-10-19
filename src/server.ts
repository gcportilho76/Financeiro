import "./lib/error-capture";
import entryServer from "./entry-server"; // Ajuste o caminho se o seu ficheiro for entry-server.server.ts

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      return await entryServer({ request, env, ctx });
    } catch (e) {
      return new Response(
        `<!DOCTYPE html><html lang="pt-BR"><head><meta charset="utf-8"/><title>Caixa Vivo</title></head><body><div id="root"></div></body></html>`,
        { status: 200, headers: { "content-type": "text/html; charset=utf-8" } }
      );
    }
  },
};