-- ============================================================
-- MIGRAÇÃO 004: Modelo de Visibilidade centrado em Usuários
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Criar tabela pivot de chamados x usuários
CREATE TABLE IF NOT EXISTS public.ticket_users (
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (ticket_id, profile_id)
);

-- Tornar destination_department_id opcional (pode ser destinado apenas a usuários individuais)
ALTER TABLE public.tickets ALTER COLUMN destination_department_id DROP NOT NULL;

-- Habilitar RLS
ALTER TABLE public.ticket_users ENABLE ROW LEVEL SECURITY;

-- Políticas para a tabela pivot ticket_users
DROP POLICY IF EXISTS "Autenticados veem envolvidos nos chamados" ON public.ticket_users;
CREATE POLICY "Autenticados veem envolvidos nos chamados"
  ON public.ticket_users FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Directors gerenciam envolvidos nos chamados" ON public.ticket_users;
CREATE POLICY "Directors gerenciam envolvidos nos chamados"
  ON public.ticket_users FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'director'
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'director'
    )
  );

-- 2. Atualizar Políticas de RLS da tabela tickets
DROP POLICY IF EXISTS "Visualizar chamados permitidos" ON public.tickets;
CREATE POLICY "Visualizar chamados permitidos"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (
    -- É o criador do chamado
    created_by = auth.uid()
    -- É director
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'director'
    )
    -- Ou está na tabela ticket_users
    OR EXISTS (
      SELECT 1 FROM public.ticket_users tu
      WHERE tu.ticket_id = tickets.id
      AND tu.profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Criar chamado do próprio setor" ON public.tickets;
CREATE POLICY "Criar chamado do próprio setor"
  ON public.tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    -- Qualquer usuário autenticado e habilitado pode criar chamados
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.tickets_enabled = true
    )
  );

DROP POLICY IF EXISTS "Atualizar chamado" ON public.tickets;
CREATE POLICY "Atualizar chamado"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (
    -- É o criador do chamado
    created_by = auth.uid()
    -- É director
    OR EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'director'
    )
    -- Ou está na tabela ticket_users (envolvidos no chamado, ex: equipe de destino)
    OR EXISTS (
      SELECT 1 FROM public.ticket_users tu
      WHERE tu.ticket_id = tickets.id
      AND tu.profile_id = auth.uid()
    )
  );
