-- ============================================================
-- SCRIPT DE IMPORTAÇÃO DE CHAMADOS DO FIREBASE PARA SUPABASE (PARTE 3)
-- Execute este script no SQL Editor do seu Supabase Dashboard
-- ============================================================

-- 1. Criar a função auxiliar temporária para obter ou criar usuários de forma segura com senha crypt('123456')
DROP FUNCTION IF EXISTS public.get_or_create_user(text, text, text);

CREATE FUNCTION public.get_or_create_user(p_full_name text, p_email text, p_dept_name text)
RETURNS uuid AS $$
DECLARE
  v_user_id uuid;
  v_dept_id uuid;
BEGIN
  -- Buscar ou criar o setor
  SELECT id INTO v_dept_id FROM public.departments WHERE name = p_dept_name LIMIT 1;
  IF v_dept_id IS NULL THEN
    INSERT INTO public.departments (name) VALUES (p_dept_name) RETURNING id INTO v_dept_id;
  END IF;

  -- 1. Buscar o ID do usuário pelo e-mail na auth.users
  SELECT id INTO v_user_id FROM auth.users WHERE email = p_email LIMIT 1;
  
  -- 2. Se não existir, criar o usuário no auth.users com a senha padrão '123456'
  IF v_user_id IS NULL THEN
    v_user_id := gen_random_uuid();
    
    INSERT INTO auth.users (
      id, instance_id, email, encrypted_password, email_confirmed_at, 
      raw_app_meta_data, raw_user_meta_data, created_at, updated_at, 
      role, aud, confirmation_token
    )
    VALUES (
      v_user_id,
      '00000000-0000-0000-0000-000000000000',
      p_email,
      crypt('123456', gen_salt('bf')), -- Senha padronizada 123456 criptografada
      now(),
      '{"provider":"email","providers":["email"]}',
      jsonb_build_object('full_name', p_full_name),
      now(),
      now(),
      'authenticated',
      'authenticated',
      ''
    );
  END IF;

  -- 3. Garantir que o perfil exista na public.profiles
  INSERT INTO public.profiles (id, full_name, email, role, department_id, tickets_enabled)
  VALUES (v_user_id, p_full_name, p_email, 'user', v_dept_id, true)
  ON CONFLICT (id) DO UPDATE
  SET full_name = EXCLUDED.full_name,
      email = EXCLUDED.email,
      department_id = COALESCE(profiles.department_id, EXCLUDED.department_id);

  RETURN v_user_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 2. Garantir que o grupo 'Manutenção' exista antes de rodar os inserts
INSERT INTO public.departments (name) VALUES ('Manutenção') ON CONFLICT (name) DO NOTHING;


