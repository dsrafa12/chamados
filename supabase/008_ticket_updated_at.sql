-- ============================================================
-- MIGRAÇÃO 008: Adicionar coluna updated_at na tabela tickets
-- ============================================================

-- 1. Adicionar coluna updated_at se não existir
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

-- 2. Trigger para atualizar automaticamente o campo updated_at no UPDATE
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
   NEW.updated_at = now();
   RETURN NEW;
END;
$$ language 'plpgsql';

CREATE OR REPLACE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
