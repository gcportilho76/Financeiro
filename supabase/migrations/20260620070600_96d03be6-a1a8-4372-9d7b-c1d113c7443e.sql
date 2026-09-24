
CREATE TABLE public.cartoes_registry (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  banco TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.cartoes_registry TO authenticated;
GRANT ALL ON public.cartoes_registry TO service_role;
ALTER TABLE public.cartoes_registry ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own cartoes_registry" ON public.cartoes_registry
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

ALTER TABLE public.insumos
  ADD COLUMN IF NOT EXISTS dias_alerta INTEGER NOT NULL DEFAULT 5;
