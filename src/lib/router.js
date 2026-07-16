/**
 * Router hash-based simples para SPA.
 * Rotas: #/login, #/dashboard, #/new-ticket, #/admin/departments
 */

const routes = {};
let currentCleanup = null;

export function registerRoute(path, handler) {
  routes[path] = handler;
}

export function navigateTo(path) {
  window.location.hash = path;
}

export function getCurrentRoute() {
  return window.location.hash.slice(1) || '/login';
}

async function handleRouteChange() {
  const path = getCurrentRoute();
  const app = document.getElementById('app');

  // Cleanup da página anterior (remover listeners, etc)
  if (currentCleanup && typeof currentCleanup === 'function') {
    currentCleanup();
    currentCleanup = null;
  }

  const handler = routes[path];
  if (handler) {
    currentCleanup = await handler(app);
  } else {
    // Fallback: redireciona para login
    navigateTo('/login');
  }
}

export function initRouter() {
  window.addEventListener('hashchange', handleRouteChange);
  handleRouteChange();
}
