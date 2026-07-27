-- ==============================================================================
-- MIGRAÇÃO 035: ANEXOS EM CHAMADOS, LIMPEZA AUTOMÁTICA EM 4 DIAS E ESTATÍSTICAS DO BANCO
-- ==============================================================================

-- 1. Garante a coluna resolved_at na tabela tickets para marcar a data exata de solução do chamado
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMP WITH TIME ZONE;

-- 2. Atualizar gatilho para preencher resolved_at quando o status for finalizado ou resolvido
CREATE OR REPLACE FUNCTION public.handle_ticket_resolved_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.status IN ('resolved', 'finalized') AND (OLD.status IS NULL OR OLD.status NOT IN ('resolved', 'finalized')) THEN
    NEW.resolved_at = NOW();
  ELSIF NEW.status NOT IN ('resolved', 'finalized') THEN
    NEW.resolved_at = NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_set_ticket_resolved_at ON public.tickets;
CREATE TRIGGER trg_set_ticket_resolved_at
BEFORE UPDATE ON public.tickets
FOR EACH ROW
EXECUTE FUNCTION public.handle_ticket_resolved_timestamp();

-- 3. Criar a tabela de Metadados de Anexos
CREATE TABLE IF NOT EXISTS public.ticket_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  uploaded_by UUID NOT NULL REFERENCES public.profiles(id),
  file_name TEXT NOT NULL,
  file_path TEXT NOT NULL,
  file_size INTEGER NOT NULL,
  mime_type TEXT NOT NULL,
  is_expired BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS na tabela ticket_attachments
ALTER TABLE public.ticket_attachments ENABLE ROW LEVEL SECURITY;

-- Política de Leitura/Seleção: Usuários podem ver anexos dos chamados aos quais têm acesso
CREATE POLICY "ticket_attachments_select" ON public.ticket_attachments
FOR SELECT USING (
  EXISTS (
    SELECT 1 FROM public.tickets t
    WHERE t.id = ticket_attachments.ticket_id
  )
);

-- Política de Inserção: Usuários autenticados podem subir anexos
CREATE POLICY "ticket_attachments_insert" ON public.ticket_attachments
FOR INSERT WITH CHECK (auth.uid() = uploaded_by);

-- 4. Bucket de Armazenamento do Supabase Storage
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'ticket-attachments', 
  'ticket-attachments', 
  true, 
  5242880, -- 5 MB máximo por arquivo
  ARRAY[
    'image/png', 'image/jpeg', 'image/jpg', 'image/webp', 'image/gif',
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document', -- docx
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', -- xlsx
    'text/plain'
  ]
)
ON CONFLICT (id) DO UPDATE SET 
  file_size_limit = 5242880,
  public = true;

-- Políticas de RLS no Storage Bucket
CREATE POLICY "Allow Public Read on Ticket Attachments"
ON storage.objects FOR SELECT
USING (bucket_id = 'ticket-attachments');

CREATE POLICY "Allow Authenticated Upload on Ticket Attachments"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'ticket-attachments' AND auth.role() = 'authenticated');

CREATE POLICY "Allow Authenticated Delete on Ticket Attachments"
ON storage.objects FOR DELETE
USING (bucket_id = 'ticket-attachments' AND auth.role() = 'authenticated');

-- 5. Função de Limpeza Automática dos Anexos (Chamados resolvidos há mais de 4 dias)
CREATE OR REPLACE FUNCTION public.delete_expired_ticket_attachments()
RETURNS TABLE (deleted_count INTEGER, freed_bytes BIGINT) AS $$
DECLARE
  v_count INTEGER := 0;
  v_bytes BIGINT := 0;
  r RECORD;
BEGIN
  -- Seleciona anexos de chamados finalizados/resolvidos há mais de 4 dias que ainda não foram expirados
  FOR r IN 
    SELECT a.id, a.file_path, a.file_size
    FROM public.ticket_attachments a
    JOIN public.tickets t ON t.id = a.ticket_id
    WHERE t.resolved_at IS NOT NULL 
      AND t.resolved_at < (NOW() - INTERVAL '4 days')
      AND a.is_expired = FALSE
  LOOP
    -- Apagar o arquivo da tabela storage.objects
    DELETE FROM storage.objects WHERE bucket_id = 'ticket-attachments' AND name = r.file_path;
    
    -- Marcar o anexo como expirado no banco
    UPDATE public.ticket_attachments 
    SET is_expired = TRUE 
    WHERE id = r.id;

    v_count := v_count + 1;
    v_bytes := v_bytes + r.file_size;
  END LOOP;

  RETURN QUERY SELECT v_count, v_bytes;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 6. Função RPC para Obter Estatísticas do Banco de Dados para o Superadmin (ds.rafa@hotmail.com)
CREATE OR REPLACE FUNCTION public.get_database_admin_stats()
RETURNS JSON AS $$
DECLARE
  v_caller_email TEXT;
  v_total_attachments_count BIGINT;
  v_total_attachments_bytes BIGINT;
  v_active_attachments_count BIGINT;
  v_expired_attachments_count BIGINT;
  v_tickets_count BIGINT;
  v_messages_count BIGINT;
  v_history_count BIGINT;
  v_profiles_count BIGINT;
BEGIN
  -- Verificar se o chamador é o superadmin ds.rafa@hotmail.com
  SELECT email INTO v_caller_email FROM public.profiles WHERE id = auth.uid();
  IF v_caller_email IS DISTINCT FROM 'ds.rafa@hotmail.com' THEN
    RAISE EXCEPTION 'Acesso negado: apenas o superadmin pode consultar estatísticas do banco.';
  END IF;

  -- Contagens de Anexos
  SELECT COUNT(*), COALESCE(SUM(file_size), 0) INTO v_total_attachments_count, v_total_attachments_bytes 
  FROM public.ticket_attachments;

  SELECT COUNT(*) INTO v_active_attachments_count 
  FROM public.ticket_attachments WHERE is_expired = FALSE;

  SELECT COUNT(*) INTO v_expired_attachments_count 
  FROM public.ticket_attachments WHERE is_expired = TRUE;

  -- Contagens de Registros de Tabelas
  SELECT COUNT(*) INTO v_tickets_count FROM public.tickets;
  SELECT COUNT(*) INTO v_messages_count FROM public.ticket_messages;
  SELECT COUNT(*) INTO v_history_count FROM public.ticket_history;
  SELECT COUNT(*) INTO v_profiles_count FROM public.profiles;

  RETURN json_build_object(
    'total_attachments_count', v_total_attachments_count,
    'total_attachments_bytes', v_total_attachments_bytes,
    'active_attachments_count', v_active_attachments_count,
    'expired_attachments_count', v_expired_attachments_count,
    'tickets_count', v_tickets_count,
    'messages_count', v_messages_count,
    'history_count', v_history_count,
    'profiles_count', v_profiles_count,
    'storage_limit_mb', 500,
    'database_limit_mb', 500
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
