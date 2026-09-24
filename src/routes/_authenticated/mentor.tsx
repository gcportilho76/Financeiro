import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useChat } from "@ai-sdk/react";
import { DefaultChatTransport, type UIMessage } from "ai";
import ReactMarkdown from "react-markdown";
import {
  ArrowLeft, Sparkles, Send, Trash2, Loader2, Bot,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Toaster } from "@/components/ui/sonner";

export const Route = createFileRoute("/_authenticated/mentor")({
  head: () => ({
    meta: [
      { title: "Gutê Finanças — Mentor IA | Orçamento Gutê" },
      {
        name: "description",
        content:
          "Converse com o Gutê Finanças, o mentor financeiro com IA que analisa suas receitas, despesas, cartões, consignados e reservas e monta um plano para eliminar dívidas.",
      },
      { property: "og:title", content: "Gutê Finanças — Mentor IA | Orçamento Gutê" },
      {
        property: "og:description",
        content:
          "Mentor financeiro com IA que analisa seu fluxo de caixa e monta estratégias de quitação de dívidas e reserva de emergência.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: MentorPage,
});

const SUGESTOES = [
  "📊 Analise meu mês atual com o relatório completo",
  "💡 Como quitar meus consignados mais rápido?",
  "🎯 Monte meu plano 50/30/20 para este mês",
];

async function carregarHistorico(): Promise<UIMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("message_id, role, parts")
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []).map((row: any) => ({
    id: row.message_id as string,
    role: row.role as UIMessage["role"],
    parts: (row.parts ?? []) as UIMessage["parts"],
  }));
}

function MentorPage() {
  const { data: historico, isLoading } = useQuery({
    queryKey: ["mentor-history"],
    queryFn: carregarHistorico,
    staleTime: Infinity,
  });

  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <Toaster richColors theme="dark" position="top-right" />
      <header className="border-b border-border bg-card/50 backdrop-blur sticky top-0 z-40">
        <div className="max-w-3xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link to="/dashboard">
              <Button variant="ghost" size="icon" title="Voltar ao dashboard">
                <ArrowLeft className="w-4 h-4" />
              </Button>
            </Link>
            <div className="w-9 h-9 rounded-lg bg-primary flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-base font-bold tracking-tight leading-tight">
                Gutê Finanças
              </h1>
              <p className="text-xs text-muted-foreground">
                Mentor financeiro da família
              </p>
            </div>
          </div>
        </div>
      </header>

      {isLoading ? (
        <div className="flex-1 flex items-center justify-center">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : (
        <ChatWindow key="gute" initialMessages={historico ?? []} />
      )}
    </div>
  );
}

const mdComponents = {
  h2: ({ children }: any) => (
    <h2 className="text-sm font-bold mt-4 mb-2 first:mt-0">{children}</h2>
  ),
  h3: ({ children }: any) => (
    <h3 className="text-sm font-semibold mt-3 mb-1">{children}</h3>
  ),
  p: ({ children }: any) => <p className="my-2 leading-relaxed">{children}</p>,
  ul: ({ children }: any) => (
    <ul className="list-disc pl-5 my-2 space-y-1">{children}</ul>
  ),
  ol: ({ children }: any) => (
    <ol className="list-decimal pl-5 my-2 space-y-1">{children}</ol>
  ),
  strong: ({ children }: any) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  table: ({ children }: any) => (
    <div className="overflow-x-auto my-3 rounded-md border border-border">
      <table className="w-full text-xs border-collapse">{children}</table>
    </div>
  ),
  th: ({ children }: any) => (
    <th className="bg-secondary px-2 py-1.5 text-left font-semibold border-b border-border">
      {children}
    </th>
  ),
  td: ({ children }: any) => (
    <td className="px-2 py-1.5 border-b border-border align-top">{children}</td>
  ),
  hr: () => <hr className="my-3 border-border" />,
  code: ({ children }: any) => (
    <code className="bg-secondary rounded px-1 py-0.5 text-xs">{children}</code>
  ),
};

function ChatWindow({ initialMessages }: { initialMessages: UIMessage[] }) {
  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const transport = useMemo(
    () =>
      new DefaultChatTransport({
        api: "/api/chat",
        headers: async (): Promise<Record<string, string>> => {
          const { data } = await supabase.auth.getSession();
          const token = data.session?.access_token;
          return token ? { Authorization: `Bearer ${token}` } : {};
        },
      }),
    [],
  );

  const { messages, sendMessage, status, setMessages, error, clearError } =
    useChat({
      id: "gute-financas",
      messages: initialMessages,
      transport,
      onError: (e) => {
        console.error(e);
        toast.error(
          "Não consegui falar com o mentor agora. Tente novamente em instantes.",
        );
      },
    });

  const busy = status === "submitted" || status === "streaming";

  // Auto-scroll
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, status]);

  // Foco no campo de texto
  useEffect(() => {
    if (!busy) textareaRef.current?.focus();
  }, [busy]);

  useEffect(() => {
    if (error) toast.error("Erro na conversa. Tente reenviar.");
  }, [error]);

  async function enviar(texto: string) {
    const t = texto.trim();
    if (!t || busy) return;
    clearError();
    setInput("");
    await sendMessage({ text: t });
  }

  async function limparConversa() {
    const { error } = await supabase
      .from("chat_messages")
      .delete()
      .neq("message_id", "");
    if (error) {
      toast.error("Não consegui apagar a conversa.");
      return;
    }
    setMessages([]);
    toast.success("Conversa apagada. Vamos recomeçar!");
    textareaRef.current?.focus();
  }

  return (
    <>
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-4 py-6 space-y-5">
          {messages.length === 0 && (
            <div className="text-center py-10 space-y-6">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
                <Bot className="w-8 h-8 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold">Fala, família! 👋</h2>
                <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                  Eu sou o Gutê Finanças. Já estou de olho nos seus números do
                  mês — receitas, despesas, cartões, consignados e caixinhas.
                  Manda ver:
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-2 justify-center">
                {SUGESTOES.map((s) => (
                  <button
                    key={s}
                    onClick={() => enviar(s)}
                    className="text-left text-sm px-4 py-2.5 rounded-lg border border-border bg-card hover:bg-accent transition-colors"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((m) => (
            <MessageBubble key={m.id} message={m} />
          ))}

          {status === "submitted" && (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                <Bot className="w-4 h-4 text-primary" />
              </div>
              <span className="italic">Gutê está analisando seus números…</span>
            </div>
          )}
        </div>
      </div>

      <div className="border-t border-border bg-card/50 backdrop-blur sticky bottom-0">
        <div className="max-w-3xl mx-auto px-4 py-3">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              enviar(input);
            }}
            className="flex items-end gap-2"
          >
            <Textarea
              ref={textareaRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  enviar(input);
                }
              }}
              placeholder="Pergunte sobre seus gastos, dívidas ou peça o relatório do mês…"
              className="min-h-[44px] max-h-40 resize-none"
              rows={1}
              autoFocus
            />
            <Button
              type="submit"
              size="icon"
              disabled={busy || !input.trim()}
              title="Enviar"
            >
              {busy ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </Button>
            {messages.length > 0 && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={limparConversa}
                title="Apagar conversa"
              >
                <Trash2 className="w-4 h-4" />
              </Button>
            )}
          </form>
          <p className="text-[11px] text-muted-foreground mt-1.5 text-center">
            Enter envia · Shift+Enter quebra linha · O mentor já conhece seus
            dados do mês
          </p>
        </div>
      </div>
    </>
  );
}

