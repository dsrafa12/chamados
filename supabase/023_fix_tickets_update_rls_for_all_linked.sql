-- ============================================================
-- MIGRAÇÃO: Permitir que qualquer usuário atrelado possa atualizar o chamado (iniciar/finalizar atendimento)
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

DROP POLICY IF EXISTS "Atualizar chamado" ON public.tickets;

CREATE POLICY "Atualizar chamado"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (
    -- 1. É o criador do chamado
    created_by = auth.uid()
    OR
    -- 2. É um Diretor (pode atualizar qualquer chamado)
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE profiles.id = auth.uid()
      AND profiles.role = 'director'
    )
    -- 3. Ou o usuário está na tabela de colaboradores do chamado (ticket_users)
    OR EXISTS (
      SELECT 1 FROM public.ticket_users tu
      WHERE tu.ticket_id = tickets.id
      AND tu.profile_id = auth.uid()
    )
    -- 4. Ou o setor de destino do chamado está entre os setores vinculados ao usuário
    OR destination_department_id IN (
      SELECT department_id FROM public.profile_departments WHERE profile_id = auth.uid()
    )
    -- 5. Ou o setor de origem do chamado está entre os setores vinculados ao usuário
    OR origin_department_id IN (
      SELECT department_id FROM public.profile_departments WHERE profile_id = auth.uid()
    )
  );
