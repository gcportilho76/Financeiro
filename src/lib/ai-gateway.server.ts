import { createOpenAI } from "@ai-sdk/openai";

// Provedor do Lovable AI Gateway usando a Responses API (/v1/responses).
// Somente servidor — nunca importar em componentes.
export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAI({
    name: "lovable",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    apiKey,
    headers: { "Lovable-API-Key": apiKey },
  });
}
