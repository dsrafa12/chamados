-- ============================================================
-- SCRIPT PARA CORRIGIR IDENTIDADES E CONFIRMAÇÕES DE E-MAIL DOS USUÁRIOS
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

-- 1. Confirmar todos os e-mails pendentes na tabela auth.users
UPDATE auth.users 
SET email_confirmed_at = COALESCE(email_confirmed_at, now()),
    updated_at = now()
WHERE email_confirmed_at IS NULL;

-- 2. Inserir as identidades de login de e-mail ausentes na tabela auth.identities
INSERT INTO auth.identities (id, user_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
SELECT 
  id, 
  id, 
  jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true), 
  'email', 
  now(), 
  now(), 
  now()
FROM auth.users
ON CONFLICT (provider, id) DO NOTHING;
