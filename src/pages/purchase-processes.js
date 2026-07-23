/**
 * Purchase Processes — Módulo de gerenciamento de processos de compra
 */
import { getCurrentProfile } from '../lib/auth.js';
import { 
  fetchPurchaseProcesses, 
  updatePurchaseProcessStatus 
} from '../lib/api.js';
import { navigateTo } from '../lib/router.js';
import { showToast } from '../lib/toast.js';
import { getLayoutTemplate, bindLayoutEvents } from '../lib/layout.js';

const STATUS_LABELS = {
  awaiting_start: 'Aguardando Início',
  in_analysis: 'Em Análise',
  awaiting_info: 'Aguardando Informações',
  in_quotation: 'Em Cotação',
  in_approval: 'Em Aprovação',
  order_issued: 'Pedido Emitido',
  awaiting_supplier: 'Aguardando Fornecedor',
  awaiting_receipt: 'Aguardando Recebimento',
  finalized: 'Finalizado',
  cancelled: 'Cancelado'
};

export async function renderPurchaseProcesses(container, queryString) {
  let profile = null;
  let processes = [];
  let filteredProcesses = [];
  let selectedProcess = null;
  
  const params = new URLSearchParams(queryString || '');
  const targetTicketId = params.get('ticketId');

  try {
    profile = await getCurrentProfile();
    if (!profile) {
      navigateTo('/login');
      return;
    }

    // Apenas membros de Compras ou Diretores podem acessar
    const isMemberOfCompras = profile.departments?.some(d => d.name?.toLowerCase() === 'compras') || profile.role === 'director';
    if (!isMemberOfCompras) {
      showToast('Acesso negado. Módulo restrito ao setor de Compras.', 'error');
      navigateTo('/dashboard');
      return;
    }
  } catch (err) {
    navigateTo('/login');
    return;
  }

  async function loadData() {
    try {
      processes = await fetchPurchaseProcesses();
      filterAndRender();

      // Se veio com um ticketId específico na URL, abre automaticamente o detalhe/modal desse processo
      if (targetTicketId) {
        const found = processes.find(p => p.ticket_id === targetTicketId);
        if (found) {
          openStatusModal(found);
        }
      }
    } catch (err) {
      console.error(err);
      showToast('Erro ao carregar processos de compra', 'error');
    }
  }

  function filterAndRender() {
    const searchVal = document.getElementById('searchProcessInput')?.value?.toLowerCase() || '';
    const statusVal = document.getElementById('filterProcessStatus')?.value || '';

    filteredProcesses = processes.filter(p => {
      const ticket = p.ticket || {};
      const matchesSearch = 
        (ticket.ticket_number?.toString() || '').includes(searchVal) ||
        (ticket.title || '').toLowerCase().includes(searchVal) ||
        (ticket.creator?.full_name || '').toLowerCase().includes(searchVal);
      
      const matchesStatus = !statusVal || p.status === statusVal;

      return matchesSearch && matchesStatus;
    });

    renderTable();
  }

  function renderPage() {
    container.innerHTML = getLayoutTemplate(profile, 'purchase-processes');
    const mainContent = document.getElementById('mainContent');

    mainContent.innerHTML = `
      <main class="page" style="max-width:1200px; margin: 0 auto; padding-top: 48px !important;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:28px; flex-wrap:wrap; gap:16px;">
          <div>
            <h1 style="margin:0; font-size:1.8rem; font-weight:700; color:var(--text-primary);">Processos de Compra</h1>
            <p style="margin:4px 0 0 0; font-size:0.9rem; color:var(--text-muted);">Gerenciamento de fluxos de compras e suprimentos integrados aos chamados</p>
          </div>
        </div>

        <!-- FILTROS -->
        <div class="card" style="padding:16px; margin-bottom:24px; display:flex; gap:16px; align-items:center; flex-wrap:wrap;">
          <div style="flex:1; min-width:260px; position:relative;">
            <input type="text" id="searchProcessInput" class="input" placeholder="Buscar por Nº, título ou autor..." style="padding-left:36px; font-size:0.9rem;" />
            <span style="position:absolute; left:12px; top:50%; transform:translateY(-50%); color:var(--text-muted);">🔍</span>
          </div>
          <div style="min-width:180px;">
            <select id="filterProcessStatus" class="input" style="font-size:0.9rem;">
              <option value="">Todos os Status</option>
              ${Object.entries(STATUS_LABELS).map(([key, label]) => `
                <option value="${key}">${label}</option>
              `).join('')}
            </select>
          </div>
        </div>

        <!-- LISTAGEM -->
        <div class="card" style="padding:0; overflow:hidden;">
          <div style="overflow-x:auto;">
            <table class="tickets-table" style="width:100%; border-collapse:collapse; text-align:left;">
              <thead>
                <tr style="background:var(--bg-app); border-bottom:1px solid var(--border);">
                  <th style="padding:14px 20px; font-size:0.82rem; font-weight:600; color:var(--text-secondary); width:120px;">Chamado</th>
                  <th style="padding:14px 20px; font-size:0.82rem; font-weight:600; color:var(--text-secondary);">Título do Chamado</th>
                  <th style="padding:14px 20px; font-size:0.82rem; font-weight:600; color:var(--text-secondary); width:200px;">Autor</th>
                  <th style="padding:14px 20px; font-size:0.82rem; font-weight:600; color:var(--text-secondary); width:180px;">Origem Destino</th>
                  <th style="padding:14px 20px; font-size:0.82rem; font-weight:600; color:var(--text-secondary); text-align:center; width:180px;">Status de Compra</th>
                  <th style="padding:14px 20px; font-size:0.82rem; font-weight:600; color:var(--text-secondary); text-align:center; width:100px;">Ações</th>
                </tr>
              </thead>
              <tbody id="purchaseProcessesTableBody">
                <!-- Injetado dinamicamente -->
              </tbody>
            </table>
          </div>
        </div>
      </main>

      <!-- MODAL DE STATUS -->
      <div id="statusModal" class="modal" style="display:none; position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:1100; align-items:center; justify-content:center;">
        <div class="card" style="width:100%; max-width:500px; padding:24px; position:relative; box-shadow:var(--shadow-lg); animation: slideUp 0.25s ease-out;">
          <button id="closeModalBtn" style="position:absolute; top:20px; right:20px; background:transparent; border:none; font-size:1.2rem; cursor:pointer; color:var(--text-muted);" title="Fechar">✕</button>
          
          <h3 style="margin:0 0 4px 0; font-size:1.25rem; font-weight:700; color:var(--text-primary);" id="modalTitle">Status do Processo</h3>
          <p style="margin:0 0 20px 0; font-size:0.88rem; color:var(--text-muted);" id="modalSubtitle"></p>

          <div style="margin-bottom:20px;">
            <label style="display:block; font-size:0.85rem; font-weight:600; color:var(--text-secondary); margin-bottom:8px;">Status Atual do Processo</label>
            <select id="modalStatusSelect" class="input" style="font-size:0.95rem; padding:10px 12px; background:var(--bg-card);">
              ${Object.entries(STATUS_LABELS).map(([key, label]) => `
                <option value="${key}">${label}</option>
              `).join('')}
            </select>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:12px;">
            <button class="btn btn-secondary" id="modalCancelBtn" style="padding:10px 20px;">Cancelar</button>
            <button class="btn btn-primary" id="modalSaveBtn" style="padding:10px 24px; font-weight:600;">Salvar Status</button>
          </div>
        </div>
      </div>
    `;

    // Estilos do Modal
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .modal {
        display: flex !important;
      }
    `;
    document.head.appendChild(styleSheet);

    bindLayoutEvents(profile);
    bindPageEvents();
  }

  function renderTable() {
    const tbody = document.getElementById('purchaseProcessesTableBody');
    if (!tbody) return;

    if (filteredProcesses.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" style="padding:40px; text-align:center; color:var(--text-muted); font-size:0.9rem;">
            Nenhum processo de compra encontrado.
          </td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = filteredProcesses.map(p => {
      const ticket = p.ticket || {};
      const creatorName = ticket.creator?.full_name || '—';
      const destName = ticket.destination?.name || 'Compras';
      
      let badgeStyle = '';
      if (p.status === 'awaiting_start') {
        badgeStyle = 'background:#f3f4f6; color:#374151;';
      } else if (p.status === 'in_analysis') {
        badgeStyle = 'background:#e0e7ff; color:#3730a3;';
      } else if (p.status === 'awaiting_info') {
        badgeStyle = 'background:#fef3c7; color:#92400e;';
      } else if (p.status === 'in_quotation') {
        badgeStyle = 'background:#e0f2fe; color:#0369a1;';
      } else if (p.status === 'in_approval') {
        badgeStyle = 'background:#fae8ff; color:#86198f;';
      } else if (p.status === 'order_issued') {
        badgeStyle = 'background:#dcfce7; color:#166534;';
      } else if (p.status === 'awaiting_supplier') {
        badgeStyle = 'background:#ffedd5; color:#9a3412;';
      } else if (p.status === 'awaiting_receipt') {
        badgeStyle = 'background:#ecfeff; color:#0891b2;';
      } else if (p.status === 'finalized') {
        badgeStyle = 'background:#dcfce7; color:#15803d;';
      } else if (p.status === 'cancelled') {
        badgeStyle = 'background:#fee2e2; color:#991b1b;';
      }

      return `
        <tr style="border-bottom:1px solid var(--border); transition:background 0.2s;">
          <td style="padding:14px 20px;">
            <a href="#/ticket?id=${p.ticket_id}" style="color:var(--primary); font-weight:700; text-decoration:none; font-size:0.9rem;">
              Nº: ${ticket.ticket_number || ''}
            </a>
          </td>
          <td style="padding:14px 20px;">
            <span style="font-weight:600; color:var(--text-primary); font-size:0.9rem;">${escapeHtml(ticket.title || '')}</span>
          </td>
          <td style="padding:14px 20px; font-weight:500; color:var(--text-secondary); font-size:0.9rem;">
            ${escapeHtml(creatorName)}
          </td>
          <td style="padding:14px 20px; font-weight:500; color:var(--text-secondary); font-size:0.9rem;">
            ${escapeHtml(destName)}
          </td>
          <td style="padding:14px 20px; text-align:center;">
            <span class="badge" style="min-width:145px; padding:6px 12px; font-size:0.8rem; border-radius:12px; font-weight:600; display:inline-block; ${badgeStyle}">
              ${STATUS_LABELS[p.status] || p.status}
            </span>
          </td>
          <td style="padding:14px 20px; text-align:center;">
            <button class="btn btn-sm btn-secondary manage-status-btn" data-id="${p.id}" style="padding:6px 12px; font-size:0.8rem; font-weight:600;">
              Alterar
            </button>
          </td>
        </tr>
      `;
    }).join('');
  }

  function bindPageEvents() {
    document.getElementById('searchProcessInput')?.addEventListener('input', filterAndRender);
    document.getElementById('filterProcessStatus')?.addEventListener('change', filterAndRender);

    // Fechar modal
    const modal = document.getElementById('statusModal');
    const closeBtns = ['closeModalBtn', 'modalCancelBtn'];
    closeBtns.forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        if (modal) modal.style.display = 'none';
      });
    });

    // Delegar cliques para alterar status
    document.getElementById('purchaseProcessesTableBody')?.addEventListener('click', (e) => {
      const btn = e.target.closest('.manage-status-btn');
      if (btn) {
        const processId = btn.getAttribute('data-id');
        const found = processes.find(p => p.id === processId);
        if (found) {
          openStatusModal(found);
        }
      }
    });

    // Salvar Status
    document.getElementById('modalSaveBtn')?.addEventListener('click', async () => {
      if (!selectedProcess) return;

      const newStatus = document.getElementById('modalStatusSelect').value;
      const saveBtn = document.getElementById('modalSaveBtn');

      try {
        saveBtn.disabled = true;
        saveBtn.textContent = 'Salvando...';

        await updatePurchaseProcessStatus(selectedProcess.id, newStatus);
        showToast('Status do processo atualizado com sucesso!', 'success');
        
        if (modal) modal.style.display = 'none';
        await loadData();
      } catch (err) {
        console.error(err);
        showToast('Erro ao atualizar status', 'error');
      } finally {
        saveBtn.disabled = false;
        saveBtn.textContent = 'Salvar Status';
      }
    });
  }

  function openStatusModal(process) {
    selectedProcess = process;
    const modal = document.getElementById('statusModal');
    const title = document.getElementById('modalTitle');
    const subtitle = document.getElementById('modalSubtitle');
    const select = document.getElementById('modalStatusSelect');

    if (modal && title && subtitle && select) {
      title.textContent = `Processo Chamado Nº ${process.ticket?.ticket_number || ''}`;
      subtitle.textContent = `Ajuste o status de compras para o chamado "${process.ticket?.title || ''}"`;
      select.value = process.status;
      modal.style.display = 'flex';
    }
  }

  function escapeHtml(str) {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  renderPage();
  await loadData();
}
