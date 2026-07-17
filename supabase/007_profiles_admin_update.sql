-- ============================================================
-- MIGRAÇÃO 007: Habilitar Super Admin atualizar perfis de terceiros (Otimizado)
-- ============================================================

-- Adiciona política usando metadados do JWT para evitar recursão infinita no banco
DROP POLICY IF EXISTS "Super admins podem atualizar qualquer perfil" ON public.profiles;
CREATE POLICY "Super admins podem atualizar qualquer perfil"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (
    auth.uid() = id 
    OR auth.jwt() ->> 'email' = 'ds.rafa@hotmail.com'
  )
  WITH CHECK (
    auth.uid() = id 
    OR auth.jwt() ->> 'email' = 'ds.rafa@hotmail.com'
  );
