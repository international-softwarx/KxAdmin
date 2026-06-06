import API_URL from '../config/index.js';

const API_BASE = API_URL.replace(/\/$/, '');
const ADMIN_TOKEN_KEY = 'kx_admin_token';

export class ApiError extends Error {
  constructor(message, code = 500, payload = null) {
    super(message);
    this.name = 'ApiError';
    this.code = code;
    this.payload = payload;
  }
}

let _adminToken = localStorage.getItem(ADMIN_TOKEN_KEY) || '';

function url(path) {
  return path.startsWith('/') ? `${API_BASE}${path}` : `${API_BASE}/${path}`;
}

async function request(method, path, { body, auth, admin, headers = {} } = {}) {
  const h = { Accept: 'application/json', ...headers };

  if (body !== undefined && body !== null) h['Content-Type'] = 'application/json';
  if (auth) {
    const t = localStorage.getItem('kx_token');
    if (t) h.Authorization = `Bearer ${t}`;
  }
  if (admin) {
    if (!_adminToken) throw new ApiError('Sin token de administrador.', 401);
    h['x-admin-token'] = _adminToken;
  }

  const res = await fetch(url(path), {
    method,
    headers: h,
    body: body !== undefined && body !== null ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  let payload = null;
  try { payload = text ? JSON.parse(text) : null; } catch { payload = null; }

  if (!res.ok || payload?.success === false) {
    const msg = payload?.error || payload?.message || `HTTP ${res.status}`;
    throw new ApiError(msg, res.status, payload);
  }

  return payload?.data ?? payload;
}

export function setAdminToken(token) {
  _adminToken = (token || '').trim();
  if (_adminToken) localStorage.setItem(ADMIN_TOKEN_KEY, _adminToken);
  else localStorage.removeItem(ADMIN_TOKEN_KEY);
}

export function getAdminToken() { return _adminToken; }
export function hasSavedToken() { return Boolean(localStorage.getItem(ADMIN_TOKEN_KEY)); }

export const api = {
  admin: {
    users:         (page = 1, limit = 25) => request('GET', `/admin/users?page=${page}&limit=${limit}`, { admin: true }),
    createUser:    (body) => request('POST', '/admin/users', { admin: true, body }),
    setPremium:    (id, isPremium, days = 0) => request('PATCH', `/admin/users/${id}/premium`, { admin: true, body: { isPremium, days } }),
    removePremium: (id) => request('PATCH', `/admin/users/${id}/premium`, { admin: true, body: { isPremium: false, days: 0 } }),
    setStatus:     (id, isActive, reason = '', clearDeletionRequest = true) =>
      request('PATCH', `/admin/users/${id}/status`, { admin: true, body: { isActive, reason, clearDeletionRequest } }),
    deleteUser:    (id) => request('DELETE', `/admin/users/${id}`, { admin: true }),
    adjustTrial:   (id, trialDays, resetTrial = true) => request('PATCH', `/admin/users/${id}/trial`, { admin: true, body: { trialDays, resetTrial } }),
    removeTrial:   (id) => request('PATCH', `/admin/users/${id}/trial`, { admin: true, body: { trialDays: 0, resetTrial: true } }),
    grantTrial:    (email, days) => request('POST', '/admin/grant-trial', { admin: true, body: { email, days } }),
    deletionRequests: () => request('GET', '/admin/deletion-requests', { admin: true }),
    dismissDeletion:  (id) => request('PATCH', `/admin/users/${id}/deletion-request/dismiss`, { admin: true }),
    billingConfig:       () => request('GET', '/admin/billing/config', { admin: true }),
    updateBillingConfig: (body) => request('PATCH', '/admin/billing/config', { admin: true, body }),
    resetMachineLimit: (id) => request('PATCH', `/admin/users/${id}/machine-limit-reset`, { admin: true }),
    machineAccounts:   (machineId) => request('GET', `/auth/machine-accounts`, { admin: true, headers: { 'x-machine-id': machineId } }),
    cleanupDeletionRequests: () => request('PATCH', '/admin/deletion-requests/cleanup', { admin: true }),
    
    // ── Transacciones (nuevos métodos) ──────────────────────────
    transactions: ({ page = 1, limit = 20, status = '', search = '' } = {}) => {
      const params = new URLSearchParams({ page: String(page), limit: String(limit) });
      if (status) params.set('status', status);
      if (search) params.set('search', search);
      return request('GET', `/admin/transactions?${params}`, { admin: true });
    },
    transactionStats: () => request('GET', '/admin/transactions/stats', { admin: true }),
    transactionById:  (id) => request('GET', `/admin/transactions/${id}`, { admin: true }),
  },
};