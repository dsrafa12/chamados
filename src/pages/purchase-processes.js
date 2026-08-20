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
  updateTicketStatus,
  uploadTicketAttachment,
  fetchTicketAttachments,
  createNotification,
  removeComprasCollaborators,
  fetchComprasReportData,
  toggleIgnoreInComprasReport,
  createPurchaseProcess
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
  let reportTickets = [];
  let reportStartDate = '';
  let reportEndDate = '';
  let reportRawMaterialFilter = 'all'; // 'all', 'raw_only', 'non_raw_only'
  let reportCurrentPage = 1;
  const reportPageSize = 10;
  
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
      const [procData, profData, repTickets] = await Promise.all([
        fetchPurchaseProcesses(),
        fetchAllProfiles(),
        fetchComprasReportData()
      ]);
      processes = procData;
      allProfiles = profData;
      reportTickets = repTickets;
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
    } else if (currentView === 'list') {
      renderList();
    } else if (currentView === 'report') {
      renderReport();
    }

    // Ocultar a barra de busca/filtros na visualização de relatório
    const filtersCard = document.getElementById('filtersCardContainer');
    if (filtersCard) {
      filtersCard.style.display = currentView === 'report' ? 'none' : 'flex';
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
          <div>
            <button id="viewReportBtn" class="btn" style="padding:10px 20px; font-weight:600; cursor:pointer; background:${currentView === 'report' ? 'var(--primary)' : 'var(--bg-card)'}; color:${currentView === 'report' ? 'white' : 'var(--text-primary)'}; border:1px solid var(--border); border-radius:10px; box-shadow:var(--shadow-sm); display:flex; align-items:center; gap:8px; transition:all 0.2s;">
              📊 Relatório de Compras
            </button>
          </div>
        </div>

        <!-- FILTROS -->
        <div id="filtersCardContainer" class="card" style="padding:16px; margin-bottom:24px; display:${currentView === 'report' ? 'none' : 'flex'}; gap:16px; align-items:center; flex-wrap:wrap;">
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

        // Badges de Alerta (Bloqueado/Recebido/Matéria-Prima)
        let warningHtml = '';
        if (p.is_raw_material) {
          warningHtml += `<span style="background:#fffbeb; color:#d97706; font-size:0.7rem; padding:2px 6px; border-radius:4px; font-weight:700; border:1px solid #fef3c7;">📦 MP</span>`;
        }
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

  function renderReport() {
    const viewContainer = document.getElementById('viewContainer');
    if (!viewContainer) return;

    // Filtrar chamados pela faixa de data de abertura, tipo de matéria-prima e desconsiderar os marcados como ignorados
    const filteredReportTickets = reportTickets.filter(t => {
      if (t.ignore_in_compras_report) return false;

      const p = Array.isArray(t.purchase_process) ? t.purchase_process[0] : t.purchase_process;
      const isRaw = !!(p && p.is_raw_material);

      if (reportRawMaterialFilter === 'raw_only' && !isRaw) return false;
      if (reportRawMaterialFilter === 'non_raw_only' && isRaw) return false;

      if (!t.created_at) return true;
      const createdDate = new Date(t.created_at);

      if (reportStartDate) {
        const start = new Date(reportStartDate + 'T00:00:00');
        if (createdDate < start) return false;
      }

      if (reportEndDate) {
        const end = new Date(reportEndDate + 'T23:59:59');
        if (createdDate > end) return false;
      }

      return true;
    });

    // 1. Totalizadores de chamados e processos
    const totalDirectedToCompras = filteredReportTickets.length;
    const totalWithPurchaseProcess = filteredReportTickets.filter(t => t.purchase_process || t.purchase_process?.id).length;
    const totalWithoutPurchaseProcess = totalDirectedToCompras - totalWithPurchaseProcess;
    
    // Taxa de conversão em processo de compra
    const conversionRate = totalDirectedToCompras > 0 ? Math.round((totalWithPurchaseProcess / totalDirectedToCompras) * 100) : 0;

    // Total acumulado em R$ de compras e métricas de Matéria-Prima
    let totalPurchaseAmount = 0;
    let rawMaterialCount = 0;
    let rawMaterialAmount = 0;

    filteredReportTickets.forEach(t => {
      const p = Array.isArray(t.purchase_process) ? t.purchase_process[0] : t.purchase_process;
      if (p) {
        if (p.is_raw_material) {
          rawMaterialCount++;
          if (p.purchase_amount) {
            rawMaterialAmount += parseFloat(p.purchase_amount) || 0;
          }
        }
        if (p.purchase_amount) {
          totalPurchaseAmount += parseFloat(p.purchase_amount) || 0;
        }
      }
    });

    // 2. Cálculo do tempo médio (Abertura vs Prazo de Conclusão) - ignora chamados sem prazo definido
    let totalDiffMs = 0;
    let validDeadlineCount = 0;

    // Cálculo do tempo médio para GERAR o processo de compra (Abertura do Chamado x Criação do Processo)
    let totalCreationDiffMs = 0;
    let validCreationCount = 0;

    // Acumuladores de tempo até Pedido Emitido / Aguardando Recebimento
    let totalAwaitingReceiptDiffMs = 0;
    let validAwaitingReceiptCount = 0;

    // Acumuladores de tempo até Recebimento Total
    let totalFinalizedDiffMs = 0;
    let validFinalizedCount = 0;

    // Cálculo de Pontualidade (No prazo x Atrasado) - Comparação: Previsão de Entrega vs Recebimento Total (finalized_at)
    let onTimeCount = 0;
    let delayedCount = 0;

    filteredReportTickets.forEach(t => {
      if (t.created_at && t.deadline) {
        const createdMs = new Date(t.created_at).getTime();
        const deadlineMs = new Date(t.deadline).getTime();
        if (deadlineMs > createdMs) {
          totalDiffMs += (deadlineMs - createdMs);
          validDeadlineCount++;
        }
      }

      const p = Array.isArray(t.purchase_process) ? t.purchase_process[0] : t.purchase_process;
      if (p && p.created_at) {
        const processCreatedMs = new Date(p.created_at).getTime();

        if (t.created_at) {
          const ticketCreatedMs = new Date(t.created_at).getTime();
          if (processCreatedMs >= ticketCreatedMs) {
            totalCreationDiffMs += (processCreatedMs - ticketCreatedMs);
            validCreationCount++;
          }
        }

        if (p.awaiting_receipt_at) {
          const awaitingReceiptMs = new Date(p.awaiting_receipt_at).getTime();
          if (awaitingReceiptMs >= processCreatedMs) {
            totalAwaitingReceiptDiffMs += (awaitingReceiptMs - processCreatedMs);
            validAwaitingReceiptCount++;
          }
        }

        if (p.finalized_at) {
          const finalizedMs = new Date(p.finalized_at).getTime();
          if (finalizedMs >= processCreatedMs) {
            totalFinalizedDiffMs += (finalizedMs - processCreatedMs);
            validFinalizedCount++;
          }

          // Checagem de Pontualidade (Previsão de Entrega x Data de Recebimento Total)
          if (p.delivery_forecast) {
            const forecastMs = new Date(p.delivery_forecast + 'T23:59:59').getTime();
            if (finalizedMs <= forecastMs) {
              onTimeCount++;
            } else {
              delayedCount++;
            }
          }
        }
      }
    });

    let avgTimeText = 'Sem prazos';
    if (validDeadlineCount > 0) {
      const avgMs = totalDiffMs / validDeadlineCount;
      const avgHours = Math.floor(avgMs / (1000 * 60 * 60));
      const avgDays = Math.floor(avgHours / 24);
      const remainingHours = avgHours % 24;

      if (avgDays > 0) {
        avgTimeText = `${avgDays}d ${remainingHours}h`;
      } else {
        avgTimeText = `${avgHours}h`;
      }
    }

    let avgCreationTimeText = '—';
    if (validCreationCount > 0) {
      const avgMs = totalCreationDiffMs / validCreationCount;
      const avgHours = Math.floor(avgMs / (1000 * 60 * 60));
      const avgDays = Math.floor(avgHours / 24);
      const remainingHours = avgHours % 24;

      if (avgDays > 0) {
        avgCreationTimeText = `${avgDays}d ${remainingHours}h`;
      } else if (avgHours > 0) {
        avgCreationTimeText = `${avgHours}h`;
      } else {
        const avgMins = Math.round(avgMs / (1000 * 60));
        avgCreationTimeText = `${avgMins} min`;
      }
    }

    let avgAwaitingReceiptTimeText = '—';
    if (validAwaitingReceiptCount > 0) {
      const avgMs = totalAwaitingReceiptDiffMs / validAwaitingReceiptCount;
      const avgHours = Math.floor(avgMs / (1000 * 60 * 60));
      const avgDays = Math.floor(avgHours / 24);
      const remainingHours = avgHours % 24;

      if (avgDays > 0) {
        avgAwaitingReceiptTimeText = `${avgDays}d ${remainingHours}h`;
      } else if (avgHours > 0) {
        avgAwaitingReceiptTimeText = `${avgHours}h`;
      } else {
        const avgMins = Math.round(avgMs / (1000 * 60));
        avgAwaitingReceiptTimeText = `${avgMins} min`;
      }
    }

    let avgFinalizedTimeText = '—';
    if (validFinalizedCount > 0) {
      const avgMs = totalFinalizedDiffMs / validFinalizedCount;
      const avgHours = Math.floor(avgMs / (1000 * 60 * 60));
      const avgDays = Math.floor(avgHours / 24);
      const remainingHours = avgHours % 24;

      if (avgDays > 0) {
        avgFinalizedTimeText = `${avgDays}d ${remainingHours}h`;
      } else if (avgHours > 0) {
        avgFinalizedTimeText = `${avgHours}h`;
      } else {
        const avgMins = Math.round(avgMs / (1000 * 60));
        avgFinalizedTimeText = `${avgMins} min`;
      }
    }

    // Calcular paginação de 10 em 10
    const totalPages = Math.ceil(filteredReportTickets.length / reportPageSize) || 1;
    if (reportCurrentPage > totalPages) reportCurrentPage = totalPages;
    if (reportCurrentPage < 1) reportCurrentPage = 1;

    const startIndex = (reportCurrentPage - 1) * reportPageSize;
    const paginatedTickets = filteredReportTickets.slice(startIndex, startIndex + reportPageSize);

    // 3. Montagem das linhas da tabela analítica do relatório (Paginada de 10 em 10)
    const tableRowsHtml = paginatedTickets.map(t => {
      const p = Array.isArray(t.purchase_process) ? t.purchase_process[0] : t.purchase_process;
      
      const createdFormatted = t.created_at ? new Date(t.created_at).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : '—';
      const deadlineFormatted = t.deadline ? new Date(t.deadline).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }) : 'Sem prazo';
      
      let amountFormatted = '—';
      if (p && p.purchase_amount !== null && p.purchase_amount !== undefined) {
        amountFormatted = 'R$ ' + parseFloat(p.purchase_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      }

      let forecastFormatted = '—';
      if (p && p.delivery_forecast) {
        const [y, m, d] = p.delivery_forecast.split('-');
        forecastFormatted = `${d}/${m}/${y}`;
      }

      const statusText = STATUS_LABELS[p?.status] || p?.status || 'Ativo';
      const rawMaterialBadge = p?.is_raw_material ? `<span style="display:inline-block; font-size:0.75rem; background:#fef3c7; color:#d97706; border:1px solid #fde68a; padding:2px 8px; border-radius:10px; font-weight:700; margin-top:4px; white-space:nowrap;">📦 Matéria-Prima</span>` : '';
      const processBadge = p ? `
        <span style="background:#e0f2fe; color:#0369a1; padding:4px 10px; border-radius:12px; font-size:0.78rem; font-weight:600; white-space:nowrap; display:inline-block;">
          Sim (${statusText})
        </span>
        ${rawMaterialBadge ? `<div style="margin-top:2px;">${rawMaterialBadge}</div>` : ''}
      ` : `
        <span style="background:#f1f5f9; color:#64748b; padding:4px 10px; border-radius:12px; font-size:0.78rem; font-weight:600; white-space:nowrap; display:inline-block;">
          Não gerado
        </span>
      `;

      return `
        <tr style="border-bottom:1px solid var(--border); transition:background 0.2s;" data-id="${p ? p.id : ''}" data-ticket-id="${t.id}">
          <td style="padding:14px 16px;">
            <strong style="color:var(--primary); font-size:0.88rem;">Nº ${t.ticket_number || ''}</strong>
            <div style="font-size:0.82rem; font-weight:600; color:var(--text-primary); max-width:220px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; margin-top:2px;">
              ${escapeHtml(t.title || '')}
            </div>
            <div style="font-size:0.76rem; color:var(--text-muted); margin-top:2px;">
              👤 ${escapeHtml(t.creator?.full_name || '—')}
            </div>
          </td>
          <td style="padding:14px 16px; font-size:0.85rem; color:var(--text-primary);">
            ${createdFormatted}
          </td>
          <td style="padding:14px 16px; font-size:0.85rem; color:var(--text-primary);">
            ${deadlineFormatted}
          </td>
          <td style="padding:14px 16px; font-size:0.85rem; text-align:center;">
            ${processBadge}
          </td>
          <td style="padding:14px 16px; font-size:0.88rem; font-weight:600; color:#059669; text-align:right;">
            ${amountFormatted}
          </td>
          <td style="padding:14px 16px; font-size:0.85rem; text-align:center; color:var(--text-primary);">
            ${forecastFormatted}
          </td>
          <td style="padding:14px 16px; font-size:0.85rem; text-align:center; position:relative;">
            <button class="btn btn-sm action-dropdown-btn" data-ticket-id="${t.id}" data-ticket-number="${t.ticket_number || ''}" data-ticket-title="${escapeHtml(t.title || '')}" data-process-id="${p ? p.id : ''}" data-is-raw="${p?.is_raw_material ? 'true' : 'false'}" style="padding:6px 12px; font-size:0.82rem; font-weight:600; background:var(--bg-app); border:1px solid var(--border); border-radius:6px; cursor:pointer; color:var(--text-secondary);">
              Ações ⚙️ ▾
            </button>
          </td>
        </tr>
      `;
    }).join('');

    viewContainer.innerHTML = `
      <div style="display:flex; flex-direction:column; gap:24px;">
        
        <!-- BARRA DE FILTRO POR DATA DE ABERTURA E MATÉRIA-PRIMA -->
        <div class="card" style="padding:16px 24px; display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:16px; background:var(--bg-card);">
          <div style="display:flex; align-items:center; gap:20px; flex-wrap:wrap;">
            <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
              <span style="font-weight:700; font-size:0.9rem; color:var(--text-primary); display:flex; align-items:center; gap:6px;">
                📅 Data de Abertura:
              </span>
              <div style="display:flex; align-items:center; gap:8px;">
                <label style="font-size:0.82rem; color:var(--text-secondary); font-weight:600;">Início:</label>
                <input type="date" id="reportStartDateInput" class="input" value="${reportStartDate}" style="padding:6px 12px; font-size:0.85rem; width:145px;" />
              </div>
              <div style="display:flex; align-items:center; gap:8px;">
                <label style="font-size:0.82rem; color:var(--text-secondary); font-weight:600;">Fim:</label>
                <input type="date" id="reportEndDateInput" class="input" value="${reportEndDate}" style="padding:6px 12px; font-size:0.85rem; width:145px;" />
              </div>
            </div>

            <div style="display:flex; align-items:center; gap:8px;">
              <span style="font-weight:700; font-size:0.9rem; color:var(--text-primary);">
                Tipo:
              </span>
              <select id="reportRawMaterialSelect" class="select" style="padding:6px 32px 6px 12px; font-size:0.85rem; font-weight:600; min-width:180px;">
                <option value="all" ${reportRawMaterialFilter === 'all' ? 'selected' : ''}>Todos os Processos</option>
                <option value="raw_only" ${reportRawMaterialFilter === 'raw_only' ? 'selected' : ''}>Apenas Matéria-Prima</option>
                <option value="non_raw_only" ${reportRawMaterialFilter === 'non_raw_only' ? 'selected' : ''}>Outras Compras (Exceto MP)</option>
              </select>
            </div>

            ${(reportStartDate || reportEndDate || reportRawMaterialFilter !== 'all') ? `
              <button id="clearDateFilterBtn" class="btn btn-sm" style="background:#fee2e2; color:#991b1b; border:none; padding:6px 12px; font-weight:600; cursor:pointer; border-radius:6px;">
                ✖ Limpar Filtros
              </button>
            ` : ''}
          </div>
          <span style="font-size:0.82rem; font-weight:600; color:var(--text-muted);">
            Exibindo ${filteredReportTickets.length} de ${reportTickets.length} chamados
          </span>
        </div>

        <!-- CARDS DE METRICAS PRINCIPAIS -->
        <div style="display:grid; grid-template-columns:repeat(auto-fit, minmax(180px, 1fr)); gap:16px;">
          
          <div class="card has-tooltip-card" style="padding:16px; display:flex; flex-direction:column; gap:6px; border-left:4px solid #3b82f6;">
            <div class="tooltip-card">Quantidade total de chamados direcionados ao setor de compras no período selecionado.</div>
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Chamados em Compras</span>
            <div style="font-size:1.5rem; font-weight:800; color:var(--text-primary);">${totalDirectedToCompras}</div>
            <span style="font-size:0.72rem; color:var(--text-secondary);">Direcionados ao setor</span>
          </div>

          <div class="card has-tooltip-card" style="padding:16px; display:flex; flex-direction:column; gap:6px; border-left:4px solid #0f766e;">
            <div class="tooltip-card">Total de chamados com processo de compra criado e a taxa de conversão correspondente.</div>
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Processos Criados</span>
            <div style="font-size:1.5rem; font-weight:800; color:#0f766e;">${totalWithPurchaseProcess} <span style="font-size:0.8rem; font-weight:600; color:var(--text-muted);">(${conversionRate}%)</span></div>
            <span style="font-size:0.72rem; color:var(--text-secondary);">${totalWithoutPurchaseProcess} pendentes</span>
          </div>

          <div class="card has-tooltip-card" style="padding:16px; display:flex; flex-direction:column; gap:6px; border-left:4px solid #10b981;">
            <div class="tooltip-card">Soma total dos valores financeiros lançados em todos os processos de compra.</div>
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Total Investido</span>
            <div style="font-size:1.35rem; font-weight:800; color:#10b981;">R$ ${totalPurchaseAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span style="font-size:0.72rem; color:var(--text-secondary);">Soma dos valores</span>
          </div>

          <div class="card has-tooltip-card" style="padding:16px; display:flex; flex-direction:column; gap:6px; border-left:4px solid #d97706;">
            <div class="tooltip-card">Quantidade de chamados com processos de compra marcados como Matéria-Prima.</div>
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Matéria-Prima</span>
            <div style="font-size:1.5rem; font-weight:800; color:#d97706;">${rawMaterialCount} <span style="font-size:0.8rem; font-weight:600; color:var(--text-muted);">chamados</span></div>
            <span style="font-size:0.72rem; color:var(--text-secondary);">Processos marcados</span>
          </div>

          <div class="card has-tooltip-card" style="padding:16px; display:flex; flex-direction:column; gap:6px; border-left:4px solid #059669;">
            <div class="tooltip-card">Valor total acumulado gasto exclusivamente em processos referentes a Matéria-Prima.</div>
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Gasto Matéria-Prima</span>
            <div style="font-size:1.35rem; font-weight:800; color:#059669;">R$ ${rawMaterialAmount.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</div>
            <span style="font-size:0.72rem; color:var(--text-secondary);">Valor investido MP</span>
          </div>

          <div class="card has-tooltip-card" style="padding:16px; display:flex; flex-direction:column; gap:6px; border-left:4px solid #8b5cf6;">
            <div class="tooltip-card">Tempo médio da abertura do chamado até o prazo final estipulado de conclusão.</div>
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Tempo Médio Prazo</span>
            <div style="font-size:1.5rem; font-weight:800; color:#8b5cf6;">${avgTimeText}</div>
            <span style="font-size:0.72rem; color:var(--text-secondary);">${validDeadlineCount} com prazo</span>
          </div>

          <div class="card has-tooltip-card" style="padding:16px; display:flex; flex-direction:column; gap:6px; border-left:4px solid #0284c7;">
            <div class="tooltip-card">Tempo médio demorado da abertura do chamado até a criação do processo de compra.</div>
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Tempo Gerar Processo</span>
            <div style="font-size:1.5rem; font-weight:800; color:#0284c7;">${avgCreationTimeText}</div>
            <span style="font-size:0.72rem; color:var(--text-secondary);">Abertura x Processo Compra</span>
          </div>

          <div class="card has-tooltip-card" style="padding:16px; display:flex; flex-direction:column; gap:6px; border-left:4px solid #0891b2;">
            <div class="tooltip-card">Tempo médio entre a criação do processo de compra e a emissão do pedido (Aguardando Recebimento).</div>
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Tempo Gerar Pedido</span>
            <div style="font-size:1.5rem; font-weight:800; color:#0891b2;">${avgAwaitingReceiptTimeText}</div>
            <span style="font-size:0.72rem; color:var(--text-secondary);">Processo x Pedido</span>
          </div>

          <div class="card has-tooltip-card" style="padding:16px; display:flex; flex-direction:column; gap:6px; border-left:4px solid #16a34a;">
            <div class="tooltip-card">Tempo médio entre a criação do processo de compra e a conclusão do recebimento total.</div>
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Tempo Recebimento Total</span>
            <div style="font-size:1.5rem; font-weight:800; color:#16a34a;">${avgFinalizedTimeText}</div>
            <span style="font-size:0.72rem; color:var(--text-secondary);">Processo x Recebimento Total</span>
          </div>

          <div class="card has-tooltip-card" style="padding:16px; display:flex; flex-direction:column; gap:6px; border-left:4px solid #ea580c;">
            <div class="tooltip-card">Comparativo da previsão de entrega x data de recebimento. Exibe quantos processos foram concluídos no prazo e quantos atrasaram.</div>
            <span style="font-size:0.75rem; font-weight:700; color:var(--text-muted); text-transform:uppercase;">Pontualidade</span>
            <div style="font-size:1.5rem; font-weight:800; color:var(--text-primary);">
              <span style="color:#16a34a;">${onTimeCount}</span> <span style="font-size:0.9rem; color:var(--text-muted);">/</span> <span style="color:#dc2626;">${delayedCount}</span>
            </div>
            <span style="font-size:0.72rem; font-weight:600;">
              <span style="color:#16a34a;">No prazo</span> <span style="color:var(--text-muted);">x</span> <span style="color:#dc2626;">Atrasado</span>
            </span>
          </div>

        </div>

        <!-- PAINEL DE GRÁFICOS VISUAIS -->
        <div style="display:grid; grid-template-columns:1fr 1fr; gap:20px;" class="report-charts-grid">
          
          <!-- GRÁFICO 1: CONVERSÃO DE CHAMADOS X PROCESSOS DE COMPRA -->
          <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h4 style="margin:0; font-size:0.95rem; font-weight:700; color:var(--text-primary);">Conversão de Chamados em Compras</h4>
              <span style="font-size:0.8rem; font-weight:600; color:var(--primary);">${conversionRate}% Convertidos</span>
            </div>
            
            <div style="display:flex; align-items:center; gap:24px; justify-content:center; padding:10px 0;">
              <!-- Gráfico de Donut SVG -->
              <div style="position:relative; width:130px; height:130px; flex-shrink:0;">
                <svg width="130" height="130" viewBox="0 0 36 36" style="transform:rotate(-90deg);">
                  <path stroke="#f1f5f9" stroke-width="3.8" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path stroke="#0f766e" stroke-dasharray="${conversionRate}, 100" stroke-width="3.8" stroke-linecap="round" fill="none" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
                <div style="position:absolute; top:50%; left:50%; transform:translate(-50%, -50%); text-align:center;">
                  <strong style="font-size:1.1rem; color:var(--text-primary); display:block;">${totalWithPurchaseProcess} / ${totalDirectedToCompras}</strong>
                  <span style="font-size:0.7rem; color:var(--text-muted);">Processos</span>
                </div>
              </div>

              <!-- Legenda do Gráfico 1 -->
              <div style="display:flex; flex-direction:column; gap:10px; font-size:0.85rem;">
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="width:12px; height:12px; border-radius:50%; background:#0f766e; display:inline-block;"></span>
                  <span style="color:var(--text-secondary);">Com Processo de Compra (<strong>${totalWithPurchaseProcess}</strong>)</span>
                </div>
                <div style="display:flex; align-items:center; gap:8px;">
                  <span style="width:12px; height:12px; border-radius:50%; background:#e2e8f0; display:inline-block;"></span>
                  <span style="color:var(--text-secondary);">Apenas no Setor Compras (<strong>${totalWithoutPurchaseProcess}</strong>)</span>
                </div>
              </div>
            </div>
          </div>

          <!-- GRÁFICO 2: DISTRIBUIÇÃO POR STATUS DO PROCESSO -->
          <div class="card" style="padding:20px; display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h4 style="margin:0; font-size:0.95rem; font-weight:700; color:var(--text-primary);">Distribuição por Status dos Processos</h4>
              <span style="font-size:0.75rem; font-weight:600; color:#0284c7; background:#e0f2fe; padding:2px 8px; border-radius:10px;">⚡ Em Tempo Real</span>
            </div>
            
            <div style="display:flex; flex-direction:column; gap:10px; justify-content:center; flex:1;">
              ${(() => {
                const statusCounts = {};
                filteredReportTickets.forEach(t => {
                  const p = Array.isArray(t.purchase_process) ? t.purchase_process[0] : t.purchase_process;
                  const st = p ? (p.status || 'awaiting_start') : 'sem_processo';
                  statusCounts[st] = (statusCounts[st] || 0) + 1;
                });

                const statusColorMap = {
                  awaiting_start: '#0f766e',
                  in_analysis: '#3b82f6',
                  in_quotation: '#0284c7',
                  order_issued: '#16a34a',
                  awaiting_receipt: '#0891b2',
                  finalized: '#10b981',
                  sem_processo: '#94a3b8'
                };

                const totalProc = filteredReportTickets.length;
                if (totalProc === 0) {
                  return `<span style="font-size:0.85rem; color:var(--text-muted); text-align:center;">Nenhum dado no período</span>`;
                }

                return Object.entries(statusCounts).map(([stKey, count]) => {
                  const label = stKey === 'sem_processo' ? 'Sem Processo Criado' : (STATUS_LABELS[stKey] || stKey);
                  const pct = Math.round((count / totalProc) * 100);
                  const color = statusColorMap[stKey] || '#64748b';

                  return `
                    <div style="display:flex; flex-direction:column; gap:4px;">
                      <div style="display:flex; justify-content:space-between; font-size:0.8rem;">
                        <span style="font-weight:600; color:var(--text-secondary);">${label}</span>
                        <strong style="color:var(--text-primary);">${count} <span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">(${pct}%)</span></strong>
                      </div>
                      <div style="height:6px; background:#f1f5f9; border-radius:3px; overflow:hidden;">
                        <div style="width:${pct}%; height:100%; background:${color}; border-radius:3px; transition:width 0.5s ease;"></div>
                      </div>
                    </div>
                  `;
                }).join('');
              })()}
            </div>
          </div>

        </div>

        <!-- TABELA ANALÍTICA DETALHADA -->
        <div class="card" style="padding:0; overflow:hidden; border-radius:16px; margin-bottom:120px;">
          <div style="padding:20px; border-bottom:1px solid var(--border); display:flex; justify-content:space-between; align-items:center;">
            <h4 style="margin:0; font-size:1rem; font-weight:700; color:var(--text-primary);">Relatório Analítico de Chamados e Compras</h4>
            <span style="font-size:0.8rem; color:var(--text-muted);">Total de ${filteredReportTickets.length} registros</span>
          </div>

          <div style="overflow-x:auto;">
            <table style="width:100%; border-collapse:collapse; font-size:0.88rem; text-align:left;">
              <thead>
                <tr style="background:var(--bg-app); border-bottom:1px solid var(--border); font-size:0.78rem; text-transform:uppercase; color:var(--text-muted); font-weight:700;">
                  <th style="padding:12px 16px;">Chamado / Título / Autor</th>
                  <th style="padding:12px 16px;">Data Abertura</th>
                  <th style="padding:12px 16px;">Prazo Estipulado</th>
                  <th style="padding:12px 16px; text-align:center;">Processo Gerado?</th>
                  <th style="padding:12px 16px; text-align:right;">Valor da Compra</th>
                  <th style="padding:12px 16px; text-align:center;">Previsão Entrega</th>
                  <th style="padding:12px 16px; text-align:center;">Ações</th>
                </tr>
              </thead>
              <tbody>
                ${tableRowsHtml.length > 0 ? tableRowsHtml : `
                  <tr>
                    <td colspan="7" style="padding:32px; text-align:center; color:var(--text-muted);">Nenhum chamado registrado para o setor de compras.</td>
                  </tr>
                `}
              </tbody>
            </table>
          </div>

          <!-- CONTROLES DE PAGINAÇÃO DE 10 EM 10 -->
          <div style="padding:16px 20px; border-top:1px solid var(--border); display:flex; align-items:center; justify-content:space-between; flex-wrap:wrap; gap:12px; background:var(--bg-card);">
            <span style="font-size:0.82rem; color:var(--text-secondary); font-weight:500;">
              Mostrando <strong>${filteredReportTickets.length > 0 ? startIndex + 1 : 0}</strong> a <strong>${Math.min(startIndex + reportPageSize, filteredReportTickets.length)}</strong> de <strong>${filteredReportTickets.length}</strong> chamados
            </span>

            <div style="display:flex; align-items:center; gap:8px;">
              <button id="reportPrevPageBtn" class="btn btn-sm" ${reportCurrentPage <= 1 ? 'disabled' : ''} style="padding:6px 12px; font-size:0.82rem; font-weight:600; border:1px solid var(--border); background:var(--bg-card); cursor:${reportCurrentPage <= 1 ? 'not-allowed' : 'pointer'}; opacity:${reportCurrentPage <= 1 ? '0.5' : '1'}; border-radius:6px;">
                ◀ Anterior
              </button>

              <span style="font-size:0.82rem; font-weight:700; color:var(--text-primary); padding:0 8px;">
                Página ${reportCurrentPage} de ${totalPages}
              </span>

              <button id="reportNextPageBtn" class="btn btn-sm" ${reportCurrentPage >= totalPages ? 'disabled' : ''} style="padding:6px 12px; font-size:0.82rem; font-weight:600; border:1px solid var(--border); background:var(--bg-card); cursor:${reportCurrentPage >= totalPages ? 'not-allowed' : 'pointer'}; opacity:${reportCurrentPage >= totalPages ? '0.5' : '1'}; border-radius:6px;">
                Próxima ▶
              </button>
            </div>
          </div>

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
    const reportBtn = document.getElementById('viewReportBtn');

    const updateTabStyles = (activeView) => {
      if (kanbanBtn) {
        kanbanBtn.style.background = activeView === 'kanban' ? 'var(--primary)' : 'transparent';
        kanbanBtn.style.color = activeView === 'kanban' ? 'white' : 'var(--text-secondary)';
      }
      if (listBtn) {
        listBtn.style.background = activeView === 'list' ? 'var(--primary)' : 'transparent';
        listBtn.style.color = activeView === 'list' ? 'white' : 'var(--text-secondary)';
      }
      if (reportBtn) {
        reportBtn.style.background = activeView === 'report' ? 'var(--primary)' : 'transparent';
        reportBtn.style.color = activeView === 'report' ? 'white' : 'var(--text-secondary)';
      }
    };

    kanbanBtn?.addEventListener('click', () => {
      currentView = 'kanban';
      updateTabStyles('kanban');
      filterAndRender();
    });

    listBtn?.addEventListener('click', () => {
      currentView = 'list';
      updateTabStyles('list');
      filterAndRender();
    });

    reportBtn?.addEventListener('click', () => {
      currentView = 'report';
      updateTabStyles('report');
      filterAndRender();
    });

    // Fechar menu de ações ao clicar em qualquer lugar fora da janela do menu
    window.addEventListener('click', (e) => {
      const existingMenu = document.getElementById('reportActionMenu');
      if (existingMenu && !e.target.closest('.action-dropdown-btn') && !existingMenu.contains(e.target)) {
        existingMenu.remove();
      }
    });

    const viewContainer = document.getElementById('viewContainer');

    // Delegar cliques nos cards/linhas para abrir o modal de detalhes + manipular filtros de data do relatório + menu de Ações + Paginação
    viewContainer?.addEventListener('click', async (e) => {
      const existingMenu = document.getElementById('reportActionMenu');
      if (existingMenu && !e.target.closest('.action-dropdown-btn') && !existingMenu.contains(e.target)) {
        existingMenu.remove();
      }

      // Navegação da paginação
      const prevBtn = e.target.closest('#reportPrevPageBtn');
      if (prevBtn && reportCurrentPage > 1) {
        reportCurrentPage--;
        renderReport();
        return;
      }

      const nextBtn = e.target.closest('#reportNextPageBtn');
      if (nextBtn) {
        const totalPages = Math.ceil(filteredReportTickets.length / reportPageSize) || 1;
        if (reportCurrentPage < totalPages) {
          reportCurrentPage++;
          renderReport();
          return;
        }
      }

      if (e.target.id === 'clearDateFilterBtn') {
        reportStartDate = '';
        reportEndDate = '';
        reportRawMaterialFilter = 'all';
        reportCurrentPage = 1;
        renderReport();
        return;
      }

      // Tratar clique no botão Ações ⚙️
      const dropdownBtn = e.target.closest('.action-dropdown-btn');
      if (dropdownBtn) {
        e.stopPropagation();
        
        // Se já houver um menu aberto no mesmo botão, apenas o fecha
        if (existingMenu && existingMenu.getAttribute('data-for-ticket') === dropdownBtn.getAttribute('data-ticket-id')) {
          existingMenu.remove();
          return;
        }

        if (existingMenu) existingMenu.remove();

        const ticketId = dropdownBtn.getAttribute('data-ticket-id');
        const ticketNumber = dropdownBtn.getAttribute('data-ticket-number');
        const ticketTitle = dropdownBtn.getAttribute('data-ticket-title');
        const processId = dropdownBtn.getAttribute('data-process-id');
        const isRaw = dropdownBtn.getAttribute('data-is-raw') === 'true';

        const rect = dropdownBtn.getBoundingClientRect();
        const menu = document.createElement('div');
        menu.id = 'reportActionMenu';
        menu.setAttribute('data-for-ticket', ticketId);

        // Estimar altura do menu (~170px) para decidir se abre para cima ou para baixo
        const menuHeight = 175;
        const spaceBelow = window.innerHeight - rect.bottom;
        const openUpward = spaceBelow < menuHeight && rect.top > menuHeight;
        
        const topPos = openUpward ? (rect.top - menuHeight - 4) : (rect.bottom + 4);
        menu.style = `position:fixed; top:${topPos}px; left:${rect.left - 40}px; background:var(--bg-card); border:1px solid var(--border); border-radius:10px; box-shadow:var(--shadow-lg); z-index:1200; display:flex; flex-direction:column; min-width:210px; overflow:hidden; animation:slideUp 0.15s ease-out;`;
        
        menu.innerHTML = `
          <button id="actionViewDetailsBtn" style="padding:10px 14px; text-align:left; background:transparent; border:none; border-bottom:1px solid var(--border); font-size:0.85rem; font-weight:600; color:var(--primary); cursor:pointer; display:flex; align-items:center; gap:8px; transition:background 0.2s;">
            👁️ Ver Detalhes
          </button>
          <button id="actionViewDatesBtn" style="padding:10px 14px; text-align:left; background:transparent; border:none; border-bottom:1px solid var(--border); font-size:0.85rem; font-weight:600; color:#0891b2; cursor:pointer; display:flex; align-items:center; gap:8px; transition:background 0.2s;">
            📅 Ver Todas as Datas
          </button>
          <button id="actionIgnoreTicketBtn" style="padding:10px 14px; text-align:left; background:transparent; border:none; border-bottom:1px solid var(--border); font-size:0.85rem; font-weight:600; color:#dc2626; cursor:pointer; display:flex; align-items:center; gap:8px; transition:background 0.2s;">
            🚫 Desconsiderar Chamado
          </button>
          <button id="actionToggleRawMaterialBtn" style="padding:10px 14px; text-align:left; background:transparent; border:none; font-size:0.85rem; font-weight:600; color:#d97706; cursor:pointer; display:flex; align-items:center; gap:8px; transition:background 0.2s;">
            📦 ${isRaw ? 'Desmarcar Matéria-Prima' : 'Relacionar como Matéria-Prima'}
          </button>
        `;

        document.body.appendChild(menu);

        // Opção 0: Ver Detalhes do Chamado e Processo no Modal
        menu.querySelector('#actionViewDetailsBtn')?.addEventListener('click', async (evt) => {
          evt.stopPropagation();
          menu.remove();
          
          let proc = processes.find(p => p.id === processId || p.ticket_id === ticketId);
          if (!proc) {
            const foundTicket = reportTickets.find(t => t.id === ticketId);
            proc = {
              id: '',
              ticket_id: ticketId,
              status: 'awaiting_start',
              ticket: foundTicket || {}
            };
          }
          openStatusModal(proc);
        });

        // Opção Ver Todas as Datas
        menu.querySelector('#actionViewDatesBtn')?.addEventListener('click', (evt) => {
          evt.stopPropagation();
          menu.remove();

          const foundTicket = reportTickets.find(t => t.id === ticketId) || {};
          const proc = Array.isArray(foundTicket.purchase_process) ? foundTicket.purchase_process[0] : (foundTicket.purchase_process || processes.find(p => p.ticket_id === ticketId));

          const formatDt = (val) => {
            if (!val) return '—';
            if (val.length === 10 && val.includes('-')) {
              const [y, m, d] = val.split('-');
              return `${d}/${m}/${y}`;
            }
            try {
              return new Date(val).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });
            } catch (e) {
              return val;
            }
          };

          const deadlineColor = foundTicket.deadline ? '#8b5cf6' : 'var(--text-muted)';
          const createdAtColor = proc?.created_at ? '#0284c7' : 'var(--text-muted)';
          const awaitingReceiptColor = proc?.awaiting_receipt_at ? '#0891b2' : 'var(--text-muted)';
          const deliveryForecastColor = proc?.delivery_forecast ? '#ea580c' : 'var(--text-muted)';
          const finalizedColor = proc?.finalized_at ? '#16a34a' : 'var(--text-muted)';

          const datesDialog = document.createElement('div');
          datesDialog.className = 'modal-container open';
          datesDialog.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:1300; display:flex; align-items:center; justify-content:center;';
          datesDialog.innerHTML = `
            <div class="modal" style="width:90%; max-width:500px; padding:24px; display:flex; flex-direction:column; gap:20px; background:#ffffff; border-radius:16px; border:1px solid var(--border); box-shadow:var(--shadow-lg);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:1.1rem; color:var(--text-primary); display:flex; align-items:center; gap:8px;">
                  📅 Cronograma de Datas
                </h3>
                <button id="closeDatesModalBtn" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:var(--text-muted);">✕</button>
              </div>

              <!-- Identificação do Chamado -->
              <div style="background:var(--bg-app); border:1px solid var(--border); border-radius:8px; padding:12px 14px; display:flex; flex-direction:column; gap:4px;">
                <span style="font-size:0.8rem; font-weight:700; color:var(--primary);">Chamado Nº ${ticketNumber}</span>
                <span style="font-size:0.88rem; font-weight:600; color:var(--text-primary); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ticketTitle}</span>
              </div>

              <!-- Lista de Datas -->
              <div style="display:flex; flex-direction:column; gap:10px; font-size:0.88rem;">
                
                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                  <span style="color:var(--text-secondary); font-weight:600; display:flex; align-items:center; gap:6px;">
                    🟢 Abertura do Chamado:
                  </span>
                  <strong style="color:var(--text-primary);">${formatDt(foundTicket.created_at)}</strong>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                  <span style="color:var(--text-secondary); font-weight:600; display:flex; align-items:center; gap:6px;">
                    ⏱️ Prazo Estipulado:
                  </span>
                  <strong style="color:${deadlineColor};">${formatDt(foundTicket.deadline)}</strong>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                  <span style="color:var(--text-secondary); font-weight:600; display:flex; align-items:center; gap:6px;">
                    🛒 Criação do Processo de Compra:
                  </span>
                  <strong style="color:${createdAtColor};">${formatDt(proc?.created_at)}</strong>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                  <span style="color:var(--text-secondary); font-weight:600; display:flex; align-items:center; gap:6px;">
                    📄 Emissão do Pedido (Aguard. Recebimento):
                  </span>
                  <strong style="color:${awaitingReceiptColor};">${formatDt(proc?.awaiting_receipt_at)}</strong>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                  <span style="color:var(--text-secondary); font-weight:600; display:flex; align-items:center; gap:6px;">
                    🚚 Previsão de Entrega (Fornecedor):
                  </span>
                  <strong style="color:${deliveryForecastColor};">${formatDt(proc?.delivery_forecast)}</strong>
                </div>

                <div style="display:flex; justify-content:space-between; align-items:center; padding:10px 14px; background:#f8fafc; border-radius:8px; border:1px solid #e2e8f0;">
                  <span style="color:var(--text-secondary); font-weight:600; display:flex; align-items:center; gap:6px;">
                    ✅ Recebimento Total / Finalização:
                  </span>
                  <strong style="color:${finalizedColor};">${formatDt(proc?.finalized_at)}</strong>
                </div>

              </div>

              <div style="display:flex; justify-content:flex-end; margin-top:4px;">
                <button id="closeDatesModalBtnBottom" class="btn btn-secondary" style="padding:8px 20px;">Fechar</button>
              </div>
            </div>
          `;
          document.body.appendChild(datesDialog);

          const closeDatesModal = () => datesDialog.remove();
          datesDialog.querySelector('#closeDatesModalBtn')?.addEventListener('click', closeDatesModal);
          datesDialog.querySelector('#closeDatesModalBtnBottom')?.addEventListener('click', closeDatesModal);
        });

        // Opção 1: Desconsiderar chamado no relatório (com confirmação e aviso de ação irreversível)
        menu.querySelector('#actionIgnoreTicketBtn')?.addEventListener('click', (evt) => {
          evt.stopPropagation();
          menu.remove();

          const ignoreDialog = document.createElement('div');
          ignoreDialog.className = 'modal-container open';
          ignoreDialog.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:1300; display:flex; align-items:center; justify-content:center;';
          ignoreDialog.innerHTML = `
            <div class="modal" style="width:90%; max-width:460px; padding:24px; display:flex; flex-direction:column; gap:16px; background:#ffffff; border-radius:16px; border:1px solid var(--border); box-shadow:var(--shadow-lg);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:1.1rem; color:#dc2626; display:flex; align-items:center; gap:8px;">
                  ⚠️ Confirmar Desconsideração
                </h3>
                <button id="closeIgnoreModalBtn" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:var(--text-muted);">✕</button>
              </div>

              <!-- Identificação do Chamado -->
              <div style="background:var(--bg-app); border:1px solid var(--border); border-radius:8px; padding:12px 14px; display:flex; flex-direction:column; gap:4px;">
                <span style="font-size:0.8rem; font-weight:700; color:var(--primary);">Chamado Nº ${ticketNumber}</span>
                <span style="font-size:0.88rem; font-weight:600; color:var(--text-primary); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ticketTitle}</span>
              </div>

              <div style="background:#fef2f2; border:1px solid #fecaca; border-radius:8px; padding:12px 16px; font-size:0.85rem; color:#991b1b; display:flex; flex-direction:column; gap:6px;">
                <strong>🚨 AVISO DE AÇÃO IRREVERSÍVEL:</strong>
                <span>Ao desconsiderar este chamado, ele será permanentemente omitido das métricas e listagens dos relatórios de compras.</span>
              </div>

              <p style="margin:0; font-size:0.88rem; color:var(--text-secondary);">
                Tem certeza de que deseja desconsiderar este chamado no relatório de compras?
              </p>

              <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
                <button id="cancelIgnoreBtn" class="btn btn-secondary" style="padding:8px 16px;">Cancelar</button>
                <button id="confirmIgnoreBtn" class="btn" style="background:#dc2626; color:white; font-weight:600; padding:8px 16px;">
                  Sim, Desconsiderar
                </button>
              </div>
            </div>
          `;
          document.body.appendChild(ignoreDialog);

          const closeIgnoreModal = () => ignoreDialog.remove();
          ignoreDialog.querySelector('#closeIgnoreModalBtn')?.addEventListener('click', closeIgnoreModal);
          ignoreDialog.querySelector('#cancelIgnoreBtn')?.addEventListener('click', closeIgnoreModal);

          ignoreDialog.querySelector('#confirmIgnoreBtn')?.addEventListener('click', async () => {
            closeIgnoreModal();
            try {
              await toggleIgnoreInComprasReport(ticketId, true);
              showToast('Chamado desconsiderado do relatório!', 'success');
              await loadData();
            } catch (err) {
              console.error(err);
              showToast('Erro ao desconsiderar chamado. Certifique-se de rodar a migração 040.', 'error');
            }
          });
        });

        // Opção 2: Relacionar ou Desmarcar como Matéria-Prima (com confirmação reversível)
        menu.querySelector('#actionToggleRawMaterialBtn')?.addEventListener('click', (evt) => {
          evt.stopPropagation();
          menu.remove();

          const rawDialog = document.createElement('div');
          rawDialog.className = 'modal-container open';
          rawDialog.style = 'position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:1300; display:flex; align-items:center; justify-content:center;';
          rawDialog.innerHTML = `
            <div class="modal" style="width:90%; max-width:460px; padding:24px; display:flex; flex-direction:column; gap:16px; background:#ffffff; border-radius:16px; border:1px solid var(--border); box-shadow:var(--shadow-lg);">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:1.1rem; color:#d97706; display:flex; align-items:center; gap:8px;">
                  📦 Confirmar Matéria-Prima
                </h3>
                <button id="closeRawModalBtn" style="background:none; border:none; font-size:1.2rem; cursor:pointer; color:var(--text-muted);">✕</button>
              </div>

              <!-- Identificação do Chamado -->
              <div style="background:var(--bg-app); border:1px solid var(--border); border-radius:8px; padding:12px 14px; display:flex; flex-direction:column; gap:4px;">
                <span style="font-size:0.8rem; font-weight:700; color:var(--primary);">Chamado Nº ${ticketNumber}</span>
                <span style="font-size:0.88rem; font-weight:600; color:var(--text-primary); max-width:100%; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${ticketTitle}</span>
              </div>

              <div style="background:#fffbeb; border:1px solid #fef3c7; border-radius:8px; padding:12px 16px; font-size:0.85rem; color:#b45309; display:flex; flex-direction:column; gap:4px;">
                <strong>ℹ️ AÇÃO REVERSÍVEL:</strong>
                <span>Esta ação pode ser alterada a qualquer momento através deste mesmo menu.</span>
              </div>

              <p style="margin:0; font-size:0.88rem; color:var(--text-secondary);">
                Deseja ${isRaw ? '<strong>desmarcar</strong> este chamado como Matéria-Prima' : '<strong>relacionar</strong> este chamado como Matéria-Prima'}?
              </p>

              <div style="display:flex; justify-content:flex-end; gap:10px; margin-top:8px;">
                <button id="cancelRawBtn" class="btn btn-secondary" style="padding:8px 16px;">Cancelar</button>
                <button id="confirmRawBtn" class="btn" style="background:#d97706; color:white; font-weight:600; padding:8px 16px;">
                  ${isRaw ? 'Sim, Desmarcar' : 'Sim, Relacionar'}
                </button>
              </div>
            </div>
          `;
          document.body.appendChild(rawDialog);

          const closeRawModal = () => rawDialog.remove();
          rawDialog.querySelector('#closeRawModalBtn')?.addEventListener('click', closeRawModal);
          rawDialog.querySelector('#cancelRawBtn')?.addEventListener('click', closeRawModal);

          rawDialog.querySelector('#confirmRawBtn')?.addEventListener('click', async () => {
            closeRawModal();
            try {
              if (!processId) {
                await createPurchaseProcess(ticketId);
                const updatedProcesses = await fetchPurchaseProcesses();
                const newProc = updatedProcesses.find(p => p.ticket_id === ticketId);
                if (newProc) {
                  await updatePurchaseProcess(newProc.id, { is_raw_material: true });
                }
              } else {
                await updatePurchaseProcess(processId, { is_raw_material: !isRaw });
              }

              showToast(isRaw ? 'Matéria-Prima desmarcada!' : 'Relacionado como Matéria-Prima com sucesso!', 'success');
              await loadData();
            } catch (err) {
              console.error(err);
              showToast('Erro ao atualizar marcação de Matéria-Prima.', 'error');
            }
          });
        });

        return;
      }

      const card = e.target.closest('.kanban-card');
      if (card) {
        const processId = card.getAttribute('data-id');
        const found = processes.find(p => p.id === processId);
        if (found) openStatusModal(found);
        return;
      }
    });

    viewContainer?.addEventListener('change', (e) => {
      if (e.target.id === 'reportStartDateInput') {
        reportStartDate = e.target.value;
        reportCurrentPage = 1;
        renderReport();
      } else if (e.target.id === 'reportEndDateInput') {
        reportEndDate = e.target.value;
        reportCurrentPage = 1;
        renderReport();
      } else if (e.target.id === 'reportRawMaterialSelect') {
        reportRawMaterialFilter = e.target.value;
        reportCurrentPage = 1;
        renderReport();
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
      const [profilesList, historyList, processAttachments] = await Promise.all([
        fetchAllProfiles(),
        fetchTicketHistory(process.ticket_id),
        fetchTicketAttachments(process.ticket_id)
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
          <div style="display:flex; align-items:center; gap:12px; flex-wrap:wrap;">
            <button class="btn" id="modalCancelPurchaseBtn" style="padding:10px 18px; font-weight:600; background:#dc2626; color:white; border-radius:8px; font-size:0.88rem; transition:background 0.2s; cursor:pointer; display:inline-flex; align-items:center; gap:6px;">
              🚫 Cancelar Compra
            </button>
            ${process.receipt_status !== 'total' ? `
              <button class="btn" id="modalReceiptBtn" style="padding:10px 18px; font-weight:600; background:#0f766e; color:white; border-radius:8px; font-size:0.88rem; transition:background 0.2s; cursor:pointer;">Recebimento</button>
            ` : ''}
            <button id="closeModalBtn" style="background:transparent; border:none; font-size:1.5rem; cursor:pointer; color:var(--text-muted); line-height:1; padding:4px; margin-left:4px;">✕</button>
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

            <!-- OPÇÃO MATÉRIA-PRIMA -->
            <div style="background:var(--bg-app); padding:12px 16px; border-radius:10px; border:1px solid var(--border); display:flex; align-items:center; gap:12px;">
              <input type="checkbox" id="modalIsRawMaterialCheckbox" ${process.is_raw_material ? 'checked' : ''} style="width:18px; height:18px; cursor:pointer; accent-color:var(--primary);" />
              <label for="modalIsRawMaterialCheckbox" style="font-size:0.9rem; font-weight:700; color:var(--text-primary); cursor:pointer; margin:0; display:flex; align-items:center; gap:6px;">
                📦 Este processo é referente a <u>Matéria-Prima</u>
              </label>
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

            <!-- ANEXAR ARQUIVO NO PROCESSO DE COMPRA -->
            <div>
              <label style="display:block; font-size:0.85rem; font-weight:700; color:var(--text-secondary); margin-bottom:6px;">Anexo</label>
              <div style="font-size:0.75rem; color:var(--text-muted); background:var(--bg-app); padding:8px 12px; border-radius:8px; border:1px solid var(--border); line-height:1.35; margin-bottom:8px;">
                📎 <strong>Formatos permitidos:</strong> PNG, JPG, WEBP, GIF, PDF, DOCX, XLSX, TXT (Máx: <strong>5MB</strong>).
              </div>
              <input type="file" id="modalAttachmentInput" accept=".png,.jpg,.jpeg,.webp,.gif,.pdf,.docx,.xlsx,.txt" style="display:none;" />
              <button class="btn btn-secondary" id="modalAttachFileBtn" type="button" style="padding:8px 14px; font-weight:600; font-size:0.85rem; display:inline-flex; align-items:center; gap:8px; border-radius:8px;">
                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
                Incluir Anexo
              </button>
              <span id="modalAttachmentName" style="margin-left:10px; font-size:0.82rem; font-weight:600; color:var(--primary);"></span>
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
                ${processAttachments && processAttachments.length > 0 ? `
                  <div style="margin-top:6px; border-top:1px dashed var(--border); padding-top:10px;">
                    <strong style="color:var(--text-secondary); display:block; margin-bottom:6px;">📎 Anexos (${processAttachments.length}):</strong>
                    <div style="display:flex; flex-direction:column; gap:6px;">
                      ${processAttachments.map(att => {
                        if (att.is_expired) {
                          return `<div style="font-size:0.75rem; color:#d97706;">📎 ${escapeHtml(att.file_name)} (expirado)</div>`;
                        }
                        const isImg = att.mime_type?.startsWith('image/');
                        return `
                          <a href="${att.publicUrl}" target="_blank" ${isImg ? '' : `download="${escapeHtml(att.file_name)}"`} style="display:inline-flex; align-items:center; gap:6px; font-size:0.8rem; color:var(--primary); font-weight:600; text-decoration:none; background:var(--bg-card); padding:4px 8px; border-radius:6px; border:1px solid var(--border);">
                            <span>${isImg ? '📷' : '📄'}</span>
                            <span style="overflow:hidden; text-overflow:ellipsis; white-space:nowrap; max-width:180px;">${escapeHtml(att.file_name)}</span>
                            <span style="color:var(--text-muted); font-size:0.72rem; font-weight:normal;">(${(att.file_size / (1024 * 1024)).toFixed(2)} MB)</span>
                          </a>
                        `;
                      }).join('')}
                    </div>
                  </div>
                ` : ''}
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

      // BOTÃO CANCELAR COMPRA
      document.getElementById('modalCancelPurchaseBtn')?.addEventListener('click', () => {
        // Criar diálogo de confirmação bonito
        const cancelDialog = document.createElement('div');
        cancelDialog.id = 'cancelPurchaseConfirmDialog';
        cancelDialog.style = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:1300; display:flex; align-items:center; justify-content:center;`;
        cancelDialog.innerHTML = `
          <div style="background:var(--bg-card); padding:28px; border-radius:16px; box-shadow:var(--shadow-lg); width:90%; max-width:460px; display:flex; flex-direction:column; gap:20px; animation:slideUp 0.2s ease-out;">
            <div style="display:flex; justify-content:space-between; align-items:center;">
              <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:#dc2626; display:flex; align-items:center; gap:8px;">
                🚫 Cancelar Processo de Compra?
              </h3>
              <button id="cancelCloseBtn" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:1.25rem;">&times;</button>
            </div>
            <p style="margin:0; font-size:0.92rem; color:var(--text-secondary); line-height:1.5;">
              Ao cancelar a compra, o status do processo mudará para <strong>Cancelado</strong> e o chamado associado será finalizado como <strong>Resolvido</strong>.
            </p>
            <div>
              <label style="display:block; font-size:0.85rem; font-weight:700; color:var(--text-primary); margin-bottom:6px;">
                Motivo do Cancelamento <span style="color:#dc2626;">*</span>
              </label>
              <textarea id="cancelReasonInput" class="input" rows="3" placeholder="Informe obrigatoriamente o motivo do cancelamento..." style="background:var(--bg-app); resize:none; font-family:inherit; font-size:0.92rem; padding:10px 12px; border:1px solid var(--border);"></textarea>
            </div>
            <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:4px;">
              <button id="confirmCancelPurchaseBtn" class="btn" style="background:#dc2626; color:white; font-weight:600; padding:10px 20px; border-radius:8px; cursor:pointer;">Sim, Cancelar Compra</button>
              <button id="dismissCancelPurchaseBtn" class="btn btn-secondary" style="padding:10px 20px; border-radius:8px; cursor:pointer;">Voltar</button>
            </div>
          </div>
        `;
        document.body.appendChild(cancelDialog);

        const closeCancelDialog = () => {
          cancelDialog.remove();
        };

        cancelDialog.querySelector('#cancelCloseBtn')?.addEventListener('click', closeCancelDialog);
        cancelDialog.querySelector('#dismissCancelPurchaseBtn')?.addEventListener('click', closeCancelDialog);

        cancelDialog.querySelector('#confirmCancelPurchaseBtn')?.addEventListener('click', async () => {
          const reason = cancelDialog.querySelector('#cancelReasonInput')?.value?.trim();
          if (!reason) {
            showToast('Informe obrigatoriamente o motivo do cancelamento!', 'error');
            return;
          }

          const confirmBtn = cancelDialog.querySelector('#confirmCancelPurchaseBtn');
          try {
            if (confirmBtn) {
              confirmBtn.disabled = true;
              confirmBtn.textContent = 'Cancelando...';
            }

            // 1. Atualizar o processo de compra para status 'cancelled'
            await updatePurchaseProcess(process.id, {
              status: 'cancelled'
            });

            // 2. Atualizar o chamado associado para 'resolved'
            await updateTicketStatus(process.ticket_id, 'resolved');

            // 3. Incluir mensagem no chat do chamado
            const chatMsg = `🚫 **Compra Não Autorizada / Cancelada**\n**Motivo:** ${reason}`;
            await sendTicketMessage(process.ticket_id, chatMsg);

            showToast('Compra cancelada com sucesso e chamado resolvido.', 'success');
            closeCancelDialog();
            modal.classList.remove('open');
            await loadData();
          } catch (err) {
            console.error(err);
            showToast('Erro ao cancelar processo de compra.', 'error');
          } finally {
            if (confirmBtn) {
              confirmBtn.disabled = false;
              confirmBtn.textContent = 'Sim, Cancelar Compra';
            }
          }
        });
      });

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

          // Abrir modal de confirmação explicando o que acontecerá
          const confirmTotalDialog = document.createElement('div');
          confirmTotalDialog.id = 'confirmTotalDialog';
          confirmTotalDialog.style = `position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:1300; display:flex; align-items:center; justify-content:center;`;
          confirmTotalDialog.innerHTML = `
            <div style="background:var(--bg-card); padding:28px; border-radius:16px; box-shadow:var(--shadow-lg); width:90%; max-width:440px; display:flex; flex-direction:column; gap:20px; animation:slideUp 0.2s ease-out;">
              <div style="display:flex; justify-content:space-between; align-items:center;">
                <h3 style="margin:0; font-size:1.15rem; font-weight:700; color:var(--text-primary);">Confirmar Recebimento Total</h3>
                <button id="confirmCloseBtn" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:1.25rem;">&times;</button>
              </div>
              
              <div style="font-size:0.92rem; color:var(--text-secondary); line-height:1.5; background:var(--bg-app); padding:14px 16px; border-radius:10px; border:1px solid var(--border);">
                <p style="margin:0 0 10px 0; font-weight:600; color:var(--text-primary);">Ao confirmar o recebimento total:</p>
                <ul style="margin:0; padding-left:20px; display:flex; flex-direction:column; gap:6px;">
                  <li>O <strong>processo de compra será encerrado</strong> com status de recebimento total.</li>
                  <li>O <strong>chamado retornará para o autor</strong>.</li>
                  <li>O <strong>setor de compras será desvinculado</strong> deste chamado.</li>
                </ul>
              </div>

              <p style="margin:0; font-size:0.9rem; color:var(--text-muted);">Deseja prosseguir com o encerramento do processo de compra?</p>

              <div style="display:flex; justify-content:flex-end; gap:12px; margin-top:4px;">
                <button id="cancelTotalConfirmBtn" class="btn btn-secondary" style="padding:10px 20px; border-radius:8px; cursor:pointer;">Cancelar</button>
                <button id="executeTotalConfirmBtn" class="btn" style="background:#16a34a; color:white; font-weight:600; padding:10px 20px; border-radius:8px; cursor:pointer;">Sim, Confirmar</button>
              </div>
            </div>
          `;
          document.body.appendChild(confirmTotalDialog);

          const closeConfirmDialog = () => {
            confirmTotalDialog.remove();
          };

          confirmTotalDialog.querySelector('#confirmCloseBtn')?.addEventListener('click', closeConfirmDialog);
          confirmTotalDialog.querySelector('#cancelTotalConfirmBtn')?.addEventListener('click', closeConfirmDialog);

          confirmTotalDialog.querySelector('#executeTotalConfirmBtn')?.addEventListener('click', async () => {
            closeConfirmDialog();
            try {
              // 1. Desatrelar colaboradores do setor de Compras
              await removeComprasCollaborators(process.ticket_id);

              // 2. Atualizar status do chamado para "Compra Recebida" (purchase_received)
              await updateTicketStatus(process.ticket_id, 'purchase_received');

              // 3. Registrar mensagem no chat
              const ticketMsgContent = '📦 **Recebimento Total registrado**\nO processo de compra foi encerrado com recebimento total e o status do chamado foi atualizado para Compra Recebida.';
              await sendTicketMessage(process.ticket_id, ticketMsgContent);

              // 4. Encerrar processo de compra por último (status: finalized, receipt_status: total)
              await updatePurchaseProcess(process.id, {
                status: 'finalized',
                receipt_status: 'total',
                finalized_at: process.finalized_at || new Date().toISOString()
              });

              showToast('Recebimento Total registrado e processo encerrado com sucesso!', 'success');
              modal.classList.remove('open');
              await loadData();
            } catch (err) {
              console.error(err);
              showToast('Erro ao registrar recebimento total.', 'error');
            }
          });
        });
      });

      // Eventos de Seleção de Anexo
      const modalAttachBtn = document.getElementById('modalAttachFileBtn');
      const modalFileInput = document.getElementById('modalAttachmentInput');
      const modalFileNameSpan = document.getElementById('modalAttachmentName');
      let selectedAttachmentFile = null;

      modalAttachBtn?.addEventListener('click', () => {
        modalFileInput?.click();
      });

      modalFileInput?.addEventListener('change', (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar Tamanho Máximo (5 MB)
        const MAX_BYTES = 5 * 1024 * 1024;
        if (file.size > MAX_BYTES) {
          showToast(`O arquivo excede o limite máximo de 5MB! (${(file.size / (1024 * 1024)).toFixed(2)} MB)`, 'error');
          modalFileInput.value = '';
          selectedAttachmentFile = null;
          if (modalFileNameSpan) modalFileNameSpan.textContent = '';
          return;
        }

        // Validar Extensões Permitidas
        const allowedExts = ['png', 'jpg', 'jpeg', 'webp', 'gif', 'pdf', 'docx', 'xlsx', 'txt'];
        const fileExt = file.name.split('.').pop()?.toLowerCase();
        if (!allowedExts.includes(fileExt)) {
          showToast(`Formato não permitido! Permitidos: ${allowedExts.join(', ').toUpperCase()}`, 'error');
          modalFileInput.value = '';
          selectedAttachmentFile = null;
          if (modalFileNameSpan) modalFileNameSpan.textContent = '';
          return;
        }

        selectedAttachmentFile = file;
        if (modalFileNameSpan) {
          modalFileNameSpan.textContent = `📎 ${file.name} (${(file.size / (1024 * 1024)).toFixed(2)} MB)`;
        }
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
          const newIsRawMaterial = document.getElementById('modalIsRawMaterialCheckbox')?.checked || false;

          const updateData = {
            status: newStatus,
            responsible_id: newResponsibleId,
            order_number: newOrderNumber,
            supplier: newSupplier,
            purchase_amount: newPurchaseAmount,
            delivery_forecast: newDeliveryForecast,
            block_reason: newBlockReason,
            receipt_status: newReceiptStatus,
            is_raw_material: newIsRawMaterial
          };

          if (newStatus === 'awaiting_receipt' && !process.awaiting_receipt_at) {
            updateData.awaiting_receipt_at = new Date().toISOString();
          }
          if (newStatus === 'finalized' && !process.finalized_at) {
            updateData.finalized_at = new Date().toISOString();
          }

          // Atualizar processo de compra no Supabase
          await updatePurchaseProcess(process.id, updateData);

          // Upload de Anexo se selecionado
          if (selectedAttachmentFile) {
            await uploadTicketAttachment(process.ticket_id, selectedAttachmentFile);
          }

          // Tratar nova observação (gravar no chat do chamado)
          const newObs = document.getElementById('modalNewObservationInput').value.trim();
          if (newObs || selectedAttachmentFile) {
            let formattedMsg = '';
            if (newObs && selectedAttachmentFile) {
              formattedMsg = `📝 **Nova Observação de Compra**\n${newObs}\n📎 Anexo: **${selectedAttachmentFile.name}**`;
            } else if (newObs) {
              formattedMsg = `📝 **Nova Observação de Compra**\n${newObs}`;
            } else if (selectedAttachmentFile) {
              formattedMsg = `📎 Enviou anexo de compra: **${selectedAttachmentFile.name}**`;
            }

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
