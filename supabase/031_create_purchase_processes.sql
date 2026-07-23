-- ============================================================
-- MIGRAÇÃO 031: Módulo de Processos de Compra
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

-- 1. Ampliar a restrição (constraint) de status na tabela tickets
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check CHECK (status IN (
  'open', 'in_progress', 'resolved', 'overdue',
  'awaiting_start', 'in_analysis', 'awaiting_info', 'in_quotation', 'in_approval', 
  'order_issued', 'awaiting_supplier', 'awaiting_receipt', 'finalized', 'cancelled'
));

-- 2. Criar a tabela de processos de compra
CREATE TABLE IF NOT EXISTS public.purchase_processes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid NOT NULL UNIQUE REFERENCES public.tickets(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'awaiting_start' CHECK (status IN (
    'awaiting_start', 'in_analysis', 'awaiting_info', 'in_quotation', 'in_approval', 
    'order_issued', 'awaiting_supplier', 'awaiting_receipt', 'finalized', 'cancelled'
  )),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.purchase_processes ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de RLS para processos de compra
-- SELECT: Qualquer usuário que possa visualizar o chamado correspondente
DROP POLICY IF EXISTS "Visualizar processos de compra permitidos" ON public.purchase_processes;
CREATE POLICY "Visualizar processos de compra permitidos" ON public.purchase_processes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = purchase_processes.ticket_id
    )
  );

-- ALL (inserir, atualizar, deletar): Somente usuários do departamento de Compras ou Diretores
DROP POLICY IF EXISTS "Gerenciar processos de compra" ON public.purchase_processes;
CREATE POLICY "Gerenciar processos de compra" ON public.purchase_processes
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profile_departments pd
      JOIN public.departments d ON pd.department_id = d.id
      WHERE pd.profile_id = auth.uid()
      AND lower(d.name) = 'compras'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'director'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profile_departments pd
      JOIN public.departments d ON pd.department_id = d.id
      WHERE pd.profile_id = auth.uid()
      AND lower(d.name) = 'compras'
    )
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'director'
    )
  );

-- 4. Função e Gatilho para sincronizar o status do processo de compra com o chamado
CREATE OR REPLACE FUNCTION public.sync_purchase_process_status_to_ticket()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.tickets
  SET status = NEW.status
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS purchase_process_status_sync_trigger ON public.purchase_processes;
CREATE TRIGGER purchase_process_status_sync_trigger
  AFTER INSERT OR UPDATE OF status
  ON public.purchase_processes
  FOR EACH ROW
  EXECUTE FUNCTION public.sync_purchase_process_status_to_ticket();

-- 5. Atualizar a função de auditoria para capturar e registrar os novos status de compras
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
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'overdue', 'O chamado expirou (ficou atrasado)');
      ELSIF OLD.status = 'resolved' AND NEW.status != 'resolved' AND NEW.status NOT IN ('finalized', 'cancelled') THEN
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'reopen', 'Reabriu o chamado');
      
      -- Novos status do processo de compra
      ELSIF NEW.status = 'awaiting_start' THEN
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'purchase_status', 'Alterou o status do processo de compra para: Gerado Processo de Compra');
      ELSIF NEW.status = 'in_analysis' THEN
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'purchase_status', 'Alterou o status do processo de compra para: Em Análise');
      ELSIF NEW.status = 'awaiting_info' THEN
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'purchase_status', 'Alterou o status do processo de compra para: Aguardando Informações');
      ELSIF NEW.status = 'in_quotation' THEN
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'purchase_status', 'Alterou o status do processo de compra para: Em Cotação');
      ELSIF NEW.status = 'in_approval' THEN
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'purchase_status', 'Alterou o status do processo de compra para: Em Aprovação');
      ELSIF NEW.status = 'order_issued' THEN
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'purchase_status', 'Alterou o status do processo de compra para: Pedido Emitido');
      ELSIF NEW.status = 'awaiting_supplier' THEN
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'purchase_status', 'Alterou o status do processo de compra para: Aguardando Fornecedor');
      ELSIF NEW.status = 'awaiting_receipt' THEN
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'purchase_status', 'Alterou o status do processo de compra para: Aguardando Recebimento');
      ELSIF NEW.status = 'finalized' THEN
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'purchase_status', 'Finalizou o processo de compra');
      ELSIF NEW.status = 'cancelled' THEN
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'purchase_status', 'Cancelou o processo de compra');
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