-- CHAMADO SEQUENCIAL #803
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');

  -- Verificar se já existe chamado com este número
  SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = 803 LIMIT 1;

  IF v_ticket_id IS NOT NULL THEN
    -- Atualizar status e descrição do chamado existente
    UPDATE public.tickets 
    SET status = 'in_progress',
        description = '10 ROLAMENTO 607 2RS PRIMEIRA LINHA MAQUINA PARADA'
    WHERE id = v_ticket_id;
  ELSE
    -- Inserir ticket novo
    INSERT INTO public.tickets (
      title,
      description,
      priority,
      status,
      created_by,
      origin_department_id,
      destination_department_id,
      ticket_number,
      created_at
    ) VALUES (
      'SERRA PARADA',
      '10 ROLAMENTO 607 2RS PRIMEIRA LINHA MAQUINA PARADA',
      'high',
      'in_progress', -- Importados com status "Em Atendimento" (in_progress)
      v_creator_id,
      COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Ferramentaria' LIMIT 1)),
      (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
      803,
      '2026-07-22 10:53:50-03'::timestamptz
    ) RETURNING id INTO v_ticket_id;

    -- Adicionar visibilidade para o criador
    INSERT INTO public.ticket_users (ticket_id, profile_id)
    VALUES (v_ticket_id, v_creator_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Status em Andamento -'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Status em Andamento -', '2026-07-22 11:51:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'já em cotação'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'já em cotação', '2026-07-22 11:51:00-03'::timestamptz);
  END IF;

END $$;

-- CHAMADO SEQUENCIAL #801
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Matheus Boseli', 'comercial2@fundiferroformas.com.br', 'Engenharia');

  -- Verificar se já existe chamado com este número
  SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = 801 LIMIT 1;

  IF v_ticket_id IS NOT NULL THEN
    -- Atualizar status e descrição do chamado existente
    UPDATE public.tickets 
    SET status = 'in_progress',
        description = 'Precisamos de uma posição sobre a compra das canetas da feira, ela precisa estar na empresa até 05/08 pois será o dia que o Luciano ira sair para a feira levando a forma e itens que iremos expor.'
    WHERE id = v_ticket_id;
  ELSE
    -- Inserir ticket novo
    INSERT INTO public.tickets (
      title,
      description,
      priority,
      status,
      created_by,
      origin_department_id,
      destination_department_id,
      ticket_number,
      created_at
    ) VALUES (
      'Compras Caneta Feira',
      'Precisamos de uma posição sobre a compra das canetas da feira, ela precisa estar na empresa até 05/08 pois será o dia que o Luciano ira sair para a feira levando a forma e itens que iremos expor.',
      'high',
      'in_progress', -- Importados com status "Em Atendimento" (in_progress)
      v_creator_id,
      COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Engenharia' LIMIT 1)),
      (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
      801,
      '2026-07-22 09:50:10-03'::timestamptz
    ) RETURNING id INTO v_ticket_id;

    -- Adicionar visibilidade para o criador
    INSERT INTO public.ticket_users (ticket_id, profile_id)
    VALUES (v_ticket_id, v_creator_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mensagem de Silvana
  v_msg_user_id := public.get_or_create_user('Silvana', 'compras@agropasi.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Estarei dando andamento no processo, pretendo finalizar o processo ainda hoje'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Estarei dando andamento no processo, pretendo finalizar o processo ainda hoje', '2026-07-22 10:50:00-03'::timestamptz);
  END IF;

  -- Mensagem de Silvana
  v_msg_user_id := public.get_or_create_user('Silvana', 'compras@agropasi.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Status em Andamento -'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Status em Andamento -', '2026-07-22 10:50:00-03'::timestamptz);
  END IF;

END $$;

-- CHAMADO SEQUENCIAL #732
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Marcelo kanesaki', 'pcp2@fundiferroformas.com.br', 'Qualidade');

  -- Verificar se já existe chamado com este número
  SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = 732 LIMIT 1;

  IF v_ticket_id IS NOT NULL THEN
    -- Atualizar status e descrição do chamado existente
    UPDATE public.tickets 
    SET status = 'in_progress',
        description = ' SEGUE ANEXO, PEDIDO COM PRIORIDADE PARA PRODUÇÃO DO MES DE JULHO 26... JÁ ESTA COMPROMETENDO A PRODUÇÃO... '
    WHERE id = v_ticket_id;
  ELSE
    -- Inserir ticket novo
    INSERT INTO public.tickets (
      title,
      description,
      priority,
      status,
      created_by,
      origin_department_id,
      destination_department_id,
      ticket_number,
      created_at
    ) VALUES (
      'MATERIAL ALUMINIO - JULHO 2026',
      ' SEGUE ANEXO, PEDIDO COM PRIORIDADE PARA PRODUÇÃO DO MES DE JULHO 26... JÁ ESTA COMPROMETENDO A PRODUÇÃO... ',
      'high',
      'in_progress', -- Importados com status "Em Atendimento" (in_progress)
      v_creator_id,
      COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Qualidade' LIMIT 1)),
      (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
      732,
      '2026-07-15 10:20:48-03'::timestamptz
    ) RETURNING id INTO v_ticket_id;

    -- Adicionar visibilidade para o criador
    INSERT INTO public.ticket_users (ticket_id, profile_id)
    VALUES (v_ticket_id, v_creator_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Status em Andamento -'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Status em Andamento -', '2026-07-15 11:57:00-03'::timestamptz);
  END IF;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Tinti , vc tem posição ?'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Tinti , vc tem posição ?', '2026-07-15 11:57:00-03'::timestamptz);
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Até as 14h tenho retorno da Barraforte para falarmos'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Até as 14h tenho retorno da Barraforte para falarmos', '2026-07-15 11:58:00-03'::timestamptz);
  END IF;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Tinti , precisa de posição urgente'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Tinti , precisa de posição urgente', '2026-07-15 12:21:00-03'::timestamptz);
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Sim, estou pressionando a Barraforte, acabei de cobrar mais uma vez o retorno, disse que temos reunião as 14h e preciso dessa posição até esse horário.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Sim, estou pressionando a Barraforte, acabei de cobrar mais uma vez o retorno, disse que temos reunião as 14h e preciso dessa posição até esse horário.', '2026-07-15 13:48:00-03'::timestamptz);
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Retorno recebido, precisamos nos reunir emergencialmente para dividir as informações'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Retorno recebido, precisamos nos reunir emergencialmente para dividir as informações', '2026-07-15 14:15:00-03'::timestamptz);
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Atualizando esse tema, cancelamos toda a programação em aberto e em atraso, mantendo apenas os itens abaixo que realmente serão necessários para Julho. PF-1509 - 4ton - ferramenta deu problema, previsão da Barraforte receber da limpeza 22/07 e colocar em produção novamente. PF-6509 - aguardando hoje nova atualização da Barraforte.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Atualizando esse tema, cancelamos toda a programação em aberto e em atraso, mantendo apenas os itens abaixo que realmente serão necessários para Julho. PF-1509 - 4ton - ferramenta deu problema, previsão da Barraforte receber da limpeza 22/07 e colocar em produção novamente. PF-6509 - aguardando hoje nova atualização da Barraforte.', '2026-07-21 08:52:00-03'::timestamptz);
  END IF;

END $$;

-- CHAMADO SEQUENCIAL #736
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Marcelo kanesaki', 'pcp2@fundiferroformas.com.br', 'Qualidade');

  -- Verificar se já existe chamado com este número
  SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = 736 LIMIT 1;

  IF v_ticket_id IS NOT NULL THEN
    -- Atualizar status e descrição do chamado existente
    UPDATE public.tickets 
    SET status = 'in_progress',
        description = ' INICIALMENTE PRECISAMOS A AQUISIÇÃO DE 05 APAERELHOS.; 2 - TABLET PARA CONFERENCIA DE EXPEDIÇÃO-ROMANEIO/ACESSORIO E FORMA (BOA QUALIDADE) 2- TABLET PARA SUBSTITUIR OS DA EMPILHADEIRA (BOA QUALIDADE) 1- TABLET PRÉ MONTAGEM.(BOA QUALIDADE)'
    WHERE id = v_ticket_id;
  ELSE
    -- Inserir ticket novo
    INSERT INTO public.tickets (
      title,
      description,
      priority,
      status,
      created_by,
      origin_department_id,
      destination_department_id,
      ticket_number,
      created_at
    ) VALUES (
      'TABLET - PRODUÇÃO',
      ' INICIALMENTE PRECISAMOS A AQUISIÇÃO DE 05 APAERELHOS.; 2 - TABLET PARA CONFERENCIA DE EXPEDIÇÃO-ROMANEIO/ACESSORIO E FORMA (BOA QUALIDADE) 2- TABLET PARA SUBSTITUIR OS DA EMPILHADEIRA (BOA QUALIDADE) 1- TABLET PRÉ MONTAGEM.(BOA QUALIDADE)',
      'medium',
      'in_progress', -- Importados com status "Em Atendimento" (in_progress)
      v_creator_id,
      COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Qualidade' LIMIT 1)),
      (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
      736,
      '2026-07-15 12:56:52-03'::timestamptz
    ) RETURNING id INTO v_ticket_id;

    -- Adicionar visibilidade para o criador
    INSERT INTO public.ticket_users (ticket_id, profile_id)
    VALUES (v_ticket_id, v_creator_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Status em Andamento -'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Status em Andamento -', '2026-07-16 08:06:00-03'::timestamptz);
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Marcelo, me procure por favor para melhor entender sua necessidade sobre as especificações dos tablets, temos algumas dúvidas antes de iniciar as cotações.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Marcelo, me procure por favor para melhor entender sua necessidade sobre as especificações dos tablets, temos algumas dúvidas antes de iniciar as cotações.', '2026-07-16 08:07:00-03'::timestamptz);
  END IF;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'MARCELO , VC PROCUROU COMPRAS ? TINTIN ASSIM QUE VC TIVER OS ORÇAMENTOS VC ME ENVIA, ANTES DE COMPRAR'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'MARCELO , VC PROCUROU COMPRAS ? TINTIN ASSIM QUE VC TIVER OS ORÇAMENTOS VC ME ENVIA, ANTES DE COMPRAR', '2026-07-16 12:24:00-03'::timestamptz);
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Combinado, aprovaremos juntos essa demanda, quero entender melhor as necessidades para adquirirmos o equipamento mais adequado para cada uso.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Combinado, aprovaremos juntos essa demanda, quero entender melhor as necessidades para adquirirmos o equipamento mais adequado para cada uso.', '2026-07-16 13:35:00-03'::timestamptz);
  END IF;

  -- Mensagem de Marcelo kanesaki
  v_msg_user_id := public.get_or_create_user('Marcelo kanesaki', 'pcp2@fundiferroformas.com.br', 'Qualidade');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'vou enviar um LINK destes com urgência . posteriomente vamos preciar de mais.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'vou enviar um LINK destes com urgência . posteriomente vamos preciar de mais.', '2026-07-17 09:26:00-03'::timestamptz);
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Obrigado, envie no meu whats, assim fazemos a compra de forma mais assertiva.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Obrigado, envie no meu whats, assim fazemos a compra de forma mais assertiva.', '2026-07-17 10:00:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Marcelo, me mandar o link dos tablets que voce viu para podermos cotar o melhor ou parecido.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Marcelo, me mandar o link dos tablets que voce viu para podermos cotar o melhor ou parecido.', '2026-07-17 11:27:00-03'::timestamptz);
  END IF;

  -- Mensagem de Marcelo kanesaki
  v_msg_user_id := public.get_or_create_user('Marcelo kanesaki', 'pcp2@fundiferroformas.com.br', 'Qualidade');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'seria prox. ou superior ao GALAXY TAB A9+ SM-X210'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'seria prox. ou superior ao GALAXY TAB A9+ SM-X210', '2026-07-20 08:15:00-03'::timestamptz);
  END IF;

END $$;

-- CHAMADO SEQUENCIAL #734
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Peter Prudencio', 'projetos@fundiferroformas.com.br', 'Projetos');

  -- Verificar se já existe chamado com este número
  SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = 734 LIMIT 1;

  IF v_ticket_id IS NOT NULL THEN
    -- Atualizar status e descrição do chamado existente
    UPDATE public.tickets 
    SET status = 'in_progress',
        description = 'Bom dia. Só para deixar registrado, para acompanharmos a resolução do notebook da engenharia que foi para a JP fazer manutenção preventiva e voltou sem ligar. Este computador iria para a Daiana trabalhar no Revit. '
    WHERE id = v_ticket_id;
  ELSE
    -- Inserir ticket novo
    INSERT INTO public.tickets (
      title,
      description,
      priority,
      status,
      created_by,
      origin_department_id,
      destination_department_id,
      ticket_number,
      created_at
    ) VALUES (
      'Notebook Queimado',
      'Bom dia. Só para deixar registrado, para acompanharmos a resolução do notebook da engenharia que foi para a JP fazer manutenção preventiva e voltou sem ligar. Este computador iria para a Daiana trabalhar no Revit. ',
      'high',
      'in_progress', -- Importados com status "Em Atendimento" (in_progress)
      v_creator_id,
      COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Projetos' LIMIT 1)),
      (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
      734,
      '2026-07-15 11:35:11-03'::timestamptz
    ) RETURNING id INTO v_ticket_id;

    -- Adicionar visibilidade para o criador
    INSERT INTO public.ticket_users (ticket_id, profile_id)
    VALUES (v_ticket_id, v_creator_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Status em Andamento -'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Status em Andamento -', '2026-07-15 11:56:00-03'::timestamptz);
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Henrique, pede retorno até as 15h sobre o relatório do conserto desse note a Dr. Note por gentileza.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Henrique, pede retorno até as 15h sobre o relatório do conserto desse note a Dr. Note por gentileza.', '2026-07-15 11:57:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Recebemos o orçamento da Dr.Note para o reparo na placa mae que está com defeito, agora o orçamento esta com o Jose carlos Tinti para resolver com o Sr. Jose carlos Pasiani.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Recebemos o orçamento da Dr.Note para o reparo na placa mae que está com defeito, agora o orçamento esta com o Jose carlos Tinti para resolver com o Sr. Jose carlos Pasiani.', '2026-07-16 09:56:00-03'::timestamptz);
  END IF;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'TINTI , ONDE ESTA O ORÇAMENTO ?'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'TINTI , ONDE ESTA O ORÇAMENTO ?', '2026-07-16 12:25:00-03'::timestamptz);
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Está comigo, a tarde quando falarmos de perfil de alumínio, já falaremos sobre esse orçamento e o que ocorreu.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Está comigo, a tarde quando falarmos de perfil de alumínio, já falaremos sobre esse orçamento e o que ocorreu.', '2026-07-16 13:34:00-03'::timestamptz);
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Acabamos não falando na sequência da reunião do aluminio, mas amanhã na parte da manhã precisamos falar.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Acabamos não falando na sequência da reunião do aluminio, mas amanhã na parte da manhã precisamos falar.', '2026-07-16 17:20:00-03'::timestamptz);
  END IF;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = '????????????????????????????'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, '????????????????????????????', '2026-07-18 17:52:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Assim como conversado com o Sr. José carlos para poder fazer o reparo do notebook, ja informado ao local para dar inicio'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Assim como conversado com o Sr. José carlos para poder fazer o reparo do notebook, ja informado ao local para dar inicio', '2026-07-20 11:08:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Já iniciado a manutenção, resposta em 2 dias para fazer a manutenção e envio'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Já iniciado a manutenção, resposta em 2 dias para fazer a manutenção e envio', '2026-07-20 13:22:00-03'::timestamptz);
  END IF;

END $$;

-- CHAMADO SEQUENCIAL #662
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');

  -- Verificar se já existe chamado com este número
  SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = 662 LIMIT 1;

  IF v_ticket_id IS NOT NULL THEN
    -- Atualizar status e descrição do chamado existente
    UPDATE public.tickets 
    SET status = 'in_progress',
        description = 'Bom dia! estamos com 3 maquinas de solda da Torck com problema se encontra paradas. 1 - ja faz meses que esta na asistencia 1 - esta parada na manutenção 1 - não sei se esta no almoxarifado ou levou para assistencia. precisa ver com urgencia isso'
    WHERE id = v_ticket_id;
  ELSE
    -- Inserir ticket novo
    INSERT INTO public.tickets (
      title,
      description,
      priority,
      status,
      created_by,
      origin_department_id,
      destination_department_id,
      ticket_number,
      created_at
    ) VALUES (
      'Setor Aluminio - Maquinas De Solda Torck ',
      'Bom dia! estamos com 3 maquinas de solda da Torck com problema se encontra paradas. 1 - ja faz meses que esta na asistencia 1 - esta parada na manutenção 1 - não sei se esta no almoxarifado ou levou para assistencia. precisa ver com urgencia isso',
      'high',
      'in_progress', -- Importados com status "Em Atendimento" (in_progress)
      v_creator_id,
      COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
      (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
      662,
      '2026-06-26 09:11:15-03'::timestamptz
    ) RETURNING id INTO v_ticket_id;

    -- Adicionar visibilidade para o criador
    INSERT INTO public.ticket_users (ticket_id, profile_id)
    VALUES (v_ticket_id, v_creator_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Finalizado'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Finalizado', '2026-07-02 09:13:00-03'::timestamptz);
  END IF;

  -- Mensagem de Eder Pires
  v_msg_user_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Eder Pires - 3/7 13:36- Reaberto.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Eder Pires - 3/7 13:36- Reaberto.', '2026-06-26 09:11:15-03'::timestamptz);
  END IF;

  -- Mensagem de Eder Pires
  v_msg_user_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Boa tarde! porque foi finalizado? como esta estas maquinas, não ficamos sabendo de nada.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Boa tarde! porque foi finalizado? como esta estas maquinas, não ficamos sabendo de nada.', '2026-07-03 13:37:00-03'::timestamptz);
  END IF;

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'SAO DUAS MAQUINAS AGORA ESTA NA RESPONSABILIDADE DE COMPRAS PARA EVIAR PARA A ASSISTENCIA'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'SAO DUAS MAQUINAS AGORA ESTA NA RESPONSABILIDADE DE COMPRAS PARA EVIAR PARA A ASSISTENCIA', '2026-07-08 13:46:00-03'::timestamptz);
  END IF;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Não vi a RNC em compras , quando foi enviado ????'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Não vi a RNC em compras , quando foi enviado ????', '2026-07-11 09:22:00-03'::timestamptz);
  END IF;

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Encaminhado - Compras'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Encaminhado - Compras', '2026-07-13 16:09:00-03'::timestamptz);
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Status em Andamento -'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Status em Andamento -', '2026-07-13 17:13:00-03'::timestamptz);
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Gentileza, confirmar se realmente são 3 máquinas, no almoxarifado haviam apenas as 2 máquinas abaixo para envio para conserto NUMEROS DE SERIE MAQUINAS :- Nº SÉRIE €23 I028052200000039 Nº SÉRIE €23 I028122400000041 Já foi retirada a nota de remessa para conserto, amanhã a Tork informa o dia da retirada das 2 máquinas para conserto. Assim que confirmarem a data de retirada atualizamos, solicitada urgência.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Gentileza, confirmar se realmente são 3 máquinas, no almoxarifado haviam apenas as 2 máquinas abaixo para envio para conserto NUMEROS DE SERIE MAQUINAS :- Nº SÉRIE €23 I028052200000039 Nº SÉRIE €23 I028122400000041 Já foi retirada a nota de remessa para conserto, amanhã a Tork informa o dia da retirada das 2 máquinas para conserto. Assim que confirmarem a data de retirada atualizamos, solicitada urgência.', '2026-07-13 17:15:00-03'::timestamptz);
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Éder, fui informado agora, que a terceira máquina que não tínhamos conhecimento, foi levada ontem 13/07 na porta da ferramentaria, segundo relatos me informados, ela pegou fogo, a Tork tem um processo muito burocrático de envio para assistência, pedem muitas informações para agendamento da retirada, os dois equipamentos que estão com nota pronta, irão primeiro, esse terceiro irá na sequência.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Éder, fui informado agora, que a terceira máquina que não tínhamos conhecimento, foi levada ontem 13/07 na porta da ferramentaria, segundo relatos me informados, ela pegou fogo, a Tork tem um processo muito burocrático de envio para assistência, pedem muitas informações para agendamento da retirada, os dois equipamentos que estão com nota pronta, irão primeiro, esse terceiro irá na sequência.', '2026-07-14 10:06:00-03'::timestamptz);
  END IF;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'PORQUE JÁ NÃO ENVIA AS TRES ? ÉDER , DEIXA EU ENTENDER , O TINTI ESTÁ COMENTADANDO QUE A MAQUINA ESTVA NA PORTA DO ALMOXARIFADO , QUEM É RESPONSAVEL DE REEBER OS CONSERTOS E COMO É A EXPLICAÇÃO DO QUE ESTA ACONTECENDO COM O EQUIPAMENTO ? PRECISA TER UMA DATA DO CONSERTO , NÃO TEM COMO FICARMOS ESPERANDO A VONTADE DELES .'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'PORQUE JÁ NÃO ENVIA AS TRES ? ÉDER , DEIXA EU ENTENDER , O TINTI ESTÁ COMENTADANDO QUE A MAQUINA ESTVA NA PORTA DO ALMOXARIFADO , QUEM É RESPONSAVEL DE REEBER OS CONSERTOS E COMO É A EXPLICAÇÃO DO QUE ESTA ACONTECENDO COM O EQUIPAMENTO ? PRECISA TER UMA DATA DO CONSERTO , NÃO TEM COMO FICARMOS ESPERANDO A VONTADE DELES .', '2026-07-14 16:26:00-03'::timestamptz);
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Zé Pasiani, o processo da Tork é extremamente burocrático e moroso, exemplo, pedem 72hs para informar a transportadora que fará a coleta, pedem relatos e um formulario preenchido antes de emitirmos a nota de remessa para conserto, após tudo ok e aprovado por eles, pedem mais 72 horas para dar uma data estimada de quando virão coletar os materiais, essas duas maquinas ja estão contando desde ontem as 72hs para informarem a transportadora, após isso, mais 72 horas para darem uma data estimada de coleta aqui, se incluirmos o terceiro equipamento no processo demoraremos mais ainda para enviar. Precisamos até entender se realmente são máquinas que nos atendem bem, pelo que vi já é a terceira ou quarta vez desde novembro de 25 que enviamos máquinas para conserto, uma dessas que estão indo agora. está sendo enviada pela segunda vez para conserto.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Zé Pasiani, o processo da Tork é extremamente burocrático e moroso, exemplo, pedem 72hs para informar a transportadora que fará a coleta, pedem relatos e um formulario preenchido antes de emitirmos a nota de remessa para conserto, após tudo ok e aprovado por eles, pedem mais 72 horas para dar uma data estimada de quando virão coletar os materiais, essas duas maquinas ja estão contando desde ontem as 72hs para informarem a transportadora, após isso, mais 72 horas para darem uma data estimada de coleta aqui, se incluirmos o terceiro equipamento no processo demoraremos mais ainda para enviar. Precisamos até entender se realmente são máquinas que nos atendem bem, pelo que vi já é a terceira ou quarta vez desde novembro de 25 que enviamos máquinas para conserto, uma dessas que estão indo agora. está sendo enviada pela segunda vez para conserto.', '2026-07-14 17:29:00-03'::timestamptz);
  END IF;

  -- Mensagem de Lucimar
  v_msg_user_id := public.get_or_create_user('Lucimar', 'almoxarifado@fundiferro.formas.com.br', 'Almoxarifado');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'sim realmente rigoroso e demorado ,sobre o processo da tork ,com fotos da series , fotos da maquinas, sem embala, depois maquinas embalada,peso, altura,quantidade de volume,esperar eles mandar qual trasmportadoura. teve uma vez que o rodrigo teve que canselar 2 vezes a nota e fazer 1 carta de correçao.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'sim realmente rigoroso e demorado ,sobre o processo da tork ,com fotos da series , fotos da maquinas, sem embala, depois maquinas embalada,peso, altura,quantidade de volume,esperar eles mandar qual trasmportadoura. teve uma vez que o rodrigo teve que canselar 2 vezes a nota e fazer 1 carta de correçao.', '2026-07-15 11:05:00-03'::timestamptz);
  END IF;

  -- Mensagem de Lucimar
  v_msg_user_id := public.get_or_create_user('Lucimar', 'almoxarifado@fundiferro.formas.com.br', 'Almoxarifado');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'segue a resposta da tork de hoje : Bom dia! Sobre a coleta dos dois equipamentos de 300A e do terceiro equipamento de 500A, já solicitamos os dados da transportadora responsável. Assim que essas informações nos forem encaminhadas, informaremos você. Caso a transportadora responsável pelos dois equipamentos de 300A seja a mesma, poderemos aceitar a Nota Fiscal de Remessa para Conserto já emitida para a realização da coleta.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'segue a resposta da tork de hoje : Bom dia! Sobre a coleta dos dois equipamentos de 300A e do terceiro equipamento de 500A, já solicitamos os dados da transportadora responsável. Assim que essas informações nos forem encaminhadas, informaremos você. Caso a transportadora responsável pelos dois equipamentos de 300A seja a mesma, poderemos aceitar a Nota Fiscal de Remessa para Conserto já emitida para a realização da coleta.', '2026-07-16 13:17:00-03'::timestamptz);
  END IF;

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Lucimar, me procure para ligarmos para esse contato da Tork, vamos ligar juntos, até amanhã vence o prazo para ele passar essa informação, não temos condições de trabalhar com esse tipo de empresa.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Lucimar, me procure para ligarmos para esse contato da Tork, vamos ligar juntos, até amanhã vence o prazo para ele passar essa informação, não temos condições de trabalhar com esse tipo de empresa.', '2026-07-16 13:32:00-03'::timestamptz);
  END IF;