function MessageBubble({ message }: { message: UIMessage }) {
  const isUser = message.role === "user";
  const textParts = message.parts.filter((p) => p.type === "text");
  const reasoningParts = message.parts.filter((p) => p.type === "reasoning");

  return (
    <div className={`flex gap-2 ${isUser ? "justify-end" : "justify-start"}`}>
      {!isUser && (
        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0 mt-1">
          <Bot className="w-4 h-4 text-primary" />
        </div>
      )}
      <div
        className={
          isUser
            ? "max-w-[85%] rounded-2xl rounded-br-sm bg-primary text-primary-foreground px-4 py-2.5 text-sm"
            : "max-w-[90%] rounded-2xl rounded-bl-sm bg-card border border-border px-4 py-3 text-sm"
        }
      >
        {reasoningParts.length > 0 && (
          <details className="mb-2 text-xs text-muted-foreground">
            <summary className="cursor-pointer select-none italic">
              Ver raciocínio do Gutê
            </summary>
            <div className="mt-1 whitespace-pre-wrap italic opacity-80">
              {reasoningParts.map((p: any, i) => (
                <span key={i}>{p.text}</span>
              ))}
            </div>
          </details>
        )}
        {isUser ? (
          <span className="whitespace-pre-wrap">
            {textParts.map((p: any) => p.text).join("")}
          </span>
        ) : (
          <ReactMarkdown components={mdComponents}>
            {textParts.map((p: any) => p.text).join("")}
          </ReactMarkdown>
        )}
      </div>
    </div>
  );
}
