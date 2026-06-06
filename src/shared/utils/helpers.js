export function fmtDate(value, opts = {}) {
  if (!value) return '—';
  const d = new Date(value);
  if (isNaN(d.getTime())) return '—';
  const defaults = { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' };
  return d.toLocaleString('es-CO', { ...defaults, ...opts });
}

export function fmtDateShort(value) {
  return fmtDate(value, { hour: undefined, minute: undefined });
}

export function fmtRelative(value) {
  if (!value) return '—';
  const diff = Math.floor((Date.now() - new Date(value)) / 1000);
  if (diff < 60)   return 'hace un momento';
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`;
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)} h`;
  if (diff < 86400 * 7) return `hace ${Math.floor(diff / 86400)} días`;
  return fmtDateShort(value);
}

export function daysUntil(value) {
  if (!value) return null;
  return Math.ceil((new Date(value) - Date.now()) / (1000 * 60 * 60 * 24));
}

export function fmtExpiry(value) {
  if (!value) return '<span class="text-muted">Sin vencimiento</span>';
  const days = daysUntil(value);
  const date = fmtDateShort(value);
  if (days === null) return '—';
  if (days < 0)  return `<span class="text-danger">Vencido (${date})</span>`;
  if (days === 0) return `<span class="text-warn">Vence hoy</span>`;
  if (days <= 7)  return `<span class="text-warn">${days}d (${date})</span>`;
  return `<span class="text-dim">${date}</span>`;
}

export function fmtCents(cents) {
  if (cents === undefined || cents === null) return '—';
  return new Intl.NumberFormat('es-CO', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

export function initials(name = '') {
  return name.trim().slice(0, 2).toUpperCase() || '??';
}

export function truncate(str, n = 40) {
  if (!str) return '—';
  return str.length > n ? str.slice(0, n) + '…' : str;
}

export const $ = (id) => document.getElementById(id);

export function showAlert(targetId, message, type = 'error') {
  const el = $(targetId);
  if (!el) return;
  el.className = `alert alert-${type} show`;
  el.innerHTML = message;
  if (type !== 'error') {
    setTimeout(() => clearAlert(targetId), 4500);
  }
}

export function clearAlert(targetId) {
  const el = $(targetId);
  if (el) { el.className = 'alert'; el.innerHTML = ''; }
}

export function debounce(fn, ms = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}

export function getPlanBadge(user) {
  if (user.isPremium) return `<span class="badge badge-premium">⭐ Premium</span>`;
  if (user.trialDaysLeft > 0) return `<span class="badge badge-trial">⚡ Trial ${user.trialDaysLeft}d</span>`;
  return `<span class="badge badge-free">Free</span>`;
}

export function getStatusBadge(user) {
  return user.isActive
    ? `<span class="badge badge-active">● Activo</span>`
    : `<span class="badge badge-inactive">● Inactivo</span>`;
}

export function getPaymentBadge(status) {
  if (!status) return '<span class="text-muted">—</span>';
  const map = {
    completed: `<span class="badge badge-active">✓ OK</span>`,
    pending:   `<span class="badge badge-pending">⏳ Pend.</span>`,
    cancelled: `<span class="badge badge-inactive">✗ Canc.</span>`,
  };
  return map[status] || `<span class="text-dim">${status}</span>`;
}