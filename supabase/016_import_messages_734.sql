-- ============================================================
-- IMPORTAÇÃO DE MENSAGENS PENDENTES DO CHAMADO 734
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

DO $$
DECLARE
  v_ticket_id uuid;
  v_tinti_id uuid;
  v_henrique_id uuid;
  v_jc_id uuid;
BEGIN
  -- 1. Buscar o ID do ticket 734
  SELECT id INTO v_ticket_id FROM public.tickets WHERE ticket_number = 734;
  
  IF v_ticket_id IS NULL THEN
    RAISE EXCEPTION 'Chamado 734 não foi localizado no banco de dados.';
  END IF;

  -- 2. Buscar os IDs dos perfis correspondentes
  SELECT id INTO v_tinti_id FROM public.profiles WHERE full_name ILIKE '%Tinti%' LIMIT 1;
  SELECT id INTO v_henrique_id FROM public.profiles WHERE full_name ILIKE '%Henrique Compras%' OR full_name ILIKE '%Henrique%' LIMIT 1;
  SELECT id INTO v_jc_id FROM public.profiles WHERE full_name ILIKE '%Jose Carlos%' AND full_name NOT ILIKE '%Tinti%' LIMIT 1;

  IF v_tinti_id IS NULL THEN
    RAISE EXCEPTION 'Perfil do usuário José Carlos Tinti não foi localizado.';
  END IF;
  
  IF v_henrique_id IS NULL THEN
    RAISE EXCEPTION 'Perfil do usuário Henrique Compras não foi localizado.';
  END IF;

  IF v_jc_id IS NULL THEN
    RAISE EXCEPTION 'Perfil do usuário Jose Carlos não foi localizado.';
  END IF;

  -- 3. Inserir as mensagens na tabela de histórico de chat (com data e fuso horário corretos)
  
  -- Mensagem 0
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_tinti_id, 'Status em Andamento - ', '2026-07-15 11:56:00-03'::timestamptz);

  -- Mensagem 1
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_tinti_id, 'Henrique, pede retorno até as 15h sobre o relatório do conserto desse note a Dr. Note por gentileza.', '2026-07-15 11:57:00-03'::timestamptz);

  -- Mensagem 2 (Compras -> Henrique Compras)
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_henrique_id, 'Recebemos o orçamento da Dr.Note para o reparo na placa mae que está com defeito, agora o orçamento esta com o Jose carlos Tinti para resolver com o Sr. Jose carlos Pasiani.', '2026-07-16 09:56:00-03'::timestamptz);

  -- Mensagem 3
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_jc_id, 'TINTI , ONDE ESTA O ORÇAMENTO ?', '2026-07-16 12:25:00-03'::timestamptz);

  -- Mensagem 4
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_tinti_id, 'Está comigo, a tarde quando falarmos de perfil de alumínio, já falaremos sobre esse orçamento e o que ocorreu.', '2026-07-16 13:34:00-03'::timestamptz);

  -- Mensagem 5
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_tinti_id, 'Acabamos não falando na sequência da reunião do aluminio, mas amanhã na parte da manhã precisamos falar.', '2026-07-16 17:20:00-03'::timestamptz);

  -- Mensagem 6
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_jc_id, '????????????????????????????', '2026-07-18 17:52:00-03'::timestamptz);

  -- Mensagem 7 (Compras -> Henrique Compras)
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_henrique_id, 'Assim como conversado com o Sr. José carlos para poder fazer o reparo do notebook, ja informado ao local para dar inicio', '2026-07-20 11:08:00-03'::timestamptz);

  -- Mensagem 8 (Compras -> Henrique Compras)
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_henrique_id, 'Já iniciado a manutenção, resposta em 2 dias para fazer a manutenção e envio', '2026-07-20 13:22:00-03'::timestamptz);

  -- Mensagem 9 (Compras -> Henrique Compras)
  INSERT INTO public.ticket_messages (ticket_id, profile_id, content, created_at)
  VALUES (v_ticket_id, v_henrique_id, 'Conserto do notebook realizado e recuperado, de acordo com a Dr.Note tever que fazer esses reparos : "tinha algumas linhas de comunicação com problema na placa" "ai foi feita a troca dos componentes" "teve troca de pwm, mosfet e capacitor" Entao sera retirado lá.', '2026-07-22 14:55:00-03'::timestamptz);

END $$;
