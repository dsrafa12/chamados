/**
 * Utilitário para renderizar o layout padrão (Sidebar + Mobile Header)
 * e gerenciar a restrição de super admin para o email ds.rafa@hotmail.com.
 */
import { navigateTo } from './router.js';
import { signOut } from './auth.js';

export function getLayoutTemplate(profile, activePage) {
  const isSuperAdmin = profile.email === 'ds.rafa@hotmail.com';
  const isDirector = profile.role === 'director';
  
  const initials = (profile.full_name || 'U')
    .split(' ')
    .map(n => n[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();

  const deptName = profile.departments?.map(d => d.name).join(', ') || 'Sem grupo';

  // SVG Icons
  const ticketIcon = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M9 12h6M12 9v6M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/></svg>`;
  const deptIcon = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5"/></svg>`;
  const usersIcon = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2M9 7a4 4 0 110-8 4 4 0 010 8zm14 14v-2a4 4 0 00-3-3.87M16 3.13a4 4 0 010 7.75"/></svg>`;
  const logoutIcon = `<svg width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>`;
  const menuIcon = `<svg width="24" height="24" fill="none" stroke="currentColor" stroke-width="2" viewBox="0 0 24 24"><path d="M4 6h16M4 12h16M4 18h16"/></svg>`;

  return `
    <div class="layout-container">
      
      <!-- SIDEBAR DESKTOP -->
      <aside class="sidebar">
        <div class="sidebar-logo">
          <svg width="28" height="28" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="#1a73e8"/>
            <path d="M14 18h20M14 24h14M14 30h18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          Chamados
        </div>

        <nav class="sidebar-menu">
          <button class="sidebar-link ${activePage === 'tickets' ? 'active' : ''}" id="sidebarTickets">
            ${ticketIcon} Chamados
          </button>
          
          ${isDirector ? `
            <button class="sidebar-link ${activePage === 'departments' ? 'active' : ''}" id="sidebarDepts">
              ${deptIcon} Grupos
            </button>
          ` : ''}
          ${isSuperAdmin ? `
            <button class="sidebar-link ${activePage === 'users' ? 'active' : ''}" id="sidebarUsers">
              ${usersIcon} Usuários
            </button>
          ` : ''}
        </nav>

        <div class="sidebar-footer">
          <div style="display:flex;align-items:center;gap:12px;padding:0 8px;">
            <div class="header-avatar" style="width:40px;height:40px;flex-shrink:0;">${initials}</div>
            <div style="overflow:hidden;">
              <div style="font-size:0.85rem;font-weight:600;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;" title="${profile.full_name}">${profile.full_name}</div>
              <div style="font-size:0.75rem;color:var(--text-secondary);">${deptName}</div>
            </div>
          </div>
          <button class="sidebar-link" id="sidebarLogout" style="color:var(--danger);">
            ${logoutIcon} Sair da Conta
          </button>
        </div>
      </aside>

      <!-- MOBILE HEADER -->
      <header class="mobile-header">
        <div class="mobile-logo">
          <svg width="24" height="24" viewBox="0 0 48 48" fill="none">
            <rect width="48" height="48" rx="12" fill="#1a73e8"/>
            <path d="M14 18h20M14 24h14M14 30h18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
          </svg>
          Chamados
        </div>
        <button class="mobile-menu-btn" id="mobileMenuBtn">
          ${menuIcon}
        </button>
      </header>

      <!-- MOBILE DROPDOWN MENU -->
      <nav class="mobile-dropdown" id="mobileDropdown">
        <button class="sidebar-link ${activePage === 'tickets' ? 'active' : ''}" id="mobileTickets">
          ${ticketIcon} Chamados
        </button>
        
        ${isDirector ? `
          <button class="sidebar-link ${activePage === 'departments' ? 'active' : ''}" id="mobileDepts">
            ${deptIcon} Gerenciar Grupos
          </button>
        ` : ''}
        ${isSuperAdmin ? `
          <button class="sidebar-link ${activePage === 'users' ? 'active' : ''}" id="mobileUsers">
            ${usersIcon} Gerenciar Usuários
          </button>
        ` : ''}
        
        <button class="sidebar-link" id="mobileLogout" style="color:var(--danger);margin-top:8px;border-top:1px solid var(--border);padding-top:12px;">
          ${logoutIcon} Sair da Conta
        </button>
      </nav>

      <!-- CONTEÚDO PRINCIPAL (Injetado depois) -->
      <div class="main-content" id="mainContent"></div>
    </div>
  `;
}

export function bindLayoutEvents(profile) {
  // Toggle do menu mobile
  const menuBtn = document.getElementById('mobileMenuBtn');
  const dropdown = document.getElementById('mobileDropdown');
  
  if (menuBtn && dropdown) {
    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown.classList.toggle('open');
    });

    document.addEventListener('click', () => {
      dropdown.classList.remove('open');
    });
  }

  // Ações de Navegação
  const navActions = [
    { ids: ['sidebarTickets', 'mobileTickets'], path: '/dashboard' },
    { ids: ['sidebarDepts', 'mobileDepts'], path: '/admin/departments' },
    { ids: ['sidebarUsers', 'mobileUsers'], path: '/admin/users' }
  ];

  navActions.forEach(action => {
    action.ids.forEach(id => {
      document.getElementById(id)?.addEventListener('click', () => {
        navigateTo(action.path);
      });
    });
  });

  // Logout
  const logoutHandler = async () => {
    if (confirm('Deseja realmente sair da sua conta?')) {
      await signOut();
      navigateTo('/login');
    }
  };

  document.getElementById('sidebarLogout')?.addEventListener('click', logoutHandler);
  document.getElementById('mobileLogout')?.addEventListener('click', logoutHandler);
}
