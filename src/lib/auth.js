/**
 * Módulo de Autenticação — Supabase Auth
 */
import { supabase } from './supabase.js';
import { createClient } from '@supabase/supabase-js';

/** Login com email/senha */
export async function signIn(email, password) {
  const { data, error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });
  if (error) throw error;
  return data;
}

/** Logout */
export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
}

/** Retorna a sessão atual */
export async function getSession() {
  const { data: { session } } = await supabase.auth.getSession();
  return session;
}

/** Retorna o profile completo do usuário logado com nome do setor */
export async function getCurrentProfile() {
  const session = await getSession();
  if (!session) return null;

  try {
    const { data, error } = await supabase
      .from('profiles')
      .select('*, department:departments!department_id(id, name), departments:profile_departments(department:departments(id, name))')
      .eq('id', session.user.id)
      .single();

    if (error) throw error;
    if (data) {
      data.departments = data.departments?.map(d => d.department).filter(Boolean) || [];
      if (!data.department && data.departments.length > 0) {
        data.department = data.departments[0];
      }
    }
    return data;
  } catch (pivotError) {
    console.warn('Erro ao carregar múltiplos setores. Tentando perfil básico:', pivotError.message);
    
    // Fallback: Tenta carregar o perfil simples
    const { data, error } = await supabase
      .from('profiles')
      .select('*, department:departments!department_id(id, name)')
      .eq('id', session.user.id)
      .single();

    if (error) {
      // Se não existir perfil na tabela public.profiles, cria um perfil virtual básico para permitir login
      if (error.code === 'PGRST116') {
        return {
          id: session.user.id,
          email: session.user.email,
          full_name: session.user.user_metadata?.full_name || 'Usuário',
          role: 'user',
          department_id: null,
          department: null,
          departments: [],
          tickets_enabled: true
        };
      }
      throw error;
    }

    if (data) {
      data.departments = data.department ? [data.department] : [];
    }
    return data;
  }
}

/** Atualiza o profile do usuário logado */
export async function updateProfile(updates) {
  const session = await getSession();
  if (!session) throw new Error('Não autenticado');

  try {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id)
      .select('*, department:departments!department_id(id, name), departments:profile_departments(department:departments(id, name))')
      .single();

    if (error) throw error;
    if (data) {
      data.departments = data.departments?.map(d => d.department).filter(Boolean) || [];
      if (!data.department && data.departments.length > 0) {
        data.department = data.departments[0];
      }
    }
    return data;
  } catch (pivotError) {
    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', session.user.id)
      .select('*, department:departments!department_id(id, name)')
      .single();

    if (error) throw error;
    if (data) {
      data.departments = data.department ? [data.department] : [];
    }
    return data;
  }
}

/**
 * Cria um novo usuário como admin.
 * Usa um client secundário para não afetar a sessão do admin logado.
 */
export async function createUserAsAdmin(email, password, fullName, departmentIds, role = 'user') {
  const deptIds = Array.isArray(departmentIds) ? departmentIds : (departmentIds ? [departmentIds] : []);

  // Client secundário que não persiste sessão (não desloga o admin)
  const tempClient = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_ANON_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  );

  // 1. Criar o usuário via auth
  const { data, error } = await tempClient.auth.signUp({
    email,
    password,
    options: {
      data: {
        full_name: fullName,
        department_id: deptIds[0] || null,
      },
    },
  });

  if (error) throw error;

  // 2. Atualizar o profile com department_id e role usando o client principal (do admin)
  if (data.user) {
    // Espera um momento para o trigger criar o profile
    await new Promise(resolve => setTimeout(resolve, 1000));

    const { error: updateError } = await supabase
      .from('profiles')
      .update({
        full_name: fullName,
        department_id: deptIds[0] || null,
        role: role,
      })
      .eq('id', data.user.id);

    if (updateError) throw updateError;

    // Vincular múltiplos departamentos na tabela pivot
    if (deptIds.length > 0) {
      const inserts = deptIds.map(dId => ({
        profile_id: data.user.id,
        department_id: dId
      }));
      const { error: pivotError } = await supabase
        .from('profile_departments')
        .insert(inserts);

      if (pivotError) throw pivotError;
    }
  }

  return data;
}

/** Lista todos os profiles (para admin) */
export async function fetchAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, department:departments!department_id(id, name), departments:profile_departments(department:departments(id, name))')
    .eq('tickets_enabled', true)
    .order('full_name');

  if (error) throw error;
  if (data) {
    data.forEach(profile => {
      profile.departments = profile.departments?.map(d => d.department).filter(Boolean) || [];
      if (!profile.department && profile.departments.length > 0) {
        profile.department = profile.departments[0];
      }
    });
  }
  return data;
}

/** @type {any} */
export async function updateUserProfile(userId, updates, departmentIds) {
  const { data, error } = await supabase
    .from('profiles')
    .update({
      ...updates,
      department_id: departmentIds && departmentIds.length > 0 ? departmentIds[0] : undefined
    })
    .eq('id', userId)
    .select('*, department:departments!department_id(id, name), departments:profile_departments(department:departments(id, name))')
    .single();

  if (error) throw error;

  if (departmentIds) {
    const deptIds = Array.isArray(departmentIds) ? departmentIds : [departmentIds];

    // Limpar setores antigos na tabela pivot
    const { error: deleteError } = await supabase
      .from('profile_departments')
      .delete()
      .eq('profile_id', userId);

    if (deleteError) throw deleteError;

    // Inserir novos setores
    if (deptIds.length > 0) {
      const inserts = deptIds.map(dId => ({
        profile_id: userId,
        department_id: dId
      }));
      const { error: insertError } = await supabase
        .from('profile_departments')
        .insert(inserts);

      if (insertError) throw insertError;
    }
  }

  if (data) {
    data.departments = data.departments?.map(d => d.department).filter(Boolean) || [];
    if (!data.department && data.departments.length > 0) {
      data.department = data.departments[0];
    }
  }
  return data;
}

/** Listener para mudanças de autenticação */
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}
