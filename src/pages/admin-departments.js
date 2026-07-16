/**
 * Admin — Cadastro de Setores (somente super admin ds.rafa@hotmail.com)
 */
import { getCurrentProfile } from '../lib/auth.js';
import { fetchDepartments, createDepartment, deleteDepartment } from '../lib/api.js';
import { navigateTo } from '../lib/router.js';
import { showToast } from '../lib/toast.js';
import { getLayoutTemplate, bindLayoutEvents } from '../lib/layout.js';

export async function renderAdminDepartments(container) {
  let profile = null;
  let departments = [];
  let loading = false;

  try {
    profile = await getCurrentProfile();
    if (!profile) { navigateTo('/login'); return; }
    
    // Restrição estrita de super admin
    if (profile.email !== 'ds.rafa@hotmail.com') {
      showToast('Acesso restrito ao Super Administrador', 'error');
      navigateTo('/dashboard');
      return;
    }
    departments = await fetchDepartments();
  } catch {
    navigateTo('/login');
    return;
  }

  function render() {
    // 1. Injeta layout base da sidebar
    container.innerHTML = getLayoutTemplate(profile, 'departments');

    // 2. Injeta conteúdo específico na área principal
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
      <main class="page" style="max-width:600px; margin: 0 auto;">
        <div class="page-header">
          <div>
            <h1>Gerenciar Setores</h1>
            <p style="color:var(--text-secondary);font-size:0.9rem;margin-top:2px;">
              Adicione e remova os setores da empresa
            </p>
          </div>
        </div>

        <!-- Formulário para adicionar -->
        <div class="card" style="margin-bottom:24px;padding:24px;">
          <h3 style="margin-bottom:16px;">Adicionar Novo Setor</h3>
          <form class="admin-add-form" id="addDeptForm">
            <input type="text" class="input" id="deptName" placeholder="Nome do setor" required />
            <button type="submit" class="btn btn-primary" ${loading ? 'disabled' : ''}>
              ${loading ? '...' : 'Adicionar'}
            </button>
          </form>
        </div>

        <!-- Lista de setores -->
        <h3 style="margin-bottom:12px;">Setores Cadastrados (${departments.length})</h3>
        <div class="admin-list">
          ${departments.map(d => `
            <div class="admin-list-item">
              <div>
                <span style="font-weight:600;">${escapeHtml(d.name)}</span>
                <span style="font-size:0.75rem;color:var(--text-muted);margin-left:8px;">
                  ${formatDate(d.created_at)}
                </span>
              </div>
              ${d.name !== 'Diretoria' ? `
                <button class="btn btn-sm btn-danger" data-delete-id="${d.id}" title="Excluir">
                  <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
                </button>
              ` : '<span class="badge badge-open">Padrão</span>'}
            </div>
          `).join('')}
        </div>
      </main>
    `;

    bindLayoutEvents(profile);
    bindPageEvents();
  }

  function bindPageEvents() {
    document.getElementById('addDeptForm')?.addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('deptName').value.trim();
      if (!name) return;

      loading = true;
      render();

      try {
        await createDepartment(name);
        departments = await fetchDepartments();
        showToast(`Setor "${name}" criado!`, 'success');
      } catch (err) {
        if (err.message?.includes('duplicate') || err.message?.includes('unique')) {
          showToast('Setor já existe', 'error');
        } else {
          showToast(err.message || 'Erro ao criar setor', 'error');
        }
      }
      loading = false;
      render();
    });

    document.querySelectorAll('[data-delete-id]').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.deleteId;
        const dept = departments.find(d => d.id === id);
        if (!confirm(`Tem certeza que deseja excluir o setor "${dept?.name}"?`)) return;

        try {
          await deleteDepartment(id);
          departments = await fetchDepartments();
          showToast('Setor excluído', 'success');
          render();
        } catch (err) {
          showToast('Erro ao excluir (pode haver chamados vinculados)', 'error');
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
