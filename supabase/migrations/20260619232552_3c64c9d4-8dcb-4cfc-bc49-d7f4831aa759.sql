
CREATE TABLE public.insumos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  competencia date NOT NULL,
  nome text NOT NULL,
  valor_base numeric NOT NULL DEFAULT 0,
  data_final_consumo date,
  validade date,
  observacao text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.insumos TO authenticated;
GRANT ALL ON public.insumos TO service_role;
ALTER TABLE public.insumos ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own insumos" ON public.insumos FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
