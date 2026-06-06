import { api, setAdminToken, hasSavedToken } from './core/api/apiClient.js';
import { state, setState } from './shared/utils/state.js';

import { renderLogin }    from './features/auth/Login.js';
import { renderDashboard } from './features/dashboard/Dashboard.js';
import { renderUsers, setUsersRefreshCallback } from './features/users/Users.js';
import { renderBilling }  from './features/billing/Billing.js';
import { renderDeletions, setDeletionsRefreshCallback } from './features/requests/Deletions.js';

import { renderSidebar, closeMobileSidebar } from './shared/components/Sidebar.js';
import { renderTopbar, updateTopbar } from './shared/components/Topbar.js';
import { renderTransactions } from './features/transactions/Transactions.js';

async function boot() {
  if (hasSavedToken()) {
    setupShell();
    try {
      await loadAll();
      showApp();
    } catch {
      setAdminToken('');
      showLogin();
    }
  } else {
    showLogin();
  }
}

function showLogin() {
  renderLogin(async () => {
    await loadAll();
    buildShell();
    showApp();
  });
}

function buildShell() {
  document.body.innerHTML = '';
  setupShell();
}

function setupShell() {
  if (document.getElementById('sidebar')) return;

  renderSidebar(navigateTo);

  const main = document.createElement('div');
  main.id = 'appMain';
  main.className = `app-main ${state.sidebarCollapsed ? 'collapsed' : ''}`;
  main.innerHTML = `<div id="pageContainer" class="page-content"></div>`;
  document.body.appendChild(main);

  renderTopbar(state.activePage, async () => {
    await refreshData();
    renderPage(state.activePage);
  }, logout);
}

function navigateTo(page) {
  setState({ activePage: page });
  updateTopbar(page);
  renderPage(page);
  closeMobileSidebar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function renderPage(page) {
  const container = document.getElementById('pageContainer');
  if (!container) return;
  container.innerHTML = '';
  switch (page) {
    case 'dashboard': renderDashboard(container); break;
    case 'users':     renderUsers(container);     break;
    case 'billing':   renderBilling(container);   break;
    case 'transactions': renderTransactions(container); break;
    case 'deletions': renderDeletions(container); break;

    default:          renderDashboard(container);
  }
}

async function loadAll() {
  const [usersData, deletionData, billingData] = await Promise.all([
    api.admin.users(state.usersPage, state.usersLimit),
    api.admin.deletionRequests(),
    api.admin.billingConfig(),
  ]);

  setState({
    users:            usersData.users    || [],
    usersTotal:       usersData.total    || 0,
    deletionRequests: deletionData.requests || [],
    billingConfig:    billingData,
  });
}

async function refreshData() {
  await loadAll();
}

function showApp() {
  setUsersRefreshCallback(refreshData);
  setDeletionsRefreshCallback(refreshData);
  navigateTo(state.activePage || 'dashboard');
}

function logout() {
  setAdminToken('');
  closeMobileSidebar();
  setState({
    users: [], deletionRequests: [], billingConfig: null,
    usersPage: 1, activePage: 'dashboard',
  });
  document.getElementById('sidebar')?.remove();
  document.getElementById('sidebarOverlay')?.remove();
  document.getElementById('appMain')?.remove();
  showLogin();
}

function setupScrollTop() {
  const btn = document.createElement('button');
  btn.className = 'scroll-top';
  btn.title = 'Volver arriba';
  btn.innerHTML = `<svg width="13" height="13" viewBox="0 0 13 13" fill="none"><path d="M6.5 11V2M3 5.5l3.5-3.5L10 5.5" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  document.body.appendChild(btn);
  window.addEventListener('scroll', () => btn.classList.toggle('visible', window.scrollY > 300));
  btn.addEventListener('click', () => window.scrollTo({ top: 0, behavior: 'smooth' }));
}

function init() {
  setupScrollTop();
  boot();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}