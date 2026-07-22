-- ============================================================
-- IMPORTAÇÃO DE MENSAGENS PENDENTES DO CHAMADO 771
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

DO $$
DECLARE
  v_ticket_id uuid;
  v_peter_id uuid;
  v_matheus_id uuid;
BEGIN
  -- 1. Buscar o ID do ticket 771
  SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = 771;
  
  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'Chamado 771 não foi localizado no banco de dados.';
  END IF;

  -- 2. Buscar os IDs dos perfis do Peter e do Matheus
  SELECT id INTO v_peter_id FROM public.profiles WHERE full_name ILIKE '%Peter Prudencio%' LIMIT 1;
  SELECT id INTO v_matheus_id FROM public.profiles WHERE full_name ILIKE '%Matheus Boseli%' LIMIT 1;

  IF v_peter_id IS NULL THEN
    RAISE EXCEPTION 'Perfil do usuário Peter Prudencio não foi localizado.';
  END IF;
  
  IF v_matheus_id IS NULL THEN
    RAISE EXCEPTION 'Perfil do usuário Matheus Boseli não foi localizado.';
  END IF;

  -- 3. Inserir as mensagens na tabela de histórico de chat (com data e fuso horário corretos)
  
  -- Mensagem 0
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (
    v_ticket_id, 
    v_peter_id, 
    'além disso, não veio a quantidade da segurança laje a concretar, nem da linha de vida', 
    '2026-07-16 17:29:00-03'::timestamptz
  );

  -- Mensagem 1
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (
    v_ticket_id, 
    v_matheus_id, 
    'Peter segurança laje a concretar vai ter sim. Quanto a linha de vida o Renato da Pacaembu pensa em colocar 04 ou seis postes da linha de vida fixando na forma, (ainda a definir) Quantidade dos acessorios esta no anexo.', 
    '2026-07-17 08:15:00-03'::timestamptz
  );

  -- Mensagem 2
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (
    v_ticket_id, 
    v_peter_id, 
    'Matheus, obrigado. Porém para executar o projeto preciso entender como será feito o sistema de linha de vida. Não enxergo como não será furada a laje. ', 
    '2026-07-17 09:01:00-03'::timestamptz
  );

  -- Mensagem 3
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (
    v_ticket_id, 
    v_peter_id, 
    'Outra coisa, no escopo está duas linhas de vida, mas são 4 ou 6?', 
    '2026-07-17 09:02:00-03'::timestamptz
  );

  -- Mensagem 4
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (
    v_ticket_id, 
    v_matheus_id, 
    'Iremos ter uma posição dia 20/07 das pendencias e volto a indormar o que foi definido.', 
    '2026-07-17 10:57:00-03'::timestamptz
  );

  -- Mensagem 5
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (
    v_ticket_id, 
    v_peter_id, 
    'Bom dia Matheus. Voces já tem a posição das pendencias?', 
    '2026-07-22 11:07:00-03'::timestamptz
  );

  -- Mensagem 6
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (
    v_ticket_id, 
    v_matheus_id, 
    'Apos contato do Paulo com o responsavel, ficaram de enviar fotos referencia de como será a linha de vida. Ainda no aguardo do mesmo.', 
    '2026-07-22 15:10:00-03'::timestamptz
  );

END $$;
