-- ============================================================
-- MIGRAÇÃO: Corrigir políticas RLS de Chat e Custos dos Chamados
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

-- 1. Liberar acesso às mensagens do chamado baseado no acesso ao próprio chamado
DROP POLICY IF EXISTS "Ver mensagens do chamado" ON public.ticket_messages;
CREATE POLICY "Ver mensagens do chamado" ON public.ticket_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_messages.ticket_id
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
    )
  );

-- 2. Liberar acesso aos custos do chamado baseado no acesso ao próprio chamado
DROP POLICY IF EXISTS "Ver custos do chamado" ON public.ticket_costs;
CREATE POLICY "Ver custos do chamado" ON public.ticket_costs
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_costs.ticket_id
    )
  );

DROP POLICY IF EXISTS "Gerenciar custos do chamado" ON public.ticket_costs;
CREATE POLICY "Gerenciar custos do chamado" ON public.ticket_costs
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_costs.ticket_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.tickets t
      WHERE t.id = ticket_costs.ticket_id
    )
  );
