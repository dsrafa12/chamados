/**
 * Ticket Detail — Visualização do Chamado como Página Cheia
 */
import { getCurrentProfile, fetchAllProfiles } from '../lib/auth.js';
import { 
  fetchTicketDetail, 
  fetchTicketMessages, 
  fetchTicketCosts, 
  fetchDepartments, 
  fetchTicketHistory, 
  updateTicketStatus, 
  updateTicketDeadline, 
  addTicketCost, 
  sendTicketMessage, 
  addTicketCollaborators,
  fetchPurchaseProcessByTicket,
  createPurchaseProcess
} from '../lib/api.js';
import { navigateTo } from '../lib/router.js';
import { showToast } from '../lib/toast.js';
import { getLayoutTemplate, bindLayoutEvents } from '../lib/layout.js';

const PRIORITY_LABELS = { low: 'Baixa', medium: 'Média', high: 'Alta' };
const STATUS_LABELS = { 
  open: 'Aberto', 
  in_progress: 'Em Andamento', 
  resolved: 'Resolvido', 
  overdue: 'Atrasado',
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

export async function renderTicketDetail(container, queryString) {
  const params = new URLSearchParams(queryString || '');
  const ticketId = params.get('id');

  if (!ticketId) {
    navigateTo('/dashboard');
    return;
  }

  let profile = null;
  let ticket = null;
  let messages = [];
  let costs = [];
  let allDepts = [];
  let history = [];
  let allProfiles = [];
  let purchaseProcess = null;

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

  async function loadAllData() {
    try {
      ticket = await fetchTicketDetail(ticketId);
      const isMemberOfDestinationDept = profile.departments?.some(d => d.id === ticket.destination_department_id);
      const isMemberOfOriginDept = profile.departments?.some(d => d.id === ticket.origin_department_id);
      
      const canChangeStatus =
        ticket.created_by === profile.id ||
        profile.role === 'director' ||
        ticket.involved_user_ids?.includes(profile.id) ||
        isMemberOfDestinationDept ||
        isMemberOfOriginDept;

      if (!canChangeStatus && profile.role !== 'director') {
        // Se o usuário não tiver permissão para ver ou interagir, redireciona
      }

      [messages, costs, allDepts, history, allProfiles, purchaseProcess] = await Promise.all([
        fetchTicketMessages(ticketId),
        fetchTicketCosts(ticketId),
        fetchDepartments(),
        fetchTicketHistory(ticketId),
        fetchAllProfiles(),
        fetchPurchaseProcessByTicket(ticketId)
      ]);
    } catch (err) {
      console.error(err);
      showToast('Erro ao carregar detalhes do chamado', 'error');
      navigateTo('/dashboard');
    }
  }

  await loadAllData();
  renderPage();

  function renderPage() {
    // 1. Injeta layout base da sidebar
    container.innerHTML = getLayoutTemplate(profile, 'tickets');

    // 2. Injeta o conteúdo principal
    const mainContent = document.getElementById('mainContent');
    const isMemberOfDestinationDept = profile.departments?.some(d => d.id === ticket.destination_department_id);
    const isMemberOfOriginDept = profile.departments?.some(d => d.id === ticket.origin_department_id);
    const canChangeStatus =
      ticket.created_by === profile.id ||
      profile.role === 'director' ||
      ticket.involved_user_ids?.includes(profile.id) ||
      isMemberOfDestinationDept ||
      isMemberOfOriginDept;

    const isMemberOfCompras = profile.departments?.some(d => d.name?.toLowerCase() === 'compras') || profile.role === 'director';
    const showStandardButtons = !purchaseProcess && canChangeStatus;

    const isOverdue = ticket.deadline && new Date(ticket.deadline) < new Date();
    let statusClass = ticket.status;
    let statusLabel = STATUS_LABELS[ticket.status];
    
    if (ticket.status === 'open') {
      statusLabel = 'Pendente';
    } else if (ticket.status === 'overdue') {
      statusLabel = 'Atrasado';
    }
    
    if (ticket.status === 'in_progress' && isOverdue) {
      statusClass = 'in_progress_overdue';
      statusLabel = 'Em Atendimento (Atrasado)';
    }

    let detailBadgeStyle = '';
    let detailLabelHtml = escapeHtml(statusLabel);
    if (statusClass === 'in_progress_overdue') {
      detailBadgeStyle = 'font-size:0.72rem; line-height:1.15; padding:4px 8px; white-space:normal; text-align:center; display:inline-block; max-width:125px;';
      detailLabelHtml = `Em Atendimento<br>(Atrasado)`;
    } else if (statusClass === 'awaiting_start' || statusClass === 'in_analysis' || statusClass === 'awaiting_info' || statusClass === 'in_quotation' || statusClass === 'in_approval' || statusClass === 'order_issued' || statusClass === 'awaiting_supplier' || statusClass === 'awaiting_receipt' || statusClass === 'finalized' || statusClass === 'cancelled') {
      detailBadgeStyle = 'font-size:0.75rem; line-height:1.15; padding:4px 8px; white-space:normal; text-align:center; display:inline-block; max-width:125px;';
      detailLabelHtml = statusLabel;
    }

    mainContent.innerHTML = `
      <main class="page" style="max-width:1200px; margin: 0 auto; padding-top: 48px !important;">
        
        <!-- HEADER DA PÁGINA -->
        <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid var(--border);padding-bottom:16px;margin-bottom:20px;flex-wrap:wrap;gap:16px;">
          <div style="display:flex;align-items:center;gap:14px;">
            <button class="btn btn-secondary btn-sm" id="backBtn" style="padding:8px 12px;">
              <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M19 12H5M12 19l-7-7 7-7"/></svg>
              Voltar
            </button>
            <h2 style="margin:0;font-size:1.4rem;color:var(--text-primary);">Chamado Nº: ${ticket.ticket_number || ticket.id.slice(0, 8).toUpperCase()}</h2>
          </div>
          <div style="display:flex;gap:10px;align-items:center;flex-wrap:wrap;">
            ${canChangeStatus ? `
              <button class="btn btn-sm" id="btnCollaborators" style="background:#6366f1;color:white;font-weight:600;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;">Colaboradores</button>
            ` : ''}
            
            ${showStandardButtons ? `
              ${(ticket.status === 'open' || ticket.status === 'overdue') ? `
                <button class="btn btn-sm" id="btnStartService" style="background:#3b82f6;color:white;font-weight:600;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;">Iniciar Atendimento</button>
              ` : ''}
              ${ticket.status !== 'resolved' ? `
                <button class="btn btn-sm" id="btnFinishTicket" style="background:#059669;color:white;font-weight:600;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;">Finalizar Chamado</button>
              ` : ''}
            ` : ''}

            ${isMemberOfCompras ? `
              ${purchaseProcess ? `
                <button class="btn btn-sm" id="btnAccessPurchaseProcess" style="background:#0284c7;color:white;font-weight:600;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;">Acessar Processo de Compra</button>
              ` : `
                <button class="btn btn-sm" id="btnCreatePurchaseProcess" style="background:#0f766e;color:white;font-weight:600;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;">Criar Processo de Compra</button>
              `}
            ` : ''}
          </div>
        </div>

        <!-- GRID DE DUAS COLUNAS -->
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:32px;align-items:start;" class="ticket-detail-grid">
          
          <!-- COLUNA ESQUERDA (INFORMAÇÕES, CUSTOS E HISTÓRICO) -->
          <div style="display:flex;flex-direction:column;gap:20px;">
            
            <!-- Painel de Gerenciamento de Colaboradores (Colapsado por padrão) -->
            <div id="collaboratorsForm" style="display:none;flex-direction:column;gap:14px;padding:18px;border:1px solid var(--border);border-radius:12px;background:var(--bg-app);box-shadow:var(--shadow-sm);">
              <h4 style="margin:0;font-size:0.95rem;color:var(--text-primary);font-weight:700;">Colaboradores Atrelados</h4>
              <div style="display:flex;flex-wrap:wrap;gap:8px;" id="linkedCollaboratorsList">
                <!-- Badges -->
              </div>
              <hr style="border:none;border-top:1px solid var(--border);margin:2px 0;" />
              <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;margin-bottom:4px;">
                <label style="font-size:0.88rem;font-weight:700;color:var(--text-secondary);">Atrelar Mais Colaboradores</label>
                <input type="text" id="searchCollaboratorInput" class="input" placeholder="🔍 Buscar colaborador..." style="font-size:0.82rem;padding:6px 12px;background:var(--bg-card);border-radius:6px;border:1px solid var(--border);max-width:220px;" />
              </div>
              <div style="max-height:280px;overflow-y:auto;display:flex;flex-direction:column;gap:6px;padding:8px;border:1px solid var(--border);border-radius:8px;background:var(--bg-card);" id="availableCollaboratorsList">
                <!-- Checkboxes -->
              </div>
              <div style="display:flex;gap:10px;margin-top:4px;">
                <button class="btn btn-sm btn-primary" id="saveCollaboratorsBtn">Salvar Alterações</button>
                <button class="btn btn-sm btn-secondary" id="cancelCollaboratorsBtn">Cancelar</button>
              </div>
            </div>

            <!-- Dados Básicos -->
            <div class="card" style="padding:24px;">
              <h3 style="margin:0 0 16px 0;font-size:1.25rem;color:var(--primary);text-transform:uppercase;letter-spacing:0.5px;">${escapeHtml(ticket.title)}</h3>
              
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;font-size:0.9rem;">
                <div>
                  <span style="color:var(--text-muted);display:block;margin-bottom:2px;">Origem (Criador)</span>
                  <strong style="color:var(--text-primary);">${escapeHtml(ticket.creator?.full_name || '—')}</strong>
                </div>
                <div>
                  <span style="color:var(--text-muted);display:block;margin-bottom:2px;">Data de Abertura</span>
                  <strong style="color:var(--text-primary);">${formatDate(ticket.created_at)}</strong>
                </div>
                <div>
                  <span style="color:var(--text-muted);display:block;margin-bottom:2px;">Destino</span>
                  <strong style="color:var(--text-primary);">
                    ${escapeHtml(
                      ticket.destination?.name || 
                      ticket.ticket_users
                        ?.filter(tu => tu.profile && tu.profile.id !== ticket.created_by)
                        .map(tu => tu.profile.full_name)
                        .join(', ') || 
                      'Colaborador(es)'
                    )}
                  </strong>
                </div>
                <div>
                  <span style="color:var(--text-muted);display:block;margin-bottom:2px;">Data de Encerramento</span>
                  <strong style="color:var(--text-primary);">${ticket.status === 'resolved' && ticket.updated_at ? formatDate(ticket.updated_at) : '—'}</strong>
                </div>
                <div style="grid-column: span 2;">
                  <span style="color:var(--text-muted);display:block;margin-bottom:2px;">Prazo de Conclusão</span>
                  <div id="deadlineDisplay" style="display:flex;align-items:center;gap:8px;flex-wrap:wrap;">
                    <strong style="color:var(--text-primary);" id="deadlineText">
                      ${ticket.deadline ? formatDate(ticket.deadline) : 'Sem prazo definido'}
                    </strong>
                    ${(ticket.created_by === profile.id || profile.role === 'director') && ticket.status !== 'resolved' ? `
                      <button class="btn btn-sm btn-icon" id="btnEditDeadline" style="padding:2px 6px;font-size:0.75rem;background:transparent;border:1px solid var(--border);border-radius:4px;cursor:pointer;color:var(--primary);" title="Editar Prazo">✏️</button>
                    ` : ''}
                  </div>
                  <!-- Form edit prazo -->
                  ${(ticket.created_by === profile.id || profile.role === 'director') && ticket.status !== 'resolved' ? `
                    <div id="editDeadlineForm" style="display:none;flex-direction:column;gap:8px;margin-top:8px;padding:10px;border:1px solid var(--border);border-radius:8px;background:var(--bg-app);">
                      <input type="datetime-local" id="newDeadlineInput" class="input" style="font-size:0.85rem;padding:8px;background:var(--bg-card);" value="${ticket.deadline ? new Date(new Date(ticket.deadline).getTime() - new Date(ticket.deadline).getTimezoneOffset() * 60000).toISOString().slice(0, 16) : ''}" />
                      <div style="display:flex;gap:8px;">
                        <button class="btn btn-sm btn-primary" id="btnSaveDeadline" style="font-size:0.8rem;padding:6px 12px;">Salvar</button>
                        <button class="btn btn-sm btn-secondary" id="btnCancelDeadline" style="font-size:0.8rem;padding:6px 12px;">Cancelar</button>
                      </div>
                    </div>
                  ` : ''}
                </div>
              </div>

              <div style="display:flex;gap:16px;margin-top:20px;flex-wrap:wrap;border-top:1px solid var(--border);padding-top:16px;">
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="color:var(--text-muted);font-size:0.9rem;">Status:</span>
                  <span class="badge badge-${statusClass}" style="${detailBadgeStyle}">${detailLabelHtml}</span>
                </div>
                <div style="display:flex;align-items:center;gap:6px;">
                  <span style="color:var(--text-muted);font-size:0.9rem;">Prioridade:</span>
                  <span class="badge badge-${ticket.priority}">${PRIORITY_LABELS[ticket.priority]}</span>
                </div>
              </div>
            </div>

            <!-- Descrição -->
            <div class="card" style="padding:20px;">
              <h4 style="margin:0 0 10px 0;font-size:1rem;color:var(--text-secondary);">Descrição do Problema</h4>
              <p style="margin:0;font-size:0.95rem;color:var(--text-primary);background:var(--bg-app);padding:16px;border-radius:10px;border:1px solid var(--border);white-space:pre-wrap;line-height:1.5;">${escapeHtml(ticket.description || 'Nenhuma descrição detalhada fornecida.')}</p>
            </div>

            <!-- Custos Externos -->
            <div class="card" style="padding:20px;">
              <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:12px;">
                <h4 style="margin:0;font-size:1rem;color:var(--text-secondary);">Custos Externos</h4>
                <button class="btn btn-sm btn-primary" id="addCostBtn" style="padding:6px 12px;font-size:0.8rem;font-weight:600;display:flex;align-items:center;gap:6px;">
                  ＋ Inserir Custo
                </button>
              </div>

              <!-- Formulário de inserção inline de custo -->
              <div id="costInputForm" style="display:none;flex-direction:column;gap:10px;padding:14px;border:1px solid var(--border);border-radius:10px;background:var(--bg-app);margin-bottom:12px;">
                <input type="text" id="costDesc" class="input" placeholder="Descrição do custo..." style="font-size:0.85rem;padding:8px 10px;background:var(--bg-card);" />
                <div style="display:flex;gap:10px;">
                  <input type="text" id="costVal" class="input" placeholder="R$ 0,00" style="font-size:0.85rem;padding:8px 10px;background:var(--bg-card);flex:1;" />
                  <button class="btn btn-sm btn-primary" id="saveCostBtn" style="font-size:0.8rem;padding:6px 12px;">Salvar</button>
                  <button class="btn btn-sm btn-secondary" id="cancelCostBtn" style="font-size:0.8rem;padding:6px 12px;">Cancelar</button>
                </div>
              </div>

              <div id="ticketCostsList">
                <!-- Custos renderizados -->
              </div>

              <div id="ticketCostsTotal" style="margin-top:12px;font-size:1.05rem;color:var(--text-primary);text-align:left;border-top:1px solid var(--border);padding-top:10px;">
                Total: <strong>R$ 0,00</strong>
              </div>
            </div>

            <!-- Histórico -->
            <div class="card" style="padding:20px;">
              <h4 style="margin:0 0 14px 0;font-size:1rem;color:var(--text-secondary);">Histórico do Chamado</h4>
              <div id="ticketHistoryList" class="history-timeline">
                <!-- Timeline renderizada -->
              </div>
            </div>

          </div>

          <!-- COLUNA DIREITA (CHAT DE MENSAGENS) -->
          <div class="card" style="padding:20px;display:flex;flex-direction:column;gap:14px;min-height:500px;position:sticky;top:20px;">
            <h4 style="margin:0;font-size:1.05rem;color:var(--text-primary);display:flex;align-items:center;justify-content:space-between;">
              Mensagens
              <button class="btn btn-sm btn-secondary" id="btnRefreshChat" style="padding:4px 8px;font-size:0.75rem;border:none;border-radius:4px;cursor:pointer;">🔄 Atualizar</button>
            </h4>
            
            <div id="ticketChatHistory" style="display:flex;flex-direction:column;gap:12px;max-height:420px;overflow-y:auto;padding-right:6px;min-height:300px;flex:1;">
              <!-- Chat renderizado -->
            </div>
            
            <div style="display:flex;gap:10px;align-items:flex-end;margin-top:10px;">
              <textarea id="chatInputMessage" class="input" placeholder="Digite uma mensagem..." rows="2" style="resize:none;font-size:0.88rem;flex:1;padding:8px 12px;border-radius:8px;background:var(--bg-card);"></textarea>
              <button id="sendChatMsgBtn" style="background:#059669;color:white;border:none;width:42px;height:42px;border-radius:50%;display:flex;align-items:center;justify-content:center;cursor:pointer;flex-shrink:0;transition:background 0.2s;box-shadow:var(--shadow-sm);" title="Enviar Mensagem">
                <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2.5" viewBox="0 0 24 24"><path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"/></svg>
              </button>
            </div>
          </div>

        </div>

      </main>
    `;

    // 3. Estilos adicionais para timeline e grid responsivo
    const styleSheet = document.createElement("style");
    styleSheet.innerText = `
      .history-timeline {
        position: relative;
        padding-left: 24px;
      }
      .history-timeline::before {
        content: '';
        position: absolute;
        left: 9px;
        top: 6px;
        bottom: 6px;
        width: 2px;
        background: var(--border);
      }
      .badge-in_progress_overdue {
        background: linear-gradient(135deg, #3b82f6 50%, #ef4444 50%) !important;
        color: white !important;
        border-radius: 20px !important;
        font-weight: bold;
        text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
      }
      @media (max-width: 900px) {
        .ticket-detail-grid {
          grid-template-columns: 1fr !important;
          gap: 24px !important;
        }
      }
    `;
    document.head.appendChild(styleSheet);

    bindLayoutEvents(profile);
    bindEvents();
    renderCosts(costs);
    renderMessages(messages);
    renderHistory(history);
    renderCollaborators();
  }

  function renderCollaborators() {
    const linkedListContainer = document.getElementById('linkedCollaboratorsList');
    const availableListContainer = document.getElementById('availableCollaboratorsList');
    
    if (linkedListContainer && availableListContainer) {
      // Renderizar quem já está atrelado
      const creatorBadge = `
        <span style="background:var(--primary-light);color:var(--primary);font-size:0.8rem;padding:6px 12px;border-radius:20px;font-weight:600;display:inline-flex;align-items:center;gap:4px;">
          ✍️ ${escapeHtml(ticket.creator?.full_name || 'Autor')} (Autor)
        </span>
      `;
      const otherBadges = ticket.ticket_users
        ?.filter(tu => tu.profile && tu.profile.id !== ticket.created_by)
        .map(tu => `
          <span style="background:var(--bg-app);color:var(--text-primary);font-size:0.8rem;padding:6px 12px;border-radius:20px;font-weight:500;border:1px solid var(--border);display:inline-flex;align-items:center;gap:4px;">
            👤 ${escapeHtml(tu.profile.full_name || 'Colaborador')}
          </span>
        `).join('') || '';
      
      linkedListContainer.innerHTML = creatorBadge + otherBadges;

      // Renderizar checklist de disponíveis
      const otherProfiles = allProfiles.filter(p => p.id !== ticket.created_by);
      availableListContainer.innerHTML = otherProfiles.map(p => {
        const isAlreadyLinked = ticket.involved_user_ids?.includes(p.id);
        return `
          <label style="display:flex;align-items:center;gap:10px;padding:6px 8px;font-size:0.88rem;cursor:${isAlreadyLinked ? 'not-allowed' : 'pointer'};opacity:${isAlreadyLinked ? '0.7' : '1'};border-bottom:1px dashed var(--border);width:100%;">
            <input type="checkbox" value="${p.id}" ${isAlreadyLinked ? 'checked disabled' : ''} class="new-collab-checkbox" style="width:16px;height:16px;cursor:${isAlreadyLinked ? 'not-allowed' : 'pointer'};" />
            <span>${escapeHtml(p.full_name || p.email)}</span>
          </label>
        `;
      }).join('');
    }
  }

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

  function renderHistory(historyList) {
    const historyContainer = document.getElementById('ticketHistoryList');
    if (historyContainer) {
      historyContainer.innerHTML = historyList.map(h => {
        const authorName = h.author?.full_name || 'Sistema';
        
        let color = 'var(--text-muted)';
        let icon = '⚙️';
        
        if (h.action === 'create') {
          color = '#10b981';
          icon = '➕';
        } else if (h.action === 'start_service') {
          color = '#3b82f6';
          icon = '⚡';
        } else if (h.action === 'resolve') {
          color = '#10b981';
          icon = '✅';
        } else if (h.action === 'reopen') {
          color = '#ef4444';
          icon = '🔄';
        } else if (h.action === 'forward') {
          color = '#f59e0b';
          icon = '➡️';
        } else if (h.action === 'overdue') {
          color = '#ef4444';
          icon = '⏰';
        } else if (h.action === 'cost_added') {
          color = '#6366f1';
          icon = '💵';
        } else if (h.action === 'collaborator_added') {
          color = '#6366f1';
          icon = '👤';
        }

        return `
          <div class="history-item" style="margin-bottom: 16px; position: relative;">
            <span class="history-icon" style="position: absolute; left: -25px; top: 1px; background: ${color}; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 0.7rem; border: 2px solid var(--bg-card);">${icon}</span>
            <div style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.4;">
              <strong>${escapeHtml(authorName)}</strong> ${escapeHtml(h.description)}
            </div>
            <div style="font-size: 0.72rem; color: var(--text-muted); margin-top: 2px;">
              ${formatDate(h.created_at)}
            </div>
          </div>
        `;
      }).join('') || '<p style="color:var(--text-muted);font-size:0.85rem;margin-top:6px;">Nenhuma atividade registrada.</p>';
    }
  }

  function bindEvents() {
    // Voltar
    document.getElementById('backBtn')?.addEventListener('click', () => navigateTo('/dashboard'));

    // Status: Iniciar Atendimento
    document.getElementById('btnStartService')?.addEventListener('click', async () => {
      try {
        await updateTicketStatus(ticketId, 'in_progress');
        showToast('Atendimento iniciado!', 'success');
        await loadAllData();
        renderPage();
      } catch (err) {
        console.error(err);
        showToast('Erro ao iniciar atendimento', 'error');
      }
    });

    // Status: Finalizar Chamado
    document.getElementById('btnFinishTicket')?.addEventListener('click', async () => {
      try {
        await updateTicketStatus(ticketId, 'resolved');
        showToast('Chamado finalizado!', 'success');
        await loadAllData();
        renderPage();
      } catch (err) {
        console.error(err);
        showToast('Erro ao finalizar chamado', 'error');
      }
    });

    // Criar Processo de Compra
    document.getElementById('btnCreatePurchaseProcess')?.addEventListener('click', async () => {
      try {
        await createPurchaseProcess(ticketId);
        showToast('Processo de compra criado com sucesso!', 'success');
        await loadAllData();
        renderPage();
      } catch (err) {
        console.error(err);
        showToast('Erro ao criar processo de compra', 'error');
      }
    });

    // Acessar Processo de Compra
    document.getElementById('btnAccessPurchaseProcess')?.addEventListener('click', () => {
      navigateTo(`/purchase-processes?ticketId=${ticketId}`);
    });

    // Colaboradores Form Show/Hide
    const collaboratorsForm = document.getElementById('collaboratorsForm');
    document.getElementById('btnCollaborators')?.addEventListener('click', () => {
      if (collaboratorsForm) {
        collaboratorsForm.style.display = collaboratorsForm.style.display === 'none' ? 'flex' : 'none';
      }
    });

    document.getElementById('cancelCollaboratorsBtn')?.addEventListener('click', () => {
      if (collaboratorsForm) collaboratorsForm.style.display = 'none';
    });

    document.getElementById('searchCollaboratorInput')?.addEventListener('input', (e) => {
      const query = e.target.value.toLowerCase().trim();
      const labels = document.querySelectorAll('#availableCollaboratorsList label');
      labels.forEach(label => {
        const text = label.textContent.toLowerCase();
        if (text.includes(query)) {
          label.style.display = 'flex';
        } else {
          label.style.display = 'none';
        }
      });
    });

    document.getElementById('saveCollaboratorsBtn')?.addEventListener('click', async () => {
      const checkedBoxes = document.querySelectorAll('.new-collab-checkbox:checked:not([disabled])');
      const newIds = Array.from(checkedBoxes).map(cb => cb.value);

      if (newIds.length === 0) {
        showToast('Nenhum novo colaborador selecionado', 'info');
        return;
      }

      try {
        await addTicketCollaborators(ticketId, newIds);
        showToast('Colaborador(es) atrelado(s) com sucesso!', 'success');
        await loadAllData();
        renderPage();
      } catch (err) {
        console.error(err);
        showToast('Erro ao atrelar colaborador(es)', 'error');
      }
    });

    // Custo Externo Form Show/Hide
    const costInputForm = document.getElementById('costInputForm');
    const addCostBtn = document.getElementById('addCostBtn');

    // Máscara monetária
    const costValInput = document.getElementById('costVal');
    if (costValInput) {
      costValInput.addEventListener('input', (e) => {
        let value = e.target.value;
        let digits = value.replace(/\D/g, '');
        if (digits.length === 0) {
          e.target.value = '';
          return;
        }
        let numberValue = parseFloat(digits) / 100;
        e.target.value = new Intl.NumberFormat('pt-BR', {
          style: 'currency',
          currency: 'BRL'
        }).format(numberValue);
      });
    }

    addCostBtn?.addEventListener('click', () => {
      if (costInputForm) {
        costInputForm.style.display = costInputForm.style.display === 'none' ? 'flex' : 'none';
      }
    });

    document.getElementById('cancelCostBtn')?.addEventListener('click', () => {
      if (costInputForm) costInputForm.style.display = 'none';
    });

    document.getElementById('saveCostBtn')?.addEventListener('click', async () => {
      const desc = document.getElementById('costDesc')?.value;
      const valStr = document.getElementById('costVal')?.value;

      if (!desc || !valStr) {
        showToast('Preencha a descrição e o valor do custo', 'error');
        return;
      }

      const numericVal = parseFloat(valStr.replace(/[^\d]/g, '')) / 100;

      try {
        await addTicketCost(ticketId, desc, numericVal);
        showToast('Custo adicionado com sucesso!', 'success');
        await loadAllData();
        renderPage();
      } catch (err) {
        console.error(err);
        showToast('Erro ao adicionar custo', 'error');
      }
    });

    // Chat: Enviar Mensagem
    const chatInput = document.getElementById('chatInputMessage');
    const sendBtn = document.getElementById('sendChatMsgBtn');

    async function sendMsg() {
      const text = chatInput?.value?.trim();
      if (!text) return;
      try {
        await sendTicketMessage(ticketId, text);
        chatInput.value = '';
        await loadAllData();
        renderPage();
      } catch (err) {
        console.error(err);
        showToast('Erro ao enviar mensagem', 'error');
      }
    }

    sendBtn?.addEventListener('click', sendMsg);
    chatInput?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMsg();
      }
    });

    // Chat: Refresh
    document.getElementById('btnRefreshChat')?.addEventListener('click', async () => {
      await loadAllData();
      renderPage();
      showToast('Chat atualizado!', 'success');
    });

    // Prazo (Deadline) Edit Form Show/Hide
    const editDeadlineForm = document.getElementById('editDeadlineForm');
    document.getElementById('btnEditDeadline')?.addEventListener('click', () => {
      if (editDeadlineForm) {
        editDeadlineForm.style.display = editDeadlineForm.style.display === 'none' ? 'flex' : 'none';
      }
    });

    document.getElementById('btnCancelDeadline')?.addEventListener('click', () => {
      if (editDeadlineForm) editDeadlineForm.style.display = 'none';
    });

    document.getElementById('btnSaveDeadline')?.addEventListener('click', async () => {
      const val = document.getElementById('newDeadlineInput')?.value;
      if (!val) {
        showToast('Selecione uma data e horário', 'error');
        return;
      }

      const newDeadline = new Date(val);
      const oldDeadline = ticket.deadline ? new Date(ticket.deadline) : null;

      if (profile.role !== 'director' && oldDeadline && newDeadline <= oldDeadline) {
        showToast('O novo prazo deve ser maior do que o prazo atual', 'error');
        return;
      }

      try {
        await updateTicketDeadline(ticketId, newDeadline.toISOString());
        showToast('Prazo atualizado com sucesso!', 'success');
        await loadAllData();
        renderPage();
      } catch (err) {
        console.error(err);
        showToast(err.message || 'Erro ao atualizar prazo', 'error');
      }
    });
  }
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
