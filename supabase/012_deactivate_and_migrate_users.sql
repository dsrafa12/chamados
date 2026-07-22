-- ============================================================
-- SCRIPT DE DESVINCULAÇÃO E MIGRAÇÃO DOS CHAMADOS PARA NOVOS LOGINS
-- Cole este código no SQL Editor do seu Supabase Dashboard DEPOIS de criar os novos usuários no painel
-- ============================================================

DO $$
DECLARE
  v_old_id uuid;
  v_new_id uuid;
  r RECORD;
BEGIN
  -- Lista de mapeamento: [Nome do usuário novo], [E-mail antigo a ser desativado]
  FOR r IN 
    SELECT 'Lucimar' as name, 'almoxarifado@fundiferro.formas.com.br' as old_email UNION ALL
    SELECT 'Adriel', 'comercial@fundiferroformas.com.br' UNION ALL
    SELECT 'Matheus Boseli', 'comercial2@fundiferroformas.com.br' UNION ALL
    SELECT 'Silvana', 'compras@agropasi.com.br' UNION ALL
    SELECT 'Henrique', 'compras@fundiferroformas.com.br' UNION ALL
    SELECT 'Rodrigo', 'fundiferro@fundiferroformas.com.br'
  LOOP
    -- 1. Obter o ID do perfil antigo (pelo e-mail original)
    SELECT id INTO v_old_id FROM public.profiles WHERE email = r.old_email;

    -- 2. Obter o ID do perfil novo (pelo nome correspondente e e-mail diferente do antigo)
    SELECT id INTO v_new_id FROM public.profiles 
    WHERE full_name = r.name AND email <> r.old_email
    LIMIT 1;

    -- Se ambos os perfis forem localizados, migramos todo o histórico com segurança
    IF v_old_id IS NOT NULL AND v_new_id IS NOT NULL THEN
      -- Migrar os chamados criados
      UPDATE public.tickets SET created_by = v_new_id WHERE created_by = v_old_id;

      -- Migrar as mensagens do chat
      UPDATE public.ticket_messages SET profile_id = v_new_id WHERE profile_id = v_old_id;

      -- Migrar os custos criados
      UPDATE public.ticket_costs SET created_by = v_new_id WHERE created_by = v_old_id;

      -- Migrar a tabela pivot de colaboradores (evitando chaves duplicadas)
      DELETE FROM public.ticket_users WHERE profile_id = v_new_id AND ticket_id IN (
        SELECT ticket_id FROM public.ticket_users WHERE profile_id = v_old_id
      );
      UPDATE public.ticket_users SET profile_id = v_new_id WHERE profile_id = v_old_id;

      -- Migrar a tabela pivot de setores vinculados
      DELETE FROM public.profile_departments WHERE profile_id = v_new_id AND department_id IN (
        SELECT department_id FROM public.profile_departments WHERE profile_id = v_old_id
      );
      UPDATE public.profile_departments SET profile_id = v_new_id WHERE profile_id = v_old_id;

      -- 3. Desvincular o perfil antigo (desativa o acesso a chamados) e ativa o novo
      UPDATE public.profiles SET tickets_enabled = false WHERE id = v_old_id;
      UPDATE public.profiles SET tickets_enabled = true WHERE id = v_new_id;
    END IF;
  END LOOP;
END $$;
