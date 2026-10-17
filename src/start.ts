import { createStart, createMiddleware } from "@tanstack/react-start";
import { renderErrorPage } from "./lib/error-page";

// Middleware seguro que evita exceções fatais de SSR no Nitro/Vercel
const errorMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    return await next();
  } catch (error) {
    if (error != null && typeof error === "object" && "statusCode" in error) {
      throw error;
    }
    console.error("Servidor TanStack Start interceptou erro de runtime:", error);
    // Em vez de quebrar o pipeline, prossegue a execução para o renderizador do cliente
    return await next();
  }
});

// Middleware seguro para inicialização da sessão do Supabase sem crash de SSR
const safeAuthMiddleware = createMiddleware().server(async ({ next }) => {
  try {
    const { attachSupabaseAuth } = await import("@/integrations/supabase/auth-attacher");
    if (typeof attachSupabaseAuth === "function") {
      return await attachSupabaseAuth({ next } as any);
    }
  } catch (err) {
    console.warn("Autenticação no servidor ignorada (modo fallback para cliente):", err);
  }
  return await next();
});

export const startInstance = createStart(() => ({
  functionMiddleware: [safeAuthMiddleware],
  requestMiddleware: [errorMiddleware],
}));