-- ============================================================
-- SCRIPT DE REPARO DOS USUÁRIOS E PASSWORDS NO SUPABASE
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

-- 1. Deletar quaisquer identidades corrompidas ou anteriores desses usuários
DELETE FROM auth.identities 
WHERE user_id IN (
  SELECT id FROM auth.users 
  WHERE email IN (
    'almoxarifado@fundiferro.formas.com.br',
    'comercial@fundiferroformas.com.br',
    'comercial2@fundiferroformas.com.br',
    'compras@agropasi.com.br',
    'compras@fundiferroformas.com.br',
    'fundiferro@fundiferroformas.com.br'
  )
);

-- 2. Inserir novas identidades limpas e válidas para restabelecer os logins
INSERT INTO auth.identities (id, user_id, identity_data, provider, provider_id, last_sign_in_at, created_at, updated_at)
SELECT 
  id, 
  id, 
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 
  'email', 
  id::text, 
  now(), 
  now(), 
  now()
FROM auth.users
WHERE email IN (
  'almoxarifado@fundiferro.formas.com.br',
  'comercial@fundiferroformas.com.br',
  'comercial2@fundiferroformas.com.br',
  'compras@agropasi.com.br',
  'compras@fundiferroformas.com.br',
  'fundiferro@fundiferroformas.com.br'
);

-- 3. Forçar e certificar a senha padrão '123456' e e-mail como confirmado
UPDATE auth.users 
SET encrypted_password = crypt('123456', gen_salt('bf')),
    email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email IN (
  'almoxarifado@fundiferro.formas.com.br',
  'comercial@fundiferroformas.com.br',
  'comercial2@fundiferroformas.com.br',
  'compras@agropasi.com.br',
  'compras@fundiferroformas.com.br',
  'fundiferro@fundiferroformas.com.br'
);
