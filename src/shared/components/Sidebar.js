import { icon } from '../../assets/icons/icons.js';
import { state, setState, on, pendingDeletions } from '../utils/state.js';

const NAV_ITEMS = [
  { id: 'dashboard',    label: 'Dashboard',           icon: 'dashboard',   section: 'Principal' },
  { id: 'users',        label: 'Usuarios',             icon: 'users',       section: 'Gestión' },
  { id: 'billing',      label: 'Facturación',          icon: 'creditCard',  section: 'Gestión' },
  { id: 'transactions', label: 'Transacciones',        icon: 'creditCard',  section: 'Gestión' },
  { id: 'deletions',    label: 'Solicitudes de baja',  icon: 'deletionReq', section: 'Gestión', badge: true },
];

export function renderSidebar(onNavigate) {
  const sidebar = document.createElement('nav');
  sidebar.className = `sidebar ${state.sidebarCollapsed ? 'collapsed' : ''}`;
  sidebar.id = 'sidebar';

  sidebar.innerHTML = `
    <div class="sidebar-header">
    <div class="logo">
        <div class="logo-mark">
          <img src="assets/images/logo.png" alt="Kx" onerror="this.style.display='none';this.parentElement.textContent='Kx'" />
        </div>
        <span class="logo-text">Admin</span>
      </div>
      <button class="sidebar-toggle" id="sidebarToggle" title="Colapsar">
        ${icon(state.sidebarCollapsed ? 'chevronRight' : 'chevronLeft', 14)}
      </button>
    </div>
    <div class="sidebar-nav" id="sidebarNav"></div>
    <div class="sidebar-footer">
      <div class="sidebar-user">
        <div class="sidebar-user-avatar">AD</div>
        <div class="sidebar-user-info">
          <div class="sidebar-user-name">Administrador</div>
          <div class="sidebar-user-role">Control total</div>
        </div>
      </div>
    </div>
  `;

  document.body.prepend(sidebar);
  renderNav(sidebar, onNavigate);

  document.getElementById('sidebarToggle')?.addEventListener('click', () => {
    const collapsed = !state.sidebarCollapsed;
    setState({ sidebarCollapsed: collapsed });
    sidebar.classList.toggle('collapsed', collapsed);
    document.getElementById('appMain')?.classList.toggle('collapsed', collapsed);
    const btn = document.getElementById('sidebarToggle');
    if (btn) btn.innerHTML = icon(collapsed ? 'chevronRight' : 'chevronLeft', 14);
  });

  on('deletionRequests', () => updateBadge());
  on('activePage', (page) => highlightActive(page));

  addMobileOverlay();
}

function renderNav(sidebar, onNavigate) {
  const nav = document.getElementById('sidebarNav');
  if (!nav) return;

  let lastSection = '';
  let html = '';

  for (const item of NAV_ITEMS) {
    if (item.section !== lastSection) {
      html += `<div class="nav-section-label">${item.section}</div>`;
      lastSection = item.section;
    }
    const pending = item.badge ? pendingDeletions().length : 0;
    const isActive = state.activePage === item.id;

    html += `
      <div class="nav-item ${isActive ? 'active' : ''}" data-page="${item.id}" role="button" tabindex="0">
        <span class="nav-icon">${icon(item.icon, 16)}</span>
        <span class="nav-label">${item.label}</span>
        <span class="nav-badge" id="badge-${item.id}" style="${pending > 0 ? '' : 'display:none'}">${pending}</span>
      </div>
    `;
  }

  nav.innerHTML = html;

  nav.addEventListener('click', (e) => {
    const item = e.target.closest('[data-page]');
    if (!item) return;
    setState({ activePage: item.dataset.page });
    onNavigate(item.dataset.page);
  });

  nav.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    const item = e.target.closest('[data-page]');
    if (item) { setState({ activePage: item.dataset.page }); onNavigate(item.dataset.page); }
  });
}

function highlightActive(page) {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
}

function updateBadge() {
  const count = pendingDeletions().length;
  const badge = document.getElementById('badge-deletions');
  if (badge) {
    badge.textContent = count;
    badge.style.display = count > 0 ? 'flex' : 'none';
  }
}

function addMobileOverlay() {
  let overlay = document.getElementById('sidebarOverlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'sidebarOverlay';
    overlay.className = 'sidebar-overlay';
    document.body.appendChild(overlay);
  }
  overlay.onclick = closeMobileSidebar;
}

export function openMobileSidebar() {
  document.getElementById('sidebar')?.classList.add('mobile-open');
  document.getElementById('sidebarOverlay')?.classList.add('show');
  document.body.style.overflow = 'hidden';
}

export function closeMobileSidebar() {
  document.getElementById('sidebar')?.classList.remove('mobile-open');
  document.getElementById('sidebarOverlay')?.classList.remove('show');
  document.body.style.overflow = '';
}