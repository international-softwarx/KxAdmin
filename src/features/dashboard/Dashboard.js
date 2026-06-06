import { icon } from '../../assets/icons/icons.js';
import { state, pendingDeletions } from '../../shared/utils/state.js';
import { fmtRelative, fmtCents, fmtExpiry, getPlanBadge } from '../../shared/utils/helpers.js';

export function renderDashboard(container) {
  const users   = state.users;
  const premium = users.filter(u => u.isPremium).length;
  const trial   = users.filter(u => !u.isPremium && u.trialDaysLeft > 0).length;
  const free    = users.filter(u => !u.isPremium && u.trialDaysLeft <= 0).length;
  const inactive = users.filter(u => !u.isActive).length;
  const pending  = pendingDeletions().length;

  const expiringSoon = users.filter(u => {
    if (!u.isPremium || !u.premiumExpiry) return false;
    const days = Math.ceil((new Date(u.premiumExpiry) - Date.now()) / 86400000);
    return days >= 0 && days <= 7;
  });

  const recentUsers = [...users]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 6);

  container.innerHTML = `
    <div class="stats-grid">
      <div class="stat-card brand">
        <div class="stat-icon brand">${icon('users', 14)}</div>
        <div class="stat-value">${state.usersTotal || users.length}</div>
        <div class="stat-label">Total usuarios</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-icon blue">${icon('star', 14)}</div>
        <div class="stat-value">${premium}</div>
        <div class="stat-label">Premium activos</div>
      </div>
      <div class="stat-card warn">
        <div class="stat-icon warn">${icon('zap', 14)}</div>
        <div class="stat-value">${trial}</div>
        <div class="stat-label">En trial</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-icon danger">${icon('xCircle', 14)}</div>
        <div class="stat-value">${inactive}</div>
        <div class="stat-label">Inactivos</div>
      </div>
      <div class="stat-card purple">
        <div class="stat-icon purple">${icon('deletionReq', 14)}</div>
        <div class="stat-value">${pending}</div>
        <div class="stat-label">Solicitudes baja</div>
      </div>
      <div class="stat-card">
        <div class="stat-icon default">${icon('gift', 14)}</div>
        <div class="stat-value">${free}</div>
        <div class="stat-label">Cuentas free</div>
      </div>
    </div>

    ${pending > 0 ? `
      <div class="alert alert-warn show" style="margin-bottom:14px">
        ${icon('alertTriangle', 14)} Hay <strong>${pending}</strong> solicitud${pending > 1 ? 'es' : ''} de baja pendiente${pending > 1 ? 's' : ''} por revisar.
        <a href="#" class="dashboard-alert-link" data-goto="deletions">Ver solicitudes →</a>
      </div>
    ` : ''}

    <div class="dashboard-panels">
      <div class="card">
        <div class="card-header">
          <div class="card-title">${icon('clock', 13)} Premium por vencer</div>
          <span class="badge badge-warn">${expiringSoon.length}</span>
        </div>
        ${expiringSoon.length === 0
          ? `<div class="empty-state"><div class="empty-icon">${icon('checkCircle', 20)}</div><p class="empty-title">Todo en orden</p><p class="empty-text">No hay membresías por vencer pronto</p></div>`
          : `<div class="table-scroll"><table><thead><tr><th>Usuario</th><th>Vence</th></tr></thead><tbody>
              ${expiringSoon.map(u => `<tr><td class="mono" style="color:var(--text-1)">${u.username}</td><td>${fmtExpiry(u.premiumExpiry)}</td></tr>`).join('')}
            </tbody></table></div>`
        }
      </div>

      <div class="card">
        <div class="card-header">
          <div class="card-title">${icon('userPlus', 13)} Registros recientes</div>
        </div>
        <div class="table-scroll">
          <table>
            <thead><tr><th>Usuario</th><th>Registro</th><th>Plan</th></tr></thead>
            <tbody>
              ${recentUsers.map(u => `
                <tr>
                  <td style="color:var(--text-1);font-weight:600">${u.username}</td>
                  <td class="dashboard-table-muted">${fmtRelative(u.createdAt)}</td>
                  <td>${getPlanBadge(u)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>
    </div>

    ${renderBillingPreview()}
  `;

  container.querySelector('[data-goto]')?.addEventListener('click', (e) => {
    e.preventDefault();
    document.querySelector(`[data-page="${e.target.dataset.goto}"]`)?.click();
  });
}

function renderBillingPreview() {
  const cfg = state.billingConfig;
  if (!cfg?.plans?.length) return '';
  const plans = cfg.plans.filter(p => p.enabled);
  if (!plans.length) return '';

  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${icon('creditCard', 13)} Planes activos</div>
        <span class="badge badge-info">${plans.length} habilitado${plans.length !== 1 ? 's' : ''}</span>
      </div>
      <div class="dashboard-billing-cards">
        ${plans.map(plan => `
          <div class="dashboard-plan-card">
            <div class="dashboard-plan-key">${plan.key}</div>
            <div class="dashboard-plan-price">${fmtCents(plan.amountCents)}</div>
            <div class="dashboard-plan-days">${plan.premiumDays} días premium</div>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}