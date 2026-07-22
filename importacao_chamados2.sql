-- ============================================================
-- SCRIPT DE IMPORTAÇÃO DE CHAMADOS DO FIREBASE PARA SUPABASE (PARTE 2)
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


-- CHAMADO SEQUENCIAL #744
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');

  -- Inserir ticket
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
    'TUPIA AUTOMATICA',
    'RONALDO COMO ESTÁ A POSIÇÃO DA TUPIA , OS PINOS NOVOS E A SERRA AUTOMATICA . PRECISO DAS DATAS DAS TRES FERRAMENTAS LEMBRANDO QUE OS MODELOS DOS PINOS NÓS VAMOS CONVERSARMOS , PARA ALINHAR.',
    'medium',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Diretoria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    744,
    '2026-07-15 18:33:41-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'RONALDO , PORQUE NÃO OBITIVE O SEU RETORNO ATÉ AGORA ???', '2026-07-16 12:16:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'A TUPIA ESTOU FAZENDOACREDITO QUE VAI MAIS UNS 30 A 40 DIAS SE EU NAO PARAR MUITO A SERRA AUTOMATICA ESTA CORTANDO A PROTECAO ASSIM QUE TIVER PRONTA 1 A 2 DIAS ESTA PRONTA PARA SOLTAR TRABALHAR OS PINOS O MATERIAL QUE VAI USINAR CHEGA TERCA FEIRA', '2026-07-16 13:05:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #793
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Não informado no registro', 'sem.registro@fundiferroformas.com.br', 'Produção');

  -- Inserir ticket
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
    'Tubo Do Climatizador Quebrado ',
    'O neto estava levando com a empilhadeira ,no sábado de manhã estava levando os tubos mills - bateu e esta perigoso cair sobre colaborador , ',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Produção' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    793,
    '2026-07-21 10:11:49-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

END $$;

-- CHAMADO SEQUENCIAL #665
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');

  -- Inserir ticket
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
    'Setor Alumnio - Prensa De Ø 17,00 Desmontada',
    'Ronaldo, bom dia! precisamos de uma previsão da montagem desta prensa, como esta o andamento, esta tudo no jeito para iniciar a montagem.',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    665,
    '2026-06-26 10:14:10-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Porque este monte de RNC sem retorno , quero seja prenchido todas as RNCS e completas', '2026-07-11 09:24:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'JA ESTA ABERTA A RNC PARA COMPRAS PARA MANDAR A ENGRENAGEM PARA MANDRILHAR', '2026-07-13 15:59:00-03'::timestamptz);

  -- Mensagem de Eder Pires
  v_msg_user_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'precisamos de uma posição, tem previsão?', '2026-07-15 07:06:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #661
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');

  -- Inserir ticket
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
    'Setor Aluminio - Maquina De Solda Torck',
    'Bom dia! maquina de solda do colaborador Danilo montador, esta com as ventuinhas paradas.',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    661,
    '2026-06-26 09:08:40-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Porque não foi dado o retorno até agora?', '2026-07-11 09:22:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'ESTOU AGUARDANDO A RESPOSTA', '2026-07-18 17:40:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'VAI SER TIRADO HJ PARA VER SE TEM QUE PEDIR NOVA', '2026-07-20 13:13:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #759
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');

  -- Inserir ticket
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
    'CLIETE PAVANELI',
    'COMO ESTA ESTE ORÇAMENTO ?',
    'medium',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Diretoria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    759,
    '2026-07-16 12:49:10-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'SEM RESPOSTA', '2026-07-18 17:59:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #802
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');

  -- Inserir ticket
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
    'FIO PARA ESTALAR OS REFLETORES',
    '100 METROS DE FIO PP2.5 X 2 VIA 4 FOTO CELULA 100 METRO CONDOITE CORRUGADO DE 1 POLEGADA',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Ferramentaria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    802,
    '2026-07-22 10:34:45-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

END $$;

