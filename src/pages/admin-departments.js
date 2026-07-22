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
    // 1. Injeta layout base da sidebar
    container.innerHTML = getLayoutTemplate(profile, 'departments');

    // 2. Injeta conteúdo específico na área principal (Duas colunas)
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
      <main class="page" style="max-width:1200px; margin: 0 auto;">
        <div class="page-header">
          <div>
            <h1>Gerenciar Grupos</h1>
            <p style="color:var(--text-secondary);font-size:0.9rem;margin-top:2px;">
              Adicione grupos e gerencie seus membros em tempo real
            </p>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1fr 1.2fr; gap:24px; min-height:600px;" class="groups-grid-layout">
          <!-- LADO ESQUERDO: GRUPOS -->
          <div style="display:flex; flex-direction:column; gap:20px;">
            <!-- Formulário para adicionar -->
            <div class="card" style="padding:20px;">
              <h3 style="margin-bottom:12px; font-size:1.1rem;">Adicionar Novo Grupo</h3>
              <form class="admin-add-form" id="addDeptForm" style="display:flex; gap:10px;">
                <input type="text" class="input" id="deptName" placeholder="Nome do grupo" required style="flex:1;" />
                <button type="submit" class="btn btn-primary" ${loading ? 'disabled' : ''}>
                  ${loading ? '...' : 'Adicionar'}
                </button>
              </form>
            </div>

            <!-- Lista de setores -->
            <div class="card" style="padding:20px;">
              <h3 style="margin-bottom:12px; font-size:1.1rem;">Grupos Cadastrados (${departments.length})</h3>
              <div class="admin-list" style="display:flex; flex-direction:column; gap:8px;">
                ${departments.map(d => {
                  const isSelected = selectedDeptId === d.id;
                  return `
                    <div class="admin-list-item" style="align-items: center; padding: 10px 12px; border-radius: 8px; border: 1px solid ${isSelected ? 'var(--primary)' : 'var(--border)'}; background: ${isSelected ? 'rgba(26,115,232,0.04)' : 'var(--bg-card)'}; cursor: pointer; transition: all 0.2s;" data-dept-item-id="${d.id}">
                      <div style="flex:1;">
                        <span style="font-weight:600; color:${isSelected ? 'var(--primary)' : 'var(--text-primary)'};">${escapeHtml(d.name)}</span>
                      </div>
                      <div style="display:flex; gap:6px; align-items:center;" onclick="event.stopPropagation();">
                        <button class="btn btn-sm btn-danger" data-delete-id="${d.id}" title="Excluir" style="width: 28px; height: 28px; min-width: 28px; padding: 0; display: inline-flex; align-items: center; justify-content: center; border-radius: var(--radius-md);">
                          <svg width="12" height="12" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                        </button>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>
          </div>

          <!-- LADO DIREITO: MEMBROS -->
          <div style="display:flex; flex-direction:column;">
            <div class="card" style="padding:20px; flex:1; display:flex; flex-direction:column; min-height:480px; background:var(--bg-card);">
              ${selectedDeptId ? renderRightPanel(selectedDeptId) : `
                <div style="flex:1; display:flex; flex-direction:column; align-items:center; justify-content:center; color:var(--text-muted); text-align:center; padding:40px 20px;">
                  <svg width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5" viewBox="0 0 24 24" style="margin-bottom:12px; color:var(--text-muted);"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 110-8 4 4 0 010 8zm14 14v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>
                  <h4 style="margin:0 0 4px 0; color:var(--text-secondary);">Gerenciar Membros</h4>
                  <p style="margin:0; font-size:0.85rem; max-width:280px;">Selecione um grupo ao lado para gerenciar quem faz parte dele em tempo real.</p>
                </div>
              `}
            </div>
          </div>
        </div>

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
      </main>
    `;

    bindLayoutEvents(profile);
    bindPageEvents();
  }

  function renderRightPanel(deptId) {
    const dept = departments.find(d => d.id === deptId);
    
    // Identificar membros do grupo
    const deptMembers = new Set(users.filter(u => u.departments?.some(d => d.id === deptId)).map(u => u.id));

    // Ordenar usuários: membros primeiro
    const sortedUsers = [...users].sort((a, b) => {
      const aIn = deptMembers.has(a.id) ? 1 : 0;
      const bIn = deptMembers.has(b.id) ? 1 : 0;
      return bIn - aIn; // 1s first (members), 0s second
    });

    return `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:16px; border-bottom:1px solid var(--border); padding-bottom:12px;">
        <h3 style="margin:0; font-size:1.1rem; color:var(--text-primary);">Membros do Grupo</h3>
        <span class="badge" style="background:var(--primary); color:white; font-size:0.75rem; padding:4px 8px; border-radius:12px; font-weight:bold;">
          ${escapeHtml(dept?.name || '')}
        </span>
      </div>

      <div style="display:flex; flex-direction:column; gap:8px;">
        ${sortedUsers.map(u => {
          const isMember = deptMembers.has(u.id);
          
          return `
            <div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; border:1px solid var(--border); border-radius:8px; background:var(--bg-app); gap:12px;">
              <!-- Botão Adicionar ou Remover (mesmo tamanho, cores diferentes) na frente do nome -->
              <div>
                ${isMember ? `
                  <button class="btn btn-sm btn-danger" data-remove-member-id="${u.id}" style="width:85px; height:30px; font-size:0.78rem; font-weight:700; display:inline-flex; align-items:center; justify-content:center; padding:0; border-radius:6px;">
                    Remover
                  </button>
                ` : `
                  <button class="btn btn-sm btn-success" data-add-member-id="${u.id}" style="width:85px; height:30px; font-size:0.78rem; font-weight:700; display:inline-flex; align-items:center; justify-content:center; padding:0; border-radius:6px; background:#10b981; border-color:#10b981; color:white;">
                    Adicionar
                  </button>
                `}
              </div>
              
              <div style="flex:1; text-align:left; overflow:hidden;">
                <div style="font-weight:600; font-size:0.88rem; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(u.full_name || 'Sem nome')}">
                  ${escapeHtml(u.full_name || 'Sem nome')}
                </div>
                <div style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${escapeHtml(u.email)}">
                  ${escapeHtml(u.email)}
                </div>
              </div>
            </div>
          `;
        }).join('')}
      </div>
    `;
  }

  function bindPageEvents() {
    let deptToDeleteId = null;

    // Seleção de grupo ao clicar
    document.querySelectorAll('[data-dept-item-id]').forEach(item => {
      item.addEventListener('click', () => {
        selectedDeptId = item.dataset.deptItemId;
        render();
      });
    });

    // Inserir novo grupo
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

    // Botões de deletar grupo (abre modal)
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

    // Cancelar exclusão
    document.getElementById('cancelDeleteBtn')?.addEventListener('click', () => {
      const modal = document.getElementById('deleteConfirmModal');
      if (modal) modal.style.display = 'none';
      deptToDeleteId = null;
    });

    // Confirmar exclusão
    document.getElementById('confirmDeleteBtn')?.addEventListener('click', async () => {
      if (!deptToDeleteId) return;

      const modal = document.getElementById('deleteConfirmModal');
      if (modal) modal.style.display = 'none';

      try {
        await deleteDepartment(deptToDeleteId);
        if (selectedDeptId === deptToDeleteId) {
          selectedDeptId = null;
        }
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

    // Adicionar membro inline
    document.querySelectorAll('[data-add-member-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.addMemberId;
        if (!selectedDeptId) return;

        btn.disabled = true;
        btn.textContent = '...';

        try {
          const { error } = await supabase
            .from('profile_departments')
            .insert({ profile_id: userId, department_id: selectedDeptId });
          
          if (error) throw error;

          // Recarregar os dados locais
          [departments, users] = await Promise.all([
            fetchDepartments(),
            fetchAllProfiles()
          ]);
          showToast('Membro adicionado ao grupo!', 'success');
        } catch (err) {
          console.error(err);
          showToast('Erro ao adicionar membro', 'error');
        } finally {
          render();
        }
      });
    });

    // Remover membro inline
    document.querySelectorAll('[data-remove-member-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const userId = btn.dataset.removeMemberId;
        if (!selectedDeptId) return;

        btn.disabled = true;
        btn.textContent = '...';

        try {
          const { error } = await supabase
            .from('profile_departments')
            .delete()
            .eq('profile_id', userId)
            .eq('department_id', selectedDeptId);
          
          if (error) throw error;

          // Recarregar os dados locais
          [departments, users] = await Promise.all([
            fetchDepartments(),
            fetchAllProfiles()
          ]);
          showToast('Membro removido do grupo!', 'success');
        } catch (err) {
          console.error(err);
          showToast('Erro ao remover membro', 'error');
        } finally {
          render();
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

function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('pt-BR');
}
