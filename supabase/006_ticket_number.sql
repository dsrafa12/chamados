-- ============================================================
-- MIGRAÇÃO 006: Adição de Número Sequencial aos Chamados
-- ============================================================

-- 1. Adicionar coluna ticket_number autoincremental (SERIAL)
ALTER TABLE public.tickets ADD COLUMN IF NOT EXISTS ticket_number SERIAL;

-- 2. Garantir que a coluna seja única
ALTER TABLE public.tickets ADD CONSTRAINT tickets_ticket_number_key UNIQUE (ticket_number);
