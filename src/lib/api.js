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
      creator:profiles!created_by(id, full_name, department:departments!profiles_department_id_fkey(name)),
      ticket_users(profile:profiles(id, full_name))
    `)
    .order('created_at', { ascending: true });

  if (filters.view === 'resolved') {
    query = query.eq('status', 'resolved');
  } else if (filters.status) {
    query = query.eq('status', filters.status);
  } else {
    query = query.neq('status', 'resolved');
  }

  if (filters.priority) {
    query = query.eq('priority', filters.priority);
  }
  if (filters.departmentId) {
    query = query.eq('destination_department_id', filters.departmentId);
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
    .update({ 
      status: newStatus,
      updated_at: new Date().toISOString()
    })
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
      creator:profiles!created_by(id, full_name, email),
      ticket_users(profile:profiles(id, full_name))
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

  // Mapeia involved_user_ids para compatibilidade
  ticket.involved_user_ids = ticket.ticket_users?.map(tu => tu.profile?.id).filter(Boolean) || [];

  return ticket;
}

/** Busca mensagens do chat de um chamado */
export async function fetchTicketMessages(ticketId) {
  const { data, error } = await supabase
    .from('ticket_messages')
    .select(`
      *,
      sender:profiles!profile_id(full_name)
    `)
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

/** Envia mensagem no chat de um chamado */
export async function sendTicketMessage(ticketId, content) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Não autenticado');

  const { data, error } = await supabase
    .from('ticket_messages')
    .insert({
      ticket_id: ticketId,
      profile_id: session.user.id,
      content,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Busca custos externos de um chamado */
export async function fetchTicketCosts(ticketId) {
  const { data, error } = await supabase
    .from('ticket_costs')
    .select('*')
    .eq('ticket_id', ticketId)
    .order('created_at', { ascending: true });

  if (error) throw error;
  return data;
}

/** Adiciona um custo externo ao chamado */
export async function addTicketCost(ticketId, description, amount) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error('Não autenticado');

  const { data, error } = await supabase
    .from('ticket_costs')
    .insert({
      ticket_id: ticketId,
      description,
      amount,
      created_by: session.user.id,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/** Encaminha o chamado para um novo setor e vincula seus membros */
export async function forwardTicket(ticketId, departmentId) {
  // 1. Atualiza o grupo de destino na tabela tickets
  const { error: updateError } = await supabase
    .from('tickets')
    .update({ destination_department_id: departmentId })
    .eq('id', ticketId);

  if (updateError) throw updateError;

  // 2. Busca todos os usuários do novo setor
  const { data: deptUsers, error: usersError } = await supabase
    .from('profile_departments')
    .select('profile_id')
    .eq('department_id', departmentId);

  if (usersError) throw usersError;

  if (deptUsers && deptUsers.length > 0) {
    // 3. Insere os usuários do novo setor na tabela pivot ticket_users para garantir a visibilidade RLS
    const insertRows = deptUsers.map(du => ({
      ticket_id: ticketId,
      profile_id: du.profile_id
    }));

    const { error: pivotError } = await supabase
      .from('ticket_users')
      .insert(insertRows);

    if (pivotError && !pivotError.message?.includes('duplicate key')) {
      throw pivotError;
    }
  }
}


