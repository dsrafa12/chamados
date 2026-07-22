-- ============================================================
-- SCRIPT DE IMPORTAÇÃO DE CHAMADOS DO FIREBASE PARA SUPABASE
-- Execute este script no SQL Editor do seu Supabase Dashboard
-- ============================================================

-- 1. Criar a função auxiliar temporária para obter ou criar usuários de forma segura com senha crypt('123456')
CREATE OR REPLACE FUNCTION public.get_or_create_user(p_full_name text, p_email text, p_dept_name text)
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

-- 3. Cadastrar usuários adicionais solicitados
SELECT public.get_or_create_user('Silvana', 'compras@agropasi.com.br', 'Compras');
SELECT public.get_or_create_user('Rodrigo', 'fundiferro@fundiferroformas.com.br', 'Produção');
SELECT public.get_or_create_user('Lucimar', 'almoxarifado@fundiferro.formas.com.br', 'Almoxarifado');


-- CHAMADO SEQUENCIAL #719
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
    'COMPRENSOR',
    'PESSOAL PRECISO DE UMA POSICAO DE QUANDO O TECNICO DO COMPRENSOR VIRA PARA ESTALAR OS SECADORES',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Ferramentaria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    719,
    '2026-07-13 14:09:37-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Qual compressor seria? os chigago da fabrica da fundiferro ou os Pumas do laser ?', '2026-07-13 14:34:00-03'::timestamptz);

  -- Mensagem de Henrique
  v_msg_user_id := public.get_or_create_user('Henrique', 'compras@fundiferroformas.com.br', 'Compras');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Status em Andamento -', '2026-07-13 14:34:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'OS DA FABRICA CHICAGO', '2026-07-13 15:37:00-03'::timestamptz);

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Zé Pasiani, esse tema trata-se do que falamos hoje, o orçamento da Puma do secador e do reservatório.', '2026-07-13 17:19:00-03'::timestamptz);

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Conforme reunião que tive ontem com Zé Pasiani, ele pediu para aguardar até agosto para voltar a falar sobre esse tema, não irá fazer esse trabalho nesse momento no compressor. Ele achou que o compressor do laser estava com problemas, do laser está ok, é da fábrica que precisa ser feito o trabalho do secador.', '2026-07-14 09:12:00-03'::timestamptz);

  -- Mensagem de José Carlos Tinti
  v_msg_user_id := public.get_or_create_user('José Carlos Tinti', 'jcarlos.tinti@gmail.com', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Encaminhado - Manutenção', '2026-07-14 09:12:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'ZE CARLOS PASIANE COMPRAS ME INFORMOU QUE VC NAO AUTORIZOU A MANUTENCAO DOS SECADOR NOS COMPRENSORES CHICAGO DA FABRICA', '2026-07-14 13:06:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'EU NÃO AUTORIZEI A COMPRA DO SECADOR E RESERVATÓRIO , NESTE MOMENTO . A MANUTENÇÃO JAMAIS VOU DEIXAR DE APROVAR.', '2026-07-18 17:49:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #800
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Jando Bonfim', 'jandobonfim@gmail.com', 'Ferramentaria');

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
    'FERRAMENTA DO V DO ELITE ESCADA METAX',
    'FERRAMENTA DE CORTE E DOBRA AFIAR O CORTE',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Ferramentaria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    800,
    '2026-07-22 08:29:01-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

END $$;

-- CHAMADO SEQUENCIAL #713
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Jando Bonfim', 'jandobonfim@gmail.com', 'Ferramentaria');

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
    'GUILHOTINA CN01',
    'TROCAR AS FACAS',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Ferramentaria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    713,
    '2026-07-13 07:01:05-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'SEM RESPOSTAS', '2026-07-18 17:47:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'AINDA NAO CONSEGUIU VAMOS NOS PROGRAMAR ESSA SEMANA', '2026-07-20 13:26:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #715
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
    'Setor Aluminio - Braço Pneumatico ',
    ' Solicito a finalização da montagem do braço pneumático no Setor de Alumínio. O equipamento é essencial para a continuidade das operações do setor, e a conclusão da montagem evitará gargalos na produção e garantirá a segurança dos operadores na movimentação das peças.',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    715,
    '2026-07-13 08:35:19-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Coloca a data que será resolvido', '2026-07-13 12:34:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'JA ESTAMOS FALANDO COM ALFATEK SE NAO CHEGOU VAMOS PEDIR PARA COMPRAR EM OUTRO LUGAR', '2026-07-16 16:47:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #764
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
    'TOP SOLID E REWET',
    'PETER, QUEM ESTA TRABALHANDO NESSES PROCESSO ? PRECISO DA POSIÇÃO TODAS AS SEXTA-FEIRAS A EVOLUÇÃO ',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Diretoria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    764,
    '2026-07-16 12:58:13-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Peter Prudencio
  v_msg_user_id := public.get_or_create_user('Peter Prudencio', 'projetos@fundiferroformas.com.br', 'Projetos');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Top Solid conseguimos trabalhar mas deu problema no programa e estou falando com o suporte técnico. Revit nao está trabalhando pois precisamos do computador que queimou. Compramos outro computador para o Vaine e o do Vaine iria para Daiana. O da Daina é muito lento.', '2026-07-16 13:04:00-03'::timestamptz);

  -- Mensagem de Peter Prudencio
  v_msg_user_id := public.get_or_create_user('Peter Prudencio', 'projetos@fundiferroformas.com.br', 'Projetos');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'No Top Solid nao estamos conseguindo importar o pacote de paineis que o Matheus desenvolveu. Acionamos o suporte, ainda não resolveram, pediram um prazo para eles analisarem. Devemos ter retorno 2ª feira', '2026-07-17 21:13:00-03'::timestamptz);

  -- Mensagem de Peter Prudencio
  v_msg_user_id := public.get_or_create_user('Peter Prudencio', 'projetos@fundiferroformas.com.br', 'Projetos');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Revit estamos no aguardo do computador da Daiana chegar para dar andamento', '2026-07-17 21:14:00-03'::timestamptz);

  -- Mensagem de Peter Prudencio
  v_msg_user_id := public.get_or_create_user('Peter Prudencio', 'projetos@fundiferroformas.com.br', 'Projetos');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Tive uma reunião com o Matheus, ele falou que cobra da Fundiferro apenas 1 funcionário, valor do funcionario por dia R$ 390,00 Alinhamos que ele vai levantar quantas horas precisaria para concluir o que eles estão fazendo Eu vou levantar aqui o que mais faltaria para terminarmos este desenvolvimento e conseguir fazer todos os paineis pelo Top Solid (Fundiferro, Forsa, Sform) Iremos nos reunir quinta ou sexta-feira desta semana, vou passar para eles tudo o que faltaria a ser feito, ele vai estimar um tempo. Feito isso nos reuniremos todos nós, inclusive com o Zé Carlos, para definir como iremos fazer o restante dos desenvolvimentos. Por ex: 15 dias de trabalho por mes, 12 dias, etc. Assim já terá uma estimativa de custo total.', '2026-07-20 13:27:00-03'::timestamptz);

  -- Mensagem de Peter Prudencio
  v_msg_user_id := public.get_or_create_user('Peter Prudencio', 'projetos@fundiferroformas.com.br', 'Projetos');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Sobre fazer aqui dentro, eu e ele achamos que não daria certo, pois eles estão num nível muito acima, a ponto de importar uma lista inteira de paineis e ele criar sozinho, coisa que nem saberiamos como fazer. Nao compensaria ele gastar horas ensinando a gente fazer ,', '2026-07-20 13:28:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #754
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
    'ORÇAMENTO CONSTRUTORA 7 LM',
    'SERÁ ENVIADO HOJE ?',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Diretoria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    754,
    '2026-07-16 12:41:49-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'SEM RESPOSTA', '2026-07-18 17:58:00-03'::timestamptz);

  -- Mensagem de Adriel
  v_msg_user_id := public.get_or_create_user('Adriel', 'comercial@fundiferroformas.com.br', 'Projetos');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Zé, estavamos agurdando retorno do cliente sobre algumas duvidas desse orçamento, foi respondido por ele no final de semana, estamos seguindo com o levantamento da proposta hoje, é um orçamento mais complexo, pois se trata de uma adaptação.', '2026-07-20 08:03:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #751
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
    'MAQUINA VAP (FAGNER)',
    ' FOI SOLIICTADO A MANUTENÇÃO DA MAQUINA LAVADORA VAP DO DEPARTAMENTO DE LIMPEZA . PODERIA DAR UMA POSIÇÃO? A PARTIR DE AGORA FORMALIZADO.',
    'medium',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Qualidade' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    751,
    '2026-07-16 10:32:29-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'PRECISO QUE TODOS OS CHAMADOS ABERTOS SEJA RESPONDIDO COM DATA PREVISTA DO CONSERTO', '2026-07-16 12:13:00-03'::timestamptz);

  -- Mensagem de Marcelo kanesaki
  v_msg_user_id := public.get_or_create_user('Marcelo kanesaki', 'pcp2@fundiferroformas.com.br', 'Qualidade');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'TEMOA SUMA POSIÇÃO EM RELAÇÃO ?', '2026-07-17 09:20:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'SEM RESPOSTAS', '2026-07-18 17:57:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'QUANDO FOR ASSIM TRAZER A MAQUINA NA MANUTENCAO VAMOS TER QUE IR ATRAS DA MAQUINA QUE NAO ESTA AQUI', '2026-07-20 13:33:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #799
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
    'REFLETOR PARA TERRENO DO ZE',
    '4 REFLETORES DE 2000WATS 5 REFETORES DE 500 WATS',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Ferramentaria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    799,
    '2026-07-22 07:29:50-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

