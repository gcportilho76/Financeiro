-- =====================================================================
-- CASH GUARD — SCRIPT COMPLETO DE CRIAÇÃO DO ESQUEMA
-- Execute UMA ÚNICA vez no SQL Editor do Supabase.
-- Todas as instruções são idempotentes (IF NOT EXISTS / DROP POLICY IF EXISTS).
-- Ordem de criação respeita dependências de chaves estrangeiras:
--   profiles → contas → receitas/despesas/cartoes_registry → ...
-- =====================================================================

-- =====================================================================
-- 1. PROFILES
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  saldo_inicial NUMERIC NOT NULL DEFAULT 0,
  reserva_minima NUMERIC NOT NULL DEFAULT 0,
  salario_base NUMERIC NOT NULL DEFAULT 11000,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own profile" ON public.profiles;
CREATE POLICY "own profile" ON public.profiles FOR ALL
  TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email);
  RETURN NEW;
END; $$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- =====================================================================
-- 2. CONTAS BANCÁRIAS (criada ANTES de receitas/despesas/cartoes_registry)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.contas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  nome TEXT NOT NULL,
  instituicao TEXT,
  tipo TEXT NOT NULL DEFAULT 'corrente',
  saldo_inicial NUMERIC NOT NULL DEFAULT 0,
  data_saldo_inicial DATE NOT NULL DEFAULT CURRENT_DATE,
  saldo_banco NUMERIC,
  data_saldo_banco DATE,
  ultima_conferencia TIMESTAMPTZ,
  ultima_conciliacao TIMESTAMPTZ,
  ativa BOOLEAN NOT NULL DEFAULT true,
  observacoes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contas TO authenticated;
GRANT ALL ON public.contas TO service_role;
ALTER TABLE public.contas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own contas" ON public.contas;
CREATE POLICY "own contas" ON public.contas FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 3. RECEITAS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.receitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  competencia DATE NOT NULL,
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Salário',
  valor NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'PREVISTO' CHECK (status IN ('PREVISTO','RECEBIDO')),
  origem TEXT NOT NULL DEFAULT 'manual',
  status_conciliacao TEXT NOT NULL DEFAULT 'NAO_CONCILIADO',
  data_efetiva DATE,
  conta_id UUID REFERENCES public.contas ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.receitas TO authenticated;
GRANT ALL ON public.receitas TO service_role;
ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own receitas" ON public.receitas;
CREATE POLICY "own receitas" ON public.receitas FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS receitas_user_comp_idx ON public.receitas (user_id, competencia);

-- =====================================================================
-- 4. DESPESAS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  competencia DATE NOT NULL,
  data_venc DATE NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Outros',
  valor NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PAGO','PENDENTE')),
  tipo TEXT NOT NULL DEFAULT 'variavel' CHECK (tipo IN ('fixa','variavel','amortizacao','consignado')),
  recorrente BOOLEAN NOT NULL DEFAULT false,
  origem TEXT NOT NULL DEFAULT 'manual',
  status_conciliacao TEXT NOT NULL DEFAULT 'NAO_CONCILIADO',
  data_efetiva DATE,
  conta_id UUID REFERENCES public.contas ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas TO authenticated;
GRANT ALL ON public.despesas TO service_role;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own despesas" ON public.despesas;
CREATE POLICY "own despesas" ON public.despesas FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS despesas_user_comp_idx ON public.despesas (user_id, competencia);

-- =====================================================================
-- 5. CARTÕES — LANÇAMENTOS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.cartoes_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  competencia DATE NOT NULL,
  cartao TEXT NOT NULL DEFAULT 'Geral',
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Cartão',
  valor NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PAGO','PENDENTE')),
  consolidado BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  fatura TEXT NOT NULL DEFAULT 'atual' CHECK (fatura IN ('atual','seguinte')),
  data_compra DATE,
  data_efetiva DATE,
  parcela_num INTEGER NOT NULL DEFAULT 1,
  parcela_total INTEGER NOT NULL DEFAULT 1,
  parent_id UUID REFERENCES public.cartoes_lancamentos ON DELETE SET NULL,
  origem TEXT NOT NULL DEFAULT 'manual',
  status_conciliacao TEXT NOT NULL DEFAULT 'NAO_CONCILIADO',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartoes_lancamentos TO authenticated;
GRANT ALL ON public.cartoes_lancamentos TO service_role;
ALTER TABLE public.cartoes_lancamentos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own cartoes" ON public.cartoes_lancamentos;
CREATE POLICY "own cartoes" ON public.cartoes_lancamentos FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS cartoes_user_comp_idx ON public.cartoes_lancamentos (user_id, competencia);