-- CHAMADO SEQUENCIAL #792
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Peter Prudencio', 'projetos@fundiferroformas.com.br', 'Projetos');

  -- Inserir ticket
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
    'Inventário Tubo 60 X 40',
    'Bom dia. Preciso do inventário atualizado do tubo 60 x 40, segundo o Paulo tem muito mais tubos do que o que foi me passado. Aguardo isso para finalizar a compra de aço do mês.',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Projetos' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    792,
    '2026-07-21 09:43:32-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Peter Prudencio
  v_msg_user_id := public.get_or_create_user('Peter Prudencio', 'projetos@fundiferroformas.com.br', 'Projetos');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'preciso também do inventário das malhas de ferro 4,3 x 15 x 15 que usamos nos gradis de segurança', '2026-07-21 11:39:00-03'::timestamptz);

  -- Mensagem de Marcelo kanesaki
  v_msg_user_id := public.get_or_create_user('Marcelo kanesaki', 'pcp2@fundiferroformas.com.br', 'Qualidade');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'DESCRITIVO SALDO ATUAL TUBO RET. 2,00 X 60 X 40 X 6000 58 barras TUBO RET. 2,25 X 60 X 40 X 6000 219 barras TUBO RET. 3,00 X 60 X 40 X 6000 201 barras ATUALIZADO NA DATA DE HOJE ...ABATIDO MARIANA . 610 BARRAS.', '2026-07-21 15:52:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #763
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');

  -- Inserir ticket
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
    'IMPLANTAÇÃO PROJETO 3 D',
    'PETER COMO ESTA O PROCESSO DE COMEÇAR A ENVIAR OS PROJETOS EM 3D ?',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Diretoria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    763,
    '2026-07-16 12:56:20-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Encaminhado - PCP', '2026-07-16 13:00:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'SEM RESPOSTA', '2026-07-18 18:00:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #447
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');

  -- Inserir ticket
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
    'Compressores ',
    'Bom dia! tem um compressor que esta sem filtro e outro precisa verificar que não esta desligando no botão, toda vez que tem que desligar tem que desligar a geral.',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    447,
    '2026-03-31 07:58:38-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Eder Pires
  v_msg_user_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Comprrensor jogando muita agua na rede', '2026-07-02 09:11:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Foi resolvido este problema da Rede ?', '2026-07-04 18:59:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'RONALDO MECANICO PASSOU PARA O TINTI E PARA JOSE CARLOS SOBRE OS SECADORES DO COMPRENSSORES QUE ESTAO COM PROBLEMA', '2026-07-08 14:21:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Este assunto, ja esta aprovodo, desde a semana passada, vc abriu uma RNC para compreas perguntando quando será instalado.', '2026-07-11 09:15:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'VOU ABRIR AGORA', '2026-07-13 14:07:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'COMO FICOU ?', '2026-07-18 17:35:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #663
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');

  -- Inserir ticket
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
    'Setor Triagem - Eletrica',
    ' Bom dia! preciso que instale mais lampadas no setor e arremem as tomadas.',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    663,
    '2026-06-26 09:13:00-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Nenhum retorno porque ???????????', '2026-07-11 09:23:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'SEM RESPOSTA', '2026-07-18 17:42:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #741
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Marcelo kanesaki', 'pcp2@fundiferroformas.com.br', 'Qualidade');

  -- Inserir ticket
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
    'MAQUINA SERRA CIRCULAR - ALUMINIO',
    ' PRECISAMOS DE UMA POSIÇÃO URGENTE PARA FUNCIONAR A NOVA MAQUINA. ',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Qualidade' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    741,
    '2026-07-15 15:36:33-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'RONALDO PORQUE ESTA SEM RESPOSTA', '2026-07-16 12:19:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'ESTA PINTANDO A PROTENCAO ATE SEGUNDA FEIRA ESTA PRONTO', '2026-07-16 16:41:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #653
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');

  -- Inserir ticket
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
    'Fabrica - Roteadores',
    'Precisa instalar as caixinhas de plastico para os roteadores.',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    653,
    '2026-06-24 11:32:12-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Foi instalada ?', '2026-07-04 19:07:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Resposta???????????????????????????', '2026-07-11 09:21:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'PREVISTO PARA COLOCAR ESSA SEMANA', '2026-07-13 15:53:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'FOI COLOCADO ?????', '2026-07-18 17:39:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'DEVIDO AO TANTO DE MAQUINAS QUEBRADAS NAO CONSEGUIU COLOCAR', '2026-07-20 13:11:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #723
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');

  -- Inserir ticket
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
    'Setor Aluminio - Prensa De Prender Mancal',
    'Bom dia! por favor pedir para prender no chão pois a mesma esta andando ',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    723,
    '2026-07-14 07:06:56-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'SEM RESPOSTAS', '2026-07-18 17:49:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'ESTA SENDO FEITO', '2026-07-20 13:27:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #778
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Raniele Thomaz', 'raniele.thomaz@fundiferroformas.com.br', 'Produção');

  -- Inserir ticket
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
    'DOBRADEIRA AMADA',
    'A DOBRADEIRA AMADA PERDEU A REFERÊNCIA E NÃO ESTÁ REFERENCIANDO OS EIXOS',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Produção' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    778,
    '2026-07-17 15:02:08-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'FOI RESOLVIDO', '2026-07-18 18:04:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'PASSADO PARA COMPRAS COMPRAR O SENSOR', '2026-07-21 08:23:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'ESTAMOS AGUARDANDO O SENSOR PARA OS TESTES FINAIS', '2026-07-21 08:54:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #705
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');

  -- Inserir ticket
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
    'Setor Aluminio - Nova Ferramenta Rasgo Costela',
    'Bom dia! conforme reunião precisamos fazer uma nova ferramenta para os rasgos da costela.',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    705,
    '2026-07-10 07:06:39-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Sem resposta ??????????????????????', '2026-07-11 09:28:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'NAO CONSEGUIMOS COMECAR', '2026-07-20 13:21:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #760
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');

  -- Inserir ticket
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
    'CLIENTE JUNDIAI',
    'PAULO , VC MARCOU CM ESSE CLIENTE A NOSSA VISITA ?',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Diretoria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    760,
    '2026-07-16 12:50:10-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Paulo Solcia
  v_msg_user_id := public.get_or_create_user('Paulo Solcia', 'paulo.solcia@fundiferroformas.com.br', 'Comercial');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'ZE CARLOS , ESTOU FALANDO COM ELE SEMPRE , AGORA O ORÇAMENTO ESTÁ EM ANALISE MAIS AVANÇADO , FALEI DE IR LA OU ELE VIR NOS CONHECER , ELE ME PEDIU ALHUNS DIAS SO', '2026-07-20 07:48:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #701
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');

  -- Inserir ticket
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
    'Setor Aluminio - Prensa Rasgo Costela',
    'preciso que verifique esta prens com urgencia ',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    701,
    '2026-07-08 10:34:44-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Sem resposta ????????????????', '2026-07-11 09:27:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'SEM RESPOSTAS', '2026-07-18 17:44:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #429
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Marcelo kanesaki', 'pcp2@fundiferroformas.com.br', 'Qualidade');

  -- Inserir ticket
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
    'MAQUINA DO LAVADOR - VAZAMENTO DE OLEO',
    ' A MAQUINA DO LAVADOR MAIS ANTIGA ESTA COM VAZAMENTO DE OLEO, POR FAVOR VERIFICAR O MAIS BREVE POSSIVEL. PROCURAR MAURO GARCIA.',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Qualidade' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    429,
    '2026-03-27 08:45:11-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Encaminhado - Compras', '2026-07-02 08:32:00-03'::timestamptz);

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Encaminhado - Manutenção', '2026-07-03 15:58:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Como esta o status desta Maquina', '2026-07-04 18:58:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Encaminhado - Compras', '2026-07-04 18:58:00-03'::timestamptz);

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Pessoal, precisamos de mais detalhes sobre essa RNC, como compras pode ajudar? Precisa acionar algum fornecedor? Ficamos com dúvida nesse chamado.', '2026-07-06 13:54:00-03'::timestamptz);

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Encaminhado - Manutenção', '2026-07-07 13:56:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'ESSA MAQUINAS PRECISAMOS VER PARA TRAZER ELA PARA A MECANICA PARA ABRIR AQUI O PESSOAL DA LEMASA PEDIU 20 MIL PARA MEXER NESSE VAZAMENTO', '2026-07-08 14:15:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Ronaldo , vc ja pediu para buscar ? Ou simplesmente esta notificado , para esperarmos que alguem se manifesta, precisa ser direcionado para alguem levar até o local. Aguardo retorno', '2026-07-11 09:14:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'OS LAVADORES ESTAO TRABALHANDO O VAZAMENTO NAO ATRAPALHA A MAQUINA TRABALHAR', '2026-07-20 13:00:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #779
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Raniele Thomaz', 'raniele.thomaz@fundiferroformas.com.br', 'Produção');

  -- Inserir ticket
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
    'Ventosas Talha Laser',
    'TALHA ESTÁ COM AS DUAS VENTOSA DO MESMO LADO SEM FUNCIONAR, COM ISSO NÃO ESTÁ SEGURANDO AS CHAPAS.',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Produção' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    779,
    '2026-07-20 07:20:42-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'FOI EFETUDO UMA CORRECAO PALIATIVA NA TAJHA DO SETOR DO LASER PARA PODER DAR CONTINUIDADE NA PRODUCAO DAS PECAS.', '2026-07-21 08:53:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #545
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');

  -- Inserir ticket
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
    'Setor Aluminio - Solda',
    'Precisamos fazer a rede de ar para cada box do soldador, tanto da montagem e tando ta solda.',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    545,
    '2026-05-19 11:34:39-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Como esta esta rede , ja fez ou ainda não ?', '2026-07-04 19:01:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'JA ESTA FEITA SO ESTA FALTANDO CHEGAR UMA PECA', '2026-07-08 14:12:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Que peça e quando chegará ?', '2026-07-11 09:17:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'RONALDO ESTOU AGUARDANDO SUA RESPOSTA', '2026-07-18 17:37:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'AMANHA VAI SER FEITO TEM QUE SER NA HORA DO ALMOCO', '2026-07-20 13:04:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #761
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');

  -- Inserir ticket
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
    'CONSTRUTORA HIROSHI',
    'ADRIEL , COMO FICOU ESTE CLIENTE ?',
    'medium',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Diretoria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    761,
    '2026-07-16 12:51:42-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'SEM RSPOSTA', '2026-07-18 18:00:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #711
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');

  -- Inserir ticket
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
    'Instalação Da Rede De Gás',
    'Marcelo , Como Esta A Instalação Da Rede De Gás? Era Para Esta Instalado Porque Não Está?',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Diretoria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    711,
    '2026-07-11 09:32:09-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Marcelo kanesaki
  v_msg_user_id := public.get_or_create_user('Marcelo kanesaki', 'pcp2@fundiferroformas.com.br', 'Qualidade');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'ESTAMOS AGUARDANDO O PEDREIRO PARA FAZER O MURO DE ARRIMO. VOU SOLICITAR AO PESSOAL DA WHITE MARTINS PARA APROVAÇÃO DO LOCAL.', '2026-07-14 14:49:00-03'::timestamptz);

  -- Mensagem de Marcelo kanesaki
  v_msg_user_id := public.get_or_create_user('Marcelo kanesaki', 'pcp2@fundiferroformas.com.br', 'Qualidade');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'NA DATA DO DIA 16/07 O PESSOAL DA WHITE ESTARÁ AQUI PARA AVALIAÇÃO.', '2026-07-15 15:39:00-03'::timestamptz);

  -- Mensagem de Marcelo kanesaki
  v_msg_user_id := public.get_or_create_user('Marcelo kanesaki', 'pcp2@fundiferroformas.com.br', 'Qualidade');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'ACABEI DE FALAR COM O ARI , FOI REMARCADO PARA APOS O ALMOÇO.', '2026-07-16 08:35:00-03'::timestamptz);

  -- Mensagem de Marcelo kanesaki
  v_msg_user_id := public.get_or_create_user('Marcelo kanesaki', 'pcp2@fundiferroformas.com.br', 'Qualidade');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Ari esteve na empresa e vamos ter que adptar o local de abastecimento dos cilindros, pois o caminhão não pode descarregar em lugar fora de desnivel. vamos ter que concretar para o caminhão entrar.', '2026-07-16 10:31:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'MARCELO , EXPLICA PARA COMPRAS O QUE TEM QUE SER FEITOS E PEDE PARA ELES, RESOLVEREM URGENTE', '2026-07-18 17:46:00-03'::timestamptz);

  -- Mensagem de Marcelo kanesaki
  v_msg_user_id := public.get_or_create_user('Marcelo kanesaki', 'pcp2@fundiferroformas.com.br', 'Qualidade');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'VOU FAZER UMA REUNIÃO COM COMPRAS PARA ENTENDIMENTO.', '2026-07-20 08:18:00-03'::timestamptz);

END $$;

-- 4. Remover a função auxiliar temporária criada no início do script
DROP FUNCTION IF EXISTS public.get_or_create_user(text, text, text);

-- IMPORTAÇÃO CONCLUÍDA COM SUCESSO!
