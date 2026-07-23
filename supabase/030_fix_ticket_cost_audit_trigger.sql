-- ============================================================
-- MIGRAÇÃO: Corrigir gatilho de auditoria de custos do chamado
-- Cole este código no SQL Editor do seu Supabase Dashboard e clique em "Run"
-- ============================================================

CREATE OR REPLACE FUNCTION public.handle_ticket_cost_audit()
RETURNS TRIGGER AS $$
BEGIN
  -- Salva no histórico quem adicionou o custo (auth.uid()) e o valor formatado, sem a descrição textual do custo
  INSERT INTO public.ticket_history (ticket_id, profile_id, action, description)
  VALUES (
    NEW.ticket_id, 
    auth.uid(), 
    'cost_added', 
    'Adicionou um custo no valor de R$ ' || replace(to_char(NEW.amount, 'FM9999990.00'), '.', ',')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
