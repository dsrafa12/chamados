-- ============================================================
-- MIGRAÇÃO 038: Adicionar campo de Matéria-Prima no processo de compra
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

ALTER TABLE public.purchase_processes 
  ADD COLUMN IF NOT EXISTS is_raw_material boolean DEFAULT false;