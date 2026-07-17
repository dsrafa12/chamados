/**
 * Dashboard — Lista de Chamados com filtros e Sidebar
 */
import { getCurrentProfile } from '../lib/auth.js';
import { fetchTickets, updateTicketStatus, fetchTicketDetail, fetchTicketMessages, sendTicketMessage, fetchTicketCosts, addTicketCost, forwardTicket, fetchDepartments } from '../lib/api.js';
import { navigateTo } from '../lib/router.js';
import { showToast } from '../lib/toast.js';
import { getLayoutTemplate, bindLayoutEvents } from '../lib/layout.js';

const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const STATUS_LABELS = { open: 'Aberto', in_progress: 'Em Andamento', resolved: 'Resolvido' };

export async function renderDashboard(container) {
  let profile = null;
  let tickets = [];
  let filters = { status: '', priority: '', view: '' };
  let loadingTickets = true;
  let viewMode = 'kanban'; // 'kanban' ou 'list'

  try {
    profile = await getCurrentProfile();
    if (!profile) {
      navigateTo('/login');
      return;
    }
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

    mainContent.innerHTML = `
      <style>
        .view-mode-selector {
          display: flex;
        }
        @media (max-width: 900px) {
          .view-mode-selector {
            display: none !important;
          }
        }
        
        /* Estilos do Kanban */
        .kanban-board {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 20px;
          margin-top: 20px;
          align-items: start;
        }
        .kanban-column {
          background: var(--bg-card);
          border: 1px solid var(--border);
          border-radius: 12px;
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 12px;
          min-height: 400px;
          box-shadow: var(--shadow-sm);
        }
        .kanban-column-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          border-bottom: 2px solid var(--border);
          padding-bottom: 10px;
          margin-bottom: 4px;
        }
        .kanban-column-title {
          font-weight: 700;
          font-size: 0.95rem;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .kanban-column-badge {
          background: var(--bg-app);
          color: var(--text-secondary);
          padding: 2px 8px;
          border-radius: 20px;
          font-size: 0.8rem;
          font-weight: 600;
        }
        .kanban-cards {
          display: flex;
          flex-direction: column;
          gap: 12px;
          overflow-y: auto;
          max-height: 600px;
        }
        .kanban-board .ticket-card {
          margin: 0;
          padding: 16px;
        }
        
        /* Estilos de Tabela Premium */
        .tickets-table-container {
          width: 100%;
          overflow-x: auto;
          background: var(--bg-card);
          border-radius: 12px;
          border: 1px solid var(--border);
          box-shadow: var(--shadow-sm);
        }
        .tickets-table {
          width: 100%;
          border-collapse: collapse;
          text-align: left;
          font-size: 0.88rem;
        }
        .tickets-table th {
          background: #fafafa;
          color: var(--text-secondary);
          font-weight: 700;
          padding: 14px 20px;
          border-bottom: 1px solid var(--border);
          font-size: 0.82rem;
          text-transform: none;
          letter-spacing: 0.3px;
        }
        .tickets-table td {
          padding: 14px 20px;
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
        .tickets-table .badge-resolved {
          background: #10b981 !important;
          color: white !important;
          border-radius: 20px !important;
          font-weight: bold;
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
        <div class="page-header">
          <div>
            <h1>Chamados</h1>
            <p style="color:var(--text-secondary);font-size:0.9rem;margin-top:2px;">
              Painel de chamados intersetoriais
            </p>
          </div>
          
          <div style="display:flex;gap:10px;">
            <button class="btn btn-primary btn-desktop-only" id="newTicketBtn" style="background:#059669; border-color:#059669;">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              Abrir Chamado
            </button>
          </div>
        </div>

        <!-- FILTERS & VIEW MODE -->
        <div class="filter-bar" style="display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:12px; margin-bottom:20px;">
          <div style="display:flex; gap:10px; flex-wrap:wrap; align-items:center;">
            <select class="select" id="filterStatus" style="min-width:150px">
              <option value="">Todos os Status</option>
              <option value="open" ${filters.status === 'open' ? 'selected' : ''}>Aberto</option>
              <option value="in_progress" ${filters.status === 'in_progress' ? 'selected' : ''}>Em Andamento</option>
              <option value="resolved" ${filters.status === 'resolved' ? 'selected' : ''}>Resolvido</option>
            </select>

            <select class="select" id="filterPriority" style="min-width:150px">
              <option value="">Todas Prioridades</option>
              <option value="low" ${filters.priority === 'low' ? 'selected' : ''}>Baixa</option>
              <option value="medium" ${filters.priority === 'medium' ? 'selected' : ''}>Média</option>
              <option value="high" ${filters.priority === 'high' ? 'selected' : ''}>Alta</option>
            </select>

            <button class="filter-chip ${filters.view === '' ? 'active' : ''}" data-view="">Todos</button>
            <button class="filter-chip ${filters.view === 'created' ? 'active' : ''}" data-view="created">Criados por mim</button>
            <button class="filter-chip ${filters.view === 'received' ? 'active' : ''}" data-view="received">Recebidos</button>
          </div>

          <!-- Seletor de Visualização (Desktop Only) -->
          <div class="view-mode-selector" style="display:flex; background:var(--bg-app); border:1px solid var(--border); padding:4px; border-radius:8px; gap:4px;">
            <button class="btn btn-sm" id="viewModeListBtn" style="padding: 6px 12px; font-size: 0.8rem; font-weight:600; display:inline-flex; align-items:center; gap:6px; border:none; border-radius: 6px; cursor:pointer; background: ${viewMode === 'list' ? 'var(--primary)' : 'transparent'}; color: ${viewMode === 'list' ? 'white' : 'var(--text-secondary)'};">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
              Lista
            </button>
            <button class="btn btn-sm" id="viewModeKanbanBtn" style="padding: 6px 12px; font-size: 0.8rem; font-weight:600; display:inline-flex; align-items:center; gap:6px; border:none; border-radius: 6px; cursor:pointer; background: ${viewMode === 'kanban' ? 'var(--primary)' : 'transparent'}; color: ${viewMode === 'kanban' ? 'white' : 'var(--text-secondary)'};">
              <svg width="14" height="14" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4h6v6H4V4zm10 0h6v6h-6V4zM4 14h6v6H4v-6zm10 0h6v6h-6v-6z"/></svg>
              Kanban
            </button>
          </div>
        </div>

        <!-- TICKETS LIST -->
        <div id="ticketsList">
          ${loadingTickets ? '<div class="spinner"></div>' : renderTicketsList()}
        </div>
      </main>

      <!-- FAB Mobile -->
      <button class="fab" id="fabNewTicket" title="Abrir Chamado" style="background:#059669;">＋</button>

      <!-- Modal de detalhes -->
      <div id="ticketModal"></div>
    `;

    bindLayoutEvents(profile);
    bindPageEvents();
  }

  function renderTicketsList() {
    if (tickets.length === 0) {
      return `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M9 12h6M12 9v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
          </svg>
          <h3>Nenhum chamado encontrado</h3>
          <p>Crie um novo chamado para começar.</p>
        </div>
      `;
    }

    // Se estiver no mobile, força a visualização em lista
    const isMobile = window.innerWidth <= 900;
    const activeView = isMobile ? 'list' : viewMode;

    if (activeView === 'kanban') {
      const openTickets = tickets.filter(t => t.status === 'open');
      const inProgressTickets = tickets.filter(t => t.status === 'in_progress');
      const resolvedTickets = tickets.filter(t => t.status === 'resolved');

      return `
        <div class="kanban-board">
          <!-- Coluna Aberto -->
          <div class="kanban-column">
            <div class="kanban-column-header">
              <div class="kanban-column-title" style="color:var(--text-primary);">
                <span style="width:8px;height:8px;border-radius:50%;background:#3b82f6;"></span>
                Aberto
              </div>
              <span class="kanban-column-badge">${openTickets.length}</span>
            </div>
            <div class="kanban-cards">
              ${openTickets.map(t => renderKanbanCard(t)).join('')}
            </div>
          </div>

          <!-- Coluna Em Andamento -->
          <div class="kanban-column">
            <div class="kanban-column-header">
              <div class="kanban-column-title" style="color:#d97706;">
                <span style="width:8px;height:8px;border-radius:50%;background:#f59e0b;"></span>
                Em Andamento
              </div>
              <span class="kanban-column-badge">${inProgressTickets.length}</span>
            </div>
            <div class="kanban-cards">
              ${inProgressTickets.map(t => renderKanbanCard(t)).join('')}
            </div>
          </div>

          <!-- Coluna Resolvido -->
          <div class="kanban-column">
            <div class="kanban-column-header">
              <div class="kanban-column-title" style="color:#059669;">
                <span style="width:8px;height:8px;border-radius:50%;background:#10b981;"></span>
                Resolvido
              </div>
              <span class="kanban-column-badge">${resolvedTickets.length}</span>
            </div>
            <div class="kanban-cards">
              ${resolvedTickets.map(t => renderKanbanCard(t)).join('')}
            </div>
          </div>
        </div>
      `;
    }

    return `
      <div class="tickets-table-container">
        <table class="tickets-table">
          <thead>
            <tr>
              <th style="width: 32%;">Assunto</th>
              <th style="width: 23%;">Origem</th>
              <th style="width: 17%;">Destino</th>
              <th style="width: 13%;">Data Abertura</th>
              <th style="width: 8%; text-align:center;">Prioridade</th>
              <th style="width: 7%; text-align:center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tickets.map(t => renderTableRow(t)).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderKanbanCard(t) {
    return `
      <div class="card card-clickable ticket-card" data-ticket-id="${t.id}">
        <div class="ticket-card-header">
          <span class="ticket-card-title"><span style="color:var(--text-muted);font-weight:normal;margin-right:4px;">#${t.ticket_number || ''}</span>${escapeHtml(t.title)}</span>
          <span class="badge badge-${t.priority}">${PRIORITY_LABELS[t.priority]}</span>
        </div>
        <div class="ticket-card-flow">
          <span style="font-weight: 500;">${escapeHtml(t.creator?.full_name || '—')}</span>
          <span class="arrow">→</span>
          <span style="font-weight: 500;">${escapeHtml(t.destination?.name || 'Colaborador(es)')}</span>
        </div>
        <div class="ticket-card-footer">
          <span class="ticket-card-date">${formatDate(t.created_at)}</span>
          <span class="badge badge-${t.status}">${STATUS_LABELS[t.status]}</span>
        </div>
      </div>
    `;
  }

  function renderTableRow(t) {
    const originDeptName = t.creator?.department?.name || 'Diretoria';
    const dateOnly = t.created_at ? new Date(t.created_at).toLocaleDateString('pt-BR') : '—';
    const statusLabel = t.status === 'open' ? 'Pendente' : STATUS_LABELS[t.status];

    return `
      <tr class="clickable-row" data-ticket-id="${t.id}">
        <td>
          <div style="display:flex; flex-direction:column; gap:4px;">
            <strong style="font-size:0.92rem; color:var(--text-primary);">Nº: ${t.ticket_number || ''}</strong>
            <span style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase; font-weight:600; letter-spacing:0.3px;">${escapeHtml(t.title)}</span>
          </div>
        </td>
        <td>
          <div style="display:flex; flex-direction:column; gap:3px;">
            <span style="font-weight:700; color:var(--text-secondary); font-size:0.88rem;">${escapeHtml(originDeptName)}</span>
            <span style="font-size:0.82rem; color:var(--text-muted);">${escapeHtml(t.creator?.full_name || '—')}</span>
          </div>
        </td>
        <td>
          <span style="font-weight:600; color:var(--text-secondary); font-size:0.88rem;">${escapeHtml(t.destination?.name || 'Colaborador(es)')}</span>
        </td>
        <td>
          <span style="color:var(--text-secondary); font-size:0.88rem; font-weight:500;">${dateOnly}</span>
        </td>
        <td style="text-align:center;">
          <span class="badge badge-${t.priority}" style="min-width:80px; padding:6px 12px; font-size:0.82rem; border-radius:10px; display:inline-block;">${PRIORITY_LABELS[t.priority]}</span>
        </td>
        <td style="text-align:center;">
          <span class="badge badge-${t.status}" style="min-width:95px; padding:6px 12px; font-size:0.82rem; display:inline-block;">${statusLabel}</span>
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

    document.getElementById('filterPriority')?.addEventListener('change', (e) => {
      filters.priority = e.target.value;
      loadTickets();
    });

    document.querySelectorAll('[data-view]').forEach(chip => {
      chip.addEventListener('click', () => {
        filters.view = chip.dataset.view;
        loadTickets();
      });
    });

    // Seletor de visualização (Lista / Kanban)
    document.getElementById('viewModeListBtn')?.addEventListener('click', () => {
      viewMode = 'list';
      renderPage();
    });

    document.getElementById('viewModeKanbanBtn')?.addEventListener('click', () => {
      viewMode = 'kanban';
      renderPage();
    });

    // Clique no card do ticket
    document.querySelectorAll('[data-ticket-id]').forEach(card => {
      card.addEventListener('click', () => openTicketDetail(card.dataset.ticketId));
    });

    // Setup department
    document.getElementById('setupDeptBtn')?.addEventListener('click', () => {
      navigateTo('/login');
      showToast('Faça login novamente para atualizar seus dados', 'info');
    });
  }

  async function openTicketDetail(ticketId) {
    const modalContainer = document.getElementById('ticketModal');
    if (!modalContainer) return;

    try {
      const ticket = await fetchTicketDetail(ticketId);
      const canChangeStatus =
        ticket.created_by === profile.id ||
        profile.role === 'director' ||
        ticket.involved_user_ids?.includes(profile.id);

      // Carrega mensagens e custos iniciais
      const [messages, costs, allDepts] = await Promise.all([
        fetchTicketMessages(ticketId),
        fetchTicketCosts(ticketId),
        fetchDepartments()
      ]);

      modalContainer.innerHTML = `
        <div class="modal-overlay" id="modalOverlay" style="position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.4);backdrop-filter:blur(4px);display:flex;align-items:center;justify-content:center;z-index:1000;">
          <div class="modal-content" style="background:var(--bg-card);border-radius:16px;width:95%;max-width:1100px;max-height:90vh;overflow-y:auto;box-shadow:var(--shadow-lg);display:flex;flex-direction:column;padding:24px;border:1px solid var(--border);">
            
            <!-- HEADER DO MODAL -->
            <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:16px;margin-bottom:20px;flex-wrap:wrap;gap:16px;">
              <div>
                <h2 style="margin:0;font-size:1.4rem;color:var(--text-primary);">Chamado Nº: ${ticket.ticket_number || ticket.id.slice(0, 8).toUpperCase()}</h2>
              </div>
              <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
                ${canChangeStatus ? `
                  <button class="btn btn-sm" id="btnEncaminhar" style="background:#f59e0b;color:white;font-weight:600;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;">Encaminhar</button>
                  ${ticket.status === 'open' ? `
                    <button class="btn btn-sm" id="btnStartService" style="background:#3b82f6;color:white;font-weight:600;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;">Iniciar Atendimento</button>
                  ` : ''}
                  ${ticket.status !== 'resolved' ? `
                    <button class="btn btn-sm" id="btnFinishTicket" style="background:#059669;color:white;font-weight:600;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;">Finalizar Chamado</button>
                  ` : ''}
                ` : ''}
                <button class="modal-close" id="closeModal" style="background:transparent;border:none;font-size:1.4rem;cursor:pointer;color:var(--text-muted);padding:4px 8px;">✕</button>
              </div>
            </div>

            <!-- CORPO DO MODAL (DUAS COLUNAS) -->
            <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:32px;flex:1;min-height:0;flex-wrap:wrap;" class="modal-grid-layout">
              
              <!-- COLUNA ESQUERDA (INFORMAÇÕES E CUSTOS) -->
              <div style="display:flex;flex-direction:column;gap:18px;">
                
                <!-- Formulário de Encaminhamento Rápido (Colapsado por padrão) -->
                <div id="forwardForm" style="display:none;flex-direction:column;gap:10px;padding:16px;border:1px solid var(--border);border-radius:10px;background:var(--bg-app);margin-bottom:10px;">
                  <label style="font-size:0.85rem;font-weight:600;color:var(--text-primary);">Selecione o Grupo de Destino</label>
                  <select id="forwardDeptSelect" class="select" style="font-size:0.88rem;padding:8px 12px;background:var(--bg-card);">
                    <option value="">Selecione um grupo...</option>
                    ${allDepts.map(d => `<option value="${d.id}">${d.name}</option>`).join('')}
                  </select>
                  <div style="display:flex;gap:10px;margin-top:4px;">
                    <button class="btn btn-sm btn-primary" id="saveForwardBtn">Salvar</button>
                    <button class="btn btn-sm btn-secondary" id="cancelForwardBtn">Cancelar</button>
                  </div>
                </div>

                <div>
                  <h3 style="margin:0 0 12px 0;font-size:1.2rem;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(ticket.title)}</h3>
                  
                  <div style="display:grid;grid-template-columns:1fr 1fr;gap:14px;font-size:0.88rem;">
                    <div>
                      <span style="color:var(--text-muted);display:block;margin-bottom:2px;">Origem</span>
                      <strong style="color:var(--text-primary);">${escapeHtml(ticket.creator?.full_name || '—')}</strong>
                    </div>
                    <div>
                      <span style="color:var(--text-muted);display:block;margin-bottom:2px;">Data de Abertura</span>
                      <strong style="color:var(--text-primary);">${formatDate(ticket.created_at)}</strong>
                    </div>
                    <div>
                      <span style="color:var(--text-muted);display:block;margin-bottom:2px;">Destino</span>
                      <strong style="color:var(--text-primary);">${escapeHtml(ticket.destination?.name || 'Colaborador(es)')}</strong>
                    </div>
                    <div>
                      <span style="color:var(--text-muted);display:block;margin-bottom:2px;">Data de Encerramento</span>
                      <strong style="color:var(--text-primary);">${ticket.status === 'resolved' ? formatDate(ticket.updated_at) : '—'}</strong>
                    </div>
                  </div>

                  <div style="display:flex;gap:16px;margin-top:16px;flex-wrap:wrap;">
                    <div style="display:flex;align-items:center;gap:6px;">
                      <span style="color:var(--text-muted);font-size:0.88rem;">Status:</span>
                      <span class="badge badge-${ticket.status}">${STATUS_LABELS[ticket.status]}</span>
                    </div>
                    <div style="display:flex;align-items:center;gap:6px;">
                      <span style="color:var(--text-muted);font-size:0.88rem;">Prioridade:</span>
                      <span class="badge badge-${ticket.priority}">${PRIORITY_LABELS[ticket.priority]}</span>
                    </div>
                  </div>
                </div>

                <hr style="border:none;border-top:1px solid var(--border);margin:4px 0;" />

                <!-- Descrição -->
                <div>
                  <h4 style="margin:0 0 6px 0;font-size:0.95rem;color:var(--text-secondary);">Descrição do Problema:</h4>
                  <p style="margin:0;font-size:0.9rem;color:var(--text-primary);background:var(--bg-app);padding:14px;border-radius:10px;border:1px solid var(--border);white-space:pre-wrap;line-height:1.5;">${escapeHtml(ticket.description || 'Nenhuma descrição detalhada fornecida.')}</p>
                </div>

                <hr style="border:none;border-top:1px solid var(--border);margin:4px 0;" />

                <!-- Custos Externos -->
                <div>
                  <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:10px;">
                    <h4 style="margin:0;font-size:0.95rem;color:var(--text-secondary);">Custos Externos</h4>
                    <button class="btn btn-sm btn-primary" id="addCostBtn" style="padding:6px 12px;font-size:0.8rem;font-weight:600;display:flex;align-items:center;gap:6px;">
                      ＋ Inserir Custo
                    </button>
                  </div>

                  <!-- Formulário de inserção inline de custo (oculto por padrão) -->
                  <div id="costInputForm" style="display:none;flex-direction:column;gap:10px;padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--bg-app);margin-bottom:12px;">
                    <input type="text" id="costDesc" class="input" placeholder="Descrição do custo..." style="font-size:0.85rem;padding:8px 10px;background:var(--bg-card);" />
                    <div style="display:flex;gap:10px;">
                      <input type="number" step="0.01" id="costVal" class="input" placeholder="Valor (R$)" style="font-size:0.85rem;padding:8px 10px;background:var(--bg-card);flex:1;" />
                      <button class="btn btn-sm btn-primary" id="saveCostBtn" style="font-size:0.8rem;padding:6px 12px;">Salvar</button>
                      <button class="btn btn-sm btn-secondary" id="cancelCostBtn" style="font-size:0.8rem;padding:6px 12px;">Cancelar</button>
                    </div>
                  </div>

                  <div id="ticketCostsList" style="max-height:150px;overflow-y:auto;padding-right:4px;">
                    <!-- Populado dinamicamente -->
                  </div>

                  <div id="ticketCostsTotal" style="margin-top:10px;font-size:1.05rem;color:var(--text-primary);text-align:left;border-top:1px solid var(--border);padding-top:10px;">
                    Total: <strong>R$ 0,00</strong>
                  </div>
                </div>

              </div>

              <!-- COLUNA DIREITA (CHAT DE MENSAGENS) -->
              <div style="display:flex;flex-direction:column;gap:14px;border-left:1px solid var(--border);padding-left:24px;" class="modal-chat-column">
                <h4 style="margin:0;font-size:1.05rem;color:var(--text-primary);display:flex;align-items:center;justify-content:space-between;">
                  Mensagens
                  <button class="btn btn-sm btn-secondary" id="btnRefreshChat" style="padding:4px 8px;font-size:0.75rem;border:none;border-radius:4px;cursor:pointer;">🔄 Atualizar</button>
                </h4>
                
                <div id="ticketChatHistory" style="display:flex;flex-direction:column;gap:12px;max-height:360px;overflow-y:auto;padding-right:6px;min-height:260px;flex:1;">
                  <!-- Populado dinamicamente -->
                </div>
                
                <div style="display:flex;gap:10px;align-items:flex-end;margin-top:10px;">
                  <textarea id="chatInputMessage" class="input" placeholder="Digite uma mensagem..." rows="2" style="resize:none;font-size:0.88rem;flex:1;padding:8px 12px;border-radius:8px;background:var(--bg-card);"></textarea>
                  <button id="sendChatMsgBtn" style="background:#059669;color:white;border:none;width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background 0.2s;box-shadow:var(--shadow-sm);" title="Enviar Mensagem">
                    <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      `;

      // Seletor de layout responsivo CSS adicional para o grid
      const styleSheet = document.createElement("style");
      styleSheet.innerText = `
        @media (max-width: 768px) {
          .modal-grid-layout {
            grid-template-columns: 1fr !important;
            gap: 24px !important;
          }
          .modal-chat-column {
            border-left: none !important;
            padding-left: 0 !important;
            border-top: 1px solid var(--border) !important;
            padding-top: 20px !important;
          }
        }
      `;
      document.head.appendChild(styleSheet);

      // Renderização inicial de mensagens e custos
      renderCosts(costs);
      renderMessages(messages);

      // Ouvinte para fechar o modal
      document.getElementById('closeModal')?.addEventListener('click', () => {
        modalContainer.innerHTML = '';
        loadTickets(); // Atualiza a dashboard
      });
      document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlay') {
          modalContainer.innerHTML = '';
          loadTickets();
        }
      });

      // Ouvintes dos botões de status superiores
      document.getElementById('btnStartService')?.addEventListener('click', async () => {
        try {
          await updateTicketStatus(ticketId, 'in_progress');
          showToast('Atendimento iniciado!', 'success');
          openTicketDetail(ticketId); // Reabre para atualizar status/botões
        } catch (err) {
          console.error(err);
          showToast('Erro ao iniciar atendimento', 'error');
        }
      });

      document.getElementById('btnFinishTicket')?.addEventListener('click', async () => {
        try {
          await updateTicketStatus(ticketId, 'resolved');
          showToast('Chamado finalizado!', 'success');
          openTicketDetail(ticketId);
        } catch (err) {
          console.error(err);
          showToast('Erro ao finalizar chamado', 'error');
        }
      });

      // Fluxo colapsável do Encaminhar
      const forwardForm = document.getElementById('forwardForm');
      document.getElementById('btnEncaminhar')?.addEventListener('click', () => {
        if (forwardForm) forwardForm.style.display = forwardForm.style.display === 'none' ? 'flex' : 'none';
      });

      document.getElementById('cancelForwardBtn')?.addEventListener('click', () => {
        if (forwardForm) forwardForm.style.display = 'none';
      });

      document.getElementById('saveForwardBtn')?.addEventListener('click', async () => {
        const deptId = document.getElementById('forwardDeptSelect')?.value;
        if (!deptId) {
          showToast('Selecione um grupo de destino', 'error');
          return;
        }
        try {
          await forwardTicket(ticketId, deptId);
          showToast('Chamado encaminhado com sucesso!', 'success');
          openTicketDetail(ticketId);
        } catch (err) {
          console.error(err);
          showToast('Erro ao encaminhar chamado', 'error');
        }
      });

      // Fluxo colapsável do Inserir Custo
      const costInputForm = document.getElementById('costInputForm');
      const addCostBtn = document.getElementById('addCostBtn');

      addCostBtn?.addEventListener('click', () => {
        if (costInputForm) {
          costInputForm.style.display = 'flex';
          addCostBtn.style.display = 'none';
        }
      });

      document.getElementById('cancelCostBtn')?.addEventListener('click', () => {
        if (costInputForm) {
          costInputForm.style.display = 'none';
          if (addCostBtn) addCostBtn.style.display = 'flex';
          document.getElementById('costDesc').value = '';
          document.getElementById('costVal').value = '';
        }
      });

      document.getElementById('saveCostBtn')?.addEventListener('click', async () => {
        const desc = document.getElementById('costDesc')?.value.trim();
        const valStr = document.getElementById('costVal')?.value;

        if (!desc || !valStr) {
          showToast('Preencha a descrição e o valor', 'error');
          return;
        }

        const val = parseFloat(valStr);
        if (isNaN(val) || val <= 0) {
          showToast('Valor de custo inválido', 'error');
          return;
        }

        try {
          await addTicketCost(ticketId, desc, val);
          showToast('Custo adicionado com sucesso!', 'success');
          
          // Oculta form e atualiza custos
          if (costInputForm) costInputForm.style.display = 'none';
          if (addCostBtn) addCostBtn.style.display = 'flex';
          document.getElementById('costDesc').value = '';
          document.getElementById('costVal').value = '';
          
          const updatedCosts = await fetchTicketCosts(ticketId);
          renderCosts(updatedCosts);
        } catch (err) {
          console.error(err);
          showToast('Erro ao adicionar custo', 'error');
        }
      });

      // Ouvinte para Enviar Mensagem no Chat
      const chatInput = document.getElementById('chatInputMessage');
      const sendMsgBtn = document.getElementById('sendChatMsgBtn');

      const performSend = async () => {
        const text = chatInput?.value.trim();
        if (!text) return;

        try {
          chatInput.value = ''; // Limpa rápido
          await sendTicketMessage(ticketId, text);
          const updatedMessages = await fetchTicketMessages(ticketId);
          renderMessages(updatedMessages);
        } catch (err) {
          console.error(err);
          showToast('Erro ao enviar mensagem', 'error');
        }
      };

      sendMsgBtn?.addEventListener('click', performSend);
      chatInput?.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
          e.preventDefault();
          performSend();
        }
      });

      // Ouvinte para Atualizar Chat
      document.getElementById('btnRefreshChat')?.addEventListener('click', async () => {
        const updatedMessages = await fetchTicketMessages(ticketId);
        renderMessages(updatedMessages);
        showToast('Chat atualizado!', 'success');
      });

      // Sub-funções de renderização de listas internas
      function renderCosts(costsList) {
        const costsListContainer = document.getElementById('ticketCostsList');
        const costsTotalContainer = document.getElementById('ticketCostsTotal');
        if (costsListContainer && costsTotalContainer) {
          let total = 0;
          costsListContainer.innerHTML = costsList.map(c => {
            const amountVal = parseFloat(c.amount);
            total += amountVal;
            return `
              <div style="display:flex;justify-content:space-between;font-size:0.88rem;padding:8px 0;border-bottom:1px dashed var(--border);align-items:center;">
                <span style="color:var(--text-primary);font-weight:500;">${escapeHtml(c.description)}</span>
                <span style="font-weight:600;color:var(--text-secondary);">R$ ${amountVal.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
              </div>
            `;
          }).join('') || '<p style="color:var(--text-muted);font-size:0.85rem;margin-top:6px;">Nenhum custo externo registrado.</p>';

          costsTotalContainer.innerHTML = `Total: <strong style="font-size:1.15rem;color:var(--primary);margin-left:4px;">R$ ${total.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>`;
        }
      }

      function renderMessages(messagesList) {
        const chatContainer = document.getElementById('ticketChatHistory');
        if (chatContainer) {
          chatContainer.innerHTML = messagesList.map(m => `
            <div style="border:1px solid var(--border);border-radius:10px;padding:12px;background:var(--bg-app);font-size:0.88rem;color:var(--text-primary);box-shadow:var(--shadow-xs);display:flex;flex-direction:column;gap:4px;">
              <div style="font-weight:700;font-size:0.8rem;color:var(--text-secondary);display:flex;justify-content:space-between;border-bottom:1px solid var(--border);padding-bottom:4px;margin-bottom:2px;">
                <span>${escapeHtml(m.sender?.full_name || 'Desconhecido')}</span>
                <span style="color:var(--text-muted);font-weight:normal;font-size:0.75rem;">${formatDate(m.created_at)}</span>
              </div>
              <div style="white-space:pre-wrap;line-height:1.4;margin-top:2px;">${escapeHtml(m.content)}</div>
            </div>
          `).join('') || '<p style="color:var(--text-muted);font-size:0.85rem;text-align:center;margin-top:40px;">Escreva uma mensagem para iniciar o chat.</p>';
          
          chatContainer.scrollTop = chatContainer.scrollHeight;
        }
      }

    } catch (err) {
      console.error(err);
      showToast('Erro ao carregar detalhes', 'error');
    }
  }

  await loadTickets();
}

function escapeHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function formatDate(dateStr) {
  if (!dateStr) return '—';
  const d = new Date(dateStr);
  return d.toLocaleDateString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}
