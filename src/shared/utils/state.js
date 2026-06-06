const listeners = new Map();

export const state = {
  users:      [],
  usersTotal: 0,
  usersPage:  1,
  usersLimit: 25,
  deletionRequests: [],
  billingConfig: null,
  activePage: 'dashboard',
  sidebarCollapsed: localStorage.getItem('kx_sidebar_collapsed') === '1',
  loading: false,
  searchQuery:   '',
  planFilter:    'all',
  statusFilter:  'all',
  
  // ── Transacciones (nuevos estados) ──────────────────────────
  txPage:   1,
  txTotal:  0,
  txSearch: '',
  txStatus: '',
};

export function setState(patch) {
  Object.assign(state, patch);
  for (const [key, fns] of listeners) {
    if (key === '*' || Object.keys(patch).includes(key)) {
      for (const fn of fns) fn(state[key], state);
    }
  }
}

export function on(key, fn) {
  if (!listeners.has(key)) listeners.set(key, new Set());
  listeners.get(key).add(fn);
  return () => listeners.get(key).delete(fn);
}

on('sidebarCollapsed', (val) => {
  localStorage.setItem('kx_sidebar_collapsed', val ? '1' : '0');
});

export function filteredUsers() {
  const q    = state.searchQuery.toLowerCase().trim();
  const plan = state.planFilter;
  const sts  = state.statusFilter;

  return state.users.filter(u => {
    const byText = !q ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.username || '').toLowerCase().includes(q) ||
      (u.id || '').toLowerCase().includes(q);

    let byPlan = true;
    if (plan === 'premium') byPlan = u.isPremium;
    if (plan === 'trial')   byPlan = !u.isPremium && u.trialDaysLeft > 0;
    if (plan === 'free')    byPlan = !u.isPremium && u.trialDaysLeft <= 0;

    let bySts = true;
    if (sts === 'active')   bySts = u.isActive;
    if (sts === 'inactive') bySts = !u.isActive;

    return byText && byPlan && bySts;
  });
}

export function pendingDeletions() {
  return (state.deletionRequests || []).filter(r => !r.dismissedAt);
}