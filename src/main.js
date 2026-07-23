/**
 * Entry Point — Chamados Intersetoriais
 * Inicializa router, CSS e listener de autenticação.
 */
import './styles/main.css';
import { registerRoute, initRouter, navigateTo, getCurrentRoute } from './lib/router.js';
import { getSession, onAuthChange } from './lib/auth.js';
import { renderLogin } from './pages/login.js';
import { renderDashboard } from './pages/dashboard.js';
import { renderNewTicket } from './pages/new-ticket.js';
import { renderAdminDepartments } from './pages/admin-departments.js';
import { renderAdminUsers } from './pages/admin-users.js';
import { renderTicketDetail } from './pages/ticket-detail.js';

// Registrar rotas
registerRoute('/login', renderLogin);
registerRoute('/dashboard', renderDashboard);
registerRoute('/new-ticket', renderNewTicket);
registerRoute('/admin/departments', renderAdminDepartments);
registerRoute('/admin/users', renderAdminUsers);
registerRoute('/ticket', renderTicketDetail);

// Listener de autenticação: redireciona automaticamente
onAuthChange(async (event, session) => {
  const currentRoute = getCurrentRoute();
  
  if (event === 'SIGNED_IN' && currentRoute === '/login') {
    navigateTo('/dashboard');
  }
  
  if (event === 'SIGNED_OUT') {
    navigateTo('/login');
  }
});

// Verificar sessão inicial e redirecionar
async function init() {
  const session = await getSession();
  const currentRoute = getCurrentRoute();

  if (session && (currentRoute === '/login' || currentRoute === '/')) {
    navigateTo('/dashboard');
  } else if (!session && currentRoute !== '/login') {
    navigateTo('/login');
  }

  initRouter();
}

init();
