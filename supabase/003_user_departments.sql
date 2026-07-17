-- ============================================================
-- MIGRAÇÃO 003: Tabela relacional Usuário x Setor (Múltiplos Setores)
-- Execute no SQL Editor do Supabase
-- ============================================================

-- 1. Criar tabela pivot
CREATE TABLE IF NOT EXISTS public.profile_departments (
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  department_id uuid REFERENCES public.departments(id) ON DELETE CASCADE,
  PRIMARY KEY (profile_id, department_id)
);

-- Habilitar RLS
ALTER TABLE public.profile_departments ENABLE ROW LEVEL SECURITY;

-- Políticas para profile_departments
CREATE POLICY "Autenticados veem setores dos perfis"
  ON public.profile_departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Directors gerenciam setores dos perfis"
  ON public.profile_departments FOR ALL
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

-- 2. Migrar dados existentes da relação 1:N para N:N
INSERT INTO public.profile_departments (profile_id, department_id)
SELECT id, department_id 
FROM public.profiles 
WHERE department_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- 3. Atualizar Políticas de RLS da tabela tickets para suportar múltiplos setores
DROP POLICY IF EXISTS "Visualizar chamados permitidos" ON public.tickets;
CREATE POLICY "Visualizar chamados permitidos"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (
    -- É o criador do chamado
    created_by = auth.uid()
    OR
    -- É director?
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'director'
    )
    OR
    -- Setor de origem está nos meus setores
    origin_department_id IN (
      SELECT department_id FROM public.profile_departments WHERE profile_id = auth.uid()
    )
    OR
    -- Setor de destino está nos meus setores
    destination_department_id IN (
      SELECT department_id FROM public.profile_departments WHERE profile_id = auth.uid()
    )
    OR
    -- Algum dos meus setores está na visibilidade compartilhada
    EXISTS (
      SELECT 1 FROM public.ticket_visibility tv
      WHERE tv.ticket_id = tickets.id
      AND tv.department_id IN (
        SELECT department_id FROM public.profile_departments WHERE profile_id = auth.uid()
      )
    )
  );

DROP POLICY IF EXISTS "Criar chamado do próprio setor" ON public.tickets;
CREATE POLICY "Criar chamado do próprio setor"
  ON public.tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND
    origin_department_id IN (
      SELECT department_id FROM public.profile_departments WHERE profile_id = auth.uid()
    )
  );

DROP POLICY IF EXISTS "Atualizar chamado" ON public.tickets;
CREATE POLICY "Atualizar chamado"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (
    created_by = auth.uid()
    OR
    destination_department_id IN (
      SELECT department_id FROM public.profile_departments WHERE profile_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'director'
    )
  );

-- 4. Quebrar recursão circular na tabela ticket_visibility
DROP POLICY IF EXISTS "Ver visibilidade de chamados acessíveis" ON public.ticket_visibility;
CREATE POLICY "Ver visibilidade de chamados acessíveis"
  ON public.ticket_visibility FOR SELECT
  TO authenticated
  USING (true);
