-- ============================================================
-- MIGRAÇÃO 032: Adicionar status Reaberto
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

-- 1. Ampliar a restrição (constraint) de status na tabela tickets para incluir 'reopened'
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check CHECK (status IN (
  'open', 'in_progress', 'resolved', 'overdue',
  'awaiting_start', 'in_analysis', 'awaiting_info', 'in_quotation', 'in_approval', 
  'order_issued', 'awaiting_supplier', 'awaiting_receipt', 'finalized', 'cancelled',
  'reopened'
));

-- 2. Atualizar a função de auditoria para capturar e registrar o status 'reopened'
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
      ELSIF NEW.status = 'reopened' THEN
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'reopen', 'Reabriu o chamado');
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
      VALUES (NEW.id, auth.uid(), 'forward', 'Encaminhou o chamado para o grupo ' || COALESCE(v_dept_name, 'Desconhecido'));
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
