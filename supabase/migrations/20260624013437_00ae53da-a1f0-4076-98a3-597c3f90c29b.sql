CREATE TABLE public.saldos_mensais (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competencia date NOT NULL,
  saldo_inicial numeric NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, competencia)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.saldos_mensais TO authenticated;
GRANT ALL ON public.saldos_mensais TO service_role;

ALTER TABLE public.saldos_mensais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own saldos_mensais"
  ON public.saldos_mensais FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_saldos_mensais_updated_at
  BEFORE UPDATE ON public.saldos_mensais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();