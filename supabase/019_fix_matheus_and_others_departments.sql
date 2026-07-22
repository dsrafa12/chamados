-- ============================================================
-- CORREÇÃO DEFINITIVA DE ORIGEM E PERFIL DE MATHEUS, MARCELO E RONALDO
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

DO $$
DECLARE
  v_pcp_id uuid;
  v_comercial_id uuid;
  v_agropasi_id uuid;
  
  v_marcelo_id uuid;
  v_matheus_id uuid;
  v_ronaldo_id uuid;
BEGIN
  -- 1. Obter os IDs dos setores
  SELECT id INTO v_pcp_id FROM public.departments WHERE name = 'PCP';
  SELECT id INTO v_comercial_id FROM public.departments WHERE name = 'Comercial';
  SELECT id INTO v_agropasi_id FROM public.departments WHERE name = 'Agropasi';

  -- 2. Buscar os IDs dos perfis usando e-mails (pois o nome de exibição pode estar vazio no novo cadastro)
  SELECT id INTO v_marcelo_id FROM public.profiles WHERE email ILIKE '%marcelo%' OR email ILIKE '%pcp2%' LIMIT 1;
  SELECT id INTO v_matheus_id FROM public.profiles WHERE email ILIKE '%matheus%' OR email ILIKE '%comercial2%' LIMIT 1;
  SELECT id INTO v_ronaldo_id FROM public.profiles WHERE email ILIKE '%ronaldo%' OR email ILIKE '%ferramentaria%' LIMIT 1;

  -- 3. Corrigir nomes de exibição vazios se houver
  IF v_marcelo_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Marcelo Kanesaki' WHERE id = v_marcelo_id AND (full_name IS NULL OR full_name = '' OR full_name = 'Usuário');
  END IF;

  IF v_matheus_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Matheus Boseli' WHERE id = v_matheus_id AND (full_name IS NULL OR full_name = '' OR full_name = 'Usuário');
  END IF;

  IF v_ronaldo_id IS NOT NULL THEN
    UPDATE public.profiles SET full_name = 'Ronaldo Borgue' WHERE id = v_ronaldo_id AND (full_name IS NULL OR full_name = '' OR full_name = 'Usuário');
  END IF;

  -- 4. Atualizar setores e origens dos chamados correspondentes

  -- Marcelo Kanesaki -> PCP
  IF v_marcelo_id IS NOT NULL AND v_pcp_id IS NOT NULL THEN
    UPDATE public.profiles SET department_id = v_pcp_id WHERE id = v_marcelo_id;
    INSERT INTO public.profile_departments (profile_id, department_id) VALUES (v_marcelo_id, v_pcp_id) ON CONFLICT DO NOTHING;
    UPDATE public.tickets SET origin_department_id = v_pcp_id WHERE created_by = v_marcelo_id;
  END IF;

  -- Matheus Boseli -> Comercial
  IF v_matheus_id IS NOT NULL AND v_comercial_id IS NOT NULL THEN
    UPDATE public.profiles SET department_id = v_comercial_id WHERE id = v_matheus_id;
    INSERT INTO public.profile_departments (profile_id, department_id) VALUES (v_matheus_id, v_comercial_id) ON CONFLICT DO NOTHING;
    UPDATE public.tickets SET origin_department_id = v_comercial_id WHERE created_by = v_matheus_id;
  END IF;

  -- Ronaldo Borgue -> Agropasi
  IF v_ronaldo_id IS NOT NULL AND v_agropasi_id IS NOT NULL THEN
    UPDATE public.profiles SET department_id = v_agropasi_id WHERE id = v_ronaldo_id;
    INSERT INTO public.profile_departments (profile_id, department_id) VALUES (v_ronaldo_id, v_agropasi_id) ON CONFLICT DO NOTHING;
    UPDATE public.tickets SET origin_department_id = v_agropasi_id WHERE created_by = v_ronaldo_id;
  END IF;

END $$;
