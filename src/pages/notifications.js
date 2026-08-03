/**
 * Notifications — Central de Alertas e Notificações do Usuário (#/notifications)
 */
import { getCurrentProfile } from '../lib/auth.js';
import { 
  fetchNotifications, 
  markNotificationAsRead, 
  markAllNotificationsAsRead 
} from '../lib/api.js';
import { navigateTo } from '../lib/router.js';
import { showToast } from '../lib/toast.js';
import { getLayoutTemplate, bindLayoutEvents } from '../lib/layout.js';

export async function renderNotifications(container) {
  let profile = null;
  let notificationsList = [];
  let currentFilter = 'all'; // 'all' | 'unread'

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

  container.innerHTML = getLayoutTemplate(profile, 'notifications');
  const mainContent = document.getElementById('mainContent');
  bindLayoutEvents(profile);

  mainContent.innerHTML = `
    <main class="page" style="max-width:900px; margin:0 auto; padding-top:48px !important;">
      
      <!-- CABEÇALHO DA CENTRAL DE ALERTAS -->
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:16px;">
        <div>
          <h1 style="margin:0 0 4px 0; font-size:1.6rem; font-weight:800; color:var(--text-primary); display:flex; align-items:center; gap:10px;">
            🔔 Central de Alertas
          </h1>
          <p style="margin:0; font-size:0.92rem; color:var(--text-muted);">Acompanhe todas as atualizações, mensagens e mudanças de status dos seus chamados.</p>
        </div>

        <button id="markAllReadBtn" class="btn btn-secondary" style="font-weight:600; font-size:0.85rem; padding:8px 16px; display:inline-flex; align-items:center; gap:6px;">
          ✓ Marcar Todas como Lidas
        </button>
      </div>

      <!-- BARRA DE FILTROS -->
      <div style="display:flex; gap:10px; margin-bottom:20px;">
        <button id="filterAllBtn" class="btn btn-sm ${currentFilter === 'all' ? 'btn-primary' : 'btn-secondary'}" style="padding:6px 16px; font-weight:600; border-radius:20px;">
          Todas
        </button>
        <button id="filterUnreadBtn" class="btn btn-sm ${currentFilter === 'unread' ? 'btn-primary' : 'btn-secondary'}" style="padding:6px 16px; font-weight:600; border-radius:20px;">
          Não Lidas
        </button>
      </div>

      <!-- LISTA DE ALERTAS -->
      <div id="notificationsContainer" style="display:flex; flex-direction:column; gap:12px;">
        <div style="padding:40px; text-align:center; color:var(--text-muted);">
          <div class="loading-spinner" style="margin:0 auto 16px; border:4px solid var(--border); border-top:4px solid var(--primary); border-radius:50%; width:32px; height:32px; animation:spin 1s linear infinite;"></div>
          Carregando seus alertas...
        </div>
      </div>

    </main>
  `;

  let currentPage = 1;
  const itemsPerPage = 10;

  async function loadData() {
    const listContainer = document.getElementById('notificationsContainer');
    if (!listContainer) return;

    try {
      notificationsList = await fetchNotifications(currentFilter === 'unread');
      currentPage = 1;
      renderList();
    } catch (err) {
      console.error(err);
      listContainer.innerHTML = `
        <div style="padding:20px; background:#fee2e2; color:#991b1b; border-radius:12px; font-size:0.9rem;">
          Erro ao carregar alertas.
        </div>
      `;
    }
  }

  function renderList() {
    const listContainer = document.getElementById('notificationsContainer');
    if (!listContainer) return;

    if (!notificationsList || notificationsList.length === 0) {
      listContainer.innerHTML = `
        <div style="background:var(--bg-card); padding:48px 24px; border-radius:16px; border:1px solid var(--border); text-align:center; box-shadow:var(--shadow-sm);">
          <div style="font-size:2.5rem; margin-bottom:12px;">🔕</div>
          <h3 style="margin:0 0 6px 0; font-size:1.1rem; color:var(--text-primary); font-weight:700;">Nenhum alerta ${currentFilter === 'unread' ? 'não lido' : ''}</h3>
          <p style="margin:0; font-size:0.88rem; color:var(--text-muted);">Você está em dia com todas as novidades dos seus chamados!</p>
        </div>
      `;
      return;
    }

    const totalItems = notificationsList.length;
    const totalPages = Math.ceil(totalItems / itemsPerPage);

    if (currentPage > totalPages) currentPage = totalPages || 1;
    if (currentPage < 1) currentPage = 1;

    const paginatedNotifications = notificationsList.slice(
      (currentPage - 1) * itemsPerPage,
      currentPage * itemsPerPage
    );

    const itemsHtml = paginatedNotifications.map(n => {
      const isUnread = !n.is_read;
      const createdDate = new Date(n.created_at).toLocaleString('pt-BR');
      const ticketNumber = n.ticket?.ticket_number || '';
      
      // Ícone e estilo com base no tipo
      let icon = '🔔';
      let typeBg = 'var(--primary-light)';
      if (n.type === 'chat_message') {
        icon = '💬';
        typeBg = '#e0f2fe';
      } else if (n.type === 'status_change') {
        icon = '🔄';
        typeBg = '#fef3c7';
      } else if (n.type === 'ticket_resolved') {
        icon = '✅';
        typeBg = '#dcfce7';
      } else if (n.type === 'collaborator_added') {
        icon = '👤';
        typeBg = '#fae8ff';
      }

      // Traduzir chaves de status legados se houver
      let cleanMessage = n.message
        .replace(/\*\*overdue\*\*/g, '**Atrasado**')
        .replace(/\*\*open\*\*/g, '**Aberto**')
        .replace(/\*\*in_progress\*\*/g, '**Em Andamento**')
        .replace(/\*\*awaiting_start\*\*/g, '**Gerado Processo de Compra**')
        .replace(/\*\*in_analysis\*\*/g, '**Em Análise**')
        .replace(/\*\*awaiting_info\*\*/g, '**Aguardando Informações**')
        .replace(/\*\*in_quotation\*\*/g, '**Em Cotação**')
        .replace(/\*\*in_approval\*\*/g, '**Em Aprovação**')
        .replace(/\*\*order_issued\*\*/g, '**Pedido Emitido**')
        .replace(/\*\*awaiting_supplier\*\*/g, '**Aguardando Fornecedor**')
        .replace(/\*\*awaiting_receipt\*\*/g, '**Aguardando Recebimento**')
        .replace(/\*\*received_partial\*\*/g, '**Recebido Parcial**')
        .replace(/\*\*resolved\*\*/g, '**Resolvido**')
        .replace(/\*\*finalized\*\*/g, '**Finalizado**')
        .replace(/\*\*cancelled\*\*/g, '**Cancelado**')
        .replace(/\*\*reopened\*\*/g, '**Reaberto**');

      // Formatar Markdown simples da mensagem (ex: **Atrasado**)
      const formattedMessage = cleanMessage.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');

      return `
        <div class="notification-item ${isUnread ? 'unread' : ''}" data-id="${n.id}" data-ticket-id="${n.ticket_id}" style="background:var(--bg-card); padding:16px 20px; border-radius:14px; border:1px solid ${isUnread ? 'var(--primary)' : 'var(--border)'}; display:flex; align-items:flex-start; gap:16px; cursor:pointer; transition:all 0.2s; position:relative; box-shadow:${isUnread ? 'var(--shadow-md)' : 'var(--shadow-xs)'};">
          
          <div style="width:40px; height:40px; border-radius:12px; background:${typeBg}; display:flex; align-items:center; justify-content:center; font-size:1.2rem; flex-shrink:0;">
            ${icon}
          </div>

          <div style="flex:1; overflow:hidden;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:4px; flex-wrap:wrap; gap:8px;">
              <span style="font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.4px;">
                ${n.title} • Chamado Nº ${ticketNumber}
              </span>
              <span style="font-size:0.75rem; color:var(--text-muted);">${createdDate}</span>
            </div>

            <div style="font-size:0.92rem; color:var(--text-primary); line-height:1.4; font-weight:${isUnread ? '600' : '400'};">
              ${formattedMessage}
            </div>
          </div>

          ${isUnread ? `
            <span style="width:10px; height:10px; background:#dc2626; border-radius:50%; flex-shrink:0; margin-top:6px;" title="Não lido"></span>
          ` : ''}

        </div>
      `;
    }).join('');

    const paginationControls = totalPages > 1 ? `
      <div style="display:flex; justify-content:space-between; align-items:center; margin-top:16px; padding:12px 16px; background:var(--bg-card); border-radius:12px; border:1px solid var(--border); flex-wrap:wrap; gap:12px;">
        <span style="font-size:0.85rem; color:var(--text-secondary);">
          Exibindo <strong>${(currentPage - 1) * itemsPerPage + 1}</strong> a <strong>${Math.min(currentPage * itemsPerPage, totalItems)}</strong> de <strong>${totalItems}</strong> alertas
        </span>
        <div style="display:flex; align-items:center; gap:8px;">
          <button id="notifPrevPageBtn" class="btn btn-sm btn-secondary" ${currentPage === 1 ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
            ◀️ Anterior
          </button>
          <span style="font-size:0.88rem; font-weight:700; color:var(--text-primary); padding:0 8px;">
            Página ${currentPage} de ${totalPages}
          </span>
          <button id="notifNextPageBtn" class="btn btn-sm btn-secondary" ${currentPage === totalPages ? 'disabled style="opacity:0.5; cursor:not-allowed;"' : ''}>
            Próximo ▶️
          </button>
        </div>
      </div>
    ` : '';

    listContainer.innerHTML = itemsHtml + paginationControls;

    // Registrar clique na notificação para marcar como lida e navegar para o chamado
    document.querySelectorAll('.notification-item').forEach(el => {
      el.addEventListener('click', async () => {
        const notifId = el.getAttribute('data-id');
        const ticketId = el.getAttribute('data-ticket-id');

        try {
          await markNotificationAsRead(notifId);
        } catch (err) {
          console.error(err);
        }

        navigateTo(`/ticket?id=${ticketId}`);
      });
    });

    // Eventos dos botões de paginação
    document.getElementById('notifPrevPageBtn')?.addEventListener('click', () => {
      if (currentPage > 1) {
        currentPage--;
        renderList();
      }
    });

    document.getElementById('notifNextPageBtn')?.addEventListener('click', () => {
      if (currentPage < totalPages) {
        currentPage++;
        renderList();
      }
    });
  }

  // Eventos de Filtro
  document.getElementById('filterAllBtn')?.addEventListener('click', () => {
    currentFilter = 'all';
    document.getElementById('filterAllBtn').className = 'btn btn-sm btn-primary';
    document.getElementById('filterUnreadBtn').className = 'btn btn-sm btn-secondary';
    loadData();
  });

  document.getElementById('filterUnreadBtn')?.addEventListener('click', () => {
    currentFilter = 'unread';
    document.getElementById('filterAllBtn').className = 'btn btn-sm btn-secondary';
    document.getElementById('filterUnreadBtn').className = 'btn btn-sm btn-primary';
    loadData();
  });

  // Marcar todas como lidas
  document.getElementById('markAllReadBtn')?.addEventListener('click', async () => {
    try {
      await markAllNotificationsAsRead();
      showToast('Todas as notificações foram marcadas como lidas!', 'success');
      await loadData();
      bindLayoutEvents(profile);
    } catch (err) {
      console.error(err);
      showToast('Erro ao marcar notificações como lidas.', 'error');
    }
  });

  await loadData();
}
