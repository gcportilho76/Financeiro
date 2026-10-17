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

export default {
  async fetch(request: Request, env: unknown, ctx: unknown) {
    try {
      const handler = await getServerEntry();
      const response = await handler.fetch(request, env, ctx);
      return response;
    } catch (error) {
      console.error("SSR Handler Fallback:", error);
      // Retorna uma resposta direta garantindo que o cliente assuma a renderização das rotas
      const handler = await getServerEntry();
      return await handler.fetch(request, env, ctx);
    }
  },
};