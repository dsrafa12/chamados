-- ============================================================
-- MIGRAÇÃO 037: Adicionar status Compra Recebida (purchase_received)
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

-- 1. Ampliar a restrição (constraint) de status na tabela tickets para incluir 'purchase_received'
ALTER TABLE public.tickets DROP CONSTRAINT IF EXISTS tickets_status_check;
ALTER TABLE public.tickets ADD CONSTRAINT tickets_status_check CHECK (status IN (
  'open', 'in_progress', 'resolved', 'overdue',
  'awaiting_start', 'in_analysis', 'awaiting_info', 'in_quotation', 'in_approval', 
  'order_issued', 'awaiting_supplier', 'awaiting_receipt', 'finalized', 'cancelled',
  'reopened', 'received_partial', 'purchase_received'
));

-- 2. Atualizar a função de auditoria para capturar o status 'purchase_received'
CREATE OR REPLACE FUNCTION public.handle_ticket_audit()
RETURNS TRIGGER AS $$
DECLARE
  v_dept_name text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
    VALUES (NEW.id, NEW.created_by, 'create', 'Criou o chamado');

  ELSIF TG_OP = 'UPDATE' THEN
    
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
      ELSIF NEW.status = 'received_partial' THEN
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'purchase_status', 'Alterou o status do processo de compra para: Recebido Parcial');
      ELSIF NEW.status = 'purchase_received' THEN
        INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
        VALUES (NEW.id, auth.uid(), 'purchase_status', 'Alterou o status do chamado para: Compra Recebida');
      END IF;
    END IF;

    IF OLD.destination_department_id IS DISTINCT FROM NEW.destination_department_id AND NEW.destination_department_id IS NOT NULL THEN
      SELECT name INTO v_dept_name FROM public.departments WHERE id = NEW.destination_department_id;
      INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
      VALUES (NEW.id, auth.uid(), 'forward', 'Encaminhou o chamado para o grupo ' || COALESCE(v_dept_name, 'Desconhecido'));
    END IF;

  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. Atualizar o gatilho de notificações automáticas para reconhecer 'purchase_received'
CREATE OR REPLACE FUNCTION public.handle_status_change_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_status_label TEXT;
  v_type TEXT := 'status_change';
  rec RECORD;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;

  -- Mapear label legível do status
  CASE NEW.status
    WHEN 'open' THEN v_status_label := 'Aberto';
    WHEN 'in_progress' THEN v_status_label := 'Em Andamento';
    WHEN 'overdue' THEN v_status_label := 'Atrasado';
    WHEN 'awaiting_start' THEN v_status_label := 'Gerado Processo de Compra';
    WHEN 'in_analysis' THEN v_status_label := 'Em Análise';
    WHEN 'awaiting_info' THEN v_status_label := 'Aguardando Informações';
    WHEN 'in_quotation' THEN v_status_label := 'Em Cotação';
    WHEN 'in_approval' THEN v_status_label := 'Em Aprovação';
    WHEN 'order_issued' THEN v_status_label := 'Pedido Emitido';
    WHEN 'awaiting_supplier' THEN v_status_label := 'Aguardando Fornecedor';
    WHEN 'awaiting_receipt' THEN v_status_label := 'Aguardando Recebimento';
    WHEN 'received_partial' THEN v_status_label := 'Recebido Parcial';
    WHEN 'purchase_received' THEN v_status_label := 'Compra Recebida';
    WHEN 'resolved' THEN v_status_label := 'Resolvido'; v_type := 'ticket_resolved';
    WHEN 'finalized' THEN v_status_label := 'Finalizado'; v_type := 'ticket_resolved';
    WHEN 'cancelled' THEN v_status_label := 'Cancelado';
    WHEN 'reopened' THEN v_status_label := 'Reaberto';
    ELSE v_status_label := NEW.status;
  END CASE;

  -- Notificar o criador do chamado (autor)
  IF NEW.created_by IS NOT NULL THEN
    INSERT INTO public.notifications (user_id, ticket_id, title, message, type)
    VALUES (
      NEW.created_by,
      NEW.id,
      CASE WHEN v_type = 'ticket_resolved' THEN 'Chamado Encerrado' ELSE 'Alteração de Status' END,
      CASE 
        WHEN v_type = 'ticket_resolved' THEN '✅ Chamado Nº ' || COALESCE(NEW.ticket_number::text, 'S/N') || ' foi encerrado como ' || v_status_label || '.'
        ELSE '🔄 Alteração de Status para **' || v_status_label || '** do Chamado Nº ' || COALESCE(NEW.ticket_number::text, 'S/N') || ' que você é autor.'
      END,
      v_type
    );
  END IF;

  -- Notificar colaboradores atrelados ao chamado (exceto o autor já notificado)
  FOR rec IN 
    SELECT tu.profile_id AS user_id 
    FROM public.ticket_users tu 
    WHERE tu.ticket_id = NEW.id 
      AND tu.profile_id != NEW.created_by
  LOOP
    INSERT INTO public.notifications (user_id, ticket_id, title, message, type)
    VALUES (
      rec.user_id,
      NEW.id,
      CASE WHEN v_type = 'ticket_resolved' THEN 'Chamado Encerrado' ELSE 'Alteração de Status' END,
      CASE 
        WHEN v_type = 'ticket_resolved' THEN '✅ Chamado Nº ' || COALESCE(NEW.ticket_number::text, 'S/N') || ' foi encerrado.'
        ELSE '🔄 Alteração de Status para **' || v_status_label || '** do Chamado Nº ' || COALESCE(NEW.ticket_number::text, 'S/N') || ' que você está atrelado.'
      END,
      v_type
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 4. Impedir que a finalização do processo de compra sobrescreva o status do chamado
CREATE OR REPLACE FUNCTION public.sync_purchase_process_status_to_ticket()
RETURNS TRIGGER AS $$
BEGIN
  -- Se o processo de compra for encerrado (finalized), NÃO muda o status do chamado para finalized
  IF NEW.status = 'finalized' THEN
    RETURN NEW;
  END IF;

  UPDATE public.tickets
  SET status = NEW.status
  WHERE id = NEW.ticket_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 5. Função RPC com privilégio SECURITY DEFINER para remover com segurança os integrantes do setor de Compras
CREATE OR REPLACE FUNCTION public.remove_compras_collaborators(p_ticket_id UUID)
RETURNS VOID AS $$
DECLARE
  v_compras_dept_id UUID;
BEGIN
  -- Obter o ID do departamento 'Compras'
  SELECT id INTO v_compras_dept_id 
  FROM public.departments 
  WHERE lower(trim(name)) = 'compras' 
  LIMIT 1;

  IF v_compras_dept_id IS NULL THEN
    RETURN;
  END IF;

  -- Deletar da tabela ticket_users todos os usuários associados ao departamento de Compras (como primário ou secundário)
  DELETE FROM public.ticket_users
  WHERE ticket_id = p_ticket_id
    AND profile_id IN (
      SELECT p.id 
      FROM public.profiles p
      LEFT JOIN public.profile_departments pd ON pd.profile_id = p.id
      WHERE p.department_id = v_compras_dept_id 
         OR pd.department_id = v_compras_dept_id
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
