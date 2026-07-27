/**
 * Database Admin — Painel de Monitoramento do Banco de Dados e Armazenamento (Supabase)
 * Visível e acessível EXCLUSIVAMENTE para o Superadmin (ds.rafa@hotmail.com).
 */
import { getCurrentProfile } from '../lib/auth.js';
import { fetchDatabaseAdminStats, runManualAttachmentCleanup } from '../lib/api.js';
import { navigateTo } from '../lib/router.js';
import { showToast } from '../lib/toast.js';
import { getLayoutTemplate, bindLayoutEvents } from '../lib/layout.js';

export async function renderDatabaseAdmin(container) {
  let profile = null;

  try {
    profile = await getCurrentProfile();
    if (!profile || profile.email !== 'ds.rafa@hotmail.com') {
      showToast('Acesso restrito ao Superadmin.', 'error');
      navigateTo('/dashboard');
      return;
    }
  } catch {
    navigateTo('/login');
    return;
  }

  // Renderizar estrutura inicial com loading
  container.innerHTML = getLayoutTemplate(profile, 'database-admin');
  const mainContent = document.getElementById('mainContent');
  bindLayoutEvents(profile);

  mainContent.innerHTML = `
    <main class="page" style="max-width:1100px; margin:0 auto; padding-top:48px !important;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:24px; flex-wrap:wrap; gap:16px;">
        <div>
          <h1 style="margin:0 0 4px 0; font-size:1.6rem; font-weight:800; color:var(--text-primary);">🗄️ Administração do Banco de Dados</h1>
          <p style="margin:0; font-size:0.92rem; color:var(--text-muted);">Monitoramento de espaço em disco, contagem de anexos e manutenção da cota gratuita do Supabase.</p>
        </div>
        <button id="refreshStatsBtn" class="btn btn-secondary" style="display:flex; align-items:center; gap:8px;">
          <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"/></svg>
          Atualizar Dados
        </button>
      </div>

      <div id="statsContainer" style="display:flex; flex-direction:column; gap:24px;">
        <div style="padding:40px; text-align:center; color:var(--text-muted);">
          <div class="loading-spinner" style="margin:0 auto 16px; border:4px solid var(--border); border-top:4px solid var(--primary); border-radius:50%; width:36px; height:36px; animation:spin 1s linear infinite;"></div>
          Carregando métricas do banco de dados...
        </div>
      </div>
    </main>
  `;

  async function loadStats() {
    const statsContainer = document.getElementById('statsContainer');
    if (!statsContainer) return;

    try {
      const stats = await fetchDatabaseAdminStats();
      
      const totalBytes = stats.total_attachments_bytes || 0;
      const totalMB = (totalBytes / (1024 * 1024)).toFixed(2);
      const storageLimitMB = stats.storage_limit_mb || 500;
      const storagePercentage = Math.min(100, ((totalMB / storageLimitMB) * 100)).toFixed(1);

      statsContainer.innerHTML = `
        <!-- CARDS DE RESUMO DE ARMAZENAMENTO -->
        <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap:20px;">
          
          <!-- STORAGE CONSUMPTION CARD -->
          <div style="background:var(--bg-card); padding:24px; border-radius:16px; border:1px solid var(--border); box-shadow:var(--shadow-sm); display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Uso de Armazenamento (Storage)</span>
                <h2 style="margin:6px 0 0 0; font-size:1.8rem; font-weight:800; color:var(--text-primary);">${totalMB} MB <span style="font-size:0.9rem; font-weight:500; color:var(--text-muted);">/ ${storageLimitMB} MB</span></h2>
              </div>
              <div style="background:#e0f2fe; color:#0284c7; width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center;">
                <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"/></svg>
              </div>
            </div>

            <!-- BARRA DE PROGRESSO DO STORAGE -->
            <div>
              <div style="display:flex; justify-content:space-between; font-size:0.8rem; font-weight:600; color:var(--text-secondary); margin-bottom:6px;">
                <span>Cota Gratuita do Supabase</span>
                <span>${storagePercentage}%</span>
              </div>
              <div style="width:100%; height:10px; background:var(--bg-app); border-radius:10px; overflow:hidden; border:1px solid var(--border);">
                <div style="width:${storagePercentage}%; height:100%; background:${storagePercentage > 80 ? '#dc2626' : storagePercentage > 50 ? '#d97706' : '#16a34a'}; border-radius:10px; transition:width 0.5s ease;"></div>
              </div>
            </div>
            <p style="margin:0; font-size:0.8rem; color:var(--text-muted);">Arquivos armazenados no bucket <code>ticket-attachments</code>.</p>
          </div>

          <!-- DETALHAMENTO DE ANEXOS -->
          <div style="background:var(--bg-card); padding:24px; border-radius:16px; border:1px solid var(--border); box-shadow:var(--shadow-sm); display:flex; flex-direction:column; gap:16px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start;">
              <div>
                <span style="font-size:0.82rem; font-weight:700; color:var(--text-muted); text-transform:uppercase; letter-spacing:0.5px;">Estatísticas de Anexos</span>
                <h2 style="margin:6px 0 0 0; font-size:1.8rem; font-weight:800; color:var(--text-primary);">${stats.total_attachments_count} <span style="font-size:0.9rem; font-weight:500; color:var(--text-muted);">arquivos no total</span></h2>
              </div>
              <div style="background:#fef3c7; color:#d97706; width:44px; height:44px; border-radius:12px; display:flex; align-items:center; justify-content:center;">
                <svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"/></svg>
              </div>
            </div>

            <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; font-size:0.88rem; background:var(--bg-app); padding:14px; border-radius:10px; border:1px solid var(--border);">
              <div>
                <span style="color:var(--text-muted); display:block; font-size:0.78rem;">Ativos no Storage:</span>
                <strong style="color:#16a34a; font-size:1.1rem;">${stats.active_attachments_count}</strong>
              </div>
              <div>
                <span style="color:var(--text-muted); display:block; font-size:0.78rem;">Expirados / Deletados:</span>
                <strong style="color:var(--text-muted); font-size:1.1rem;">${stats.expired_attachments_count}</strong>
              </div>
            </div>
            <p style="margin:0; font-size:0.8rem; color:var(--text-muted);">Anexos de chamados concluídos são excluídos 4 dias após a solução.</p>
          </div>

        </div>

        <!-- MANUTENÇÃO E EXPURGO MANUAL -->
        <div style="background:var(--bg-card); padding:24px; border-radius:16px; border:1px solid var(--border); box-shadow:var(--shadow-sm); display:flex; justify-content:space-between; align-items:center; flex-wrap:wrap; gap:20px;">
          <div>
            <h3 style="margin:0 0 4px 0; font-size:1.1rem; font-weight:700; color:var(--text-primary);">Manutenção e Limpeza Manual</h3>
            <p style="margin:0; font-size:0.88rem; color:var(--text-secondary); line-height:1.4;">Forçar a execução da rotina de limpeza para remover agora anexos de chamados resolvidos há mais de 4 dias.</p>
          </div>
          <button id="runCleanupBtn" class="btn" style="background:#dc2626; color:white; font-weight:600; padding:12px 20px; border-radius:8px; display:flex; align-items:center; gap:8px; cursor:pointer;">
            <svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"/></svg>
            Executar Limpeza Agora
          </button>
        </div>

        <!-- CONTAGEM DE REGISTROS DAS TABELAS POSTGRES -->
        <div style="background:var(--bg-card); padding:24px; border-radius:16px; border:1px solid var(--border); box-shadow:var(--shadow-sm);">
          <h3 style="margin:0 0 16px 0; font-size:1.1rem; font-weight:700; color:var(--text-primary);">Contagem de Registros do Banco de Dados</h3>
          
          <div style="display:grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap:16px;">
            
            <div style="background:var(--bg-app); padding:16px; border-radius:12px; border:1px solid var(--border);">
              <span style="font-size:0.8rem; font-weight:600; color:var(--text-muted); display:block; margin-bottom:4px;">Chamados Criados</span>
              <span style="font-size:1.4rem; font-weight:800; color:var(--text-primary);">${stats.tickets_count}</span>
            </div>

            <div style="background:var(--bg-app); padding:16px; border-radius:12px; border:1px solid var(--border);">
              <span style="font-size:0.8rem; font-weight:600; color:var(--text-muted); display:block; margin-bottom:4px;">Mensagens no Chat</span>
              <span style="font-size:1.4rem; font-weight:800; color:var(--text-primary);">${stats.messages_count}</span>
            </div>

            <div style="background:var(--bg-app); padding:16px; border-radius:12px; border:1px solid var(--border);">
              <span style="font-size:0.8rem; font-weight:600; color:var(--text-muted); display:block; margin-bottom:4px;">Históricos de Auditoria</span>
              <span style="font-size:1.4rem; font-weight:800; color:var(--text-primary);">${stats.history_count}</span>
            </div>

            <div style="background:var(--bg-app); padding:16px; border-radius:12px; border:1px solid var(--border);">
              <span style="font-size:0.8rem; font-weight:600; color:var(--text-muted); display:block; margin-bottom:4px;">Usuários / Perfis</span>
              <span style="font-size:1.4rem; font-weight:800; color:var(--text-primary);">${stats.profiles_count}</span>
            </div>

          </div>
        </div>
      `;

      // Vincular Ação de Limpeza Manual
      document.getElementById('runCleanupBtn')?.addEventListener('click', async () => {
        if (!confirm('Deseja realmente executar a rotina de exclusão de anexos expirados agora?')) return;
        
        try {
          const res = await runManualAttachmentCleanup();
          const deletedCount = res[0]?.deleted_count || 0;
          const freedMB = ((res[0]?.freed_bytes || 0) / (1024 * 1024)).toFixed(2);

          showToast(`Limpeza concluída! ${deletedCount} anexos removidos (${freedMB} MB liberados).`, 'success');
          await loadStats();
        } catch (err) {
          console.error(err);
          showToast('Erro ao executar rotina de limpeza manual.', 'error');
        }
      });

    } catch (err) {
      console.error(err);
      statsContainer.innerHTML = `
        <div style="padding:24px; background:#fee2e2; color:#991b1b; border-radius:12px; font-weight:600;">
          Erro ao carregar estatísticas do banco de dados: ${err.message || 'Verifique as migrações SQL.'}
        </div>
      `;
    }
  }

  document.getElementById('refreshStatsBtn')?.addEventListener('click', loadStats);
  await loadStats();
}
