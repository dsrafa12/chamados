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
      <main class="page form-page" style="padding-top: 48px !important;">
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

    // Definir min e validar prazo em tempo real no campo deadline
    const deadlineEl = document.getElementById('deadline');
    if (deadlineEl) {
      const getMinDateStr = () => {
        const minDate = new Date(Date.now() + 60 * 60 * 1000);
        const yyyy = minDate.getFullYear();
        const mm = String(minDate.getMonth() + 1).padStart(2, '0');
        const dd = String(minDate.getDate()).padStart(2, '0');
        const hh = String(minDate.getHours()).padStart(2, '0');
        const mi = String(minDate.getMinutes()).padStart(2, '0');
        return `${yyyy}-${mm}-${dd}T${hh}:${mi}`;
      };

      deadlineEl.min = getMinDateStr();

      deadlineEl.addEventListener('change', () => {
        if (deadlineEl.value) {
          const selected = new Date(deadlineEl.value);
          const minAllowed = new Date(Date.now() + 60 * 60 * 1000);
          if (selected < minAllowed) {
            deadlineEl.value = getMinDateStr();
            showToast('O prazo mínimo para conclusão deve ser de no mínimo 1 hora a frente.', 'warning');
          }
        }
      });
    }

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

    const deadlineInput = document.getElementById('deadline');
    let deadlineIso = null;
    let isAutoOneHour = false;

    // Calcular data e hora mínima (+1 hora a partir de agora)
    const now = new Date();
    const minDeadline = new Date(now.getTime() + 60 * 60 * 1000);
    
    // Helper para converter objeto Date em string compatível com input datetime-local em horário local
    const toDatetimeLocalString = (dateObj) => {
      const year = dateObj.getFullYear();
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const day = String(dateObj.getDate()).padStart(2, '0');
      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    };

    if (!deadlineInput.value) {
      deadlineInput.value = toDatetimeLocalString(minDeadline);
      deadlineIso = minDeadline.toISOString();
      isAutoOneHour = true;
    } else {
      const selectedDate = new Date(deadlineInput.value);
      if (selectedDate < minDeadline) {
        deadlineInput.value = toDatetimeLocalString(minDeadline);
        deadlineIso = minDeadline.toISOString();
        isAutoOneHour = true;
      } else {
        deadlineIso = selectedDate.toISOString();
      }
    }

    // Modal de confirmação antes de salvar
    const confirmMessage = isAutoOneHour 
      ? 'A data de prazo não foi definida ou é inferior ao limite mínimo. <strong>O chamado será salvo automaticamente com 1 hora de prazo a partir de agora.</strong>'
      : 'Confira os dados do chamado antes de confirmar a criação.';

    const confirmed = await new Promise((resolve) => {
      const confirmDialog = document.createElement('div');
      confirmDialog.className = 'modal-container open';
      confirmDialog.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:1300; display:flex; align-items:center; justify-content:center;';
      confirmDialog.innerHTML = `
        <div class="modal" style="width:90%; max-width:440px; padding:24px; display:flex; flex-direction:column; gap:16px; background:#ffffff; border-radius:16px; border:1px solid var(--border); box-shadow:var(--shadow-lg); animation:slideUp 0.2s ease-out;">
          <div style="display:flex; justify-content:space-between; align-items:center;">
            <h3 style="margin:0; font-size:1.1rem; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
              ❓ Confirmar Criação do Chamado
            </h3>
            <button id="closeConfirmModalBtn" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:var(--text-muted);">✕</button>
          </div>

          <div style="background:${isAutoOneHour ? '#eff6ff' : '#f8fafc'}; border:1px solid ${isAutoOneHour ? '#bfdbfe' : '#e2e8f0'}; border-radius:8px; padding:12px 14px; font-size:0.86rem; color:${isAutoOneHour ? '#1e40af' : 'var(--text-secondary)'}; display:flex; flex-direction:column; gap:4px;">
            <span>${confirmMessage}</span>
          </div>

          <p style="margin:0; font-size:0.9rem; color:var(--text-primary); font-weight:600;">
            Deseja realmente salvar e abrir este chamado?
          </p>

          <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
            <button id="cancelSaveBtn" class="btn btn-secondary" style="padding:8px 18px;">Cancelar</button>
            <button id="confirmSaveBtn" class="btn btn-primary" style="padding:8px 18px; font-weight:600;">
              Sim, Salvar Chamado
            </button>
          </div>
        </div>
      `;
      document.body.appendChild(confirmDialog);

      const closeDialog = (val) => {
        confirmDialog.remove();
        resolve(val);
      };

      confirmDialog.querySelector('#closeConfirmModalBtn')?.addEventListener('click', () => closeDialog(false));
      confirmDialog.querySelector('#cancelSaveBtn')?.addEventListener('click', () => closeDialog(false));
      confirmDialog.querySelector('#confirmSaveBtn')?.addEventListener('click', () => closeDialog(true));
    });

    if (!confirmed) return;

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
        deadline: deadlineIso,
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
