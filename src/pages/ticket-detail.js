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
  awaiting_start: 'Gerado Processo de Compra',
  in_analysis: 'Em Análise',
  awaiting_info: 'Aguardando Informações',
  in_quotation: 'Em Cotação',
  in_approval: 'Em Aprovação',
  order_issued: 'Pedido Emitido',
  awaiting_supplier: 'Aguardando Fornecedor',
  awaiting_receipt: 'Aguardando Recebimento',
  finalized: 'Finalizado',
  cancelled: 'Cancelado',
  reopened: 'Reaberto'
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

    const isFinalized = ticket.status === 'resolved' || ticket.status === 'finalized' || ticket.status === 'cancelled';
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
    } else if (statusClass === 'awaiting_start' || statusClass === 'in_analysis' || statusClass === 'awaiting_info' || statusClass === 'in_quotation' || statusClass === 'in_approval' || statusClass === 'order_issued' || statusClass === 'awaiting_supplier' || statusClass === 'awaiting_receipt' || statusClass === 'finalized' || statusClass === 'cancelled' || statusClass === 'reopened') {
      detailBadgeStyle = 'font-size:0.72rem; line-height:1.15; padding:4px 8px; white-space:normal; text-align:center; display:inline-block; max-width:125px;';
      if (statusClass === 'awaiting_start') {
        detailLabelHtml = `Gerado Processo<br>de Compra`;
      } else if (statusClass === 'awaiting_info') {
        detailLabelHtml = `Aguardando<br>Informações`;
      } else if (statusClass === 'awaiting_supplier') {
        detailLabelHtml = `Aguardando<br>Fornecedor`;
      } else if (statusClass === 'awaiting_receipt') {
        detailLabelHtml = `Aguardando<br>Recebimento`;
      }
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
            ${canChangeStatus && !isFinalized ? `
              <button class="btn btn-sm" id="btnCollaborators" style="background:#6366f1;color:white;font-weight:600;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;">Colaboradores</button>
            ` : ''}
            
            ${showStandardButtons && !isFinalized ? `
              ${(ticket.status === 'open' || ticket.status === 'overdue') ? `
                <button class="btn btn-sm" id="btnStartService" style="background:#3b82f6;color:white;font-weight:600;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;">Iniciar Atendimento</button>
              ` : ''}
              ${(ticket.status !== 'resolved' && ticket.status !== 'finalized' && ticket.status !== 'cancelled') ? `
                <button class="btn btn-sm" id="btnFinishTicket" style="background:#059669;color:white;font-weight:600;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;">Finalizar Chamado</button>
              ` : ''}
            ` : ''}

            ${!isFinalized && purchaseProcess ? `
              <button class="btn btn-sm" id="btnViewPurchaseDetails" style="background:#0891b2;color:white;font-weight:600;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;">Detalhes da Compra</button>
            ` : ''}

            ${isMemberOfCompras && !isFinalized ? `
              ${purchaseProcess ? `
                <button class="btn btn-sm" id="btnAccessPurchaseProcess" style="background:#0284c7;color:white;font-weight:600;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;">Acessar Processo de Compra</button>
              ` : `
                <button class="btn btn-sm" id="btnCreatePurchaseProcess" style="background:#0f766e;color:white;font-weight:600;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;">Criar Processo de Compra</button>
              `}
            ` : ''}

            ${isFinalized && canChangeStatus ? `
              <button class="btn btn-sm" id="btnReopenTicket" style="background:#db2777;color:white;font-weight:600;padding:8px 16px;border:none;border-radius:8px;cursor:pointer;">Reabrir Chamado</button>
            ` : ''}
          </div>
        </div>

        <!-- GRID DE DUAS COLUNAS -->
        <div style="display:grid;grid-template-columns:1.2fr 1fr;gap:32px;align-items:start;" class="ticket-detail-grid">
          
          <!-- COLUNA ESQUERDA (INFORMAÇÕES, CUSTOS E HISTÓRICO) -->
          <div style="display:flex;flex-direction:column;gap:20px;">
            
            <!-- Card de Colaboradores Atrelados (Sempre visível acima do título) -->
            <div class="card" style="padding:18px 24px; display:flex; flex-direction:column; gap:12px; border-radius:12px;">
              <h4 style="margin:0; font-size:0.95rem; color:var(--text-primary); font-weight:700;">Colaboradores Atrelados</h4>
              <div style="display:flex; flex-wrap:wrap; gap:8px;" id="permanentCollaboratorsList">
                <!-- Badges dynamically rendered -->
              </div>
            </div>

            <!-- Painel de Gerenciamento de Colaboradores (Colapsado por padrão) -->
            <div id="collaboratorsForm" style="display:none;flex-direction:column;gap:14px;padding:18px;border:1px solid var(--border);border-radius:12px;background:var(--bg-app);box-shadow:var(--shadow-sm);">
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

      <!-- MODAL DE REABERTURA -->
      <div id="reopenModal" class="modal-container" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:1100; align-items:center; justify-content:center;">
        <div class="card" style="width:100%; max-width:500px; padding:24px; position:relative; box-shadow:var(--shadow-lg); animation: slideUp 0.25s ease-out;">
          <button id="closeReopenModalBtn" style="position:absolute; top:20px; right:20px; background:transparent; border:none; font-size:1.2rem; cursor:pointer; color:var(--text-muted);" title="Fechar">✕</button>
          
          <h3 style="margin:0 0 4px 0; font-size:1.25rem; font-weight:700; color:var(--text-primary);">Reabrir Chamado</h3>
          <p style="margin:0 0 20px 0; font-size:0.88rem; color:var(--text-muted);">Por favor, insira a justificativa para reabrir este chamado. Ela será registrada no chat do chamado.</p>

          <div style="margin-bottom:20px;">
            <label style="display:block; font-size:0.85rem; font-weight:600; color:var(--text-secondary); margin-bottom:8px;">Justificativa (Obrigatório)</label>
            <textarea id="reopenJustificationInput" class="input" rows="4" placeholder="Escreva aqui o motivo de reabrir o chamado..." style="font-size:0.95rem; padding:10px 12px; background:var(--bg-card); resize:none; font-family:inherit;"></textarea>
          </div>

          <div style="display:flex; justify-content:flex-end; gap:12px;">
            <button class="btn btn-secondary" id="reopenCancelBtn" style="padding:10px 20px;">Cancelar</button>
            <button class="btn btn-primary" id="reopenSubmitBtn" style="padding:10px 24px; font-weight:600; background:#db2777; border-color:#db2777;">Reabrir Chamado</button>
          </div>
        </div>
      </div>

      <!-- MODAL DE CONFIRMAÇÃO DE FINALIZAÇÃO -->
      <div id="finishModal" class="modal-container" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:1100; align-items:center; justify-content:center;">
        <div class="card" style="width:100%; max-width:480px; padding:24px; position:relative; box-shadow:var(--shadow-lg); animation: slideUp 0.25s ease-out; border-radius:12px;">
          <button id="closeFinishModalBtn" style="position:absolute; top:20px; right:20px; background:transparent; border:none; font-size:1.2rem; cursor:pointer; color:var(--text-muted);" title="Fechar">✕</button>
          
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
            <span style="font-size:2rem;">✅</span>
            <h3 style="margin:0; font-size:1.25rem; font-weight:700; color:var(--text-primary);">Finalizar Chamado</h3>
          </div>
          
          <p style="margin:0 0 24px 0; font-size:0.95rem; color:var(--text-secondary); line-height:1.5;">
            Tem certeza que deseja finalizar este chamado? 
            <br><br>
            <strong>Nota:</strong> Ele poderá ser reaberto futuramente por qualquer pessoa atrelada a este chamado caso seja necessário.
          </p>

          <div style="display:flex; justify-content:flex-end; gap:12px;">
            <button class="btn btn-secondary" id="finishCancelBtn" style="padding:10px 20px;">Cancelar</button>
            <button class="btn btn-primary" id="finishConfirmBtn" style="padding:10px 24px; font-weight:600; background:#059669; border-color:#059669;">Sim, Finalizar</button>
          </div>
        </div>
      </div>

      <!-- MODAL DE CONFIRMAÇÃO DE PROCESSO DE COMPRA -->
      <div id="purchaseConfirmModal" class="modal-container" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:1100; align-items:center; justify-content:center;">
        <div class="card" style="width:100%; max-width:480px; padding:24px; position:relative; box-shadow:var(--shadow-lg); animation: slideUp 0.25s ease-out; border-radius:12px;">
          <button id="closePurchaseModalBtn" style="position:absolute; top:20px; right:20px; background:transparent; border:none; font-size:1.2rem; cursor:pointer; color:var(--text-muted);" title="Fechar">✕</button>
          
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:16px;">
            <span style="font-size:2rem;">🛒</span>
            <h3 style="margin:0; font-size:1.25rem; font-weight:700; color:var(--text-primary);">Criar Processo de Compra</h3>
          </div>
          
          <p style="margin:0 0 24px 0; font-size:0.95rem; color:var(--text-secondary); line-height:1.5;">
            Deseja iniciar um processo de compra para este chamado? 
            <br><br>
            <strong>Nota:</strong> O status do chamado será alterado automaticamente para <strong>"Gerado Processo de Compra"</strong>.
          </p>

          <div style="display:flex; justify-content:flex-end; gap:12px;">
            <button class="btn btn-secondary" id="purchaseCancelBtn" style="padding:10px 20px;">Cancelar</button>
            <button class="btn btn-primary" id="purchaseConfirmBtn" style="padding:10px 24px; font-weight:600; background:#0f766e; border-color:#0f766e;">Sim, Criar</button>
          </div>
        </div>
      </div>

      <!-- MODAL DE DETALHES DA COMPRA (INFORMATIVO) -->
      <div id="purchaseDetailsModal" class="modal-container" style="position:fixed; top:0; left:0; width:100%; height:100%; background:rgba(15,23,42,0.65); backdrop-filter:blur(4px); z-index:1100; align-items:center; justify-content:center;">
        <div class="card" style="width:100%; max-width:640px; padding:28px; position:relative; box-shadow:var(--shadow-lg); animation: slideUp 0.25s ease-out; border-radius:12px;">
          <button id="closePurchaseDetailsModalBtn" style="position:absolute; top:20px; right:20px; background:transparent; border:none; font-size:1.2rem; cursor:pointer; color:var(--text-muted);" title="Fechar">✕</button>
          
          <div style="display:flex; align-items:center; gap:12px; margin-bottom:20px;">
            <span style="font-size:2rem;">🛒</span>
            <div>
              <h3 style="margin:0; font-size:1.25rem; font-weight:700; color:var(--text-primary);">Detalhes da Compra</h3>
              <p style="margin:2px 0 0 0; font-size:0.85rem; color:var(--text-muted);">Informações sobre o processo de compra deste chamado</p>
            </div>
          </div>
          
          <div style="display:grid; grid-template-columns:1fr 1fr; gap:16px; margin-bottom:24px;" id="purchaseDetailsModalContent">
            <!-- Dynamic read-only details -->
          </div>

          <div style="display:flex; justify-content:flex-end;">
            <button class="btn btn-secondary" id="purchaseDetailsCloseBtn" style="padding:10px 24px;">Fechar</button>
          </div>
        </div>
      </div>
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
      .modal-container {
        display: none;
      }
      .modal-container.open {
        display: flex !important;
      }
      @keyframes slideUp {
        from { transform: translateY(20px); opacity: 0; }
        to { transform: translateY(0); opacity: 1; }
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
    const permanentListContainer = document.getElementById('permanentCollaboratorsList');
    const availableListContainer = document.getElementById('availableCollaboratorsList');
    
    if (permanentListContainer && availableListContainer) {
      // Renderizar quem já está atrelado
      const creatorBadge = `
        <span style="background:var(--primary-light);color:var(--primary);font-size:0.85rem;padding:6px 14px;border-radius:20px;font-weight:600;display:inline-flex;align-items:center;gap:6px;box-shadow:var(--shadow-sm);">
          ✍️ ${escapeHtml(ticket.creator?.full_name || 'Autor')} (Autor)
        </span>
      `;
      const otherBadges = ticket.ticket_users
        ?.filter(tu => tu.profile && tu.profile.id !== ticket.created_by)
        .map(tu => `
          <span style="background:var(--bg-app);color:var(--text-primary);font-size:0.85rem;padding:6px 14px;border-radius:20px;font-weight:600;border:1px solid var(--border);display:inline-flex;align-items:center;gap:6px;box-shadow:var(--shadow-sm);">
            👤 ${escapeHtml(tu.profile.full_name || 'Colaborador')}
          </span>
        `).join('') || '';
      
      permanentListContainer.innerHTML = creatorBadge + otherBadges;

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

    const finishModal = document.getElementById('finishModal');

    // Status: Finalizar Chamado
    document.getElementById('btnFinishTicket')?.addEventListener('click', () => {
      finishModal?.classList.add('open');
    });

    // Fechar Modal de Finalização
    document.getElementById('closeFinishModalBtn')?.addEventListener('click', () => {
      finishModal?.classList.remove('open');
    });
    document.getElementById('finishCancelBtn')?.addEventListener('click', () => {
      finishModal?.classList.remove('open');
    });

    // Confirmar Finalização
    document.getElementById('finishConfirmBtn')?.addEventListener('click', async () => {
      const confirmBtn = document.getElementById('finishConfirmBtn');
      try {
        if (confirmBtn) {
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Processando...';
        }
        await updateTicketStatus(ticketId, 'resolved');
        showToast('Chamado finalizado!', 'success');
        finishModal?.classList.remove('open');
        await loadAllData();
        renderPage();
      } catch (err) {
        console.error(err);
        showToast('Erro ao finalizar chamado', 'error');
      } finally {
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Sim, Finalizar';
        }
      }
    });

    const purchaseConfirmModal = document.getElementById('purchaseConfirmModal');

    // Criar Processo de Compra
    document.getElementById('btnCreatePurchaseProcess')?.addEventListener('click', () => {
      purchaseConfirmModal?.classList.add('open');
    });

    // Fechar Modal de Compra
    document.getElementById('closePurchaseModalBtn')?.addEventListener('click', () => {
      purchaseConfirmModal?.classList.remove('open');
    });
    document.getElementById('purchaseCancelBtn')?.addEventListener('click', () => {
      purchaseConfirmModal?.classList.remove('open');
    });

    // Confirmar Criação
    document.getElementById('purchaseConfirmBtn')?.addEventListener('click', async () => {
      const confirmBtn = document.getElementById('purchaseConfirmBtn');
      try {
        if (confirmBtn) {
          confirmBtn.disabled = true;
          confirmBtn.textContent = 'Processando...';
        }
        await createPurchaseProcess(ticketId);
        showToast('Processo de compra criado com sucesso!', 'success');
        purchaseConfirmModal?.classList.remove('open');
        await loadAllData();
        renderPage();
      } catch (err) {
        console.error(err);
        showToast('Erro ao criar processo de compra', 'error');
      } finally {
        if (confirmBtn) {
          confirmBtn.disabled = false;
          confirmBtn.textContent = 'Sim, Criar';
        }
      }
    });

    // Acessar Processo de Compra
    document.getElementById('btnAccessPurchaseProcess')?.addEventListener('click', () => {
      navigateTo(`/purchase-processes?ticketId=${ticketId}`);
    });

    // Modal de Detalhes da Compra (Informativo)
    const purchaseDetailsModal = document.getElementById('purchaseDetailsModal');
    
    document.getElementById('btnViewPurchaseDetails')?.addEventListener('click', () => {
      const contentContainer = document.getElementById('purchaseDetailsModalContent');
      if (contentContainer && purchaseProcess) {
        // Obter nome do responsável
        const respProfile = allProfiles.find(p => p.id === purchaseProcess.responsible_id);
        const respName = respProfile ? (respProfile.full_name || respProfile.email) : 'Não atribuído';

        // Formatar valor
        let amountText = 'Não informado';
        if (purchaseProcess.purchase_amount !== null && purchaseProcess.purchase_amount !== undefined) {
          amountText = 'R$ ' + parseFloat(purchaseProcess.purchase_amount).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
        }

        // Formatar data
        let forecastText = 'Não informado';
        if (purchaseProcess.delivery_forecast) {
          const [year, month, day] = purchaseProcess.delivery_forecast.split('-');
          forecastText = `${day}/${month}/${year}`;
        }

        // Traduzir motivo do bloqueio
        const blockTextMap = {
          none: 'Sem bloqueio',
          waiting_approval: 'Aguardando aprovação',
          supplier_delay: 'Atraso do fornecedor',
          budget_limit: 'Estourou orçamento',
          other: 'Outro motivo'
        };
        const blockText = blockTextMap[purchaseProcess.block_reason] || 'Sem bloqueio';

        // Traduzir recebimento
        const receiptTextMap = {
          not_received: 'Não recebido',
          partial: 'Recebido parcial',
          total: 'Recebido total'
        };
        const receiptText = receiptTextMap[purchaseProcess.receipt_status] || 'Não recebido';

        const statusLabel = STATUS_LABELS[purchaseProcess.status] || purchaseProcess.status;

        contentContainer.innerHTML = `
          <div style="padding:10px; border-bottom:1px solid var(--border);">
            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Status</label>
            <strong style="color:var(--text-primary); font-size:0.95rem;">${escapeHtml(statusLabel.replace('<br>', ' '))}</strong>
          </div>
          <div style="padding:10px; border-bottom:1px solid var(--border);">
            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Responsável</label>
            <strong style="color:var(--text-primary); font-size:0.95rem;">${escapeHtml(respName)}</strong>
          </div>
          <div style="padding:10px; border-bottom:1px solid var(--border);">
            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Número do Pedido</label>
            <strong style="color:var(--text-primary); font-size:0.95rem;">${escapeHtml(purchaseProcess.order_number || 'Não informado')}</strong>
          </div>
          <div style="padding:10px; border-bottom:1px solid var(--border);">
            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Fornecedor</label>
            <strong style="color:var(--text-primary); font-size:0.95rem;">${escapeHtml(purchaseProcess.supplier || 'Não informado')}</strong>
          </div>
          <div style="padding:10px; border-bottom:1px solid var(--border);">
            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Valor da Compra</label>
            <strong style="color:var(--text-primary); font-size:0.95rem;">${escapeHtml(amountText)}</strong>
          </div>
          <div style="padding:10px; border-bottom:1px solid var(--border);">
            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Previsão de Entrega</label>
            <strong style="color:var(--text-primary); font-size:0.95rem;">${escapeHtml(forecastText)}</strong>
          </div>
          <div style="padding:10px; border-bottom:1px solid var(--border);">
            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Motivo do Bloqueio</label>
            <strong style="color:var(--text-primary); font-size:0.95rem;">${escapeHtml(blockText)}</strong>
          </div>
          <div style="padding:10px; border-bottom:1px solid var(--border);">
            <label style="display:block; font-size:0.78rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; margin-bottom:4px;">Recebimento</label>
            <strong style="color:var(--text-primary); font-size:0.95rem;">${escapeHtml(receiptText)}</strong>
          </div>
        `;
        purchaseDetailsModal?.classList.add('open');
      }
    });

    document.getElementById('closePurchaseDetailsModalBtn')?.addEventListener('click', () => {
      purchaseDetailsModal?.classList.remove('open');
    });
    document.getElementById('purchaseDetailsCloseBtn')?.addEventListener('click', () => {
      purchaseDetailsModal?.classList.remove('open');
    });

    // Modal de Reabertura
    const reopenModal = document.getElementById('reopenModal');
    
    document.getElementById('btnReopenTicket')?.addEventListener('click', () => {
      const input = document.getElementById('reopenJustificationInput');
      if (input) input.value = '';
      reopenModal?.classList.add('open');
    });

    document.getElementById('closeReopenModalBtn')?.addEventListener('click', () => {
      reopenModal?.classList.remove('open');
    });
    
    document.getElementById('reopenCancelBtn')?.addEventListener('click', () => {
      reopenModal?.classList.remove('open');
    });

    document.getElementById('reopenSubmitBtn')?.addEventListener('click', async () => {
      const input = document.getElementById('reopenJustificationInput');
      const justification = input ? input.value.trim() : '';
      if (!justification) {
        showToast('A justificativa é obrigatória!', 'error');
        return;
      }
      
      const submitBtn = document.getElementById('reopenSubmitBtn');
      try {
        submitBtn.disabled = true;
        submitBtn.textContent = 'Processando...';

        // 1. Envia justificativa no chat
        const formattedMsg = `⚠️ **Chamado Reaberto**\n**Justificativa:** ${justification}`;
        await sendTicketMessage(ticketId, formattedMsg);

        // 2. Atualiza status para 'reopened'
        await updateTicketStatus(ticketId, 'reopened');
        
        showToast('Chamado reaberto com sucesso!', 'success');
        reopenModal?.classList.remove('open');

        await loadAllData();
        renderPage();
      } catch (err) {
        console.error(err);
        showToast('Erro ao reabrir chamado', 'error');
      } finally {
        if (submitBtn) {
          submitBtn.disabled = false;
          submitBtn.textContent = 'Reabrir Chamado';
        }
      }
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
