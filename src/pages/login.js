/**
 * Página de Login (sem cadastro público)
 * O cadastro de novos usuários é feito apenas pelo Admin.
 */
import { signIn } from '../lib/auth.js';
import { navigateTo } from '../lib/router.js';
import { showToast } from '../lib/toast.js';

export async function renderLogin(container) {
  let loading = false;

  function render() {
    container.innerHTML = `
      <div class="login-wrapper">
        <div class="login-card">
          <div class="login-logo">
            <svg width="48" height="48" viewBox="0 0 48 48" fill="none">
              <rect width="48" height="48" rx="12" fill="#1a73e8"/>
              <path d="M14 18h20M14 24h14M14 30h18" stroke="white" stroke-width="2.5" stroke-linecap="round"/>
              <circle cx="36" cy="32" r="6" fill="#4ade80" stroke="white" stroke-width="2"/>
              <path d="M34 32l1.5 1.5L37.5 31" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
            </svg>
            <h1>Chamados</h1>
            <p>Gestão Intersetorial</p>
          </div>

          <form class="login-form" id="loginForm">
            <div class="form-group">
              <label for="email">E-mail</label>
              <input type="email" id="email" class="input" placeholder="seu@email.com" required />
            </div>

            <div class="form-group">
              <label for="password">Senha</label>
              <input type="password" id="password" class="input" placeholder="Sua senha" required minlength="6" />
            </div>

            <button type="submit" class="btn btn-primary btn-lg" id="submitBtn" ${loading ? 'disabled' : ''}>
              ${loading ? '<span class="spinner" style="width:20px;height:20px;border-width:2px;margin:0;"></span>' : 'Entrar'}
            </button>
          </form>

          <div class="login-hint">
            <p>Acesso restrito. Solicite seu cadastro ao administrador do sistema.</p>
          </div>
        </div>
      </div>
    `;

    document.getElementById('loginForm')?.addEventListener('submit', handleSubmit);
  }

  async function handleSubmit(e) {
    e.preventDefault();
    if (loading) return;

    // Captura os valores ANTES de re-renderizar
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;

    loading = true;
    render();

    try {

      await signIn(email, password);
      showToast('Login realizado!', 'success');
      navigateTo('/dashboard');
    } catch (err) {
      console.error(err);
      let msg = 'Erro ao fazer login';
      if (err.message?.includes('Invalid login')) msg = 'E-mail ou senha inválidos';
      else if (err.message) msg = err.message;
      showToast(msg, 'error');
    } finally {
      loading = false;
      render();
    }
  }

  render();
}
