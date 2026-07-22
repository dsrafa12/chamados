/**
 * Formulário "Abrir Chamado" integrado à Sidebar
 */
import { getCurrentProfile, fetchAllProfiles } from '../lib/auth.js';
import { fetchDepartments, createTicket } from '../lib/api.js';
import { navigateTo } from '../lib/router.js';
import { showToast } from '../lib/toast.js';
import { getLayoutTemplate, bindLayoutEvents } from '../lib/layout.js';

export async function renderNewTicket(container) {
  let profile = null;
  let departments = [];
  let users = [];
  let selectedVisibility = new Set();
  let selectedUsers = new Set();
  let loading = false;

  try {
    profile = await getCurrentProfile();
    if (!profile) { navigateTo('/login'); return; }
    
    [departments, users] = await Promise.all([
      fetchDepartments(),
      fetchAllProfiles()
    ]);
    
    // Filtra o próprio usuário criador
    users = users.filter(u => u.id !== profile.id);
  } catch {
    navigateTo('/login');
    return;
  }

  const myDeptName = profile.departments?.map(d => d.name).join(', ') || 'Sem grupo';

  function render() {
    // 1. Injeta layout base da sidebar
    container.innerHTML = getLayoutTemplate(profile, 'tickets');

    // 2. Injeta conteúdo específico na área principal
    const mainContent = document.getElementById('mainContent');
    mainContent.innerHTML = `
      <main class="page form-page">
        <!-- HEADER DO FORMULÁRIO -->
        <div style="display:flex;align-items:center;gap:14px;margin-bottom:20px;">
          <button class="btn btn-secondary btn-sm" id="backBtn" style="padding:8px 12px;">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
            Voltar
          </button>
          <h1>Novo Chamado</h1>
        </div>

        <div class="form-card">
          <form id="ticketForm">
            <div style="display:flex;flex-direction:column;gap:20px;">
              <!-- Autor do Chamado (Informativo) -->
              <div class="form-group">
                <label>Autor do Chamado</label>
                <input type="text" class="input" value="${escapeHtml(profile.full_name || 'Sem nome')}" disabled style="background:var(--bg-card); cursor:not-allowed; opacity:0.8;" />
              </div>

              <!-- Assunto -->
              <div class="form-group">
                <label for="title">Assunto</label>
                <input type="text" id="title" class="input" placeholder="Nome do Pedido e Tipo Problema" maxlength="60" required />
              </div>

              <!-- Prazo (Deadline) -->
              <div class="form-group">
                <label for="deadline">Prazo de Conclusão <span style="font-weight:400;color:var(--text-muted)">(opcional)</span></label>
                <input type="datetime-local" id="deadline" class="input" style="background:var(--bg-card); color:var(--text-primary); border-color:var(--border);" />
              </div>

              <!-- Prioridade -->
              <div class="form-group">
                <label style="margin-bottom:8px; display:block;">Prioridade</label>
                <div style="display:flex;gap:12px;margin-top:4px;">
                  <div class="priority-btn" style="flex:1;text-align:center;padding:10px;border-radius:8px;border:2px solid var(--border);cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--bg-card);transition:all 0.2s;" data-priority="low">
                    <span style="width:8px;height:8px;border-radius:50%;background:#10b981;"></span>
                    Baixa
                  </div>
                  <div class="priority-btn" style="flex:1;text-align:center;padding:10px;border-radius:8px;border:2px solid #3b82f6;cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;background:rgba(59,130,246,0.08);color:#2563eb;transition:all 0.2s;" data-priority="medium">
                    <span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;"></span>
                    Média
                  </div>
                  <div class="priority-btn" style="flex:1;text-align:center;padding:10px;border-radius:8px;border:2px solid var(--border);cursor:pointer;font-weight:600;display:flex;align-items:center;justify-content:center;gap:8px;background:var(--bg-card);transition:all 0.2s;" data-priority="high">
                    <span style="width:8px;height:8px;border-radius:50%;background:#ef4444;"></span>
                    Alta
                  </div>
                </div>
                <input type="hidden" id="priority" value="medium" />
              </div>

              <!-- Destinar para Grupo -->
              <div class="form-group">
                <label>Destinar para Grupo <span style="font-weight:400;color:var(--text-muted)">(opcional se colaborador selecionado)</span></label>
                <div class="multi-select" id="visibilitySelect">
                  ${departments.map(d => `
                    <label class="multi-select-item ${selectedVisibility.has(d.id) ? 'selected' : ''}" data-dept-id="${d.id}">
                      <span class="multi-select-check"></span>
                      <input type="checkbox" value="${d.id}" ${selectedVisibility.has(d.id) ? 'checked' : ''} />
                      ${d.name}
                    </label>
                  `).join('')}
                </div>
              </div>

              <!-- Destinar para Colaborador -->
              <div class="form-group">
                <label>Destinar para Colaborador <span style="font-weight:400;color:var(--text-muted)">(opcional se grupo selecionado)</span></label>
                <div class="multi-select" id="usersSelect" style="max-height:180px;overflow-y:auto;">
                  ${users.map(u => `
                    <label class="multi-select-item ${selectedUsers.has(u.id) ? 'selected' : ''}" data-user-id="${u.id}">
                      <span class="multi-select-check"></span>
                      <input type="checkbox" value="${u.id}" ${selectedUsers.has(u.id) ? 'checked' : ''} />
                      <div style="display:inline-flex;align-items:center;gap:6px;">
                        <span style="font-weight:500;">${u.full_name}</span>
                        <span style="font-size:0.75rem;color:var(--text-muted);">(${u.departments?.map(d => d.name).join(', ') || 'Sem grupo'})</span>
                      </div>
                    </label>
                  `).join('')}
                </div>
              </div>

              <!-- Descrição -->
              <div class="form-group">
                <label for="description">Descrição</label>
                <textarea id="description" class="textarea" placeholder="Descreva o chamado com detalhes..."></textarea>
              </div>

              <!-- Submit -->
              <button type="submit" class="btn btn-primary btn-lg" id="submitBtn" ${loading ? 'disabled' : ''} style="margin-top:4px;">
                ${loading ? '<span class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></span> Salvando...' : 'Salvar Chamado'}
              </button>
            </div>
          </form>
        </div>
      </main>
    `;

    bindLayoutEvents(profile);
    bindPageEvents();
  }

  function bindPageEvents() {
    // Voltar
    document.getElementById('backBtn')?.addEventListener('click', () => navigateTo('/dashboard'));

    // Multi-select visibilidade grupos
    document.querySelectorAll('#visibilitySelect .multi-select-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const deptId = item.dataset.deptId;
        const checkbox = item.querySelector('input[type="checkbox"]');

        if (selectedVisibility.has(deptId)) {
          selectedVisibility.delete(deptId);
          item.classList.remove('selected');
          checkbox.checked = false;
        } else {
          selectedVisibility.add(deptId);
          item.classList.add('selected');
          checkbox.checked = true;
        }
      });
    });

    // Multi-select usuários
    document.querySelectorAll('#usersSelect .multi-select-item').forEach(item => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        const userId = item.dataset.userId;
        const checkbox = item.querySelector('input[type="checkbox"]');

        if (selectedUsers.has(userId)) {
          selectedUsers.delete(userId);
          item.classList.remove('selected');
          checkbox.checked = false;
        } else {
          selectedUsers.add(userId);
          item.classList.add('selected');
          checkbox.checked = true;
        }
      });
    });

    // Seleção de prioridade por botões
    const priorityInput = document.getElementById('priority');
    const priorityButtons = document.querySelectorAll('.priority-btn');

    priorityButtons.forEach(btn => {
      btn.addEventListener('click', () => {
        const val = btn.dataset.priority;
        if (priorityInput) priorityInput.value = val;

        priorityButtons.forEach(b => {
          b.style.border = '2px solid var(--border)';
          b.style.background = 'var(--bg-card)';
          b.style.color = 'var(--text-primary)';
        });

        if (val === 'low') {
          btn.style.border = '2px solid #10b981';
          btn.style.background = 'rgba(16,185,129,0.08)';
          btn.style.color = '#059669';
        } else if (val === 'medium') {
          btn.style.border = '2px solid #3b82f6';
          btn.style.background = 'rgba(59,130,246,0.08)';
          btn.style.color = '#2563eb';
        } else if (val === 'high') {
          btn.style.border = '2px solid #ef4444';
          btn.style.background = 'rgba(239,68,68,0.08)';
          btn.style.color = '#dc2626';
        }
      });
    });

    // Submit
    document.getElementById('ticketForm')?.addEventListener('submit', handleSubmit);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    const title = document.getElementById('title').value.trim();
    const priority = document.getElementById('priority').value;
    const description = document.getElementById('description').value.trim();

    if (!title) {
      showToast('Preencha o assunto do chamado', 'error');
      return;
    }

    if (title.length > 60) {
      showToast('O assunto não pode exceder 60 caracteres', 'error');
      return;
    }

    // Validação obrigatória: Pelo menos um grupo ou colaborador selecionado
    if (selectedVisibility.size === 0 && selectedUsers.size === 0) {
      showToast('Selecione pelo menos um grupo ou colaborador de destino.', 'error');
      return;
    }

    const deadlineVal = document.getElementById('deadline').value;
    const deadline = deadlineVal ? new Date(deadlineVal).toISOString() : null;

    loading = true;
    render();

    // Compatibilidade com coluna legada
    const destinationDeptId = Array.from(selectedVisibility)[0] || null;

    try {
      await createTicket({
        title,
        description,
        destinationDeptId,
        priority,
        deadline,
        visibilityDeptIds: Array.from(selectedVisibility),
        profileIds: Array.from(selectedUsers),
      });

      showToast('Chamado criado com sucesso!', 'success');
      navigateTo('/dashboard');
    } catch (err) {
      console.error(err);
      showToast(err.message || 'Erro ao criar chamado', 'error');
      loading = false;
      render();
    }
  }

  render();
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