END $$;

-- CHAMADO SEQUENCIAL #388
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
    'Setor Aluminio - Prensa Pequena Perto Da Ferramentaria',
    'Preciso que faça o levantamento para arrumar esta prensa.',
    'low',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    388,
    '2026-03-19 14:09:12-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Esta Aberto desde Março ?', '2026-07-04 18:56:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'ESSA PRENSA TEM QUE FAZER TD NELA EIXO BUCHA TD NOVO ACHO QUE NAO COMPENSA FAZER', '2026-07-13 14:03:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'RONALDO , ME PROCURA PARA FALARMOS SOBRE ESTA PRENSA.', '2026-07-18 17:32:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #685
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
    'FERRAMENTA - ESTAMPO FAQUETA 32',
    ' SOLICITAÇÃO DE CONSERTO DA FERRAMENTA DO ESTAMPO FAQUETA 32. PROCURAR JANDO PARA MAIS DETALHES.',
    'medium',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Qualidade' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    685,
    '2026-07-02 13:42:17-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Novamente sem resposta, não foi ficar aceitandoisto, essas chamadas são de extrama necessidade', '2026-07-11 09:26:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'ESSA FERRAMENTA TEM QUE FAZER NOVA A VELHA TA COMDENADA', '2026-07-20 13:20:00-03'::timestamptz);

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
    'Compras Caneta Feira',
    'Precisamos de uma posição sobre a compra das canetas da feira, ela precisa estar na empresa até 05/08 pois será o dia que o Luciano ira sair para a feira levando a forma e itens que iremos expor.',
    'high',
    'open', -- Todos importados como "Pendente" (open)
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

