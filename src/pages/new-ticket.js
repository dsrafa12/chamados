/**
 * Formulário "Abrir Chamado" integrado à Sidebar
 */
import { getCurrentProfile } from '../lib/auth.js';
import { fetchDepartments, createTicket } from '../lib/api.js';
import { navigateTo } from '../lib/router.js';
import { showToast } from '../lib/toast.js';
import { getLayoutTemplate, bindLayoutEvents } from '../lib/layout.js';

export async function renderNewTicket(container) {
  let profile = null;
  let departments = [];
  let selectedVisibility = new Set();
  let loading = false;

  try {
    profile = await getCurrentProfile();
    if (!profile) { navigateTo('/login'); return; }
    departments = await fetchDepartments();
  } catch {
    navigateTo('/login');
    return;
  }

  const myDeptName = profile.department?.name || 'Sem setor';

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
          <div>
            <span class="origin-badge">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-4 0a1 1 0 01-1-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 01-1 1"/></svg>
              Setor de Origem: ${myDeptName}
            </span>
          </div>

          <form id="ticketForm">
            <div style="display:flex;flex-direction:column;gap:20px;">
              <!-- Assunto -->
              <div class="form-group">
                <label for="title">Assunto</label>
                <input type="text" id="title" class="input" placeholder="Nome do Pedido e Tipo Problema" required />
              </div>

              <!-- Destino -->
              <div class="form-group">
                <label for="destination">Destino</label>
                <select id="destination" class="select" required>
                  <option value="">Selecione o setor de destino</option>
                  ${departments
                    .filter(d => d.id !== profile.department_id)
                    .map(d => `<option value="${d.id}">${d.name}</option>`)
                    .join('')}
                </select>
              </div>

              <!-- Prioridade -->
              <div class="form-group">
                <label for="priority">Prioridade</label>
                <select id="priority" class="select" required>
                  <option value="low">Baixa</option>
                  <option value="medium" selected>Média</option>
                  <option value="high">Alta</option>
                </select>
              </div>

              <!-- Visibilidade Compartilhada -->
              <div class="form-group">
                <label>Visibilidade Compartilhada <span style="font-weight:400;color:var(--text-muted)">(opcional)</span></label>
                <div class="multi-select" id="visibilitySelect">
                  ${departments
                    .filter(d => d.id !== profile.department_id)
                    .map(d => `
                      <label class="multi-select-item ${selectedVisibility.has(d.id) ? 'selected' : ''}" data-dept-id="${d.id}">
                        <span class="multi-select-check"></span>
                        <input type="checkbox" value="${d.id}" ${selectedVisibility.has(d.id) ? 'checked' : ''} />
                        ${d.name}
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

    // Multi-select visibilidade
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

    // Submit
    document.getElementById('ticketForm')?.addEventListener('submit', handleSubmit);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    const title = document.getElementById('title').value.trim();
    const destinationDeptId = document.getElementById('destination').value;
    const priority = document.getElementById('priority').value;
    const description = document.getElementById('description').value.trim();

    if (!title || !destinationDeptId) {
      showToast('Preencha todos os campos obrigatórios', 'error');
      return;
    }

    selectedVisibility.delete(destinationDeptId);

    loading = true;
    render();

    try {
      await createTicket({
        title,
        description,
        originDeptId: profile.department_id,
        destinationDeptId,
        priority,
        visibilityDeptIds: Array.from(selectedVisibility),
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
