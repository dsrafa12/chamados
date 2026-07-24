/**
 * Purchase Processes — Módulo de gerenciamento de processos de compra
 */
import { getCurrentProfile, fetchAllProfiles } from '../lib/auth.js';
import { 
  fetchPurchaseProcesses, 
  updatePurchaseProcessStatus,
  updatePurchaseProcess,
  fetchTicketHistory,
  sendTicketMessage,
  updateTicketStatus
} from '../lib/api.js';
import { navigateTo } from '../lib/router.js';
import { showToast } from '../lib/toast.js';
import { getLayoutTemplate, bindLayoutEvents } from '../lib/layout.js';

const STATUS_LABELS = {
  awaiting_start: 'Gerado Processo de Compra',
  in_analysis: 'Em Análise',
  awaiting_info: 'Aguardando Informações',
  in_quotation: 'Em Cotação',
  in_approval: 'Em Aprovação',
  order_issued: 'Pedido Emitido',
  awaiting_supplier: 'Aguardando Fornecedor',
  awaiting_receipt: 'Aguardando Recebimento',
  received_partial: 'Recebido Parcial',
  finalized: 'Finalizado',
  cancelled: 'Cancelado',
  reopened: 'Reaberto'
};

export async function renderPurchaseProcesses(container, queryString) {
  let profile = null;
  let processes = [];
  let filteredProcesses = [];
  let selectedProcess = null;
  let allProfiles = [];
  let currentView = 'kanban';
  
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
      const [procData, profData] = await Promise.all([
        fetchPurchaseProcesses(),
        fetchAllProfiles()
      ]);
      processes = procData;
      allProfiles = profData;
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

    if (currentView === 'kanban') {
      renderKanban();
    } else {
      renderList();
    }
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
              ${Object.entries(STATUS_LABELS)
                .filter(([key]) => key !== 'finalized' && key !== 'cancelled' && key !== 'reopened')
                .map(([key, label]) => `
                <option value="${key}">${label}</option>
              `).join('')}
            </select>
          </div>
          <div style="display:flex; border:1px solid var(--border); border-radius:8px; overflow:hidden; background:var(--bg-card);">
            <button id="viewKanbanBtn" class="btn btn-sm" style="padding:8px 16px; border:none; border-radius:0; font-weight:600; cursor:pointer; background:${currentView === 'kanban' ? 'var(--primary)' : 'transparent'}; color:${currentView === 'kanban' ? 'white' : 'var(--text-secondary)'}; transition:background 0.2s;">
              ⏹️ Quadro
            </button>
            <button id="viewListBtn" class="btn btn-sm" style="padding:8px 16px; border:none; border-radius:0; font-weight:600; cursor:pointer; background:${currentView === 'list' ? 'var(--primary)' : 'transparent'}; color:${currentView === 'list' ? 'white' : 'var(--text-secondary)'}; transition:background 0.2s;">
              ☰ Lista
            </button>
          </div>
        </div>

        <!-- VIEW CONTAINER -->
        <div id="viewContainer">
          <!-- Injetado dinamicamente -->
        </div>
      </main>

      <!-- MODAL DE DETALHES E STATUS -->
      <div id="statusModal" class="modal-container" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:1100; align-items:center; justify-content:center;">
        <div id="modalInnerContainer" style="width:95%; max-width:1000px; max-height:90vh; overflow-y:auto; background:var(--bg-card); border-radius:16px; padding:32px; position:relative; box-shadow:var(--shadow-lg); animation:slideUp 0.25s ease-out;">
          <!-- Injetado dinamicamente -->
        </div>
      </div>
    `;

    // Estilos do Modal e Kanban
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
      }
      .modal-container {
        display: none;
      }
      .modal-container.open {
        display: flex !important;
      }
      .kanban-board {
        display: flex;
        gap: 20px;
        overflow-x: auto;
        padding: 10px 0 20px 0;
        align-items: start;
        -webkit-overflow-scrolling: touch;
      }
      .kanban-card:hover {
        transform: translateY(-2px);
        box-shadow: var(--shadow-md) !important;
        border-color: var(--primary) !important;
      }
      @media (max-width: 800px) {
        .modal-two-columns {
          grid-template-columns: 1fr !important;
          gap: 24px !important;
        }
      }
    `;
    document.head.appendChild(styleSheet);

    bindLayoutEvents(profile);
    bindPageEvents();
  }

  function renderKanban() {
    const viewContainer = document.getElementById('viewContainer');
    if (!viewContainer) return;

    // Se houver um filtro de status selecionado, mostrar apenas essa coluna. Caso contrário, todas.
    const statusFilterVal = document.getElementById('filterProcessStatus')?.value || '';
    const activeStatuses = statusFilterVal 
      ? [statusFilterVal] 
      : Object.keys(STATUS_LABELS).filter(k => k !== 'finalized' && k !== 'cancelled' && k !== 'reopened');

    const columnsHtml = activeStatuses.map(statusKey => {
      const colProcesses = filteredProcesses.filter(p => p.status === statusKey);
      const statusTitle = STATUS_LABELS[statusKey].replace('<br>', ' ');
      
      const cardsHtml = colProcesses.map(p => {
        const ticket = p.ticket || {};
        const creatorName = ticket.creator?.full_name || '—';
        const respProfile = allProfiles.find(prof => prof.id === p.responsible_id);
        const respName = respProfile ? (respProfile.full_name || respProfile.email) : 'Não atribuído';

        // Valor formatado
        let amountText = '';
        if (p.purchase_amount !== null && p.purchase_amount !== undefined) {
          amountText = 'R$ ' + parseFloat(p.purchase_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        // Previsão de entrega formatada
        let forecastText = '';
        if (p.delivery_forecast) {
          const [year, month, day] = p.delivery_forecast.split('-');
          forecastText = `${day}/${month}/${year}`;
        }

        // Badges de Alerta (Bloqueado/Recebido)
        let warningHtml = '';
        if (p.block_reason && p.block_reason !== 'none') {
          warningHtml += `<span style="background:#fee2e2; color:#b91c1c; font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:700;">⚠️ Bloqueado</span>`;
        }
        if (p.receipt_status === 'partial') {
          warningHtml += `<span style="background:#fef3c7; color:#d97706; font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:700;">📦 Parcial</span>`;
        } else if (p.receipt_status === 'total') {
          warningHtml += `<span style="background:#dcfce7; color:#15803d; font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:700;">✅ Recebido</span>`;
        }

        return `
          <div class="kanban-card" draggable="true" data-id="${p.id}" style="background:#ffffff; border:1px solid #e2e8f0; border-radius:12px; padding:16px; box-shadow:0 4px 6px -1px rgba(0, 0, 0, 0.05), 0 2px 4px -2px rgba(0, 0, 0, 0.05); cursor:pointer; transition:transform 0.15s, box-shadow 0.15s, border-color 0.15s; display:flex; flex-direction:column; gap:6px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <strong style="color:var(--primary); font-size:0.82rem;">Nº: ${ticket.ticket_number || ''}</strong>
              <div style="display:flex; gap:4px; flex-wrap:wrap;">
                ${warningHtml}
              </div>
            </div>
            
            <div style="font-weight:700; color:var(--text-primary); font-size:0.88rem; margin:4px 0; line-height:1.3; overflow:hidden; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical;">
              ${escapeHtml(ticket.title || '')}
            </div>

            <div style="display:flex; flex-direction:column; gap:4px; font-size:0.78rem; border-top:1px dashed var(--border); padding-top:8px; margin-top:4px;">
              <div><span style="color:var(--text-muted);">Autor:</span> <span style="color:var(--text-secondary); font-weight:600;">${escapeHtml(creatorName)}</span></div>
              <div><span style="color:var(--text-muted);">Resp:</span> <span style="color:var(--text-secondary); font-weight:600;">${escapeHtml(respName)}</span></div>
              ${p.supplier ? `<div><span style="color:var(--text-muted);">Forn:</span> <span style="color:var(--text-secondary); font-weight:600;">${escapeHtml(p.supplier)}</span></div>` : ''}
              ${amountText ? `
                <div style="margin-top:4px; display:flex; justify-content:space-between; align-items:center;">
                  <span style="color:var(--text-muted);">Valor:</span>
                  <strong style="color:#0f766e; font-size:0.85rem;">${amountText}</strong>
                </div>
              ` : ''}
              ${forecastText ? `
                <div style="display:flex; justify-content:space-between; align-items:center; margin-top:2px;">
                  <span style="color:var(--text-muted);">Previsão:</span>
                  <span style="color:var(--text-secondary); font-weight:600;">${forecastText}</span>
                </div>
              ` : ''}
            </div>
          </div>
        `;
      }).join('') || `<p style="color:var(--text-muted); font-size:0.82rem; margin:16px 0; text-align:center; width:100%;">Sem processos</p>`;

      return `
        <div class="kanban-column" style="flex:0 0 280px; background:#e2e8f0; border-radius:16px; padding:18px; display:flex; flex-direction:column; gap:14px; max-height:75vh; box-shadow:var(--shadow-sm);">
          <div class="kanban-column-header" style="display:flex; justify-content:space-between; align-items:center; padding-bottom:8px; margin-bottom:4px;">
            <span class="kanban-column-title" style="font-size:0.9rem; font-weight:700; color:var(--text-primary); line-height:1.25;">${statusTitle}</span>
            <span class="kanban-column-count" style="background:#ffffff; color:var(--text-secondary); font-size:0.75rem; font-weight:700; width:22px; height:22px; display:inline-flex; align-items:center; justify-content:center; border-radius:50%; border:1px solid var(--border);">${colProcesses.length}</span>
          </div>
          <div class="kanban-cards-container" data-status="${statusKey}" style="display:flex; flex-direction:column; gap:12px; overflow-y:auto; flex-grow:1; padding:2px; min-height:150px; transition:background 0.2s; border-radius:8px;">
            ${cardsHtml}
          </div>
        </div>
      `;
    }).join('');

    viewContainer.innerHTML = `<div class="kanban-board">${columnsHtml}</div>`;
  }

  function renderList() {
    const viewContainer = document.getElementById('viewContainer');
    if (!viewContainer) return;

    if (filteredProcesses.length === 0) {
      viewContainer.innerHTML = `
        <div class="card" style="padding:40px; text-align:center; color:var(--text-muted); font-size:0.9rem;">
          Nenhum processo de compra encontrado nesta visualização.
        </div>
      `;
      return;
    }

    const rowsHtml = filteredProcesses.map(p => {
      const ticket = p.ticket || {};
      const creatorName = ticket.creator?.full_name || '—';
      const respProfile = allProfiles.find(prof => prof.id === p.responsible_id);
      const respName = respProfile ? (respProfile.full_name || respProfile.email) : 'Não atribuído';

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

      let labelHtml = STATUS_LABELS[p.status] || p.status;
      let finalBadgeStyle = `min-width:145px; padding:6px 12px; font-size:0.8rem; border-radius:12px; font-weight:600; display:inline-block; white-space:nowrap; ${badgeStyle}`;
      if (p.status === 'awaiting_start') {
        finalBadgeStyle = `min-width:145px; padding:4px 8px; font-size:0.72rem; border-radius:12px; font-weight:600; display:inline-block; white-space:normal; line-height:1.15; ${badgeStyle}`;
        labelHtml = `Gerado Processo<br>de Compra`;
      } else if (p.status === 'awaiting_info') {
        finalBadgeStyle = `min-width:145px; padding:4px 8px; font-size:0.72rem; border-radius:12px; font-weight:600; display:inline-block; white-space:normal; line-height:1.15; ${badgeStyle}`;
        labelHtml = `Aguardando<br>Informações`;
      } else if (p.status === 'awaiting_supplier') {
        finalBadgeStyle = `min-width:145px; padding:4px 8px; font-size:0.72rem; border-radius:12px; font-weight:600; display:inline-block; white-space:normal; line-height:1.15; ${badgeStyle}`;
        labelHtml = `Aguardando<br>Fornecedor`;
      } else if (p.status === 'awaiting_receipt') {
        finalBadgeStyle = `min-width:145px; padding:4px 8px; font-size:0.72rem; border-radius:12px; font-weight:600; display:inline-block; white-space:normal; line-height:1.15; ${badgeStyle}`;
        labelHtml = `Aguardando<br>Recebimento`;
      }

      return `
        <tr class="clickable-row" data-id="${p.id}" style="border-bottom:1px solid var(--border); cursor:pointer; transition:background 0.2s;">
          <td style="padding:14px 20px;">
            <strong style="color:var(--primary); font-weight:700; font-size:0.9rem;">
              Nº: ${ticket.ticket_number || ''}
            </strong>
          </td>
          <td style="padding:14px 20px;">
            <span style="font-weight:600; color:var(--text-primary); font-size:0.9rem;">${escapeHtml(ticket.title || '')}</span>
          </td>
          <td style="padding:14px 20px; font-weight:500; color:var(--text-secondary); font-size:0.9rem;">
            ${escapeHtml(creatorName)}
          </td>
          <td style="padding:14px 20px; font-weight:500; color:var(--text-secondary); font-size:0.9rem;">
            ${escapeHtml(respName)}
          </td>
          <td style="padding:14px 20px; text-align:center;">
            <span class="badge" style="${finalBadgeStyle}">
              ${labelHtml}
            </span>
          </td>
          <td style="padding:14px 20px; text-align:center;">
            <button class="btn btn-sm btn-secondary" style="padding:6px 12px; font-size:0.8rem; font-weight:600;">
              Abrir
            </button>
          </td>
        </tr>
      `;
    }).join('');

    viewContainer.innerHTML = `
      <div class="card" style="padding:0; overflow:hidden;">
        <div style="overflow-x:auto;">
          <table class="tickets-table" style="width:100%; border-collapse:collapse; text-align:left;">
            <thead>
              <tr style="background:var(--bg-app); border-bottom:1px solid var(--border);">
                <th style="padding:14px 20px; font-size:0.82rem; font-weight:600; color:var(--text-secondary); width:120px;">Chamado</th>
                <th style="padding:14px 20px; font-size:0.82rem; font-weight:600; color:var(--text-secondary);">Título do Chamado</th>
                <th style="padding:14px 20px; font-size:0.82rem; font-weight:600; color:var(--text-secondary); width:200px;">Autor</th>
                <th style="padding:14px 20px; font-size:0.82rem; font-weight:600; color:var(--text-secondary); width:200px;">Responsável</th>
                <th style="padding:14px 20px; font-size:0.82rem; font-weight:600; color:var(--text-secondary); text-align:center; width:180px;">Status de Compra</th>
                <th style="padding:14px 20px; font-size:0.82rem; font-weight:600; color:var(--text-secondary); text-align:center; width:100px;">Ações</th>
              </tr>
            </thead>
            <tbody>
              ${rowsHtml}
            </tbody>
          </table>
        </div>
      </div>
    `;
  }

  function bindPageEvents() {
    document.getElementById('searchProcessInput')?.addEventListener('input', filterAndRender);
    document.getElementById('filterProcessStatus')?.addEventListener('change', filterAndRender);

    // Seletores de Visualização
    const kanbanBtn = document.getElementById('viewKanbanBtn');
    const listBtn = document.getElementById('viewListBtn');

    kanbanBtn?.addEventListener('click', () => {
      currentView = 'kanban';
      if (kanbanBtn) {
        kanbanBtn.style.background = 'var(--primary)';
        kanbanBtn.style.color = 'white';
      }
      if (listBtn) {
        listBtn.style.background = 'transparent';
        listBtn.style.color = 'var(--text-secondary)';
      }
      filterAndRender();
    });

    listBtn?.addEventListener('click', () => {
      currentView = 'list';
      if (listBtn) {
        listBtn.style.background = 'var(--primary)';
        listBtn.style.color = 'white';
      }
      if (kanbanBtn) {
        kanbanBtn.style.background = 'transparent';
        kanbanBtn.style.color = 'var(--text-secondary)';
      }
      filterAndRender();
    });

    const viewContainer = document.getElementById('viewContainer');

    // Delegar cliques nos cards/linhas para abrir o modal de detalhes
    viewContainer?.addEventListener('click', (e) => {
      const card = e.target.closest('.kanban-card');
      if (card) {
        const processId = card.getAttribute('data-id');
        const found = processes.find(p => p.id === processId);
        if (found) openStatusModal(found);
        return;
      }
      const row = e.target.closest('.clickable-row');
      if (row) {
        const processId = row.getAttribute('data-id');
        const found = processes.find(p => p.id === processId);
        if (found) openStatusModal(found);
      }
    });

    // Delegar eventos de Arrasta e Solta (Drag and Drop)
    viewContainer?.addEventListener('dragstart', (e) => {
      const card = e.target.closest('.kanban-card');
      if (card) {
        card.style.opacity = '0.5';
        e.dataTransfer.setData('text/plain', card.getAttribute('data-id'));
      }
    });

    viewContainer?.addEventListener('dragend', (e) => {
      const card = e.target.closest('.kanban-card');
      if (card) {
        card.style.opacity = '1';
      }
    });

    viewContainer?.addEventListener('dragover', (e) => {
      const container = e.target.closest('.kanban-cards-container');
      if (container) {
        e.preventDefault();
        container.style.background = 'rgba(15,23,42,0.06)';
      }
    });

    viewContainer?.addEventListener('dragleave', (e) => {
      const container = e.target.closest('.kanban-cards-container');
      if (container) {
        container.style.background = 'transparent';
      }
    });

    viewContainer?.addEventListener('drop', async (e) => {
      const container = e.target.closest('.kanban-cards-container');
      if (container) {
        e.preventDefault();
        container.style.background = 'transparent';
        
        const processId = e.dataTransfer.getData('text/plain');
        const targetStatus = container.getAttribute('data-status');

        if (processId && targetStatus) {
          const found = processes.find(p => p.id === processId);
          if (found && found.status !== targetStatus) {
            // Confirmar se for mudar para Em Aprovação
            if (targetStatus === 'in_approval') {
              const confirmed = await confirmInApprovalChange();
              if (!confirmed) {
                return;
              }
            }

            try {
              // Atualizar status do processo no banco de dados
              await updatePurchaseProcessStatus(processId, targetStatus);
              showToast('Status do processo atualizado por arrastar e soltar!', 'success');
              await loadData();
            } catch (err) {
              console.error(err);
              showToast('Erro ao atualizar status do processo', 'error');
            }
          }
        }
      }
    });
  }

  function confirmInApprovalChange() {
    return new Promise((resolve) => {
      const yesNoDialog = document.createElement('div');
      yesNoDialog.id = 'inApprovalConfirmDialog';
      yesNoDialog.style = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:1400; display:flex; align-items:center; justify-content:center;`;
      yesNoDialog.innerHTML = `
        <div style="background:var(--bg-card); padding:28px; border-radius:16px; box-shadow:var(--shadow-lg); width:90%; max-width:420px; display:flex; flex-direction:column; gap:20px; animation:slideUp 0.2s ease-out;">
          <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:var(--text-primary);">Enviar para Aprovação?</h3>
          <p style="margin:0; font-size:0.92rem; color:var(--text-secondary); line-height:1.5;">Deseja mudar o status para aprovação e enviar Alerta de aprovação para a Diretoria?</p>
          <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:8px;">
            <button id="inApprovalYesBtn" class="btn" style="background:var(--primary); color:white; font-weight:600; padding:10px 20px; border-radius:8px; cursor:pointer;">Sim</button>
            <button id="inApprovalNoBtn" class="btn btn-secondary" style="padding:10px 20px; border-radius:8px; cursor:pointer;">Não</button>
          </div>
        </div>
      `;
      document.body.appendChild(yesNoDialog);

      const closeDialog = (result) => {
        yesNoDialog.remove();
        resolve(result);
      };

      yesNoDialog.querySelector('#inApprovalYesBtn')?.addEventListener('click', () => closeDialog(true));
      yesNoDialog.querySelector('#inApprovalNoBtn')?.addEventListener('click', () => closeDialog(false));
    });
  }

  async function openStatusModal(process) {
    selectedProcess = process;
    const modal = document.getElementById('statusModal');
    const inner = document.getElementById('modalInnerContainer');
    if (!modal || !inner) return;

    // 1. Mostrar estado de carregamento
    inner.innerHTML = `
      <div style="display:flex; flex-direction:column; align-items:center; justify-content:center; padding:60px; gap:16px;">
        <div class="loading-spinner" style="border: 4px solid var(--border); border-top: 4px solid var(--primary); border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite;"></div>
        <span style="font-size:0.95rem; color:var(--text-secondary); font-weight:500;">Carregando detalhes do processo...</span>
      </div>
      <style>
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      </style>
    `;
    modal.classList.add('open');

    try {
      const [profilesList, historyList] = await Promise.all([
        fetchAllProfiles(),
        fetchTicketHistory(process.ticket_id)
      ]);

      const ticket = process.ticket || {};

      // Filtrar apenas usuários do grupo de Compras
      const comprasProfiles = profilesList.filter(p => 
        p.departments?.some(d => d.name?.toLowerCase() === 'compras')
      );
      
      // Garantir que o responsável atual esteja na lista para não quebrar a seleção
      if (process.responsible_id && !comprasProfiles.some(p => p.id === process.responsible_id)) {
        const currentResp = profilesList.find(p => p.id === process.responsible_id);
        if (currentResp) comprasProfiles.push(currentResp);
      }

      let formattedAmount = '';
      if (process.purchase_amount !== null && process.purchase_amount !== undefined) {
        formattedAmount = 'R$ ' + parseFloat(process.purchase_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      // 2. Injetar layout completo
      inner.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:24px; flex-wrap:wrap; gap:16px;">
          <div>
            <h2 style="margin:0 0 4px 0; font-size:1.6rem; font-weight:800; color:var(--text-primary);">${escapeHtml(ticket.title || '')}</h2>
            <p style="margin:0; font-size:0.92rem; color:var(--text-muted);">Chamado nº ${ticket.ticket_number || ''}</p>
          </div>
          <div style="display:flex; align-items:center; gap:16px;">
            <button class="btn" id="modalReceiptBtn" style="padding:10px 20px; font-weight:600; background:#0f766e; color:white; border-radius:8px; font-size:0.88rem; transition:background 0.2s; cursor:pointer;">Recebimento</button>
            <button id="closeModalBtn" style="background:transparent; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-muted); line-height:1; padding:4px;">✕</button>
          </div>
        </div>

        <div style="display:grid; grid-template-columns: 1.3fr 1fr; gap: 32px;" class="modal-two-columns">
          
          <!-- COLUNA ESQUERDA (FORMULÁRIO) -->
          <div style="display:flex; flex-direction:column; gap:20px;">
            
            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div>
                <label style="display:block; font-size:0.85rem; font-weight:700; color:var(--text-secondary); margin-bottom:6px;">Status</label>
                <select id="modalStatusSelect" class="input" style="font-size:0.95rem; padding:10px 12px; background:var(--bg-app);">
                  ${Object.entries(STATUS_LABELS)
                    .filter(([key]) => key !== 'finalized' && key !== 'cancelled' && key !== 'reopened')
                    .map(([key, label]) => `
                    <option value="${key}" ${process.status === key ? 'selected' : ''}>${label.replace('<br>', ' ')}</option>
                  `).join('')}
                </select>
              </div>
              <div>
                <label style="display:block; font-size:0.85rem; font-weight:700; color:var(--text-secondary); margin-bottom:6px;">Responsável</label>
                <select id="modalResponsibleSelect" class="input" style="font-size:0.95rem; padding:10px 12px; background:var(--bg-app);">
                  <option value="">Selecione um responsável...</option>
                  ${comprasProfiles.map(p => `
                    <option value="${p.id}" ${process.responsible_id === p.id ? 'selected' : ''}>${escapeHtml(p.full_name || p.email)}</option>
                  `).join('')}
                </select>
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div>
                <label style="display:block; font-size:0.85rem; font-weight:700; color:var(--text-secondary); margin-bottom:6px;">Número do pedido</label>
                <input type="text" id="modalOrderNumberInput" class="input" value="${escapeHtml(process.order_number || '')}" placeholder="Ex.: 12345" style="background:var(--bg-app);" />
              </div>
              <div>
                <label style="display:block; font-size:0.85rem; font-weight:700; color:var(--text-secondary); margin-bottom:6px;">Fornecedor</label>
                <input type="text" id="modalSupplierInput" class="input" value="${escapeHtml(process.supplier || '')}" placeholder="Nome do fornecedor" style="background:var(--bg-app);" />
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div>
                <label style="display:block; font-size:0.85rem; font-weight:700; color:var(--text-secondary); margin-bottom:6px;">Valor da compra</label>
                <input type="text" id="modalPurchaseAmountInput" class="input" value="${escapeHtml(formattedAmount)}" placeholder="R$ 0,00" style="background:var(--bg-app);" />
              </div>
              <div>
                <label style="display:block; font-size:0.85rem; font-weight:700; color:var(--text-secondary); margin-bottom:6px;">Previsão de entrega</label>
                <input type="date" id="modalDeliveryForecastInput" class="input" value="${process.delivery_forecast || ''}" style="background:var(--bg-app);" />
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap: 16px;">
              <div>
                <label style="display:block; font-size:0.85rem; font-weight:700; color:var(--text-secondary); margin-bottom:6px;">Motivo do bloqueio</label>
                <select id="modalBlockReasonSelect" class="input" style="font-size:0.95rem; padding:10px 12px; background:var(--bg-app);">
                  <option value="none" ${process.block_reason === 'none' ? 'selected' : ''}>Sem bloqueio</option>
                  <option value="waiting_approval" ${process.block_reason === 'waiting_approval' ? 'selected' : ''}>Aguardando aprovação</option>
                  <option value="supplier_delay" ${process.block_reason === 'supplier_delay' ? 'selected' : ''}>Atraso do fornecedor</option>
                  <option value="budget_limit" ${process.block_reason === 'budget_limit' ? 'selected' : ''}>Estourou orçamento</option>
                  <option value="other" ${process.block_reason === 'other' ? 'selected' : ''}>Outro motivo</option>
                </select>
              </div>
              <div>
                <label style="display:block; font-size:0.85rem; font-weight:700; color:var(--text-secondary); margin-bottom:6px;">Recebimento</label>
                <div style="font-size:0.95rem; padding:10px 12px; background:var(--bg-app); border:1px solid var(--border); border-radius:8px; font-weight:600; color:${
                  process.receipt_status === 'partial' ? '#b45309' : process.receipt_status === 'total' ? '#15803d' : 'var(--text-secondary)'
                };">
                  ${
                    process.receipt_status === 'partial' ? 'Recebido Parcial' : process.receipt_status === 'total' ? 'Recebido Total' : 'Não Recebido'
                  }
                </div>
              </div>
            </div>

            <div>
              <label style="display:block; font-size:0.85rem; font-weight:700; color:var(--text-secondary); margin-bottom:6px;">Nova observação</label>
              <textarea id="modalNewObservationInput" class="input" rows="3" placeholder="A atualização será registrada no histórico com data e hora." style="background:var(--bg-app); resize:none; font-family:inherit;"></textarea>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:8px;">
              <button class="btn btn-secondary" id="modalCancelBtn" style="padding:10px 20px;">Cancelar</button>
              <button class="btn btn-primary" id="modalSaveBtn" style="padding:10px 24px; font-weight:600;">Salvar atualização</button>
            </div>

          </div>

          <!-- COLUNA DIREITA (RESUMO E HISTÓRICO) -->
          <div style="display:flex; flex-direction:column; gap:20px;">
            
            <!-- RESUMO CARD -->
            <div style="background:var(--bg-app); padding:20px; border-radius:12px; border:1px solid var(--border);">
              <h4 style="margin:0 0 14px 0; font-size:1rem; font-weight:700; color:var(--text-primary);">Resumo</h4>
              <div style="display:flex; flex-direction:column; gap:10px; font-size:0.88rem;">
                <div><strong style="color:var(--text-secondary);">Área:</strong> <span style="color:var(--text-primary); font-weight:600;">${escapeHtml(ticket.destination?.name || 'Compras')}</span></div>
                <div><strong style="color:var(--text-secondary);">Tipo:</strong> <span style="color:var(--text-primary); font-weight:600;">${escapeHtml(ticket.origin?.name || '—')}</span></div>
                <div><strong style="color:var(--text-secondary);">Prioridade:</strong> <span style="color:var(--text-primary); font-weight:600;">${ticket.priority === 'high' ? 'Alta' : ticket.priority === 'medium' ? 'Média' : 'Baixa'}</span></div>
                <div><strong style="color:var(--text-secondary);">Prazo:</strong> <span style="color:var(--text-primary); font-weight:600;">${ticket.deadline ? new Date(ticket.deadline).toLocaleDateString('pt-BR') : 'Sem prazo definido'}</span></div>
                <div style="margin-top:6px; border-top:1px dashed var(--border); padding-top:10px;">
                  <strong style="color:var(--text-secondary); display:block; margin-bottom:4px;">Descrição:</strong>
                  <span style="color:var(--text-primary); white-space:pre-wrap; line-height:1.4;">${escapeHtml(ticket.description || '')}</span>
                </div>
              </div>
            </div>

            <!-- HISTÓRICO CARD -->
            <div style="background:var(--bg-app); padding:20px; border-radius:12px; border:1px solid var(--border); max-height:320px; overflow-y:auto;">
              <h4 style="margin:0 0 14px 0; font-size:1rem; font-weight:700; color:var(--text-primary);">Histórico</h4>
              <div style="display:flex; flex-direction:column; gap:14px; position:relative; padding-left:14px; border-left:2px solid var(--border);">
                ${historyList.map(h => {
                  const authorName = h.author?.full_name || 'Sistema';
                  return `
                    <div style="font-size:0.82rem; line-height:1.4; position:relative;">
                      <span style="position:absolute; left:-19px; top:4px; width:8px; height:8px; background:var(--primary); border-radius:50%;"></span>
                      <div style="color:var(--text-muted); font-size:0.75rem; margin-bottom:2px;">${new Date(h.created_at).toLocaleString('pt-BR')}</div>
                      <strong style="color:var(--text-secondary);">${escapeHtml(authorName)}</strong>
                      <div style="color:var(--text-primary); margin-top:2px;">${escapeHtml(h.description)}</div>
                    </div>
                  `;
                }).join('') || '<p style="color:var(--text-muted); font-size:0.82rem; margin:0;">Nenhuma atividade registrada.</p>'}
              </div>
            </div>

          </div>

        </div>
      `;

      // Vincular eventos do modal dinâmico
      // Vincular eventos do modal dinâmico
      document.getElementById('closeModalBtn')?.addEventListener('click', () => modal.classList.remove('open'));
      document.getElementById('modalCancelBtn')?.addEventListener('click', () => modal.classList.remove('open'));

      let previousModalStatus = document.getElementById('modalStatusSelect')?.value || '';
      document.getElementById('modalStatusSelect')?.addEventListener('change', async (e) => {
        if (e.target.value === 'in_approval') {
          const confirmed = await confirmInApprovalChange();
          if (!confirmed) {
            e.target.value = previousModalStatus;
          } else {
            previousModalStatus = 'in_approval';
          }
        } else {
          previousModalStatus = e.target.value;
        }
      });

      const amountInput = document.getElementById('modalPurchaseAmountInput');
      if (amountInput) {
        amountInput.addEventListener('input', (e) => {
          let value = e.target.value.replace(/\D/g, '');
          if (value === '') {
            e.target.value = '';
            return;
          }
          const options = { minimumFractionDigits: 2, maximumFractionDigits: 2 };
          const result = (parseFloat(value) / 100).toLocaleString('pt-BR', options);
          e.target.value = 'R$ ' + result;
        });
      }

      document.getElementById('modalReceiptBtn')?.addEventListener('click', () => {
        // Criar diálogo de opções: Recebido Parcial ou Total
        const dialog = document.createElement('div');
        dialog.id = 'receiptChoiceDialog';
        dialog.style = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:1200; display:flex; align-items:center; justify-content:center;`;
        dialog.innerHTML = `
          <div style="background:var(--bg-card); padding:28px; border-radius:16px; box-shadow:var(--shadow-lg); width:90%; max-width:450px; display:flex; flex-direction:column; gap:20px; animation:slideUp 0.2s ease-out;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:var(--text-primary);">Registrar Recebimento</h3>
              <button id="choiceCloseBtn" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:1.25rem;">&times;</button>
            </div>
            <p style="margin:0; font-size:0.92rem; color:var(--text-secondary); line-height:1.5;">Como deseja registrar o recebimento deste processo de compra?</p>
            <div style="display:flex; flex-direction:column; gap:10px; margin-top:8px;">
              <button id="choicePartialBtn" class="btn" style="background:#d97706; color:white; font-weight:600; padding:12px; border-radius:8px; cursor:pointer;">Recebido Parcial</button>
              <button id="choiceTotalBtn" class="btn" style="background:#16a34a; color:white; font-weight:600; padding:12px; border-radius:8px; cursor:pointer;">Recebido Total</button>
              <button id="choiceCancelBtn" class="btn btn-secondary" style="padding:12px; border-radius:8px; cursor:pointer;">Cancelar</button>
            </div>
          </div>
        `;
        document.body.appendChild(dialog);

        const closeDialog = () => {
          dialog.remove();
        };

        dialog.querySelector('#choiceCloseBtn')?.addEventListener('click', closeDialog);
        dialog.querySelector('#choiceCancelBtn')?.addEventListener('click', closeDialog);

        // Recebido Parcial
        dialog.querySelector('#choicePartialBtn')?.addEventListener('click', () => {
          closeDialog();
          
          // Abrir diálogo de comentário/mensagem
          const partialCommentDialog = document.createElement('div');
          partialCommentDialog.id = 'partialCommentDialog';
          partialCommentDialog.style = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:1300; display:flex; align-items:center; justify-content:center;`;
          partialCommentDialog.innerHTML = `
            <div style="background:var(--bg-card); padding:28px; border-radius:16px; box-shadow:var(--shadow-lg); width:90%; max-width:450px; display:flex; flex-direction:column; gap:20px; animation:slideUp 0.2s ease-out;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:var(--text-primary);">Detalhes do Recebimento Parcial</h3>
                <button id="commentCloseBtn" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:1.25rem;">&times;</button>
              </div>
              <p style="margin:0; font-size:0.92rem; color:var(--text-secondary); line-height:1.5;">Descreva o que foi recebido parcialmente ou adicione outras informações do recebimento:</p>
              <textarea id="partialCommentText" class="input" rows="4" placeholder="Escreva o detalhamento aqui..." style="background:var(--bg-app); resize:none; font-family:inherit; font-size:0.92rem; padding:10px 12px;"></textarea>
              <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:8px;">
                <button id="partialConfirmBtn" class="btn" style="background:#d97706; color:white; font-weight:600; padding:10px 20px; border-radius:8px; cursor:pointer;">Confirmar</button>
                <button id="partialCancelBtn" class="btn btn-secondary" style="padding:10px 20px; border-radius:8px; cursor:pointer;">Cancelar</button>
              </div>
            </div>
          `;
          document.body.appendChild(partialCommentDialog);

          const closeCommentDialog = () => {
            partialCommentDialog.remove();
          };

          partialCommentDialog.querySelector('#commentCloseBtn')?.addEventListener('click', closeCommentDialog);
          partialCommentDialog.querySelector('#partialCancelBtn')?.addEventListener('click', closeCommentDialog);

          partialCommentDialog.querySelector('#partialConfirmBtn')?.addEventListener('click', async () => {
            const comment = partialCommentDialog.querySelector('#partialCommentText').value.trim();
            closeCommentDialog();

            try {
              // Mudar o status do processo de compra e do chamado para "Recebido Parcial" (received_partial)
              // e mudar o status de recebimento para "Parcial" (partial)
              await updatePurchaseProcess(process.id, {
                status: 'received_partial',
                receipt_status: 'partial'
              });

              // Registrar mensagem no chat do chamado
              const formattedMessage = comment 
                ? `📦 **Recebido Parcial**\n${comment}` 
                : `📦 **Recebido Parcial**`;

              await sendTicketMessage(process.ticket_id, formattedMessage);
              
              showToast('Recebimento Parcial registrado com sucesso!', 'success');
              modal.classList.remove('open');
              await loadData();
            } catch (err) {
              console.error(err);
              showToast('Erro ao registrar recebimento parcial. Certifique-se de aplicar a migração 034 no banco.', 'error');
            }
          });
        });

        // Recebido Total
        dialog.querySelector('#choiceTotalBtn')?.addEventListener('click', () => {
          closeDialog();
          // Abrir segundo diálogo perguntando se deseja finalizar o chamado
          const yesNoDialog = document.createElement('div');
          yesNoDialog.id = 'yesNoDialog';
          yesNoDialog.style = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:1300; display:flex; align-items:center; justify-content:center;`;
          yesNoDialog.innerHTML = `
            <div style="background:var(--bg-card); padding:28px; border-radius:16px; box-shadow:var(--shadow-lg); width:90%; max-width:400px; display:flex; flex-direction:column; gap:20px; animation:slideUp 0.2s ease-out;">
              <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:var(--text-primary);">Finalizar Chamado?</h3>
              <p style="margin:0; font-size:0.92rem; color:var(--text-secondary); line-height:1.5;">Já que foi recebido total, deseja finalizar o chamado mudando seu status para Resolvido?</p>
              <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:8px;">
                <button id="yesBtn" class="btn" style="background:#16a34a; color:white; font-weight:600; padding:10px 20px; border-radius:8px; cursor:pointer;">Sim</button>
                <button id="noBtn" class="btn btn-secondary" style="padding:10px 20px; border-radius:8px; cursor:pointer;">Não</button>
              </div>
            </div>
          `;
          document.body.appendChild(yesNoDialog);

          const closeYesNo = () => {
            yesNoDialog.remove();
          };

          // Se clicar em Sim
          yesNoDialog.querySelector('#yesBtn')?.addEventListener('click', async () => {
            closeYesNo();
            try {
              // Mudar status do chamado para Resolvido (resolved) e recebimento do processo para Total (total)
              // Também finaliza o processo de compra (finalized)
              await updatePurchaseProcess(process.id, {
                status: 'finalized',
                receipt_status: 'total'
              });
              await updateTicketStatus(process.ticket_id, 'resolved');

              // Registrar observação no histórico
              await sendTicketMessage(process.ticket_id, '✅ **Recebimento Total registrado**\nO chamado foi finalizado e marcado como Resolvido.');
              
              showToast('Recebimento Total registrado e chamado Resolvido!', 'success');
              modal.classList.remove('open');
              await loadData();
            } catch (err) {
              console.error(err);
              showToast('Erro ao finalizar chamado e processo de compra.', 'error');
            }
          });

          // Se clicar em Não
          yesNoDialog.querySelector('#noBtn')?.addEventListener('click', async () => {
            closeYesNo();
            try {
              // Mudar apenas o drop down recebimento para Total (total)
              await updatePurchaseProcess(process.id, {
                receipt_status: 'total'
              });

              // Registrar observação no histórico
              await sendTicketMessage(process.ticket_id, '📦 **Recebimento Total registrado**\nStatus de recebimento atualizado para Total.');
              
              showToast('Recebimento Total registrado!', 'success');
              modal.classList.remove('open');
              await loadData();
            } catch (err) {
              console.error(err);
              showToast('Erro ao atualizar recebimento.', 'error');
            }
          });
        });
      });

      document.getElementById('modalSaveBtn')?.addEventListener('click', async () => {
        const saveBtn = document.getElementById('modalSaveBtn');
        try {
          if (saveBtn) {
            saveBtn.disabled = true;
            saveBtn.textContent = 'Salvando...';
          }

          const newStatus = document.getElementById('modalStatusSelect').value;
          const newResponsibleId = document.getElementById('modalResponsibleSelect').value || null;
          const newOrderNumber = document.getElementById('modalOrderNumberInput').value.trim() || null;
          const newSupplier = document.getElementById('modalSupplierInput').value.trim() || null;
          
          const amountRaw = document.getElementById('modalPurchaseAmountInput').value;
          const amountClean = amountRaw.replace(/\D/g, '');
          const newPurchaseAmount = amountClean ? parseFloat(amountClean) / 100 : null;
          
          const forecastVal = document.getElementById('modalDeliveryForecastInput').value;
          const newDeliveryForecast = forecastVal || null;

          const newBlockReason = document.getElementById('modalBlockReasonSelect').value;
          const newReceiptStatus = process.receipt_status;

          const updateData = {
            status: newStatus,
            responsible_id: newResponsibleId,
            order_number: newOrderNumber,
            supplier: newSupplier,
            purchase_amount: newPurchaseAmount,
            delivery_forecast: newDeliveryForecast,
            block_reason: newBlockReason,
            receipt_status: newReceiptStatus
          };

          // Atualizar processo de compra no Supabase
          await updatePurchaseProcess(process.id, updateData);

          // Tratar nova observação (gravar no chat do chamado)
          const newObs = document.getElementById('modalNewObservationInput').value.trim();
          if (newObs) {
            const formattedMsg = `📝 **Nova Observação de Compra**\n${newObs}`;
            await sendTicketMessage(process.ticket_id, formattedMsg);
          }

          showToast('Processo de compra atualizado com sucesso!', 'success');
          modal.classList.remove('open');
          await loadData();
        } catch (err) {
          console.error(err);
          showToast('Erro ao atualizar processo de compra', 'error');
        } finally {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = 'Salvar atualização';
          }
        }
      });

    } catch (err) {
      console.error(err);
      showToast('Erro ao carregar detalhes do chamado', 'error');
      modal.classList.remove('open');
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