END $$;

-- CHAMADO SEQUENCIAL #710
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
    'Setor Pré Montagem - Furadeira Bancada',
    'Por favor verificar com maxima urgencia a furadeira que esta com Zé Paulo, correia fica escapando.',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    710,
    '2026-07-10 16:40:52-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Sem resposta ??????????????????????', '2026-07-11 09:29:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'SEM RESPOSTAS', '2026-07-18 17:45:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'VAMOS TIRAR TEM QUE TIRAR E PEDIR NOVA', '2026-07-20 13:25:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #766
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
    'PEÇAS RIO DE JANEIRO',
    'QUAL PROGRAMAÇÃO DO CONSERTO DAS PEÇAS DO RIO DE JANEIRO MRV. QUAL CHAMADO É O DO ÉDER ?',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Diretoria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    766,
    '2026-07-16 13:03:00-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'SEM RESPOSTA', '2026-07-18 18:01:00-03'::timestamptz);

  -- Mensagem de Marcelo kanesaki
  v_msg_user_id := public.get_or_create_user('Marcelo kanesaki', 'pcp2@fundiferroformas.com.br', 'Qualidade');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'fo efetuado o Romaneio e estamos marcando uma reunião para definir a real sobre yodo o material..o que fazer.', '2026-07-20 08:07:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #757
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
    'CONSTRUTORA COELHO',
    'COMO ESTÁ O ORÇAMENTO DESTE CLIENTE ?',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Diretoria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    757,
    '2026-07-16 12:46:18-03'::timestamptz
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

