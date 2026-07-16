-- ============================================================
-- MIGRAÇÃO: Sistema de Chamados Intersetoriais
-- Projeto: PROPCP (Supabase)
-- Data: 2026-07-16
-- 
-- ATENÇÃO: Esta migração NÃO altera dados existentes.
-- Ela adiciona colunas à tabela profiles e cria 3 novas tabelas.
-- Execute este script no SQL Editor do Supabase Dashboard.
-- ============================================================

-- =====================
-- 1. TABELA: departments
-- =====================
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Seed: setor Diretoria (necessário para a regra de visibilidade)
INSERT INTO public.departments (name) VALUES ('Diretoria')
ON CONFLICT (name) DO NOTHING;

-- =====================
-- 2. ALTER: profiles (adicionar colunas novas)
-- =====================
-- Adiciona department_id (FK para departments)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS department_id uuid REFERENCES public.departments(id);

-- Adiciona role (user ou director)
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS role text DEFAULT 'user' CHECK (role IN ('user', 'director'));

-- Index para buscas por setor
CREATE INDEX IF NOT EXISTS idx_profiles_department ON public.profiles(department_id);

-- =====================
-- 3. TABELA: tickets
-- =====================
CREATE TABLE IF NOT EXISTS public.tickets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  origin_department_id uuid NOT NULL REFERENCES public.departments(id),
  destination_department_id uuid NOT NULL REFERENCES public.departments(id),
  priority text NOT NULL DEFAULT 'medium' CHECK (priority IN ('low', 'medium', 'high')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'in_progress', 'resolved')),
  created_by uuid NOT NULL REFERENCES public.profiles(id),
  created_at timestamptz DEFAULT now()
);

-- Indexes para performance nas queries filtradas e RLS
CREATE INDEX IF NOT EXISTS idx_tickets_origin ON public.tickets(origin_department_id);
CREATE INDEX IF NOT EXISTS idx_tickets_destination ON public.tickets(destination_department_id);
CREATE INDEX IF NOT EXISTS idx_tickets_status ON public.tickets(status);
CREATE INDEX IF NOT EXISTS idx_tickets_created_by ON public.tickets(created_by);

-- =====================
-- 4. TABELA: ticket_visibility
-- =====================
CREATE TABLE IF NOT EXISTS public.ticket_visibility (
  ticket_id uuid NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  department_id uuid NOT NULL REFERENCES public.departments(id) ON DELETE CASCADE,
  PRIMARY KEY (ticket_id, department_id)
);

CREATE INDEX IF NOT EXISTS idx_ticket_visibility_dept ON public.ticket_visibility(department_id);

-- ============================================================
-- 5. ROW LEVEL SECURITY (RLS)
-- ============================================================

-- --------------------
-- 5a. departments: todos autenticados leem; directors gerenciam
-- --------------------
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Autenticados podem ver setores"
  ON public.departments FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Directors podem inserir setores"
  ON public.departments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'director'
    )
  );

CREATE POLICY "Directors podem atualizar setores"
  ON public.departments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'director'
    )
  );

CREATE POLICY "Directors podem deletar setores"
  ON public.departments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'director'
    )
  );

-- --------------------
-- 5b. profiles: usuários leem todos; editam apenas o próprio
-- --------------------
-- Nota: RLS pode já estar habilitado no profiles.
-- Usamos DO block para evitar erro se já existir.
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Políticas para profiles (não conflitam com existentes se nomes forem únicos)
DO $$
BEGIN
  -- Verifica se a policy já existe antes de criar
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Autenticados podem ver todos os perfis'
  ) THEN
    EXECUTE 'CREATE POLICY "Autenticados podem ver todos os perfis"
      ON public.profiles FOR SELECT
      TO authenticated
      USING (true)';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'profiles' 
    AND policyname = 'Usuários podem atualizar próprio perfil'
  ) THEN
    EXECUTE 'CREATE POLICY "Usuários podem atualizar próprio perfil"
      ON public.profiles FOR UPDATE
      TO authenticated
      USING (auth.uid() = id)
      WITH CHECK (auth.uid() = id)';
  END IF;
END
$$;

-- --------------------
-- 5c. tickets: regras de visibilidade por setor
-- --------------------
ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

-- SELECT: Directors veem tudo. Demais veem se envolvidos.
CREATE POLICY "Visualizar chamados permitidos"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (
    -- É director?
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'director'
    )
    OR
    -- Setor de origem é o meu?
    origin_department_id = (
      SELECT department_id FROM public.profiles WHERE id = auth.uid()
    )
    OR
    -- Setor de destino é o meu?
    destination_department_id = (
      SELECT department_id FROM public.profiles WHERE id = auth.uid()
    )
    OR
    -- Meu setor está na visibilidade compartilhada?
    EXISTS (
      SELECT 1 FROM public.ticket_visibility tv
      WHERE tv.ticket_id = tickets.id
      AND tv.department_id = (
        SELECT department_id FROM public.profiles WHERE id = auth.uid()
      )
    )
  );

-- INSERT: qualquer autenticado, desde que origin seja seu setor
CREATE POLICY "Criar chamado do próprio setor"
  ON public.tickets FOR INSERT
  TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND
    origin_department_id = (
      SELECT department_id FROM public.profiles WHERE id = auth.uid()
    )
  );

-- UPDATE: criador pode editar, ou setor destino pode mudar status
CREATE POLICY "Atualizar chamado"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (
    -- É o criador
    created_by = auth.uid()
    OR
    -- Setor destino é o meu (para mudar status)
    destination_department_id = (
      SELECT department_id FROM public.profiles WHERE id = auth.uid()
    )
    OR
    -- É director
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'director'
    )
  );

-- --------------------
-- 5d. ticket_visibility: quem pode ver o ticket pode ver a visibilidade
-- --------------------
ALTER TABLE public.ticket_visibility ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Ver visibilidade de chamados acessíveis"
  ON public.ticket_visibility FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_visibility.ticket_id
    )
  );

-- INSERT: criador do ticket pode adicionar visibilidade
CREATE POLICY "Criador adiciona visibilidade"
  ON public.ticket_visibility FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_visibility.ticket_id
      AND t.created_by = auth.uid()
    )
  );

-- DELETE: criador do ticket pode remover visibilidade
CREATE POLICY "Criador remove visibilidade"
  ON public.ticket_visibility FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_visibility.ticket_id
      AND t.created_by = auth.uid()
    )
  );

-- ============================================================
-- 6. FUNÇÃO AUXILIAR: buscar setor do usuário logado
-- ============================================================
CREATE OR REPLACE FUNCTION public.get_my_department_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT department_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ============================================================
-- MIGRAÇÃO CONCLUÍDA!
-- Tabelas criadas: departments, tickets, ticket_visibility
-- Colunas adicionadas em profiles: department_id, role
-- RLS habilitado em todas as tabelas
-- ============================================================
