-- ============================================================
-- MIGRAÇÃO 002: Restringir cadastro e definir admin
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Definir ds.rafa@hotmail.com como director (admin)
UPDATE public.profiles
SET role = 'director'
WHERE email = 'ds.rafa@hotmail.com';

-- 2. Directors podem atualizar qualquer profile (atribuir setor/role)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'profiles'
    AND policyname = 'Directors podem atualizar qualquer perfil'
  ) THEN
    EXECUTE 'CREATE POLICY "Directors podem atualizar qualquer perfil"
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
          AND p.role = ''director''
        )
      )
      WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.profiles p
          WHERE p.id = auth.uid()
          AND p.role = ''director''
        )
      )';
  END IF;
END
$$;

-- 3. Directors podem ver todos os profiles (para gerenciamento)
-- (já temos a policy "Autenticados podem ver todos os perfis")

-- ============================================================
-- CONCLUÍDO! ds.rafa@hotmail.com agora é director/admin.
-- ============================================================
