import { createFileRoute } from "@tanstack/react-router";
import { createClient } from "@supabase/supabase-js";
import { convertToModelMessages, streamText, type UIMessage } from "ai";
import { createLovableAiGatewayProvider } from "@/lib/ai-gateway.server";
import { MENTOR_SYSTEM_PROMPT, buildFinancialSnapshot } from "@/lib/mentor.server";

type ChatRequestBody = { messages?: unknown };

export const Route = createFileRoute("/api/chat")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const authHeader = request.headers.get("authorization");
        if (!authHeader) {
          return new Response("Unauthorized", { status: 401 });
        }

        const supabaseUrl = process.env["SUPABASE_URL"];
        const publishableKey = process.env["SUPABASE_PUBLISHABLE_KEY"];
        const lovableKey = process.env["LOVABLE_API_KEY"];
        if (!supabaseUrl || !publishableKey || !lovableKey) {
          return new Response("Servidor mal configurado", { status: 500 });
        }

        // Cliente autenticado como o usuário (RLS se aplica)
        const supabase = createClient(supabaseUrl, publishableKey, {
          global: { headers: { Authorization: authHeader } },
          auth: {
            storage: undefined,
            persistSession: false,
            autoRefreshToken: false,
          },
        });

        const {
          data: { user },
          error: userError,
        } = await supabase.auth.getUser();
        if (userError || !user) {
          return new Response("Unauthorized", { status: 401 });
        }

        const { messages } = (await request.json()) as ChatRequestBody;
        if (!Array.isArray(messages)) {
          return new Response("Messages são obrigatórias", { status: 400 });
        }
        const uiMessages = messages as UIMessage[];

        const snapshot = await buildFinancialSnapshot(supabase, user.id).catch(
          (e) => {
            console.error("snapshot error", e);
            return "(Dados financeiros indisponíveis no momento — responda com base no que o usuário informar.)";
          },
        );

        const gateway = createLovableAiGatewayProvider(lovableKey);
        const result = streamText({
          model: gateway.responses("openai/gpt-5.6-sol"),
          system: `${MENTOR_SYSTEM_PROMPT}\n\n${snapshot}`,
          messages: await convertToModelMessages(uiMessages),
        });

        return result.toUIMessageStreamResponse({
          originalMessages: uiMessages,
          onFinish: async ({ responseMessage, isAborted }) => {
            try {
              const lastUser = [...uiMessages]
                .reverse()
                .find((m) => m.role === "user");
              const toSave: UIMessage[] = [];
              if (lastUser) toSave.push(lastUser);
              if (!isAborted && responseMessage) toSave.push(responseMessage);

              for (const m of toSave) {
                const { data: existing } = await supabase
                  .from("chat_messages")
                  .select("id")
                  .eq("message_id", m.id)
                  .maybeSingle();
                if (existing) continue;
                const { error } = await supabase.from("chat_messages").insert({
                  user_id: user.id,
                  message_id: m.id,
                  role: m.role,
                  parts: m.parts as unknown as Record<string, unknown>[],
                });
                if (error) console.error("chat_messages insert error", error);
              }
            } catch (e) {
              console.error("chat persistence error", e);
            }
          },
        });
      },
    },
  },
});
