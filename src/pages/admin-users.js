/**
 * Admin — Gerenciar Usuários (somente directors)
 */
import { getCurrentProfile, createUserAsAdmin, fetchAllProfiles, updateUserProfile } from '../lib/auth.js';
import { fetchDepartments } from '../lib/api.js';
import { navigateTo } from '../lib/router.js';
import { showToast } from '../lib/toast.js';

export async function renderAdminUsers(container) {
  let profile = null;
  let users = [];
  let departments = [];
  let loading = false;
  let editingUserId = null;

  try {
    profile = await getCurrentProfile();
    if (!profile) { navigateTo('/login'); return; }
    if (profile.role !== 'director') {
      showToast('Acesso restrito à Diretoria', 'error');
      navigateTo('/dashboard');
      return;
    }
    [users, departments] = await Promise.all([fetchAllProfiles(), fetchDepartments()]);
  } catch (err) {
    console.error(err);
    navigateTo('/login');
    return;
  }

  function render() {
    container.innerHTML = `
      <header class="header">
        <div class="header-brand">
          <button class="btn btn-secondary btn-sm" id="backBtn" style="padding:6px 10px;">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
          </button>
          Gerenciar Usuários
        </div>
      </header>

      <main class="page" style="max-width:800px;">
        <!-- Formulário para criar novo usuário -->
        <div class="card" style="margin-bottom:28px;padding:28px;">
          <h3 style="margin-bottom:18px;">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24" style="vertical-align:middle;margin-right:6px;"><path d="M16 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M12 3a4 4 0 100 8 4 4 0 000-8zM23 21v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
            Cadastrar Novo Usuário
          </h3>
          <form id="createUserForm" style="display:flex;flex-direction:column;gap:16px;">
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;">
              <div class="form-group">
                <label for="newName">Nome Completo</label>
                <input type="text" id="newName" class="input" placeholder="Nome do colaborador" required />
              </div>
              <div class="form-group">
                <label for="newEmail">E-mail</label>
                <input type="email" id="newEmail" class="input" placeholder="email@empresa.com" required />
              </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;">
              <div class="form-group">
                <label for="newPassword">Senha</label>
                <input type="password" id="newPassword" class="input" placeholder="Mínimo 6 caracteres" required minlength="6" />
              </div>
              <div class="form-group">
                <label for="newDept">Setor</label>
                <select id="newDept" class="select" required>
                  <option value="">Selecione</option>
                  ${departments.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label for="newRole">Perfil</label>
                <select id="newRole" class="select">
                  <option value="user">Usuário</option>
                  <option value="director">Diretor (Admin)</option>
                </select>
              </div>
            </div>
            <button type="submit" class="btn btn-primary" ${loading ? 'disabled' : ''} style="align-self:flex-start;">
              ${loading ? '<span class="spinner" style="width:18px;height:18px;border-width:2px;margin:0;"></span> Criando...' : '+ Criar Usuário'}
            </button>
          </form>
        </div>

        <!-- Lista de usuários -->
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <h3>Usuários Cadastrados (${users.length})</h3>
        </div>

        <div class="admin-list">
          ${users.map(u => `
            <div class="admin-list-item" style="flex-direction:column;align-items:stretch;gap:10px;">
              <div style="display:flex;align-items:center;justify-content:space-between;">
                <div style="display:flex;align-items:center;gap:10px;">
                  <div class="header-avatar" style="width:34px;height:34px;font-size:0.75rem;">
                    ${getInitials(u.full_name)}
                  </div>
                  <div>
                    <div style="font-weight:600;font-size:0.9rem;">${escapeHtml(u.full_name || 'Sem nome')}</div>
                    <div style="font-size:0.78rem;color:var(--text-muted);">${escapeHtml(u.email)}</div>
                  </div>
                </div>
                <div style="display:flex;align-items:center;gap:8px;">
                  <span class="badge ${u.role === 'director' ? 'badge-high' : 'badge-open'}">
                    ${u.role === 'director' ? 'Diretor' : 'Usuário'}
                  </span>
                  <span class="badge badge-medium">${u.department?.name || 'Sem setor'}</span>
                  <button class="btn btn-sm btn-secondary" data-edit-id="${u.id}" title="Editar">
                    <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  </button>
                </div>
              </div>

              ${editingUserId === u.id ? `
                <div style="display:flex;gap:10px;padding-top:10px;border-top:1px solid var(--border);flex-wrap:wrap;align-items:flex-end;">
                  <div class="form-group" style="flex:1;min-width:140px;">
                    <label>Setor</label>
                    <select class="select" id="editDept-${u.id}">
                      <option value="">Sem setor</option>
                      ${departments.map(d => `<option value="${d.id}" ${u.department_id === d.id ? 'selected' : ''}>${d.name}</option>`).join('')}
                    </select>
                  </div>
                  <div class="form-group" style="min-width:120px;">
                    <label>Perfil</label>
                    <select class="select" id="editRole-${u.id}">
                      <option value="user" ${u.role === 'user' ? 'selected' : ''}>Usuário</option>
                      <option value="director" ${u.role === 'director' ? 'selected' : ''}>Diretor</option>
                    </select>
                  </div>
                  <div style="display:flex;gap:6px;">
                    <button class="btn btn-sm btn-primary" data-save-id="${u.id}">Salvar</button>
                    <button class="btn btn-sm btn-secondary" data-cancel-edit>Cancelar</button>
                  </div>
                </div>
              ` : ''}
            </div>
          `).join('')}
        </div>
      </main>
    `;

    bindEvents();
  }

  function bindEvents() {
    document.getElementById('backBtn')?.addEventListener('click', () => navigateTo('/dashboard'));

    // Criar usuário
    document.getElementById('createUserForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (loading) return;

      const name = document.getElementById('newName').value.trim();
      const email = document.getElementById('newEmail').value.trim();
      const password = document.getElementById('newPassword').value;
      const deptId = document.getElementById('newDept').value;
      const role = document.getElementById('newRole').value;

      if (!name || !email || !password || !deptId) {
        showToast('Preencha todos os campos', 'error');
        return;
      }

      loading = true;
      render();

      try {
        await createUserAsAdmin(email, password, name, deptId, role);
        users = await fetchAllProfiles();
        showToast(`Usuário "${name}" criado com sucesso!`, 'success');
      } catch (err) {
        console.error(err);
        let msg = 'Erro ao criar usuário';
        if (err.message?.includes('already registered')) msg = 'E-mail já cadastrado';
        else if (err.message?.includes('Password')) msg = 'Senha deve ter no mínimo 6 caracteres';
        else if (err.message) msg = err.message;
        showToast(msg, 'error');
      }

      loading = false;
      render();
    });

    // Editar usuário (abrir)
    document.querySelectorAll('[data-edit-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        editingUserId = editingUserId === btn.dataset.editId ? null : btn.dataset.editId;
        render();
      });
    });

    // Cancelar edição
    document.querySelectorAll('[data-cancel-edit]').forEach(btn => {
      btn.addEventListener('click', () => {
        editingUserId = null;
        render();
      });
    });

    // Salvar edição
    document.querySelectorAll('[data-save-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.saveId;
        const deptId = document.getElementById(`editDept-${userId}`)?.value || null;
        const role = document.getElementById(`editRole-${userId}`)?.value || 'user';

        try {
          await updateUserProfile(userId, {
            department_id: deptId || null,
            role,
          });
          users = await fetchAllProfiles();
          editingUserId = null;
          showToast('Usuário atualizado!', 'success');
          render();
        } catch (err) {
          console.error(err);
          showToast('Erro ao atualizar usuário', 'error');
        }
      });
    });
  }

  render();
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).slice(0, 2).join('').toUpperCase();
}
