-- ============================================================
-- PASSO 3: SCRIPT PARA RE-VINCULAR OS CHAMADOS AOS NOVOS USUÁRIOS
-- Cole este código no SQL Editor do seu Supabase Dashboard DEPOIS de recriar os usuários
-- ============================================================

-- 1. Associar os chamados de volta aos novos IDs baseados no e-mail correspondente
UPDATE public.tickets t
SET created_by = p.id
FROM public.profiles p
JOIN public.temp_ticket_backups b ON p.email = b.creator_email
WHERE t.id = b.ticket_id AND t.created_by IS NULL;

-- 2. Limpar a tabela temporária de backup
DROP TABLE IF EXISTS public.temp_ticket_backups;
