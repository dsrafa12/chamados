-- ============================================================
-- MIGRAÇÃO: Permitir que Diretores alterem qualquer prazo sem restrições
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_ticket_deadline()
RETURNS trigger AS $$
DECLARE
  v_role text;
BEGIN
  -- Se o prazo está sendo alterado ou definido
  IF NEW.deadline IS DISTINCT FROM OLD.deadline THEN
    -- Buscar o cargo do usuário atual
    SELECT role INTO v_role FROM public.profiles WHERE id = auth.uid();

    -- Apenas o criador do chamado ou um Diretor pode alterar o prazo
    IF auth.uid() <> OLD.created_by AND v_role <> 'director' THEN
      RAISE EXCEPTION 'Somente o criador do chamado ou um Diretor pode alterar o prazo.';
    END IF;

    -- O prazo não pode ser diminuído, somente aumentado (exceto para Diretores que têm controle total)
    IF v_role <> 'director' AND OLD.deadline IS NOT NULL AND NEW.deadline <= OLD.deadline THEN
      RAISE EXCEPTION 'O novo prazo deve ser maior do que o prazo anterior.';
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Recriar o trigger para garantir aplicação
DROP TRIGGER IF EXISTS trigger_check_ticket_deadline ON public.tickets;
CREATE TRIGGER trigger_check_ticket_deadline
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.check_ticket_deadline();
