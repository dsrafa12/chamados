/**
 * Dashboard — Lista de Chamados com filtros e Sidebar
 */
import { getCurrentProfile } from '../lib/auth.js';
import { fetchTickets, updateTicketStatus, fetchTicketDetail } from '../lib/api.js';
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

  async function loadTickets() {
    loadingTickets = true;
    renderPage();
    try {
      tickets = await fetchTickets({
        ...filters,
        myDepartmentId: profile.department_id,
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
    const needsSetup = !profile.department_id;

    mainContent.innerHTML = `
      <main class="page">
        ${needsSetup ? `
          <div class="setup-banner">
            <p>⚠️ Você ainda não selecionou seu setor. Configure para poder abrir e visualizar chamados.</p>
            <button class="btn btn-sm btn-primary" id="setupDeptBtn">Configurar Setor</button>
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
            ${isSuperAdmin ? `
              <button class="btn btn-secondary btn-desktop-only" id="newDeptBtn" style="border-color:var(--primary);color:var(--primary);">
                + Novo Setor
              </button>
            ` : ''}
            <button class="btn btn-primary btn-desktop-only" id="newTicketBtn">
              <svg width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>
              Abrir Chamado
            </button>
          </div>
        </div>

        <!-- FILTERS -->
        <div class="filter-bar">
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

        <!-- TICKETS LIST -->
        <div id="ticketsList">
          ${loadingTickets ? '<div class="spinner"></div>' : renderTicketsList()}
        </div>
      </main>

      <!-- FAB Mobile -->
      <button class="fab" id="fabNewTicket" title="Abrir Chamado">＋</button>

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

    return `
      <div class="tickets-grid">
        ${tickets.map(t => `
          <div class="card card-clickable ticket-card" data-ticket-id="${t.id}">
            <div class="ticket-card-header">
              <span class="ticket-card-title">${escapeHtml(t.title)}</span>
              <span class="badge badge-${t.priority}">${PRIORITY_LABELS[t.priority]}</span>
            </div>
            <div class="ticket-card-flow">
              <span>${t.origin?.name || '—'}</span>
              <span class="arrow">→</span>
              <span>${t.destination?.name || '—'}</span>
            </div>
            <div class="ticket-card-footer">
              <span class="ticket-card-date">${formatDate(t.created_at)}</span>
              <span class="badge badge-${t.status}">${STATUS_LABELS[t.status]}</span>
            </div>
          </div>
        `).join('')}
      </div>
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
        ticket.destination_department_id === profile.department_id ||
        ticket.created_by === profile.id ||
        profile.role === 'director';

      modalContainer.innerHTML = `
        <div class="modal-overlay" id="modalOverlay">
          <div class="modal-content">
            <div class="modal-header">
              <h2>Detalhes do Chamado</h2>
              <button class="modal-close" id="closeModal">✕</button>
            </div>
            <div class="modal-body">
              <h3 style="margin-bottom: 4px;">${escapeHtml(ticket.title)}</h3>

              <div class="modal-detail-row">
                <span class="modal-detail-label">Criado por</span>
                <span class="modal-detail-value">${ticket.creator?.full_name || '—'}</span>
              </div>
              <div class="modal-detail-row">
                <span class="modal-detail-label">Setor Origem</span>
                <span class="modal-detail-value">${ticket.origin?.name || '—'}</span>
              </div>
              <div class="modal-detail-row">
                <span class="modal-detail-label">Setor Destino</span>
                <span class="modal-detail-value">${ticket.destination?.name || '—'}</span>
              </div>
              <div class="modal-detail-row">
                <span class="modal-detail-label">Prioridade</span>
                <span class="badge badge-${ticket.priority}">${PRIORITY_LABELS[ticket.priority]}</span>
              </div>
              <div class="modal-detail-row">
                <span class="modal-detail-label">Status</span>
                ${canChangeStatus ? `
                  <select class="select" id="statusSelect" style="width:auto;min-width:140px">
                    <option value="open" ${ticket.status === 'open' ? 'selected' : ''}>Aberto</option>
                    <option value="in_progress" ${ticket.status === 'in_progress' ? 'selected' : ''}>Em Andamento</option>
                    <option value="resolved" ${ticket.status === 'resolved' ? 'selected' : ''}>Resolvido</option>
                  </select>
                ` : `
                  <span class="badge badge-${ticket.status}">${STATUS_LABELS[ticket.status]}</span>
                `}
              </div>
              <div class="modal-detail-row">
                <span class="modal-detail-label">Data</span>
                <span class="modal-detail-value">${formatDate(ticket.created_at)}</span>
              </div>

              ${ticket.shared_visibility?.length > 0 ? `
                <div style="padding-top: 8px;">
                  <span class="modal-detail-label">Visibilidade Compartilhada</span>
                  <div style="display:flex;gap:6px;flex-wrap:wrap;margin-top:6px;">
                    ${ticket.shared_visibility.map(d => `<span class="badge badge-open">${d.name}</span>`).join('')}
                  </div>
                </div>
              ` : ''}

              ${ticket.description ? `
                <div style="padding-top: 8px;">
                  <span class="modal-detail-label">Descrição</span>
                  <p style="margin-top:6px;font-size:0.9rem;color:var(--text-primary);white-space:pre-wrap;">${escapeHtml(ticket.description)}</p>
                </div>
              ` : ''}
            </div>
          </div>
        </div>
      `;

      // Close modal
      document.getElementById('closeModal')?.addEventListener('click', () => {
        modalContainer.innerHTML = '';
      });
      document.getElementById('modalOverlay')?.addEventListener('click', (e) => {
        if (e.target.id === 'modalOverlay') modalContainer.innerHTML = '';
      });

      // Change status
      document.getElementById('statusSelect')?.addEventListener('change', async (e) => {
        try {
          await updateTicketStatus(ticket.id, e.target.value);
          showToast('Status atualizado!', 'success');
          modalContainer.innerHTML = '';
          loadTickets();
        } catch (err) {
          showToast('Erro ao atualizar status', 'error');
        }
      });
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
