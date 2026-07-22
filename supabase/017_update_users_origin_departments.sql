-- ============================================================
-- ATUALIZAÇÃO DE GRUPOS E ORIGENS DOS CHAMADOS DOS COLABORADORES
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
  -- 1. Garantir que os setores existam no banco e obter seus IDs
  INSERT INTO public.departments (name) VALUES ('PCP') ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_pcp_id FROM public.departments WHERE name = 'PCP';

  INSERT INTO public.departments (name) VALUES ('Comercial') ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_comercial_id FROM public.departments WHERE name = 'Comercial';

  INSERT INTO public.departments (name) VALUES ('Agropasi') ON CONFLICT (name) DO NOTHING;
  SELECT id INTO v_agropasi_id FROM public.departments WHERE name = 'Agropasi';

  -- 2. Obter os IDs dos perfis dos colaboradores
  SELECT id INTO v_marcelo_id FROM public.profiles WHERE full_name ILIKE '%Marcelo Kanesaki%' OR full_name ILIKE '%Marcelo%' LIMIT 1;
  SELECT id INTO v_matheus_id FROM public.profiles WHERE full_name ILIKE '%Matheus Boseli%' OR full_name ILIKE '%Matheus%' LIMIT 1;
  SELECT id INTO v_ronaldo_id FROM public.profiles WHERE full_name ILIKE '%Ronaldo Borgue%' OR full_name ILIKE '%Ronaldo%' LIMIT 1;

  -- 3. Atualizar perfis e todos os chamados existentes para as novas origens correspondentes

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
