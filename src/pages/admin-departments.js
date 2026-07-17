/**
 * Admin — Cadastro de Setores (somente super admin ds.rafa@hotmail.com)
 */
import { getCurrentProfile, fetchAllProfiles } from '../lib/auth.js';
import { fetchDepartments, createDepartment, deleteDepartment } from '../lib/api.js';
import { navigateTo } from '../lib/router.js';
import { showToast } from '../lib/toast.js';
import { getLayoutTemplate, bindLayoutEvents } from '../lib/layout.js';
import { supabase } from '../lib/supabase.js';

export async function renderAdminDepartments(container) {
  let profile = null;
  let departments = [];
  let users = [];
  let loading = false;
  let activeView = 'list'; // 'list' ou 'members'
  let selectedDeptId = null;

  try {
    profile = await getCurrentProfile();
    if (!profile) { navigateTo('/login'); return; }
    
    // Restrição estrita de diretor
    if (profile.role !== 'director') {
      showToast('Acesso restrito a Diretores', 'error');
      navigateTo('/dashboard');
      return;
    }
    
    [departments, users] = await Promise.all([
      fetchDepartments(),
      fetchAllProfiles()
    ]);
  } catch {
    navigateTo('/login');
    return;
  }

  function render() {
    if (activeView === 'members') {
      renderMembersView(selectedDeptId);
      return;
    }

    // 1. Injeta layout base da sidebar
    container.innerHTML = getLayoutTemplate(profile, 'departments');

    // 2. Injeta conteúdo específico na área principal
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
      <main class="page" style="max-width:600px; margin: 0 auto;">
        <div class="page-header">
          <div>
            <h1>Gerenciar Grupos</h1>
            <p style="color:var(--text-secondary);font-size:0.9rem;margin-top:2px;">
              Adicione e remova os grupos da empresa
            </p>
          </div>
        </div>

        <!-- Formulário para adicionar -->
        <div class="card" style="margin-bottom:24px;padding:24px;">
          <h3 style="margin-bottom:16px;">Adicionar Novo Grupo</h3>
          <form class="admin-add-form" id="addDeptForm">
            <input type="text" class="input" id="deptName" placeholder="Nome do grupo" required />
            <button type="submit" class="btn btn-primary" ${loading ? 'disabled' : ''}>
              ${loading ? '...' : 'Adicionar'}
            </button>
          </form>
        </div>

        <!-- Lista de setores -->
        <h3 style="margin-bottom:12px;">Grupos Cadastrados (${departments.length})</h3>
        <div class="admin-list">
          ${departments.map(d => `
            <div class="admin-list-item" style="align-items: center;">
              <div>
                <span style="font-weight:600;">${escapeHtml(d.name)}</span>
                <span style="font-size:0.75rem;color:var(--text-muted);margin-left:8px;">
                  ${formatDate(d.created_at)}
                </span>
              </div>
              <div style="display:flex;gap:8px;align-items:center;">
                <button class="btn btn-sm btn-secondary" data-members-id="${d.id}" title="Gerenciar Membros" style="padding: 6px 12px; font-size: 0.82rem; font-weight: 600; display: inline-flex; align-items: center; gap: 6px; border-radius: var(--radius-md);">
                  <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" viewBox="0 0 24 24" style="overflow: visible;"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 110-8 4 4 0 010 8zm14 14v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                  Gerenciar Grupo
                </button>
                <button class="btn btn-sm btn-danger" data-delete-id="${d.id}" title="Excluir" style="width: 28px; height: 28px; min-width: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-md);">
                  <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              </div>
            </div>
          `).join('')}
        </div>
      </main>

      <!-- Modal de Confirmação de Exclusão -->
      <div id="deleteConfirmModal" class="modal-overlay" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(0,0,0,0.4); z-index:9999; align-items:center; justify-content:center;">
        <div class="card" style="max-width:380px; width:90%; padding:24px; text-align:center; display:flex; flex-direction:column; gap:16px; box-shadow: 0 10px 25px rgba(0,0,0,0.15); border-radius: 12px; background: var(--bg-card);">
          <div style="width:52px; height:52px; background:#fee2e2; color:#ef4444; border-radius:50%; display:inline-flex; align-items:center; justify-content:center; margin: 0 auto;">
            <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
          </div>
          <div>
            <h3 style="margin:0 0 8px 0; font-size:1.15rem; color:var(--text-primary); font-weight:700;">Excluir Grupo?</h3>
            <p style="margin:0; font-size:0.88rem; color:var(--text-secondary); line-height:1.45;">
              Tem certeza que deseja excluir o grupo <strong id="deleteDeptName"></strong>? Esta ação não pode ser desfeita.
            </p>
          </div>
          <div style="display:flex; gap:10px; justify-content:center; margin-top:6px;">
            <button class="btn btn-secondary" id="cancelDeleteBtn" style="flex:1; padding: 10px;">Cancelar</button>
            <button class="btn btn-danger" id="confirmDeleteBtn" style="flex:1; padding: 10px;">Excluir</button>
          </div>
        </div>
      </div>
    `;

    bindLayoutEvents(profile);
    bindPageEvents();
  }

  function renderMembersView(deptId) {
    const dept = departments.find(d => d.id === deptId);
    const deptMembers = new Set(users.filter(u => u.departments?.some(d => d.id === deptId)).map(u => u.id));

    // 1. Injeta layout base da sidebar
    container.innerHTML = getLayoutTemplate(profile, 'departments');

    // 2. Injeta conteúdo específico na área principal
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
      <main class="page" style="max-width:600px; margin: 0 auto;">
        <div class="page-header">
          <div style="display:flex;align-items:center;gap:14px;margin-bottom:12px;">
            <button class="btn btn-secondary btn-sm" id="backToDeptsBtn" style="padding:8px 12px; display:inline-flex; align-items:center; gap:6px;">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Voltar
            </button>
            <h1 style="margin:0;">Membros do Grupo</h1>
          </div>
          <p style="color:var(--text-secondary);font-size:0.95rem;font-weight:600;margin-top:2px;">
            Grupo: ${escapeHtml(dept?.name || '')}
          </p>
        </div>

        <div class="card" style="padding:24px;margin-bottom:24px;">
          <h3 style="margin-bottom:16px;">Vincular Colaboradores</h3>
          <p style="color:var(--text-muted);font-size:0.85rem;margin-bottom:16px;">
            Selecione quais colaboradores fazem parte deste grupo.
          </p>

          <form id="manageMembersForm" style="display:flex;flex-direction:column;gap:16px;">
            <div style="display:flex;flex-direction:column;gap:10px;max-height:300px;overflow-y:auto;border:1px solid var(--border);padding:12px;border-radius:var(--radius-md);background:var(--bg-card);">
              ${users.map(u => {
                const isChecked = deptMembers.has(u.id);
                return `
                  <label style="display:flex;align-items:center;gap:10px;padding:8px;border-radius:var(--radius-sm);cursor:pointer;background:var(--bg-app);margin-bottom:2px;">
                    <input type="checkbox" name="groupMember" value="${u.id}" ${isChecked ? 'checked' : ''} style="width:18px;height:18px;" />
                    <div style="display:flex;flex-direction:column;">
                      <span style="font-weight:600;font-size:0.9rem;">${escapeHtml(u.full_name || 'Sem nome')}</span>
                      <span style="font-size:0.75rem;color:var(--text-muted);">${escapeHtml(u.email)}</span>
                    </div>
                  </label>
                `;
              }).join('')}
            </div>

            <button type="submit" class="btn btn-primary" ${loading ? 'disabled' : ''} style="align-self:flex-start;margin-top:8px;">
              ${loading ? 'Salvando...' : 'Salvar Alterações'}
            </button>
          </form>
        </div>
      </main>
    `;

    bindLayoutEvents(profile);
    
    // Bind eventos da sub-tela
    document.getElementById('backToDeptsBtn')?.addEventListener('click', () => {
      activeView = 'list';
      render();
    });

    document.getElementById('manageMembersForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      loading = true;
      render();

      const checkedUserIds = Array.from(document.querySelectorAll('input[name="groupMember"]:checked')).map(cb => cb.value);

      try {
        // Atualizar no Supabase
        // 1. Deletar relações antigas do grupo
        const { error: deleteError } = await supabase
          .from('profile_departments')
          .delete()
          .eq('department_id', deptId);
        
        if (deleteError) throw deleteError;

        // 2. Inserir novas relações
        if (checkedUserIds.length > 0) {
          const inserts = checkedUserIds.map(uId => ({
            profile_id: uId,
            department_id: deptId
          }));
          const { error: insertError } = await supabase
            .from('profile_departments')
            .insert(inserts);

          if (insertError) throw insertError;
        }

        // 3. Recarregar dados locais
        [departments, users] = await Promise.all([
          fetchDepartments(),
          fetchAllProfiles()
        ]);

        showToast('Membros do grupo updated!', 'success');
        activeView = 'list';
        render();
      } catch (err) {
        console.error(err);
        showToast('Erro ao salvar membros', 'error');
        loading = false;
        render();
      }
    });
  }

  function bindPageEvents() {
    let deptToDeleteId = null;

    document.getElementById('addDeptForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('deptName').value.trim();
      if (!name) return;

      loading = true;
      render();

      try {
        await createDepartment(name);
        [departments, users] = await Promise.all([
          fetchDepartments(),
          fetchAllProfiles()
        ]);
        showToast(`Grupo "${name}" criado!`, 'success');
      } catch (err) {
        if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
          showToast('Grupo já existe', 'error');
        } else {
          showToast(err.message || 'Erro ao criar grupo', 'error');
        }
      }
      loading = false;
      render();
    });

    document.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        deptToDeleteId = btn.dataset.deleteId;
        const dept = departments.find(d => d.id === deptToDeleteId);
        const nameLabel = document.getElementById('deleteDeptName');
        if (nameLabel) nameLabel.textContent = dept?.name || '';
        const modal = document.getElementById('deleteConfirmModal');
        if (modal) modal.style.display = 'flex';
      });
    });

    document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => {
      const modal = document.getElementById('deleteConfirmModal');
      if (modal) modal.style.display = 'none';
      deptToDeleteId = null;
    });

    document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
      if (!deptToDeleteId) return;

      const modal = document.getElementById('deleteConfirmModal');
      if (modal) modal.style.display = 'none';

      try {
        await deleteDepartment(deptToDeleteId);
        [departments, users] = await Promise.all([
          fetchDepartments(),
          fetchAllProfiles()
        ]);
        showToast('Grupo excluído', 'success');
        render();
      } catch (err) {
        showToast('Erro ao excluir (pode haver chamados vinculados)', 'error');
      } finally {
        deptToDeleteId = null;
      }
    });

    document.querySelectorAll('[data-members-id]').forEach(btn => {
      btn.addEventListener('click', () => {
        selectedDeptId = btn.dataset.membersId;
        activeView = 'members';
        render();
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

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}
