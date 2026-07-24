-- ============================================================
-- MIGRAÇÃO 033: Adicionar novos campos à tabela de processos de compra
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

-- Adiciona novas colunas na tabela purchase_processes
ALTER TABLE public.purchase_processes 
  ADD COLUMN IF NOT EXISTS responsible_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS order_number text,
  ADD COLUMN IF NOT EXISTS supplier text,
  ADD COLUMN IF NOT EXISTS purchase_amount numeric,
  ADD COLUMN IF NOT EXISTS delivery_forecast date,
  ADD COLUMN IF NOT EXISTS block_reason text DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS receipt_status text DEFAULT 'not_received';
