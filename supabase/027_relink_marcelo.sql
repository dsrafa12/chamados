-- ============================================================
-- MIGRAÇÃO: Reatrelar chamados do Marcelo Kanesaki antigo para o novo
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

DO $$
DECLARE
  v_old_id uuid;
  v_new_id uuid;
BEGIN
  -- 1. Obter o UUID do usuário antigo por email
  SELECT id INTO v_old_id FROM auth.users WHERE email = 'pcp2@fundiferroformas.com.br';
  
  -- 2. Obter o UUID do novo usuário por email
  SELECT id INTO v_new_id FROM auth.users WHERE email = 'marcelok@fundiferro.local';

  IF v_old_id IS NULL THEN
    RAISE NOTICE 'Usuário antigo pcp2@fundiferroformas.com.br não encontrado em auth.users.';
  ELSIF v_new_id IS NULL THEN
    RAISE NOTICE 'Novo usuário marcelok@fundiferro.local não encontrado em auth.users.';
  ELSE
    RAISE NOTICE 'Reatrelando registros de % para %', v_old_id, v_new_id;

    -- 3. Atualizar criador dos chamados (tickets)
    UPDATE public.tickets
    SET created_by = v_new_id
    WHERE created_by = v_old_id;

    -- 4. Atualizar tabela de colaboradores atrelados (ticket_users)
    -- Previne erro de chave duplicada se o novo usuário já estiver no mesmo chamado
    DELETE FROM public.ticket_users
    WHERE profile_id = v_old_id
      AND ticket_id IN (
        SELECT ticket_id FROM public.ticket_users WHERE profile_id = v_new_id
      );

    UPDATE public.ticket_users
    SET profile_id = v_new_id
    WHERE profile_id = v_old_id;

    -- 5. Atualizar mensagens do chat (ticket_messages)
    UPDATE public.ticket_messages
    SET profile_id = v_new_id
    WHERE profile_id = v_old_id;

    -- 6. Atualizar autoria de custos (ticket_costs)
    UPDATE public.ticket_costs
    SET created_by = v_new_id
    WHERE created_by = v_old_id;

    -- 7. Atualizar histórico de chamados (ticket_history)
    UPDATE public.ticket_history
    SET profile_id = v_new_id
    WHERE profile_id = v_old_id;

    -- 8. Desativar perfil antigo para novos chamados
    UPDATE public.profiles
    SET tickets_enabled = false
    WHERE id = v_old_id;

    RAISE NOTICE 'Reatrelamento concluído com sucesso!';
  END IF;
END $$;
