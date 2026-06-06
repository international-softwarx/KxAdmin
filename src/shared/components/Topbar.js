import { icon } from '../../assets/icons/icons.js';
import { openMobileSidebar } from './Sidebar.js';
import { confirm } from './Modal.js';

const PAGE_META = {
  dashboard: { title: 'Dashboard',            subtitle: 'Vista general de la plataforma' },
  users:     { title: 'Usuarios',             subtitle: 'Gestión de cuentas y accesos' },
  billing:   { title: 'Facturación',          subtitle: 'Planes y configuración de pagos' },
  deletions: { title: 'Solicitudes de baja',  subtitle: 'Revisión de cuentas a eliminar' },
};

export function renderTopbar(page, onRefresh, onLogout) {
  const meta = PAGE_META[page] || { title: page, subtitle: '' };
  const topbar = document.createElement('header');
  topbar.className = 'topbar';
  topbar.id = 'topbar';

  topbar.innerHTML = `
    <button class="btn btn-ghost btn-icon mobile-menu-btn" id="mobileMenuBtn">${icon('menu', 17)}</button>
    <div class="topbar-left">
      <h1 class="page-title" id="pageTitle">${meta.title}</h1>
      <p class="page-subtitle" id="pageSubtitle">${meta.subtitle}</p>
    </div>
    <div class="topbar-right">
      <button class="btn btn-ghost btn-sm" id="refreshBtn">${icon('refresh', 13)} <span class="btn-text">Actualizar</span></button>
      <button class="btn btn-danger btn-sm" id="topbarLogoutBtn">${icon('logout', 13)} <span class="btn-text">Salir</span></button>
      <span class="topbar-status" id="topbarStatus"></span>
    </div>
  `;

  document.getElementById('appMain')?.prepend(topbar);

  document.getElementById('mobileMenuBtn')?.addEventListener('click', openMobileSidebar);

  const refreshBtn = document.getElementById('refreshBtn');
  const status = document.getElementById('topbarStatus');

  const setStatus = (msg, type = '') => {
    if (!status) return;
    status.textContent = msg || '';
    status.className = `topbar-status ${type ? `is-${type}` : ''}`.trim();
  };

  refreshBtn?.addEventListener('click', async () => {
    if (refreshBtn.disabled) return;
    refreshBtn.disabled = true;
    refreshBtn.innerHTML = `<span class="spinner"></span> <span class="btn-text">...</span>`;
    try {
      await onRefresh?.();
      setStatus('Actualizado', 'ok');
    } catch {
      setStatus('Error', 'error');
    } finally {
      refreshBtn.disabled = false;
      refreshBtn.innerHTML = `${icon('refresh', 13)} <span class="btn-text">Actualizar</span>`;
      setTimeout(() => setStatus(''), 2500);
    }
  });

  document.getElementById('topbarLogoutBtn')?.addEventListener('click', async () => {
    const ok = await confirm('¿Cerrar el panel de administración?', 'Salir');
    if (ok) onLogout();
  });
}

export function updateTopbar(page) {
  const meta = PAGE_META[page] || { title: page, subtitle: '' };
  const t = document.getElementById('pageTitle');
  const s = document.getElementById('pageSubtitle');
  if (t) t.textContent = meta.title;
  if (s) s.textContent = meta.subtitle;
}