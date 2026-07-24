/**
 * Dashboard — Lista de Chamados com filtros e Sidebar
 */
import { getCurrentProfile, fetchAllProfiles } from '../lib/auth.js';
import { fetchTickets, fetchDepartments } from '../lib/api.js';
import { navigateTo } from '../lib/router.js';
import { showToast } from '../lib/toast.js';
import { getLayoutTemplate, bindLayoutEvents } from '../lib/layout.js';

const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const STATUS_LABELS = { 
  open: 'Aberto', 
  in_progress: 'Em Andamento', 
  resolved: 'Resolvido', 
  overdue: 'Atrasado',
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

export async function renderDashboard(container) {
  let profile = null;
  let tickets = [];
  let filters = { status: '', view: '', departmentId: '', authorId: '', searchQuery: '' };
  let loadingTickets = true;
  let departmentsList = [];
  let authorsList = [];

  try {
    profile = await getCurrentProfile();
    if (!profile) {
      navigateTo('/login');
      return;
    }
    departmentsList = await fetchDepartments();
    authorsList = await fetchAllProfiles();
  } catch {
    navigateTo('/login');
    return;
  }

  const isSuperAdmin = profile.email === 'ds.rafa@hotmail.com';
  const isDirector = profile.role === 'director';

  async function loadTickets() {
    loadingTickets = true;
    renderPage();
    try {
      tickets = await fetchTickets({
        ...filters,
        myDepartmentId: profile.department_id,
        myDepartmentIds: profile.departments?.map(d => d.id) || [],
        myUserId: profile.id,
      });
    } catch (err) {
      console.error(err);
      showToast('Erro ao carregar chamados', 'error');
      tickets = [];
    }
    loadingTickets = false;
    renderPage();
  }

  function renderPage() {
    // 1. Injeta o layout base na raiz da página
    container.innerHTML = getLayoutTemplate(profile, 'tickets');

    // 2. Injeta a tela específica dentro do container principal da Sidebar/Layout
    const mainContent = document.getElementById('mainContent');
    const needsSetup = !profile.department_id && (!profile.departments || profile.departments.length === 0);

    // Contagem de status para os cards superiores
    const totalPending = tickets.filter(t => t.status === 'open').length;
    const totalInProgress = tickets.filter(t => t.status === 'in_progress').length;
    const totalOverdue = tickets.filter(t => t.status === 'overdue').length;

    mainContent.innerHTML = `
      <style>
        /* Forçar a página e a tabela a usarem a largura máxima disponível */
        .page {
          max-width: 1200px !important;
          margin: 0 auto !important;
          padding: 48px 16px 24px 16px !important;
        }

        .view-mode-selector {
          display: flex;
        }
        @media (max-width: 900px) {
          .view-mode-selector {
            display: none !important;
          }
        }
        
        /* Estilos de Tabela Premium */
        .tickets-table-container {
          width: 100% !important;
          display: block;
          overflow-x: auto;
          background: var(--bg-card);
          border-radius: 12px;
          border: 1px solid var(--border);
          box-shadow: var(--shadow-sm);
        }
        .tickets-table {
          width: 100% !important;
          table-layout: fixed;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.95rem;
        }
        .tickets-table th {
          background: #fafafa;
          color: var(--text-secondary);
          font-weight: 700;
          padding: 8px 12px;
          border-bottom: 1px solid var(--border);
          font-size: 0.9rem;
          text-transform: none;
          letter-spacing: 0.3px;
        }
        .tickets-table td {
          padding: 8px 12px;
          border-bottom: 1px solid var(--border);
          vertical-align: middle;
          color: var(--text-primary);
        }
        .tickets-table tr:last-child td {
          border-bottom: none;
        }
        .tickets-table tr.clickable-row {
          cursor: pointer;
          transition: background 0.15s;
        }
        .tickets-table tr.clickable-row:hover {
          background: var(--bg-app);
        }
        .tickets-table .badge {
          display: inline-block;
          text-align: center;
        }
        /* Customização de badge de prioridade idêntica ao print */
        .tickets-table .badge-high {
          background: #fee2e2 !important;
          color: #ef4444 !important;
          border: 1.5px solid #ef4444 !important;
          font-weight: bold;
        }
        .tickets-table .badge-medium {
          background: #eff6ff !important;
          color: #3b82f6 !important;
          border: 1.5px solid #3b82f6 !important;
          font-weight: bold;
        }
        .tickets-table .badge-low {
          background: #ecfdf5 !important;
          color: #10b981 !important;
          border: 1.5px solid #10b981 !important;
          font-weight: bold;
        }
        /* Customização do status idêntico ao print */
        .tickets-table .badge-open {
          background: #f59e0b !important;
          color: white !important;
          border-radius: 20px !important;
          font-weight: bold;
        }
        .tickets-table .badge-in_progress {
          background: #3b82f6 !important;
          color: white !important;
          border-radius: 20px !important;
          font-weight: bold;
        }
        .tickets-table .badge-in_progress_overdue {
          background: linear-gradient(135deg, #3b82f6 50%, #ef4444 50%) !important;
          color: white !important;
          border-radius: 20px !important;
          font-weight: bold;
          text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
        }
        .tickets-table .badge-resolved {
          background: #10b981 !important;
          color: white !important;
          border-radius: 20px !important;
          font-weight: bold;
        }
        .tickets-table .badge-overdue {
          background: #ef4444 !important;
          color: white !important;
          border-radius: 20px !important;
          font-weight: bold;
        }
        .pending-badge-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #fffbeb;
          border: 1px solid #fef3c7;
          padding: 8px 16px;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(245, 158, 11, 0.05);
        }
        .pending-badge-card-number {
          background: #f59e0b;
          color: white;
          min-width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.1rem;
          padding: 0 6px;
        }
        .pending-badge-card-label {
          font-size: 0.72rem;
          font-weight: 700;
          color: #b45309;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: block;
          line-height: 1;
        }
        .pending-badge-card-title {
          font-size: 0.88rem;
          color: #78350f;
          font-weight: 800;
          display: block;
          margin-top: 2px;
        }
        .progress-badge-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #eff6ff;
          border: 1px solid #dbeafe;
          padding: 8px 16px;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.05);
        }
        .progress-badge-card-number {
          background: #3b82f6;
          color: white;
          min-width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.1rem;
          padding: 0 6px;
        }
        .progress-badge-card-label {
          font-size: 0.72rem;
          font-weight: 700;
          color: #1d4ed8;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: block;
          line-height: 1;
        }
        .progress-badge-card-title {
          font-size: 0.88rem;
          color: #1e3a8a;
          font-weight: 800;
          display: block;
          margin-top: 2px;
        }
        .overdue-badge-card {
          display: flex;
          align-items: center;
          gap: 12px;
          background: #fef2f2;
          border: 1px solid #fee2e2;
          padding: 8px 16px;
          border-radius: 12px;
          box-shadow: 0 4px 6px -1px rgba(239, 68, 68, 0.05);
        }
        .overdue-badge-card-number {
          background: #ef4444;
          color: white;
          min-width: 32px;
          height: 32px;
          border-radius: 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 700;
          font-size: 1.1rem;
          padding: 0 6px;
        }
        .overdue-badge-card-label {
          font-size: 0.72rem;
          font-weight: 700;
          color: #b91c1c;
          text-transform: uppercase;
          letter-spacing: 0.5px;
          display: block;
          line-height: 1;
        }
        .overdue-badge-card-title {
          font-size: 0.88rem;
          color: #7f1d1d;
          font-weight: 800;
          display: block;
          margin-top: 2px;
        }
      </style>

      <main class="page">
        ${needsSetup ? `
          <div class="setup-banner">
            <p>⚠️ Você ainda não selecionou seu grupo. Configure para poder abrir e visualizar chamados.</p>
            <button class="btn btn-sm btn-primary" id="setupDeptBtn">Configurar Grupo</button>
          </div>
        ` : ''}

        <!-- PAGE HEADER -->
        <div class="page-header" style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px; margin-bottom: 24px;">
          <div style="display: flex; align-items: center; gap: 48px; flex-wrap: wrap;">
            <div>
              <h1 style="margin: 0;">Chamados</h1>
              <p style="color:var(--text-secondary);font-size:0.9rem;margin-top:2px;">
                Painel de chamados Fundiferro
              </p>
            </div>
            
            <div style="display: flex; gap: 12px; flex-wrap: wrap;">
              <!-- Card de Pendentes -->
              <div class="pending-badge-card">
                <div class="pending-badge-card-number">
                  ${totalPending}
                </div>
                <div>
                  <span class="pending-badge-card-label">Chamados</span>
                  <strong class="pending-badge-card-title">Pendentes</strong>
                </div>
              </div>

              <!-- Card de Em Atendimento -->
              <div class="progress-badge-card">
                <div class="progress-badge-card-number">
                  ${totalInProgress}
                </div>
                <div>
                  <span class="progress-badge-card-label">Chamados</span>
                  <strong class="progress-badge-card-title">Em Atendimento</strong>
                </div>
              </div>

              <!-- Card de Atrasados -->
              <div class="overdue-badge-card">
                <div class="overdue-badge-card-number">
                  ${totalOverdue}
                </div>
                <div>
                  <span class="overdue-badge-card-label">Chamados</span>
                  <strong class="overdue-badge-card-title">Atrasados</strong>
                </div>
              </div>
            </div>
          </div>
          
          <div style="display:flex;gap:10px;">
            <button class="btn btn-primary btn-desktop-only" id="newTicketBtn" style="background:#059669; border-color:#059669;">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              Abrir Chamado
            </button>
          </div>
        </div>

        <!-- FILTERS & VIEW MODE -->
        <div class="filter-bar" style="display:flex; flex-direction:column; gap:14px; margin-bottom:20px; width:100%;">
          <!-- Linha 1: Filtros de status, autores, grupos, todos e criados por mim -->
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center; width:100%;">
            <select class="select" id="filterStatus" style="min-width:160px">
              <option value="">Todos os Status</option>
              <option value="open" ${filters.status === 'open' ? 'selected' : ''}>Aberto</option>
              <option value="in_progress" ${filters.status === 'in_progress' ? 'selected' : ''}>Em Andamento</option>
              <option value="resolved" ${filters.status === 'resolved' ? 'selected' : ''}>Resolvido</option>
              <option value="overdue" ${filters.status === 'overdue' ? 'selected' : ''}>Atrasado</option>
            </select>

            <select class="select" id="filterAuthor" style="min-width:180px">
              <option value="">Todos os Autores</option>
              ${authorsList.map(user => `
                <option value="${user.id}" ${filters.authorId === user.id ? 'selected' : ''}>${escapeHtml(user.full_name)}</option>
              `).join('')}
            </select>

            <select class="select" id="filterDepartment" style="min-width:160px">
              <option value="">Todos os Grupos</option>
              ${departmentsList.map(dept => `
                <option value="${dept.id}" ${filters.departmentId === dept.id ? 'selected' : ''}>${escapeHtml(dept.name)}</option>
              `).join('')}
            </select>

            <button class="filter-chip ${filters.view === '' ? 'active' : ''}" data-view="">Todos</button>
            <button class="filter-chip ${filters.view === 'created' ? 'active' : ''}" data-view="created">Criados por mim</button>
            <button class="filter-chip ${filters.view === 'resolved' ? 'active' : ''}" data-view="resolved">Finalizados</button>
          </div>

          <!-- Linha 2: Campo de busca de largura total abaixo dos filtros -->
          <div style="display:flex; width:100%;">
            <input type="text" class="input" id="searchTickets" placeholder="Buscar nº ou assunto..." style="width:100%; max-width:100%; box-sizing:border-box;" value="${escapeHtml(filters.searchQuery)}">
          </div>
        </div>

        <!-- TICKETS LIST -->
        <div id="ticketsList">
          ${loadingTickets ? '<div class="spinner"></div>' : renderTicketsList()}
        </div>
      </main>

      <!-- FAB Mobile -->
      <button class="fab" id="fabNewTicket" title="Abrir Chamado" style="background:#059669;">＋</button>
    `;

    bindLayoutEvents(profile);
    bindPageEvents();
  }

  function renderTicketsList() {
    let displayTickets = [...tickets];

    // 1. Filtrar por Autor do Chamado
    if (filters.authorId) {
      displayTickets = displayTickets.filter(t => t.created_by === filters.authorId);
    }

    // 2. Campo de busca (Buscar por número ou assunto)
    if (filters.searchQuery) {
      const sq = filters.searchQuery.trim().toLowerCase();
      displayTickets = displayTickets.filter(t => {
        const numStr = String(t.ticket_number || '');
        const titleStr = (t.title || '').toLowerCase();
        return numStr.includes(sq) || titleStr.includes(sq);
      });
    }

    if (displayTickets.length === 0) {
      return `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 12h6M12 9v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3>Nenhum chamado encontrado</h3>
          <p>Tente ajustar os filtros ou a busca.</p>
        </div>
      `;
    }

    return `
      <div class="tickets-table-container">
        <table class="tickets-table">
          <thead>
            <tr>
              <th style="width: 33%;">Assunto</th>
              <th style="width: 15%;">Origem</th>
              <th style="width: 15%;">Destino</th>
              <th style="width: 12%;">Data Abertura</th>
              <th style="width: 12%; text-align:center;">Prioridade</th>
              <th style="width: 13%; text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${displayTickets.map(t => renderTableRow(t)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderTableRow(t) {
    const dateOnly = t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : '—';
    
    const isOverdue = t.deadline && new Date(t.deadline) < new Date();
    let statusClass = t.status;
    let statusLabel = STATUS_LABELS[t.status];
    
    if (t.status === 'open') {
      statusLabel = 'Pendente';
    } else if (t.status === 'overdue') {
      statusLabel = 'Atrasado';
    }
    
    if (t.status === 'in_progress' && isOverdue) {
      statusClass = 'in_progress_overdue';
      statusLabel = 'Em Atendimento (Atrasado)';
    }

    // Determinar destino (grupo ou colaboradores)
    let destinationName = t.destination?.name;
    if (!destinationName) {
      const collaborators = t.ticket_users
        ?.map(tu => tu.profile)
        .filter(p => p && p.id !== t.created_by) || [];
      destinationName = collaborators.map(c => c.full_name).join(', ') || 'Colaborador(es)';
    }

    // Obter lista de colaboradores atrelados para o tooltip de Destino
    const linkedCollabs = t.ticket_users
      ?.map(tu => tu.profile?.full_name)
      .filter(Boolean) || [];
    const tooltipText = linkedCollabs.length > 0 
      ? `Colaboradores atrelados:\n${linkedCollabs.map(name => `• ${name}`).join('\n')}`
      : 'Nenhum colaborador atrelado';

    let badgeStyle = `min-width:125px; padding:6px 12px; font-size:0.85rem; display:inline-block; white-space:nowrap;`;
    let labelHtml = escapeHtml(statusLabel);
    if (statusClass === 'in_progress_overdue') {
      badgeStyle = `min-width:125px; padding:4px 8px; font-size:0.72rem; display:inline-block; white-space:normal; line-height:1.15;`;
      labelHtml = `Em Atendimento<br>(Atrasado)`;
    } else if (statusClass === 'awaiting_start') {
      badgeStyle = `min-width:125px; padding:4px 8px; font-size:0.72rem; display:inline-block; white-space:normal; line-height:1.15;`;
      labelHtml = `Gerado Processo<br>de Compra`;
    } else if (statusClass === 'awaiting_info') {
      badgeStyle = `min-width:125px; padding:4px 8px; font-size:0.72rem; display:inline-block; white-space:normal; line-height:1.15;`;
      labelHtml = `Aguardando<br>Informações`;
    } else if (statusClass === 'awaiting_supplier') {
      badgeStyle = `min-width:125px; padding:4px 8px; font-size:0.72rem; display:inline-block; white-space:normal; line-height:1.15;`;
      labelHtml = `Aguardando<br>Fornecedor`;
    } else if (statusClass === 'awaiting_receipt') {
      badgeStyle = `min-width:125px; padding:4px 8px; font-size:0.72rem; display:inline-block; white-space:normal; line-height:1.15;`;
      labelHtml = `Aguardando<br>Recebimento`;
    } else if (statusClass === 'received_partial') {
      badgeStyle = `min-width:125px; padding:4px 8px; font-size:0.72rem; display:inline-block; white-space:normal; line-height:1.15;`;
      labelHtml = `Recebido<br>Parcial`;
    }

    return `
      <tr class="clickable-row" data-ticket-id="${t.id}">
        <td>
          <div style="display:flex; flex-direction:column; gap:2px;">
            <strong style="font-size:0.9rem; color:var(--text-primary);">Nº: ${t.ticket_number || ''}</strong>
            <span style="font-size:0.78rem; color:var(--text-muted); text-transform:uppercase; font-weight:600; letter-spacing:0.3px;">${escapeHtml(t.title)}</span>
          </div>
        </td>
        <td>
          <span style="font-weight:600; color:var(--text-secondary); font-size:0.95rem;">${escapeHtml(t.creator?.full_name || '—')}</span>
        </td>
        <td title="${escapeHtml(tooltipText)}">
          <span style="font-weight:600; color:var(--text-secondary); font-size:0.95rem; cursor:help;">${escapeHtml(destinationName)}</span>
        </td>
        <td>
          <span style="color:var(--text-secondary); font-size:0.95rem; font-weight:500;">${dateOnly}</span>
        </td>
        <td style="text-align:center;">
          <span class="badge badge-${t.priority}" style="min-width:80px; padding:6px 12px; font-size:0.85rem; border-radius:10px; display:inline-block;">${PRIORITY_LABELS[t.priority]}</span>
        </td>
        <td style="text-align:center;">
          <span class="badge badge-${statusClass}" style="${badgeStyle}">${labelHtml}</span>
        </td>
      </tr>
    `;
  }

  function bindPageEvents() {
    // Abrir Chamado
    document.getElementById('newTicketBtn')?.addEventListener('click', () => navigateTo('/new-ticket'));
    document.getElementById('fabNewTicket')?.addEventListener('click', () => navigateTo('/new-ticket'));

    // Botão cadastrar setores (super admin)
    document.getElementById('newDeptBtn')?.addEventListener('click', () => navigateTo('/admin/departments'));

    // Filters
    document.getElementById('filterStatus')?.addEventListener('change', (e) => {
      filters.status = e.target.value;
      loadTickets();
    });

    document.getElementById('filterAuthor')?.addEventListener('change', (e) => {
      filters.authorId = e.target.value;
      const listContainer = document.getElementById('ticketsList');
      if (listContainer) {
        listContainer.innerHTML = renderTicketsList();
        listContainer.querySelectorAll('[data-ticket-id]').forEach(card => {
          card.addEventListener('click', () => navigateTo('/ticket?id=' + card.dataset.ticketId));
        });
      }
    });

    document.getElementById('searchTickets')?.addEventListener('input', (e) => {
      filters.searchQuery = e.target.value;
      const listContainer = document.getElementById('ticketsList');
      if (listContainer) {
        listContainer.innerHTML = renderTicketsList();
        listContainer.querySelectorAll('[data-ticket-id]').forEach(card => {
          card.addEventListener('click', () => navigateTo('/ticket?id=' + card.dataset.ticketId));
        });
      }
    });

    document.getElementById('filterDepartment')?.addEventListener('change', (e) => {
      filters.departmentId = e.target.value;
      loadTickets();
    });

    document.querySelectorAll('[data-view]').forEach(chip => {
      chip.addEventListener('click', () => {
        filters.view = chip.dataset.view;
        loadTickets();
      });
    });

    // Clique no card do ticket
    document.querySelectorAll('[data-ticket-id]').forEach(card => {
      card.addEventListener('click', () => navigateTo('/ticket?id=' + card.dataset.ticketId));
    });

    // Setup department
    document.getElementById('setupDeptBtn')?.addEventListener('click', () => {
      navigateTo('/login');
      showToast('Faça login novamente para atualizar seus dados', 'info');
    });
  }

  await loadTickets();
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}