-- CHAMADO SEQUENCIAL #670
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
    'Setor Aluminio - Ferramenta De Cortar Cantos',
    'Bom dia!, ja faz tempo que venho falando pra fazer uma ferramenta para cortar os cantos dos paienis com BORDA de 80, Ronaldo colocar nas sua pendencia para fazer esta ferramenta.',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    670,
    '2026-06-29 08:04:02-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Ronaldo novamente sem resposta porque???????????????', '2026-07-11 09:25:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'CONTINUA SEM RESPOSTAS', '2026-07-18 17:43:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'ZE ESTAMOS FAZENDO A TUPIA E A FERRAMENTA DE RASGAR PINO NOVA', '2026-07-20 13:18:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #597
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Jando Bonfim', 'jandobonfim@gmail.com', 'Ferramentaria');

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
    'FR- 04 -FURADEIRA RADIAL BERGONZI',
    'MAQUINA COM VAZAMENTO DE ÓLEO',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Ferramentaria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    597,
    '2026-06-09 08:25:28-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Este vazamento foi arrumado ?', '2026-07-04 19:03:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'AINDA NAO VAMOS TENTAR TIRAR O VAZAMENTO', '2026-07-08 14:23:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Quando esta programado , precisa ser colocada a data que será executado o sefviço , não apenas vamos consertar.', '2026-07-11 09:19:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'RONALDO DESDE 11/07 ESTOU AGUARDANDO SEU RETORNO', '2026-07-18 17:38:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'ZE FALEI COM O JANDO E ELE FALOU QUE NAO PODE PARAR A MAQUINA', '2026-07-20 13:08:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #709
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
    'Setor Aluminio - Ferramenta Nova De Rasgo De Faqueta',
    'boa tarde! precisamos com maxima urgencia ',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    709,
    '2026-07-10 16:39:49-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Sem respostas ????????????????????????', '2026-07-11 09:29:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'SEM RESPOSTAS', '2026-07-18 17:45:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'SE FOR A TUPIA NOVA ESTAMOS FAZENDO', '2026-07-20 13:23:00-03'::timestamptz);

  -- Mensagem de Eder Pires
  v_msg_user_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'sim é esta, tem previsão para conclusão desta ferramenta?', '2026-07-20 15:43:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #403
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
    'Setor Aluminio - Prensa Rasgar Costela',
    'Desde quando arrumou esta prensa venho pedindo para colocar a proteção nos volantes, até o momento não foi colocado',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    403,
    '2026-03-24 08:17:55-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, '??????? esta em aberto', '2026-07-04 18:57:00-03'::timestamptz);

  -- Mensagem de Eder Pires
  v_msg_user_id := public.get_or_create_user('Eder Pires', 'qualidade@fundiferroformas.com.br', 'Alumínio');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'auardando colocar proteção', '2026-07-07 11:26:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Onde esta a resposta ??????????????', '2026-07-11 09:11:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'ESSA SEMANA VAMS VER SEM FALTA', '2026-07-13 14:05:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'RONALDO FOI RESOLVIDO ?', '2026-07-18 17:33:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'COMECAMOS A FAZER MAS PRECISAMOS PARAR PARA FAZER OUTRAS COISAS MAS VAMOS ACABAR', '2026-07-20 13:17:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #561
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Jando Bonfim', 'jandobonfim@gmail.com', 'Ferramentaria');

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
    'PE-12- PRENSA',
    'PRENSA COM FOLGA NO MARTELO',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Ferramentaria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    561,
    '2026-05-22 09:36:16-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Foi consertado esta prensa ?', '2026-07-04 19:02:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Resposta , não vou adimitir que fica sem resposta', '2026-07-11 09:18:00-03'::timestamptz);

  -- Mensagem de Jando Bonfim
  v_msg_user_id := public.get_or_create_user('Jando Bonfim', 'jandobonfim@gmail.com', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Zé essa prensa é a prensa que foi comprado do Porquinho precisa dar uma melhorada no martelo.', '2026-07-15 08:51:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #624
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Jando Bonfim', 'jandobonfim@gmail.com', 'Ferramentaria');

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
    'FERRAMENTA DO MANCAL',
    '',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Ferramentaria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    624,
    '2026-06-16 14:06:35-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'O que tem esta ferramenta , que nada foi informado', '2026-07-04 19:05:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'FERRAMENTA ESTA EM RIO PRETO NO CORTE A FIO PREVISAO DE ATE TERCA FEIRA ESTAR AQUI', '2026-07-08 11:01:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'NOVAMENTE SEM RESPOSTA', '2026-07-18 17:39:00-03'::timestamptz);

  -- Mensagem de Ronaldo Ferramentaria
  v_msg_user_id := public.get_or_create_user('Ronaldo Ferramentaria', 'ronaldo.ferramentaria@fundiferroformas.com.br', 'Ferramentaria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'A FERRAMENTA ESTA EM RIO PRETO AMANHA E PRA ESTAR AQUI', '2026-07-20 13:09:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #752
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Ronaldo Borgue', 'pcp@agropasi.com.br', 'Manutenção');

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
    'REFORMA DA PLAINA DO AGRICOLA',
    ' CONVERSADO COM O SR. LUIS, SR. WILLIAN E COM O SR. JOSÉ CARLOS SOBRE A REFORMA DE NOSSA PLAINA E RESTRUTURAÇÃO DA MESMA PARA PODER-MOS FAZER RASGOS DE FAQUETAS INTERNAMENTE. PRECISAMOS URGENTE VER ESTA QUESTÃO.',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    752,
    '2026-07-16 11:07:43-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'RONALDO , VEJA VC E LUIS , QUANDO CONSEGUE DEIXARBESTA AQUINA FUNCIONANDO E NOS INFORMA', '2026-07-16 12:12:00-03'::timestamptz);

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'SEM RESPOSTA', '2026-07-18 17:58:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #700
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
    'Setor Aluminio - Maquina De Solda Torck Renan Paulino',
    ' Bom dia! preciso que de uma verificada na maquina de solda do colaborador por tive que retirar uma de outro setor.',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Alumínio' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    700,
    '2026-07-08 10:16:06-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'SEM RESPOSTA', '2026-07-18 18:03:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #775
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
    'Pontos De Rede Sem Funcionamento',
    'Temos 2 potnos de rede sem funcionamento, porém ao acionado a JP, foi falado que o cabo não está chegando no switch',
    'medium',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Projetos' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    775,
    '2026-07-17 09:04:30-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'SEM RESPOSTA', '2026-07-18 18:03:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #771
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
    'Dúvida Pacaembu',
    'Favor confirmar se haverá a segurança de laje a concretar Está na proposta linha de vida antiqueda, mas que não será furado o painel de laje. favor nos explicar como funcionará, pois ela precisa atravessar a laje.',
    'medium',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Projetos' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    771,
    '2026-07-16 17:27:44-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Peter Prudencio
  v_msg_user_id := public.get_or_create_user('Peter Prudencio', 'projetos@fundiferroformas.com.br', 'Projetos');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'além disso, não veio a quantidade da segurança laje a concretar, nem da linha de vida', '2026-07-16 17:29:00-03'::timestamptz);

  -- Mensagem de Matheus Boseli
  v_msg_user_id := public.get_or_create_user('Matheus Boseli', 'comercial2@fundiferroformas.com.br', 'Engenharia');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Peter segurança laje a concretar vai ter sim. Quanto a linha de vida o Renato da Pacaembu pensa em colocar 04 ou seis postes da linha de vida fixando na forma, (ainda a definir) Quantidade dos acessorios esta no anexo.', '2026-07-17 08:15:00-03'::timestamptz);

  -- Mensagem de Peter Prudencio
  v_msg_user_id := public.get_or_create_user('Peter Prudencio', 'projetos@fundiferroformas.com.br', 'Projetos');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Matheus, obrigado. Porém para executar o projeto preciso entender como será feito o sistema de linha de vida. Não enxergo como não será furada a laje.', '2026-07-17 09:01:00-03'::timestamptz);

  -- Mensagem de Peter Prudencio
  v_msg_user_id := public.get_or_create_user('Peter Prudencio', 'projetos@fundiferroformas.com.br', 'Projetos');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Outra coisa, no escopo está duas linhas de vida, mas são 4 ou 6?', '2026-07-17 09:02:00-03'::timestamptz);

  -- Mensagem de Matheus Boseli
  v_msg_user_id := public.get_or_create_user('Matheus Boseli', 'comercial2@fundiferroformas.com.br', 'Engenharia');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Iremos ter uma posição dia 20/07 das pendencias e volto a indormar o que foi definido.', '2026-07-17 10:57:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #755
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
    'ORÇAMENTO EMCCAMP SÉ 70',
    'SERÁ ENVIADO HOJE ?',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Diretoria' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    755,
    '2026-07-16 12:43:52-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Jose Carlos
  v_msg_user_id := public.get_or_create_user('Jose Carlos', 'jc@fundiferroformas.com.br', 'Diretoria');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'SEM RESPOSTA', '2026-07-18 17:59:00-03'::timestamptz);

  -- Mensagem de Matheus Boseli
  v_msg_user_id := public.get_or_create_user('Matheus Boseli', 'comercial2@fundiferroformas.com.br', 'Engenharia');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Levantamento feito, aguardando revisão da proposta para enviar ao cliente.', '2026-07-20 08:44:00-03'::timestamptz);

