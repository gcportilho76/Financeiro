
ALTER TABLE public.cartoes_registry
  ADD COLUMN IF NOT EXISTS limite numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS dia_fechamento integer NOT NULL DEFAULT 1
    CHECK (dia_fechamento >= 1 AND dia_fechamento <= 31);

ALTER TABLE public.cartoes_lancamentos
  ADD COLUMN IF NOT EXISTS fatura text NOT NULL DEFAULT 'atual'
    CHECK (fatura IN ('atual','seguinte')),
  ADD COLUMN IF NOT EXISTS data_compra date,
  ADD COLUMN IF NOT EXISTS parcela_num integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parcela_total integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS parent_id uuid REFERENCES public.cartoes_lancamentos(id) ON DELETE SET NULL;

ALTER TABLE public.consignados_eventos
  ADD COLUMN IF NOT EXISTS despesa_id uuid;
