-- ============================================================
-- PASSO 3: SCRIPT PARA RE-VINCULAR OS CHAMADOS AOS NOVOS USUÁRIOS
-- Cole este código no SQL Editor do seu Supabase Dashboard DEPOIS de recriar os usuários
-- ============================================================

-- 1. Associar os chamados de volta aos novos IDs baseados no nome do criador correspondente
UPDATE public.tickets t
SET created_by = p.id
FROM public.profiles p
JOIN public.temp_ticket_backups b ON t.id = b.ticket_id
WHERE t.created_by IS NULL 
  AND (
    (b.creator_email = 'almoxarifado@fundiferro.formas.com.br' AND p.full_name = 'Lucimar') OR
    (b.creator_email = 'comercial@fundiferroformas.com.br' AND p.full_name = 'Adriel') OR
    (b.creator_email = 'comercial2@fundiferroformas.com.br' AND p.full_name = 'Matheus Boseli') OR
    (b.creator_email = 'compras@agropasi.com.br' AND p.full_name = 'Silvana') OR
    (b.creator_email = 'compras@fundiferroformas.com.br' AND p.full_name = 'Henrique') OR
    (b.creator_email = 'fundiferro@fundiferroformas.com.br' AND p.full_name = 'Rodrigo')
  );

-- 2. Limpar a tabela temporária de backup
DROP TABLE IF EXISTS public.temp_ticket_backups;
