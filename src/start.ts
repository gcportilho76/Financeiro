import { createStart } from "@tanstack/react-start";

export const startInstance = createStart(() => ({
  // Desativa middlewares globais no SSR do servidor para evitar HTTPError 500
  functionMiddleware: [],
}));