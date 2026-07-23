-- ============================================================
-- MIGRAÇÃO: Criar tabela e gatilhos de Histórico do Chamado (Auditoria)
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

-- 1. Criar tabela de histórico
CREATE TABLE IF NOT EXISTS public.ticket_history (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  action text NOT NULL,
  description text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.ticket_history ENABLE ROW LEVEL SECURITY;

-- Política de visualização (SELECT): Usuário pode ver histórico se puder ver o chamado
DROP POLICY IF EXISTS "Visualizar historico de chamados permitidos" ON public.ticket_history;
CREATE POLICY "Visualizar historico de chamados permitidos"
  ON public.ticket_history FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_history.ticket_id
    )
  );

-- 2. Gatilho para monitorar mudanças de estado no chamado
CREATE OR REPLACE FUNCTION public.handle_ticket_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_dept_name text;
BEGIN
  -- Ação de Criação (INSERT)
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
    VALUES (NEW.id, NEW.created_by, 'create', 'Criou o chamado');

  -- Ação de Atualização (UPDATE)
  ELSIF TG_OP = 'UPDATE' THEN
    
    -- Se mudou o status do chamado
    IF OLD.status IS DISTINCT FROM NEW.status THEN
      IF NEW.status = 'in_progress' THEN
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'start_service', 'Iniciou o atendimento');
      ELSIF NEW.status = 'resolved' THEN
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'resolve', 'Finalizou o chamado');
      ELSIF NEW.status = 'overdue' THEN
        -- O vencimento pode ser disparado automaticamente pelo sistema (auth.uid() pode ser nulo)
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'overdue', 'O chamado expirou (ficou atrasado)');
      ELSIF OLD.status = 'resolved' AND NEW.status != 'resolved' THEN
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'reopen', 'Reabriu o chamado');
      END IF;
    END IF;

    -- Se encaminhou o chamado (mudou o setor de destino)
    IF OLD.destination_department_id IS DISTINCT FROM NEW.destination_department_id AND NEW.destination_department_id IS NOT NULL THEN
      SELECT name INTO v_dept_name FROM public.departments WHERE id = NEW.destination_department_id;
      INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
      VALUES (
        NEW.id, 
        auth.uid(), 
        'forward', 
        'Encaminhou o chamado para o grupo ' || COALESCE(v_dept_name, 'Desconhecido')
      );
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Associar gatilho à tabela tickets
DROP TRIGGER IF EXISTS ticket_audit_trigger ON public.tickets;
CREATE TRIGGER ticket_audit_trigger
  AFTER INSERT OR UPDATE OF status, destination_department_id
  ON public.tickets
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_ticket_audit();

-- 3. Gatilho para monitorar inserção de custos
CREATE OR REPLACE FUNCTION public.handle_ticket_cost_audit()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
  VALUES (
    NEW.ticket_id, 
    auth.uid(), 
    'cost_added', 
    'Adicionou o custo: ' || NEW.description || ' (R$ ' || replace(to_char(NEW.value, 'FM9999990.00'), '.', ',') || ')'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Associar gatilho à tabela ticket_costs
DROP TRIGGER IF EXISTS ticket_cost_audit_trigger ON public.ticket_costs;
CREATE TRIGGER ticket_cost_audit_trigger
  AFTER INSERT
  ON public.ticket_costs
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_ticket_cost_audit();
