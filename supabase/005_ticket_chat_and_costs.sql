-- ============================================================
-- MIGRAÇÃO 005: Chat de Mensagens e Custos do Chamado
-- ============================================================

-- 1. Criar tabela de Mensagens do Chat
CREATE TABLE IF NOT EXISTS public.ticket_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  profile_id uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  content text NOT NULL,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- 2. Criar tabela de Custos Externos
CREATE TABLE IF NOT EXISTS public.ticket_costs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id uuid REFERENCES public.tickets(id) ON DELETE CASCADE,
  description text NOT NULL,
  amount numeric(10,2) NOT NULL,
  created_by uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Habilitar RLS
ALTER TABLE public.ticket_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ticket_costs ENABLE ROW LEVEL SECURITY;

-- 3. Políticas de RLS para mensagens do chat
DROP POLICY IF EXISTS "Ver mensagens do chamado" ON public.ticket_messages;
CREATE POLICY "Ver mensagens do chamado" ON public.ticket_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_messages.ticket_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'director'
        )
        OR EXISTS (
          SELECT 1 FROM public.ticket_users tu WHERE tu.ticket_id = t.id AND tu.profile_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Inserir mensagens do chamado" ON public.ticket_messages;
CREATE POLICY "Inserir mensagens do chamado" ON public.ticket_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    profile_id = auth.uid()
    AND EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_messages.ticket_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'director'
        )
        OR EXISTS (
          SELECT 1 FROM public.ticket_users tu WHERE tu.ticket_id = t.id AND tu.profile_id = auth.uid()
        )
      )
    )
  );

-- 4. Políticas de RLS para custos
DROP POLICY IF EXISTS "Ver custos do chamado" ON public.ticket_costs;
CREATE POLICY "Ver custos do chamado" ON public.ticket_costs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_costs.ticket_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'director'
        )
        OR EXISTS (
          SELECT 1 FROM public.ticket_users tu WHERE tu.ticket_id = t.id AND tu.profile_id = auth.uid()
        )
      )
    )
  );

DROP POLICY IF EXISTS "Gerenciar custos do chamado" ON public.ticket_costs;
CREATE POLICY "Gerenciar custos do chamado" ON public.ticket_costs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_costs.ticket_id
      AND (
        t.created_by = auth.uid()
        OR EXISTS (
          SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.role = 'director'
        )
        OR EXISTS (
          SELECT 1 FROM public.ticket_users tu WHERE tu.ticket_id = t.id AND tu.profile_id = auth.uid()
        )
      )
    )
  )
  WITH CHECK (
    created_by = auth.uid()
  );
