import { icon } from '../../assets/icons/icons.js';
import { api, ApiError } from '../../core/api/apiClient.js';
import { state, setState } from '../../shared/utils/state.js';
import { fmtDate, fmtCents, showAlert, clearAlert } from '../../shared/utils/helpers.js';

export function renderBilling(container) {
  const cfg     = state.billingConfig;
  const plans   = cfg?.plans || [];
  const monthly = plans.find(p => p.key === 'monthly') || {};
  const annual  = plans.find(p => p.key === 'annual')  || {};

  container.innerHTML = `
    <div id="billingAlert" class="alert"></div>

    <div class="billing-layout">
      <div class="billing-config-column">
        ${renderPlanForm('monthly', monthly, 'Plan mensual', 'creditCard')}
        ${renderPlanForm('annual',  annual,  'Plan anual',   'star')}
        <button class="btn btn-primary btn-lg btn-block" id="saveBillingBtn">
          ${icon('check', 14)} Guardar configuración
        </button>
      </div>

      <div class="billing-side-column">
        <div class="card">
          <div class="card-header">
            <div class="card-title">${icon('eye', 13)} Vista previa</div>
          </div>
          <p class="billing-help-text">Así verán los planes los usuarios:</p>
          <div id="billingPreview" class="billing-preview-list">
            ${renderPlanPreview(monthly, 'monthly')}
            ${renderPlanPreview(annual, 'annual')}
          </div>
        </div>

        <div class="card">
          <div class="card-header">
            <div class="card-title">${icon('info', 13)} Información</div>
          </div>
          <div class="billing-info-list">
            <div>${icon('shield', 12)} Token de PayPhone solo en backend.</div>
            <div>${icon('zap', 12)} Cambios aplican en nuevos checkouts de inmediato.</div>
            <div>${icon('clock', 12)} Última actualización: <strong>${fmtDate(cfg?.updatedAt)}</strong></div>
            <div>${icon('creditCard', 12)} Mínimo 1 plan habilitado.</div>
          </div>
        </div>
      </div>
    </div>
  `;

  // Live preview
  ['monthly', 'annual'].forEach(key => {
    ['Amount', 'Days', 'Title', 'Enabled'].forEach(field => {
      document.getElementById(`${key}${field}`)?.addEventListener('input', updatePreview);
      document.getElementById(`${key}${field}`)?.addEventListener('change', updatePreview);
    });

    document.getElementById(`${key}Amount`)?.addEventListener('input', (e) => {
      const hint = document.getElementById(`${key}AmountHint`);
      if (hint) hint.textContent = `= ${fmtCents(parseInt(e.target.value, 10) || 0)}`;
    });
  });

  document.getElementById('saveBillingBtn')?.addEventListener('click', saveBilling);
}

function renderPlanForm(key, plan, title, iconName) {
  return `
    <div class="card">
      <div class="card-header">
        <div class="card-title">${icon(iconName, 13)} ${title}</div>
        <label class="toggle">
          <input type="checkbox" id="${key}Enabled" ${plan.enabled ? 'checked' : ''} />
          <span class="toggle-track"><span class="toggle-thumb"></span></span>
          <span class="toggle-label-text">Habilitado</span>
        </label>
      </div>
      <div style="padding:14px;display:flex;flex-direction:column;gap:12px">
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Título</label>
            <input id="${key}Title" class="input" type="text" value="${plan.title || ''}" maxlength="80" />
          </div>
          <div class="form-group">
            <label class="form-label">Monto en centavos</label>
            <div class="input-group">
              <span class="input-icon billing-cents-icon">¢</span>
              <input id="${key}Amount" class="input mono" type="number" min="1" value="${plan.amountCents || ''}" />
            </div>
            <span class="form-hint" id="${key}AmountHint">= ${fmtCents(plan.amountCents || 0)}</span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Días de premium otorgados</label>
          <input id="${key}Days" class="input" type="number" min="1" max="3650" value="${plan.premiumDays || ''}" />
        </div>
        <div class="form-group">
          <label class="form-label">Checkout URL <span style="color:var(--text-4);font-weight:400">(solo lectura)</span></label>
          <input class="input mono billing-readonly" type="text" value="${plan.checkoutUrl || '—'}" readonly />
          <span class="form-hint">Gestionado automáticamente por PayPhone</span>
        </div>
      </div>
    </div>
  `;
}

function renderPlanPreview(plan, key) {
  const label = key === 'monthly' ? 'Mensual' : 'Anual';
  if (!plan?.enabled) {
    return `<div class="billing-preview-card is-disabled"><span class="badge badge-free">${label} — Deshabilitado</span></div>`;
  }
  return `
    <div class="billing-preview-card ${key === 'annual' ? 'is-featured' : ''}">
      ${key === 'annual' ? `<div class="billing-preview-badge"><span class="badge badge-premium">Recomendado</span></div>` : ''}
      <div class="billing-preview-title">${plan.title || label}</div>
      <div class="billing-preview-price">${fmtCents(plan.amountCents)}</div>
      <div class="billing-preview-meta">${plan.premiumDays} días de acceso premium</div>
    </div>
  `;
}

function updatePreview() {
  const preview = document.getElementById('billingPreview');
  if (!preview) return;
  const g = (id) => document.getElementById(id);
  const monthly = {
    key: 'monthly', enabled: g('monthlyEnabled')?.checked,
    title: g('monthlyTitle')?.value, amountCents: parseInt(g('monthlyAmount')?.value, 10) || 0,
    premiumDays: parseInt(g('monthlyDays')?.value, 10) || 0,
  };
  const annual = {
    key: 'annual', enabled: g('annualEnabled')?.checked,
    title: g('annualTitle')?.value, amountCents: parseInt(g('annualAmount')?.value, 10) || 0,
    premiumDays: parseInt(g('annualDays')?.value, 10) || 0,
  };
  preview.innerHTML = renderPlanPreview(monthly, 'monthly') + renderPlanPreview(annual, 'annual');
}

async function saveBilling() {
  clearAlert('billingAlert');
  const btn = document.getElementById('saveBillingBtn');
  if (!btn) return;
  btn.disabled = true;

  const g = (id) => document.getElementById(id);
  const plans = [
    {
      key: 'monthly',
      title:       g('monthlyTitle')?.value.trim() || 'Membresía mensual',
      amountCents: Math.max(1, parseInt(g('monthlyAmount')?.value, 10) || 1),
      premiumDays: Math.max(1, parseInt(g('monthlyDays')?.value, 10) || 30),
      enabled:     g('monthlyEnabled')?.checked ?? true,
    },
    {
      key: 'annual',
      title:       g('annualTitle')?.value.trim() || 'Membresía anual',
      amountCents: Math.max(1, parseInt(g('annualAmount')?.value, 10) || 1),
      premiumDays: Math.max(1, parseInt(g('annualDays')?.value, 10) || 365),
      enabled:     g('annualEnabled')?.checked ?? true,
    },
  ];

  if (!plans.some(p => p.enabled)) {
    showAlert('billingAlert', 'Debes dejar al menos un plan habilitado.');
    btn.disabled = false;
    return;
  }

  try {
    const result = await api.admin.updateBillingConfig({ plans });
    setState({ billingConfig: result });
    showAlert('billingAlert', 'Configuración guardada correctamente.', 'success');
  } catch (err) {
    showAlert('billingAlert', err instanceof ApiError ? err.message : 'Error al guardar configuración.');
  } finally {
    btn.disabled = false;
  }
}