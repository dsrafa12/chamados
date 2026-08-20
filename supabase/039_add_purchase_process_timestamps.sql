-- ============================================================
-- MIGRAÇÃO 039: Registrar timestamps de Aguardando Recebimento e Recebimento Total
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

-- 1. Adicionar colunas de timestamp na tabela purchase_processes
ALTER TABLE public.purchase_processes 
  ADD COLUMN IF NOT EXISTS awaiting_receipt_at timestamptz,
  ADD COLUMN IF NOT EXISTS finalized_at timestamptz;

-- 2. Função de gatilho para registrar automaticamente as datas de mudança de status
CREATE OR REPLACE FUNCTION public.handle_purchase_process_timestamps()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o status mudar para 'awaiting_receipt' e a data ainda não foi registrada
  IF NEW.status = 'awaiting_receipt' AND (OLD.status IS DISTINCT FROM 'awaiting_receipt' OR NEW.awaiting_receipt_at IS NULL) THEN
    NEW.awaiting_receipt_at := COALESCE(NEW.awaiting_receipt_at, now());
  END IF;

  -- Se o status mudar para 'finalized' e a data de finalização ainda não foi registrada
  IF NEW.status = 'finalized' AND (OLD.status IS DISTINCT FROM 'finalized' OR NEW.finalized_at IS NULL) THEN
    NEW.finalized_at := COALESCE(NEW.finalized_at, now());
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Vincular gatilho à tabela purchase_processes
DROP TRIGGER IF EXISTS trg_purchase_process_timestamps ON public.purchase_processes;
CREATE TRIGGER trg_purchase_process_timestamps
  BEFORE INSERT OR UPDATE ON public.purchase_processes
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_purchase_process_timestamps();