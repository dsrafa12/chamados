-- ==============================================================================
-- MIGRAÇÃO 036: SISTEMA DE NOTIFICAÇÕES E ALERTAS AUTOMÁTICOS
-- ==============================================================================

-- 1. Criar Tabela de Notificações
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  message TEXT NOT NULL,
  type TEXT NOT NULL, -- 'chat_message', 'status_change', 'ticket_resolved', 'collaborator_added'
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS na tabela de notificações
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Política RLS: Usuários só podem visualizar e manipular suas próprias notificações
CREATE POLICY "notifications_select_policy" ON public.notifications
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "notifications_update_policy" ON public.notifications
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "notifications_insert_policy" ON public.notifications
FOR INSERT WITH CHECK (true);

-- 2. Gatilho para Gerar Notificação quando uma Nova Mensagem é enviada no Chat
CREATE OR REPLACE FUNCTION public.handle_new_message_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_ticket RECORD;
  v_sender_name TEXT;
  rec RECORD;
BEGIN
  -- Obter detalhes do chamado
  SELECT id, ticket_number, title, created_by INTO v_ticket FROM public.tickets WHERE id = NEW.ticket_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Obter nome do remetente
  SELECT full_name INTO v_sender_name FROM public.profiles WHERE id = NEW.sender_id;
  v_sender_name := COALESCE(v_sender_name, 'Um usuário');

  -- Notificar o criador do chamado (se não foi ele quem enviou)
  IF v_ticket.created_by IS NOT NULL AND v_ticket.created_by != NEW.sender_id THEN
    INSERT INTO public.notifications (user_id, ticket_id, title, message, type)
    VALUES (
      v_ticket.created_by,
      v_ticket.id,
      'Nova Mensagem',
      '💬 ' || v_sender_name || ' enviou uma nova mensagem no Chamado Nº ' || COALESCE(v_ticket.ticket_number::text, 'S/N') || ' que você é autor.',
      'chat_message'
    );
  END IF;

  -- Notificar todos os colaboradores atrelados (exceto quem enviou e o criador já notificado)
  FOR rec IN 
    SELECT tu.user_id 
    FROM public.ticket_users tu 
    WHERE tu.ticket_id = NEW.ticket_id 
      AND tu.user_id != NEW.sender_id 
      AND tu.user_id != v_ticket.created_by
  LOOP
    INSERT INTO public.notifications (user_id, ticket_id, title, message, type)
    VALUES (
      rec.user_id,
      v_ticket.id,
      'Nova Mensagem',
      '💬 ' || v_sender_name || ' enviou uma nova mensagem no Chamado Nº ' || COALESCE(v_ticket.ticket_number::text, 'S/N') || ' que você está atrelado.',
      'chat_message'
    );
  END LOOP;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_new_message_notification ON public.ticket_messages;
CREATE TRIGGER trg_new_message_notification
AFTER INSERT ON public.ticket_messages
FOR EACH ROW
EXECUTE FUNCTION public.handle_new_message_notification();

-- 3. Gatilho para Gerar Notificação em Alterações de Status do Chamado
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
    WHEN 'awaiting_start' THEN v_status_label := 'Gerado Processo de Compra';
    WHEN 'in_analysis' THEN v_status_label := 'Em Análise';
    WHEN 'awaiting_info' THEN v_status_label := 'Aguardando Informações';
    WHEN 'in_quotation' THEN v_status_label := 'Em Cotação';
    WHEN 'in_approval' THEN v_status_label := 'Em Aprovação';
    WHEN 'order_issued' THEN v_status_label := 'Pedido Emitido';
    WHEN 'awaiting_supplier' THEN v_status_label := 'Aguardando Fornecedor';
    WHEN 'awaiting_receipt' THEN v_status_label := 'Aguardando Recebimento';
    WHEN 'received_partial' THEN v_status_label := 'Recebido Parcial';
    WHEN 'resolved' THEN v_status_label := 'Resolvido'; v_type := 'ticket_resolved';
    WHEN 'finalized' THEN v_status_label := 'Finalizado'; v_type := 'ticket_resolved';
    WHEN 'cancelled' THEN v_status_label := 'Cancelado';
    WHEN 'reopened' THEN v_status_label := 'Reaberto';
    WHEN 'in_progress' THEN v_status_label := 'Em Atendimento';
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
    SELECT tu.user_id 
    FROM public.ticket_users tu 
    WHERE tu.ticket_id = NEW.id 
      AND tu.user_id != NEW.created_by
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

DROP TRIGGER IF EXISTS trg_status_change_notification ON public.tickets;
CREATE TRIGGER trg_status_change_notification
AFTER UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.handle_status_change_notification();

-- 4. Gatilho para Notificar quando um Colaborador é Atrelado ao Chamado
CREATE OR REPLACE FUNCTION public.handle_collaborator_added_notification()
RETURNS TRIGGER AS $$
DECLARE
  v_ticket RECORD;
BEGIN
  SELECT id, ticket_number, title INTO v_ticket FROM public.tickets WHERE id = NEW.ticket_id;
  IF NOT FOUND THEN RETURN NEW; END IF;

  INSERT INTO public.notifications (user_id, ticket_id, title, message, type)
  VALUES (
    NEW.user_id,
    v_ticket.id,
    'Novo Atrelamento',
    '👤 Você foi atrelado ao Chamado Nº ' || COALESCE(v_ticket.ticket_number::text, 'S/N') || ' (' || v_ticket.title || ').',
    'collaborator_added'
  );

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_collaborator_added_notification ON public.ticket_users;
CREATE TRIGGER trg_collaborator_added_notification
AFTER INSERT ON public.ticket_users
FOR EACH ROW
EXECUTE FUNCTION public.handle_collaborator_added_notification();
