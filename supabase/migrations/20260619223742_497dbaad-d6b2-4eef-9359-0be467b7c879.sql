
-- profiles
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  email TEXT,
  saldo_inicial NUMERIC NOT NULL DEFAULT 0,
  reserva_minima NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL USING (auth.uid()=id) WITH CHECK (auth.uid()=id);

CREATE OR REPLACE FUNCTION public.handle_new_user() RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER SET search_path=public AS $$
BEGIN
  INSERT INTO public.profiles (id, email) VALUES (NEW.id, NEW.email);
  RETURN NEW;
END; $$;
CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- receitas
CREATE TABLE public.receitas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  competencia DATE NOT NULL,
  data DATE NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Salário',
  valor NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'PREVISTO' CHECK (status IN ('PREVISTO','RECEBIDO')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.receitas TO authenticated;
GRANT ALL ON public.receitas TO service_role;
ALTER TABLE public.receitas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own receitas" ON public.receitas FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE INDEX ON public.receitas (user_id, competencia);

-- despesas
CREATE TABLE public.despesas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  competencia DATE NOT NULL,
  data_venc DATE NOT NULL,
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Outros',
  valor NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PAGO','PENDENTE')),
  tipo TEXT NOT NULL DEFAULT 'variavel' CHECK (tipo IN ('fixa','variavel','amortizacao','consignado')),
  recorrente BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.despesas TO authenticated;
GRANT ALL ON public.despesas TO service_role;
ALTER TABLE public.despesas ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own despesas" ON public.despesas FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE INDEX ON public.despesas (user_id, competencia);

-- cartoes
CREATE TABLE public.cartoes_lancamentos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  competencia DATE NOT NULL,
  cartao TEXT NOT NULL DEFAULT 'Geral',
  descricao TEXT NOT NULL,
  categoria TEXT NOT NULL DEFAULT 'Cartão',
  valor NUMERIC NOT NULL,
  status TEXT NOT NULL DEFAULT 'PENDENTE' CHECK (status IN ('PAGO','PENDENTE')),
  consolidado BOOLEAN NOT NULL DEFAULT false,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartoes_lancamentos TO authenticated;
GRANT ALL ON public.cartoes_lancamentos TO service_role;
ALTER TABLE public.cartoes_lancamentos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cartoes" ON public.cartoes_lancamentos FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
CREATE INDEX ON public.cartoes_lancamentos (user_id, competencia);

-- consignados contratos
CREATE TABLE public.consignados_contratos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  nome TEXT NOT NULL,
  banco TEXT,
  valor_parcela NUMERIC NOT NULL,
  parcela_atual INT NOT NULL DEFAULT 0,
  total_parcelas INT NOT NULL,
  saldo_devedor NUMERIC NOT NULL,
  ativo BOOLEAN NOT NULL DEFAULT true,
  ultimo_avanco DATE,
  data_inicio DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consignados_contratos TO authenticated;
GRANT ALL ON public.consignados_contratos TO service_role;
ALTER TABLE public.consignados_contratos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own consignados" ON public.consignados_contratos FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);

-- consignados eventos (avanço de parcelas e amortizações extraordinárias)
CREATE TABLE public.consignados_eventos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  contrato_id UUID NOT NULL REFERENCES public.consignados_contratos ON DELETE CASCADE,
  competencia DATE NOT NULL,
  tipo TEXT NOT NULL CHECK (tipo IN ('avanco','amortizacao')),
  parcelas_abatidas INT NOT NULL DEFAULT 1,
  valor_extra NUMERIC NOT NULL DEFAULT 0,
  reducao_bruta NUMERIC NOT NULL DEFAULT 0,
  juros_salvos NUMERIC NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.consignados_eventos TO authenticated;
GRANT ALL ON public.consignados_eventos TO service_role;
ALTER TABLE public.consignados_eventos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own eventos" ON public.consignados_eventos FOR ALL USING (auth.uid()=user_id) WITH CHECK (auth.uid()=user_id);
