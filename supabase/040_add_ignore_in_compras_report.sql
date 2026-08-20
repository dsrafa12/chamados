-- ============================================================
-- MIGRAÇÃO 040: Desconsiderar chamado em relatórios de compras
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

ALTER TABLE public.tickets 
  ADD COLUMN IF NOT EXISTS ignore_in_compras_report boolean DEFAULT false;