-- =====================================================================
-- 6. CARTÕES — REGISTRO (cadastro dos cartões)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.cartoes_registry (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  nome TEXT NOT NULL,
  banco TEXT,
  limite NUMERIC NOT NULL DEFAULT 0,
  dia_fechamento INTEGER NOT NULL DEFAULT 1 CHECK (dia_fechamento >= 1 AND dia_fechamento <= 31),
  dia_vencimento INTEGER,
  conta_pagamento_id UUID REFERENCES public.contas ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartoes_registry TO authenticated;
GRANT ALL ON public.cartoes_registry TO service_role;
ALTER TABLE public.cartoes_registry ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own cartoes_registry" ON public.cartoes_registry;
CREATE POLICY "own cartoes_registry" ON public.cartoes_registry FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 7. CONSIGNADOS — CONTRATOS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.consignados_contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  nome TEXT NOT NULL,
  banco TEXT,
  valor_parcela NUMERIC NOT NULL,
  parcela_atual INTEGER NOT NULL DEFAULT 0,
  total_parcelas INTEGER NOT NULL,
  saldo_devedor NUMERIC NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_avanco DATE,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  taxa_juros_mensal NUMERIC,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consignados_contratos TO authenticated;
GRANT ALL ON public.consignados_contratos TO service_role;
ALTER TABLE public.consignados_contratos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own consignados" ON public.consignados_contratos;
CREATE POLICY "own consignados" ON public.consignados_contratos FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 8. CONSIGNADOS — EVENTOS (avanços e amortizações)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.consignados_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES public.consignados_contratos ON DELETE CASCADE,
  competencia DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('avanco','amortizacao')),
  parcelas_abatidas INTEGER NOT NULL DEFAULT 1,
  valor_extra NUMERIC NOT NULL DEFAULT 0,
  reducao_bruta NUMERIC NOT NULL DEFAULT 0,
  juros_salvos NUMERIC NOT NULL DEFAULT 0,
  despesa_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.consignados_eventos TO authenticated;
GRANT ALL ON public.consignados_eventos TO service_role;
ALTER TABLE public.consignados_eventos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own eventos" ON public.consignados_eventos;
CREATE POLICY "own eventos" ON public.consignados_eventos FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 9. INSUMOS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.insumos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  competencia DATE NOT NULL,
  nome TEXT NOT NULL,
  valor_base NUMERIC NOT NULL DEFAULT 0,
  data_final_consumo DATE,
  validade DATE,
  observacao TEXT,
  dias_alerta INTEGER NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.insumos TO authenticated;
GRANT ALL ON public.insumos TO service_role;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own insumos" ON public.insumos;
CREATE POLICY "own insumos" ON public.insumos FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 10. SALDOS MENSAIS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.saldos_mensais (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  competencia DATE NOT NULL,
  saldo_inicial NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, competencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saldos_mensais TO authenticated;
GRANT ALL ON public.saldos_mensais TO service_role;
ALTER TABLE public.saldos_mensais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own saldos_mensais" ON public.saldos_mensais;
CREATE POLICY "Users manage own saldos_mensais" ON public.saldos_mensais FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 11. RESERVAS / CAIXINHAS
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.reservas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  nome TEXT NOT NULL,
  banco TEXT,
  valor NUMERIC(14,2) NOT NULL DEFAULT 0,
  competencia DATE NOT NULL DEFAULT date_trunc('month', now())::date,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.reservas TO authenticated;
GRANT ALL ON public.reservas TO service_role;
ALTER TABLE public.reservas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own reservas" ON public.reservas;
CREATE POLICY "Users manage own reservas" ON public.reservas FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS reservas_user_comp_idx ON public.reservas (user_id, competencia);

-- =====================================================================
-- 12. CHAT MESSAGES (mentor IA)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.chat_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  message_id TEXT NOT NULL,
  role TEXT NOT NULL,
  parts JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS chat_messages_user_created_idx
  ON public.chat_messages (user_id, created_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_messages TO authenticated;
GRANT ALL ON public.chat_messages TO service_role;
ALTER TABLE public.chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own chat messages" ON public.chat_messages;
CREATE POLICY "own chat messages" ON public.chat_messages FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 13. VINCULAÇÃO LOG (auditoria de troca de conta)
-- =====================================================================
CREATE TABLE IF NOT EXISTS public.vinculacao_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL DEFAULT auth.uid() REFERENCES auth.users ON DELETE CASCADE,
  lancamento_id TEXT NOT NULL,
  tabela TEXT NOT NULL,
  descricao TEXT,
  valor NUMERIC,
  conta_anterior_id UUID,
  conta_anterior_nome TEXT,
  conta_nova_id UUID,
  conta_nova_nome TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.vinculacao_log TO authenticated;
GRANT ALL ON public.vinculacao_log TO service_role;
ALTER TABLE public.vinculacao_log ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own vinculacao_log" ON public.vinculacao_log;
CREATE POLICY "own vinculacao_log" ON public.vinculacao_log FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- =====================================================================
-- 14. FUNÇÃO E TRIGGER DE updated_at
-- =====================================================================
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_saldos_mensais_updated_at ON public.saldos_mensais;
CREATE TRIGGER update_saldos_mensais_updated_at
  BEFORE UPDATE ON public.saldos_mensais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_reservas_updated_at ON public.reservas;
CREATE TRIGGER update_reservas_updated_at
  BEFORE UPDATE ON public.reservas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =====================================================================
-- FIM — Todas as 13 tabelas criadas com RLS e políticas de proprietário.
-- =====================================================================
