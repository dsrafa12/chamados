/**
 * Toast notification utility
 */

export function showToast(message, type = 'info') {
  // Remove toast anterior se existir
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.textContent = message;
  document.body.appendChild(toast);

  // Remove após 3s
  setTimeout(() => {
    toast.remove();
  }, 3000);
}
