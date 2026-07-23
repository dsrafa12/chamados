-- ============================================================
-- MIGRAÇÃO: Gatilho de Auditoria e Política RLS para Atrelar Colaboradores
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

-- 1. Gatilho de auditoria ao adicionar colaboradores a um chamado
CREATE OR REPLACE FUNCTION public.handle_ticket_user_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_user_name text;
BEGIN
  -- Só grava o log de "Atrelou o colaborador" se o chamado já tiver sido criado há mais de 5 segundos
  IF EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = NEW.ticket_id
    AND t.created_at < now() - interval '5 seconds'
  ) THEN
    SELECT full_name INTO v_user_name FROM public.profiles WHERE id = NEW.profile_id;
    INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
    VALUES (
      NEW.ticket_id, 
      auth.uid(), 
      'collaborator_added', 
      'Atrelou o colaborador: ' || COALESCE(v_user_name, 'Desconhecido')
    );
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Associar gatilho à tabela ticket_users
DROP TRIGGER IF EXISTS ticket_user_audit_trigger ON public.ticket_users;
CREATE TRIGGER ticket_user_audit_trigger
  AFTER INSERT ON public.ticket_users
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_ticket_user_audit();

-- 2. Atualizar políticas da tabela pivot ticket_users para permitir atrelar
DROP POLICY IF EXISTS "Directors gerenciam envolvidos nos chamados" ON public.ticket_users;
DROP POLICY IF EXISTS "Atrelar novos colaboradores" ON public.ticket_users;

CREATE POLICY "Atrelar novos colaboradores" ON public.ticket_users
  FOR INSERT TO authenticated
  WITH CHECK (
    -- a. É um diretor
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
      AND role = 'director'
    )
    OR
    -- b. É o criador do chamado
    EXISTS (
      SELECT 1 FROM public.tickets
      WHERE id = ticket_id
      AND created_by = auth.uid()
    )
    -- c. Ou o usuário que está inserindo já está na tabela ticket_users para este chamado
    OR EXISTS (
      SELECT 1 FROM public.ticket_users tu
      WHERE tu.ticket_id = ticket_users.ticket_id
      AND tu.profile_id = auth.uid()
    )
    -- d. Ou o usuário que está inserindo pertence ao grupo destinatário do chamado
    OR EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_users.ticket_id
      AND t.destination_department_id IN (
        SELECT department_id FROM public.profile_departments WHERE profile_id = auth.uid()
      )
    )
  );