END $$;

-- CHAMADO SEQUENCIAL #753
DO $$
DECLARE
  v_ticket_id uuid;
  v_creator_id uuid;
  v_msg_user_id uuid;
BEGIN
  -- Obter/criar criador do chamado
  v_creator_id := public.get_or_create_user('Matheus Boseli', 'comercial2@fundiferroformas.com.br', 'Engenharia');

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
    'ABC',
    'Diretor José Carlos passou na sala e cobrou a posição da ABC, pediu pra abrir esse chamado para ficar registrado e ele conseguir ir vendo o desempenho do projeto.',
    'high',
    'open', -- Todos importados como "Pendente" (open)
    v_creator_id,
    COALESCE((SELECT department_id FROM public.profiles WHERE id = v_creator_id LIMIT 1), (SELECT id FROM public.departments WHERE name = 'Engenharia' LIMIT 1)),
    (SELECT id FROM public.departments WHERE name = 'Manutenção' LIMIT 1),
    753,
    '2026-07-16 11:08:47-03'::timestamptz
  ) RETURNING id INTO v_ticket_id;

  -- Adicionar visibilidade para o criador
  INSERT INTO public.ticket_users (ticket_id, profile_id)
  VALUES (v_ticket_id, v_creator_id)
  ON CONFLICT DO NOTHING;

  -- Mensagem de Peter Prudencio
  v_msg_user_id := public.get_or_create_user('Peter Prudencio', 'projetos@fundiferroformas.com.br', 'Projetos');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Precisamos fazer uma reunião para alinhar. Temos ABC entrando além da programação Novamente outra lista de paineis faltantes da Intendente. Tudo isso no meio dos projetos do mes. tudo urgente. Não consigo falar quando este projeto ficará pronto', '2026-07-16 12:53:00-03'::timestamptz);

  -- Mensagem de Peter Prudencio
  v_msg_user_id := public.get_or_create_user('Peter Prudencio', 'projetos@fundiferroformas.com.br', 'Projetos');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Alinhado com o João Wictor, terminar a modulação no fim de semana, para segunda-feira termos a lista de peças e a área para enviar o orçamento.', '2026-07-17 07:46:00-03'::timestamptz);

  -- Mensagem de Peter Prudencio
  v_msg_user_id := public.get_or_create_user('Peter Prudencio', 'projetos@fundiferroformas.com.br', 'Projetos');
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_msg_user_id, 'Enviado para o Paulo metragam e quantidade de paineis. Opção para fazer os projetos de fabricação fora de hora, o João faria e enviariamos para produção próxima segunda-feira dia 27/07. Total 105 peças', '2026-07-20 17:10:00-03'::timestamptz);

END $$;

-- 4. Remover a função auxiliar temporária criada no início do script
DROP FUNCTION IF EXISTS public.get_or_create_user(text, text, text);

-- IMPORTAÇÃO CONCLUÍDA COM SUCESSO!
