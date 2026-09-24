/*
# Schema completo — contas, vinculacao_log e colunas ausentes

## O que faz
1. Cria a tabela `contas` (contas bancárias do usuário) que faltava no banco
2. Cria a tabela `vinculacao_log` (auditoria de troca de conta) que faltava
3. Adiciona colunas ausentes em tabelas existentes:
   - profiles: salario_base
   - receitas: origem, status_conciliacao, data_efetiva, conta_id (FK → contas)
   - despesas: origem, status_conciliacao, data_efetiva, conta_id (FK → contas)
   - cartoes_lancamentos: data_efetiva, origem, status_conciliacao
   - cartoes_registry: dia_vencimento, conta_pagamento_id (FK → contas)
4. Todas as tabelas novas têm RLS + políticas de proprietário (auth.uid = user_id)
5. user_id tem DEFAULT auth.uid() em todas as tabelas para inserts funcionarem
6. Privilégios concedidos a authenticated e service_role

## Notas
- Idempotente: usa IF NOT EXISTS e DROP POLICY IF EXISTS em tudo
- A tabela contas é criada PRIMEIRO (antes de receitas/despesas) por causa das FKs
- user_id DEFAULT auth.uid() permite inserts sem passar user_id explicitamente
*/

-- =====================================================================
-- 1. PROFILES — adicionar salario_base
-- =====================================================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS salario_base NUMERIC NOT NULL DEFAULT 11000;

-- =====================================================================
-- 2. CONTAS BANCÁRIAS (nova tabela — criada ANTES das FKs)
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
-- 3. RECEITAS — adicionar colunas ausentes
-- =====================================================================
ALTER TABLE public.receitas
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS status_conciliacao TEXT NOT NULL DEFAULT 'NAO_CONCILIADO',
  ADD COLUMN IF NOT EXISTS data_efetiva DATE,
  ADD COLUMN IF NOT EXISTS conta_id UUID REFERENCES public.contas ON DELETE SET NULL;

-- =====================================================================
-- 4. DESPESAS — adicionar colunas ausentes
-- =====================================================================
ALTER TABLE public.despesas
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS status_conciliacao TEXT NOT NULL DEFAULT 'NAO_CONCILIADO',
  ADD COLUMN IF NOT EXISTS data_efetiva DATE,
  ADD COLUMN IF NOT EXISTS conta_id UUID REFERENCES public.contas ON DELETE SET NULL;

-- =====================================================================
-- 5. CARTÕES LANÇAMENTOS — adicionar colunas ausentes
-- =====================================================================
ALTER TABLE public.cartoes_lancamentos
  ADD COLUMN IF NOT EXISTS data_efetiva DATE,
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS status_conciliacao TEXT NOT NULL DEFAULT 'NAO_CONCILIADO';

-- =====================================================================
-- 6. CARTÕES REGISTRY — adicionar colunas ausentes
-- =====================================================================
ALTER TABLE public.cartoes_registry
  ADD COLUMN IF NOT EXISTS dia_vencimento INTEGER,
  ADD COLUMN IF NOT EXISTS conta_pagamento_id UUID REFERENCES public.contas ON DELETE SET NULL;

-- =====================================================================
-- 7. VINCULAÇÃO LOG (nova tabela)
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
