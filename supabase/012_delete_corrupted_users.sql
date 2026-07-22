-- ============================================================
-- PASSO 1: SCRIPT PARA DELETAR USUÁRIOS CORROMPIDOS E CRIAR BACKUP
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

-- 1. Criar a tabela temporária de backup para salvar qual chamado pertencia a qual e-mail
CREATE TABLE IF NOT EXISTS public.temp_ticket_backups AS
SELECT t.id as ticket_id, p.email as creator_email
FROM public.tickets t
JOIN public.profiles p ON t.created_by = p.id;

-- 2. Deletar os usuários corrompidos diretamente da auth.users (isso ignora o erro do painel do Supabase)
DELETE FROM auth.users WHERE email IN (
  'almoxarifado@fundiferro.formas.com.br',
  'comercial@fundiferroformas.com.br',
  'comercial2@fundiferroformas.com.br',
  'compras@agropasi.com.br',
  'compras@fundiferroformas.com.br',
  'fundiferro@fundiferroformas.com.br'
);
