-- 1. Adicionar coluna deadline
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS deadline timestamptz;

-- 2. Modificar a restrição de check do status para aceitar 'overdue'
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check CHECK (status IN ('open', 'in_progress', 'resolved', 'overdue'));

-- 3. Trigger de segurança para alteração de prazo
CREATE OR REPLACE FUNCTION public.check_ticket_deadline()
RETURNS trigger AS $$
BEGIN
  -- Se o prazo está sendo alterado ou definido
  IF NEW.deadline IS DISTINCT FROM OLD.deadline THEN
    -- Apenas o criador do chamado pode alterar o prazo
    IF auth.uid() <> OLD.created_by THEN
      RAISE EXCEPTION 'Somente o criador do chamado pode alterar o prazo.';
    END IF;

    -- O prazo não pode ser diminuído, somente aumentado
    IF OLD.deadline IS NOT NULL AND NEW.deadline <= OLD.deadline THEN
      RAISE EXCEPTION 'O novo prazo deve ser maior do que o prazo anterior.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_check_ticket_deadline ON public.tickets;
CREATE TRIGGER trigger_check_ticket_deadline
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.check_ticket_deadline();