END $$;

-- CHAMADO SEQUENCIAL #777
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');

  -- Verificar se já existe chamado com este número
  SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = 777 LIMIT 1;

  IF v_ticket_id IS NOT NULL THEN
    -- Atualizar status e descrição do chamado existente
    UPDATE public.tickets 
    SET status = 'in_progress',
        description = 'TODAS AS PECAS ENVIADA PELO ZAP'
    WHERE id = v_ticket_id;
  ELSE
    -- Inserir ticket novo
    INSERT INTO public.tickets (
      title,
      description,
      priority,
      status,
      created_by,
      origin_department_id,
      destination_department_id,
      ticket_number,
      created_at
    ) VALUES (
      'PROJETO TUPIA NOVA',
      'TODAS AS PECAS ENVIADA PELO ZAP',
      'high',
      'in_progress', -- Importados com status "Em Atendimento" (in_progress)
      v_creator_id,
      COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Ferramentaria' LIMIT 1)),
      (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
      777,
      '2026-07-17 10:34:33-03'::timestamptz
    ) RETURNING id INTO v_ticket_id;

    -- Adicionar visibilidade para o criador
    INSERT INTO public.ticket_users (ticket_id, profile_id)
    VALUES (v_ticket_id, v_creator_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Status em Andamento -'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Status em Andamento -', '2026-07-17 10:50:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Ronaldo pediu varios itens para a tupia nova, foi conversado com ele pessoalmente sobre cada item e enviado para os locais indicado por ele para resolver este assunto, assim como conversado teria pressa para tudo o quanto antes, mas como perguntado a tempo de entrega o mesmo disse que se conseguir dentro do mes seria o melhor, mas avisa-lo para cada data para podermos tomar a melhor descisão.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Ronaldo pediu varios itens para a tupia nova, foi conversado com ele pessoalmente sobre cada item e enviado para os locais indicado por ele para resolver este assunto, assim como conversado teria pressa para tudo o quanto antes, mas como perguntado a tempo de entrega o mesmo disse que se conseguir dentro do mes seria o melhor, mas avisa-lo para cada data para podermos tomar a melhor descisão.', '2026-07-17 10:58:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Foi feito um pedido na Tecmaf com 90% dos itens no pedido:26319, sera entregue tudo até sexta feira'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Foi feito um pedido na Tecmaf com 90% dos itens no pedido:26319, sera entregue tudo até sexta feira', '2026-07-17 17:11:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Feito um pedido na IBR de uma peça que precisa entrega em 16 dias. PEDIDO Nº26329'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Feito um pedido na IBR de uma peça que precisa entrega em 16 dias. PEDIDO Nº26329', '2026-07-20 13:47:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Esta faltando um item a ser pedido na THINKROLL, mas estao com duvidas tecnicas, estão em conversação com o ronaldo da ferramentaria para poder sanar essas duvidas e passar o orçamento correto do item que precisamos'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Esta faltando um item a ser pedido na THINKROLL, mas estao com duvidas tecnicas, estão em conversação com o ronaldo da ferramentaria para poder sanar essas duvidas e passar o orçamento correto do item que precisamos', '2026-07-20 16:49:00-03'::timestamptz);
  END IF;

END $$;

-- CHAMADO SEQUENCIAL #794
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Peter Prudencio', 'projetos@fundiferroformas.com.br', 'Projetos');

  -- Verificar se já existe chamado com este número
  SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = 794 LIMIT 1;

  IF v_ticket_id IS NOT NULL THEN
    -- Atualizar status e descrição do chamado existente
    UPDATE public.tickets 
    SET status = 'in_progress',
        description = 'Precisamos comprar para um pedido adicional da Emccamp Intendente e da Emccamp Santana: 350 porcas sextavadas 7/8" rosca esquerda UNC 350 porcas sextavadas 7/8" rosca direita UNC 70 barras roscadas 7/8" UNC rosca direita com 1 metro de comprimento 70 barras roscadas 7/8" UNC rosca esquerda com 1 metro de comprimento as porcas e roscas precisam ser do mesmo passo e filete para serem montadas.'
    WHERE id = v_ticket_id;
  ELSE
    -- Inserir ticket novo
    INSERT INTO public.tickets (
      title,
      description,
      priority,
      status,
      created_by,
      origin_department_id,
      destination_department_id,
      ticket_number,
      created_at
    ) VALUES (
      'Compra De Barra Roscada E Porca',
      'Precisamos comprar para um pedido adicional da Emccamp Intendente e da Emccamp Santana: 350 porcas sextavadas 7/8" rosca esquerda UNC 350 porcas sextavadas 7/8" rosca direita UNC 70 barras roscadas 7/8" UNC rosca direita com 1 metro de comprimento 70 barras roscadas 7/8" UNC rosca esquerda com 1 metro de comprimento as porcas e roscas precisam ser do mesmo passo e filete para serem montadas.',
      'high',
      'in_progress', -- Importados com status "Em Atendimento" (in_progress)
      v_creator_id,
      COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Projetos' LIMIT 1)),
      (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
      794,
      '2026-07-21 11:38:38-03'::timestamptz
    ) RETURNING id INTO v_ticket_id;

    -- Adicionar visibilidade para o criador
    INSERT INTO public.ticket_users (ticket_id, profile_id)
    VALUES (v_ticket_id, v_creator_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Status em Andamento -'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Status em Andamento -', '2026-07-21 14:02:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Já em cotação'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Já em cotação', '2026-07-21 14:03:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Qual seria a data para isso estar na empresa ?'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Qual seria a data para isso estar na empresa ?', '2026-07-21 14:27:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'ja conversado com o peter teria que estar o quanto antes esses itens na empresa, mas estamos procurando as rosca para a esquerda que nao estamos encontrando em nossos fornecedores'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'ja conversado com o peter teria que estar o quanto antes esses itens na empresa, mas estamos procurando as rosca para a esquerda que nao estamos encontrando em nossos fornecedores', '2026-07-22 07:41:00-03'::timestamptz);
  END IF;

  -- Mensagem de Peter Prudencio
  v_msg_user_id := public.get_or_create_user('Peter Prudencio', 'projetos@fundiferroformas.com.br', 'Projetos');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Qualquer coisa por favor liga para o Paulo, ele tem experiencia neste material, ele que pediu para usar a rosca direita/esquerda, ele deve saber onde encontrar'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Qualquer coisa por favor liga para o Paulo, ele tem experiencia neste material, ele que pediu para usar a rosca direita/esquerda, ele deve saber onde encontrar', '2026-07-22 11:12:00-03'::timestamptz);
  END IF;

END $$;

-- CHAMADO SEQUENCIAL #782
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');

  -- Verificar se já existe chamado com este número
  SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = 782 LIMIT 1;

  IF v_ticket_id IS NOT NULL THEN
    -- Atualizar status e descrição do chamado existente
    UPDATE public.tickets 
    SET status = 'in_progress',
        description = 'Bom dia! para o setor de retrabalho, precisamos de 8 sangentos de 10 polegas, obrigado'
    WHERE id = v_ticket_id;
  ELSE
    -- Inserir ticket novo
    INSERT INTO public.tickets (
      title,
      description,
      priority,
      status,
      created_by,
      origin_department_id,
      destination_department_id,
      ticket_number,
      created_at
    ) VALUES (
      'Setor Retrabaho - Sagentos',
      'Bom dia! para o setor de retrabalho, precisamos de 8 sangentos de 10 polegas, obrigado',
      'medium',
      'in_progress', -- Importados com status "Em Atendimento" (in_progress)
      v_creator_id,
      COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
      (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
      782,
      '2026-07-20 09:19:42-03'::timestamptz
    ) RETURNING id INTO v_ticket_id;

    -- Adicionar visibilidade para o criador
    INSERT INTO public.ticket_users (ticket_id, profile_id)
    VALUES (v_ticket_id, v_creator_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Status em Andamento -'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Status em Andamento -', '2026-07-20 09:22:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Bom dia, Esses sargentos sao os mesmos das RNC 541?'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Bom dia, Esses sargentos sao os mesmos das RNC 541?', '2026-07-20 09:23:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'sobre esses sargentos teria alguma marca especifica ?'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'sobre esses sargentos teria alguma marca especifica ?', '2026-07-20 11:47:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'PEDIDO FEITO NA M&A MANGUEIRA DE 10 SANGENTOS, 8 PARA O PEDIDO E 2 PARA ESTOQUE. NAO ENCONTREI A PRONTA ENTREGA SERA ENTREGUE SEMANA QUE VEM.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'PEDIDO FEITO NA M&A MANGUEIRA DE 10 SANGENTOS, 8 PARA O PEDIDO E 2 PARA ESTOQUE. NAO ENCONTREI A PRONTA ENTREGA SERA ENTREGUE SEMANA QUE VEM.', '2026-07-20 16:11:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'PEDIDO Nº:26332'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'PEDIDO Nº:26332', '2026-07-20 16:12:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Finalizado'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Finalizado', '2026-07-20 16:12:00-03'::timestamptz);
  END IF;

  -- Mensagem de Eder Pires
  v_msg_user_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Eder Pires - 21/7 14:14- Reaberto.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Eder Pires - 21/7 14:14- Reaberto.', '2026-07-20 09:19:42-03'::timestamptz);
  END IF;

  -- Mensagem de Eder Pires
  v_msg_user_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'VAMOS ESPERAR CHEGAR PARA FINALIZAR'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'VAMOS ESPERAR CHEGAR PARA FINALIZAR', '2026-07-21 14:14:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Status em Andamento -'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Status em Andamento -', '2026-07-21 14:25:00-03'::timestamptz);
  END IF;

END $$;

-- CHAMADO SEQUENCIAL #785
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');

  -- Verificar se já existe chamado com este número
  SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = 785 LIMIT 1;

  IF v_ticket_id IS NOT NULL THEN
    -- Atualizar status e descrição do chamado existente
    UPDATE public.tickets 
    SET status = 'in_progress',
        description = 'ESTAMOS PRECISANDO DE UMA MOLA DE 100MM DE COMPRIMENTO X27 MM DE DIAMETRO COM ARAME DE 4MM SE NAO TIVER A MOLA SE POSSIVEL PEDIR O ARAME QUE FAREMOS AQUI 4 METROS DE ARAME . MAQUINA PARADA '
    WHERE id = v_ticket_id;
  ELSE
    -- Inserir ticket novo
    INSERT INTO public.tickets (
      title,
      description,
      priority,
      status,
      created_by,
      origin_department_id,
      destination_department_id,
      ticket_number,
      created_at
    ) VALUES (
      'MOLA PARA A CAIXA EXTERNA DA PRENSA ',
      'ESTAMOS PRECISANDO DE UMA MOLA DE 100MM DE COMPRIMENTO X27 MM DE DIAMETRO COM ARAME DE 4MM SE NAO TIVER A MOLA SE POSSIVEL PEDIR O ARAME QUE FAREMOS AQUI 4 METROS DE ARAME . MAQUINA PARADA ',
      'high',
      'in_progress', -- Importados com status "Em Atendimento" (in_progress)
      v_creator_id,
      COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Ferramentaria' LIMIT 1)),
      (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
      785,
      '2026-07-20 11:17:35-03'::timestamptz
    ) RETURNING id INTO v_ticket_id;

    -- Adicionar visibilidade para o criador
    INSERT INTO public.ticket_users (ticket_id, profile_id)
    VALUES (v_ticket_id, v_creator_id)
    ON CONFLICT DO NOTHING;
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Status em Andamento -'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Status em Andamento -', '2026-07-20 13:56:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'ja passado a cotação para fazer a compra'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'ja passado a cotação para fazer a compra', '2026-07-20 13:57:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Não finalizado a compra pois em alguns lugares nao tem dessa mola e aonde tem mesmo ligando e mandando mensagem nao obtive retorno para poder fazer o pedido de compra. estou no aguardo disso para poder fazer.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Não finalizado a compra pois em alguns lugares nao tem dessa mola e aonde tem mesmo ligando e mandando mensagem nao obtive retorno para poder fazer o pedido de compra. estou no aguardo disso para poder fazer.', '2026-07-20 16:47:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Nao conseguimos um contato direto com o vendedor da JBM/catpeças, foi resolvido que o ronaldo da manutenção iria la buscar o arame para fazer a mola, ele chegando me avisará para eu fazer o pedido e colocar o preço.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Nao conseguimos um contato direto com o vendedor da JBM/catpeças, foi resolvido que o ronaldo da manutenção iria la buscar o arame para fazer a mola, ele chegando me avisará para eu fazer o pedido e colocar o preço.', '2026-07-21 13:39:00-03'::timestamptz);
  END IF;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  IF NOT EXISTS (
    SELECT 1 FROM public.ticket_messages 
    WHERE ticket_id = v_ticket_id 
      AND profile_id = v_msg_user_id 
      AND content = 'Mola ja esta na empressa, e ja esta colocando na maquina, esperando a vendedora me passar o valor para fazer o pedido.'
  ) THEN
    INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
    VALUES (v_ticket_id, v_msg_user_id, 'Mola ja esta na empressa, e ja esta colocando na maquina, esperando a vendedora me passar o valor para fazer o pedido.', '2026-07-21 15:49:00-03'::timestamptz);
  END IF;

END $$;

-- 4. Remover a função auxiliar temporária criada no início do script
DROP FUNCTION IF EXISTS public.get_or_create_user(text, text, text);

-- IMPORTAÇÃO CONCLUÍDA COM SUCESSO!
