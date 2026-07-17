/**
 * API Layer — Operações no Supabase (departments, tickets, ticket_visibility)
 */
import { supabase } from './supabase.js';

// =====================
// DEPARTMENTS
// =====================

/** Lista todos os setores */
export async function fetchDepartments() {
  const { data, error } = await supabase
    .from('departments')
    .select('*')
    .order('name');
  if (error) throw error;
  return data;
}

/** Cria um novo setor (somente directors) */
export async function createDepartment(name) {
  const { data, error } = await supabase
    .from('departments')
    .insert({ name })
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Deleta um setor */
export async function deleteDepartment(id) {
  const { error } = await supabase
    .from('departments')
    .delete()
    .eq('id', id);
  if (error) throw error;
}

// =====================
// TICKETS
// =====================

/**
 * Lista chamados com filtros opcionais.
 * @param {Object} filters
 * @param {string} [filters.status] - 'open', 'in_progress', 'resolved'
 * @param {string} [filters.priority] - 'low', 'medium', 'high'
 * @param {string} [filters.view] - 'created' (criados por mim) | 'received' (para meu setor)
 * @param {string} [filters.myDepartmentId] - ID do setor do usuário
 * @param {string} [filters.myUserId] - ID do usuário logado
 */
export async function fetchTickets(filters = {}) {
  let query = supabase
    .from('tickets')
    .select(`
      *,
      origin:departments!origin_department_id(id, name),
      destination:departments!destination_department_id(id, name),
      creator:profiles!created_by(id, full_name)
    `)
    .order('created_at', { ascending: false });

  if (filters.status) {
    query = query.eq('status', filters.status);
  }

  if (filters.priority) {
    query = query.eq('priority', filters.priority);
  }

  if (filters.view === 'created' && filters.myUserId) {
    query = query.eq('created_by', filters.myUserId);
  }

  if (filters.view === 'received') {
    if (filters.myDepartmentIds && filters.myDepartmentIds.length > 0) {
      query = query.in('destination_department_id', filters.myDepartmentIds);
    } else if (filters.myDepartmentId) {
      query = query.eq('destination_department_id', filters.myDepartmentId);
    }
  }

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

/**
 * Cria um chamado + registros de visibilidade compartilhada.
 */
export async function createTicket({ title, description, destinationDeptId, priority, visibilityDeptIds = [], profileIds = [] }) {
  // 1. Busca o usuário logado
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Não autenticado');

  // 2. Insere o ticket
  const { data: ticket, error: ticketError } = await supabase
    .from('tickets')
    .insert({
      title,
      description,
      origin_department_id: null,
      destination_department_id: destinationDeptId,
      priority,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (ticketError) throw ticketError;

  // 3. Insere visibilidade compartilhada na tabela legada (para compatibilidade/histórico)
  if (visibilityDeptIds.length > 0) {
    const visibilityRows = visibilityDeptIds.map(deptId => ({
      ticket_id: ticket.id,
      department_id: deptId,
    }));

    const { error: visError } = await supabase
      .from('ticket_visibility')
      .insert(visibilityRows);

    if (visError) throw visError;
  }

  // 4. Mapear e associar todos os usuários envolvidos na tabela ticket_users
  const allDeptIds = [destinationDeptId, ...visibilityDeptIds].filter(Boolean);
  let usersInDepts = [];

  if (allDeptIds.length > 0) {
    const { data: deptUsers, error: deptUsersError } = await supabase
      .from('profile_departments')
      .select('profile_id')
      .in('department_id', allDeptIds);

    if (deptUsersError) throw deptUsersError;
    usersInDepts = deptUsers?.map(du => du.profile_id) || [];
  }

  const finalUserIds = new Set([
    session.user.id, // O próprio criador do chamado (autor de origem)
    ...usersInDepts, // Usuários dos grupos (setores) envolvidos
    ...profileIds // Usuários adicionais selecionados diretamente
  ]);

  if (finalUserIds.size > 0) {
    const ticketUserRows = Array.from(finalUserIds).map(pId => ({
      ticket_id: ticket.id,
      profile_id: pId
    }));

    const { error: ticketUserError } = await supabase
      .from('ticket_users')
      .insert(ticketUserRows);

    if (ticketUserError) throw ticketUserError;
  }

  return ticket;
}

/** Atualiza o status de um chamado */
export async function updateTicketStatus(ticketId, newStatus) {
  const { data, error } = await supabase
    .from('tickets')
    .update({ status: newStatus })
    .eq('id', ticketId)
    .select()
    .single();
  if (error) throw error;
  return data;
}

/** Busca detalhes de um chamado com visibilidade */
export async function fetchTicketDetail(ticketId) {
  const { data: ticket, error } = await supabase
    .from('tickets')
    .select(`
      *,
      origin:departments!origin_department_id(id, name),
      destination:departments!destination_department_id(id, name),
      creator:profiles!created_by(id, full_name, email)
    `)
    .eq('id', ticketId)
    .single();

  if (error) throw error;

  // Busca setores com visibilidade compartilhada
  const { data: visibility } = await supabase
    .from('ticket_visibility')
    .select('department:departments(id, name)')
    .eq('ticket_id', ticketId);

  ticket.shared_visibility = visibility?.map(v => v.department) || [];

  // Busca usuários envolvidos na tabela pivot ticket_users
  const { data: involvedUsers } = await supabase
    .from('ticket_users')
    .select('profile_id')
    .eq('ticket_id', ticketId);

  ticket.involved_user_ids = involvedUsers?.map(iu => iu.profile_id) || [];

  return ticket;
}
