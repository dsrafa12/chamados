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

  const { data, error } = await supabase
    .from('profiles')
    .select('*, department:departments(id, name)')
    .eq('id', session.user.id)
    .single();

  if (error) throw error;
  return data;
}

/** Atualiza o profile do usuário logado */
export async function updateProfile(updates) {
  const session = await getSession();
  if (!session) throw new Error('Não autenticado');

  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', session.user.id)
    .select('*, department:departments(id, name)')
    .single();

  if (error) throw error;
  return data;
}

/**
 * Cria um novo usuário como admin.
 * Usa um client secundário para não afetar a sessão do admin logado.
 */
export async function createUserAsAdmin(email, password, fullName, departmentId, role = 'user') {
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
        department_id: departmentId,
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
        department_id: departmentId,
        role: role,
      })
      .eq('id', data.user.id);

    if (updateError) throw updateError;
  }

  return data;
}

/** Lista todos os profiles (para admin) */
export async function fetchAllProfiles() {
  const { data, error } = await supabase
    .from('profiles')
    .select('*, department:departments(id, name)')
    .order('full_name');

  if (error) throw error;
  return data;
}

/** Atualiza o profile de qualquer usuário (admin) */
export async function updateUserProfile(userId, updates) {
  const { data, error } = await supabase
    .from('profiles')
    .update(updates)
    .eq('id', userId)
    .select('*, department:departments(id, name)')
    .single();

  if (error) throw error;
  return data;
}

/** Listener para mudanças de autenticação */
export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((event, session) => {
    callback(event, session);
  });
}
