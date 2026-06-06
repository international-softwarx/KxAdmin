import { icon } from '../../assets/icons/icons.js';
import { api, ApiError } from '../../core/api/apiClient.js';
import { state, setState } from '../../shared/utils/state.js';
import { fmtDate, fmtCents, fmtRelative, showAlert, clearAlert, debounce } from '../../shared/utils/helpers.js';
import { createModal, openModal } from '../../shared/components/Modal.js';

export function renderTransactions(container) {
  container.innerHTML = `
    <div id="txAlert" class="alert"></div>

    <div id="txStatsGrid" class="stats-grid" style="margin-bottom:18px">
      <div class="stat-card green">
        <div class="stat-icon green">${icon('trendingUp', 14)}</div>
        <div class="stat-value" id="statRevenue">—</div>
        <div class="stat-label">Ingresos totales</div>
      </div>
      <div class="stat-card blue">
        <div class="stat-icon blue">${icon('check', 14)}</div>
        <div class="stat-value" id="statApproved">—</div>
        <div class="stat-label">Aprobadas</div>
      </div>
      <div class="stat-card danger">
        <div class="stat-icon danger">${icon('xCircle', 14)}</div>
        <div class="stat-value" id="statCancelled">—</div>
        <div class="stat-label">Canceladas</div>
      </div>
      <div class="stat-card warn">
        <div class="stat-icon warn">${icon('clock', 14)}</div>
        <div class="stat-value" id="statPending">—</div>
        <div class="stat-label">Pendientes</div>
      </div>
      <div class="stat-card brand">
        <div class="stat-icon brand">${icon('creditCard', 14)}</div>
        <div class="stat-value" id="statTotal">—</div>
        <div class="stat-label">Total transacciones</div>
      </div>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-header">
        <div class="card-title">${icon('barChart2', 13)} Ingresos por mes</div>
      </div>
      <div id="monthlyChart" style="padding:14px 16px;min-height:80px;display:flex;align-items:flex-end;gap:6px">
        <span style="color:var(--text-4);font-size:12px">Cargando…</span>
      </div>
    </div>

    <div class="toolbar">
      <div class="toolbar-search input-group">
        <span class="input-icon">${icon('search', 14)}</span>
        <input id="txSearch" class="input" type="text" placeholder="Usuario, email, Transaction ID…" value="">
      </div>
      <select id="txStatusFilter" class="select toolbar-select">
        <option value="">Estado: Todos</option>
        <option value="approved">Aprobadas</option>
        <option value="cancelled">Canceladas</option>
        <option value="pending">Pendientes</option>
      </select>
      <button class="btn btn-ghost btn-md" id="txRefreshBtn">${icon('refresh', 13)} Actualizar</button>
    </div>

    <div class="card">
      <div class="table-scroll">
        <table id="txTable">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Estado</th>
              <th>Monto</th>
              <th>Plan</th>
              <th>Client Tx ID</th>
              <th>Transaction ID</th>
              <th>Fecha</th>
              <th>Acción</th>
            </tr>
          </thead>
          <tbody id="txBody">
            <tr><td colspan="8" class="text-dim" style="padding:30px;text-align:center">Cargando…</td></tr>
          </tbody>
        </table>
      </div>
      <div class="table-footer">
        <span id="txCount" style="font-family:var(--mono);font-size:11px"></span>
        <div class="pagination">
          <button class="btn btn-ghost btn-sm" id="txPrev">${icon('chevronLeft', 13)} Anterior</button>
          <span class="page-info" id="txPageInfo">Pág. 1</span>
          <button class="btn btn-ghost btn-sm" id="txNext">Siguiente ${icon('chevronRight', 13)}</button>
        </div>
      </div>
    </div>
  `;

  setupTxDetailModal();
  loadStats();
  loadTransactions();
  bindTxEvents();
}

function bindTxEvents() {
  document.getElementById('txSearch')?.addEventListener('input', debounce(() => {
    setState({ txSearch: document.getElementById('txSearch')?.value ?? '' });
    setState({ txPage: 1 });
    loadTransactions();
  }, 300));

  document.getElementById('txStatusFilter')?.addEventListener('change', (e) => {
    setState({ txStatus: e.target.value });
    setState({ txPage: 1 });
    loadTransactions();
  });

  document.getElementById('txRefreshBtn')?.addEventListener('click', () => {
    loadStats();
    loadTransactions();
  });

  document.getElementById('txPrev')?.addEventListener('click', () => {
    const page = Math.max(1, (state.txPage ?? 1) - 1);
    setState({ txPage: page });
    loadTransactions();
  });

  document.getElementById('txNext')?.addEventListener('click', () => {
    const page = (state.txPage ?? 1) + 1;
    setState({ txPage: page });
    loadTransactions();
  });

  document.getElementById('txBody')?.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-tx-id]');
    if (!btn) return;
    openTxDetail(btn.dataset.txId);
  });
}

async function loadStats() {
  try {
    const stats = await api.admin.transactionStats();
    const el = (id) => document.getElementById(id);
    if (el('statRevenue'))  el('statRevenue').textContent  = fmtCents(stats.totalRevenueCents);
    if (el('statApproved')) el('statApproved').textContent = stats.totalApproved;
    if (el('statCancelled'))el('statCancelled').textContent= stats.totalCancelled;
    if (el('statPending'))  el('statPending').textContent  = stats.totalPending;
    if (el('statTotal'))    el('statTotal').textContent    = stats.totalApproved + stats.totalCancelled + stats.totalPending;
    renderMonthlyChart(stats.revenueByMonth ?? []);
  } catch {}
}

function renderMonthlyChart(months) {
  const container = document.getElementById('monthlyChart');
  if (!container) return;
  if (!months.length) {
    container.innerHTML = `<span style="color:var(--text-4);font-size:12px">Sin datos aún</span>`;
    return;
  }

  const maxVal = Math.max(...months.map(m => m.revenueCents), 1);
  const sorted = [...months].sort((a, b) => a.month.localeCompare(b.month));
  const barW = Math.min(54, Math.floor((container.offsetWidth || 600) / sorted.length) - 8);

  container.innerHTML = sorted.map(m => {
    const pct = Math.max(4, Math.round((m.revenueCents / maxVal) * 120));
    const label = m.month.slice(0, 7);
    return `
      <div style="display:flex;flex-direction:column;align-items:center;gap:4px;flex:1;max-width:${barW + 8}px">
        <span style="font-size:10px;color:var(--text-2);font-family:var(--mono)">${fmtCents(m.revenueCents)}</span>
        <div style="width:${barW}px;height:${pct}px;background:var(--accent);border-radius:4px 4px 0 0;opacity:0.8;min-height:4px"></div>
        <span style="font-size:9px;color:var(--text-4);font-family:var(--mono);white-space:nowrap">${label}</span>
        <span style="font-size:9px;color:var(--text-4)">${m.count} tx</span>
      </div>
    `;
  }).join('');
}

async function loadTransactions() {
  const tbody = document.getElementById('txBody');
  if (!tbody) return;
  tbody.innerHTML = `<tr><td colspan="8" style="padding:24px;text-align:center;color:var(--text-4)">Cargando…</td></tr>`;

  try {
    const page   = state.txPage ?? 1;
    const limit  = 20;
    const status = state.txStatus ?? '';
    const search = state.txSearch ?? '';
    const result = await api.admin.transactions({ page, limit, status, search });

    setState({ txTotal: result.total });

    const count   = document.getElementById('txCount');
    const pageInfo= document.getElementById('txPageInfo');
    const prev    = document.getElementById('txPrev');
    const next    = document.getElementById('txNext');

    if (count)    count.textContent    = `${result.total} transacciones`;
    if (pageInfo) pageInfo.textContent = `Pág. ${page}`;
    if (prev)     prev.disabled        = page <= 1;
    if (next)     next.disabled        = page * limit >= result.total;

    if (!result.transactions.length) {
      tbody.innerHTML = `<tr><td colspan="8"><div class="empty-state">
        <div class="empty-icon">${icon('creditCard', 22)}</div>
        <p class="empty-title">Sin transacciones</p>
        <p class="empty-text">Ajusta los filtros o espera nuevos pagos</p>
      </div></td></tr>`;
      return;
    }

    tbody.innerHTML = result.transactions.map(tx => `
      <tr>
        <td>
          <div style="font-weight:600;color:var(--text-1);font-size:12.5px">${tx.username}</div>
          <div style="font-size:11px;color:var(--text-4);font-family:var(--mono)">${tx.email}</div>
        </td>
        <td>${txStatusBadge(tx.status)}</td>
        <td style="font-family:var(--mono);font-size:12px;color:var(--text-1)">${tx.amount != null ? fmtCents(tx.amount) : '—'}</td>
        <td style="font-size:11px;color:var(--text-3)">${tx.planKey ?? '—'}${tx.grantedDays ? ` (${tx.grantedDays}d)` : ''}</td>
        <td style="font-family:var(--mono);font-size:11px;color:var(--text-3)">${tx.clientTransactionId}</td>
        <td style="font-family:var(--mono);font-size:11px;color:var(--text-3)">${tx.transactionId}</td>
        <td style="font-size:11.5px;color:var(--text-4)">${fmtRelative(tx.processedAt)}</td>
        <td>
          <button class="btn btn-ghost btn-xs" data-tx-id="${tx.id}" title="Ver detalle">${icon('eye', 12)}</button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    showAlert('txAlert', err instanceof ApiError ? err.message : 'Error cargando transacciones.');
    if (tbody) tbody.innerHTML = '';
  }
}

function txStatusBadge(status) {
  if (status === 'approved')  return `<span class="badge badge-active">✓ Aprobada</span>`;
  if (status === 'cancelled') return `<span class="badge badge-inactive">✗ Cancelada</span>`;
  return `<span class="badge badge-pending">⏳ Pendiente</span>`;
}

function setupTxDetailModal() {
  createModal({
    id: 'txDetailModal',
    title: 'Detalle de transacción',
    iconName: 'creditCard',
    maxWidth: '560px',
    body: `<div id="txDetailContent"></div>`,
  });
}

async function openTxDetail(txId) {
  const content = document.getElementById('txDetailContent');
  if (!content) return;
  content.innerHTML = `<p style="color:var(--text-4);font-size:13px;text-align:center;padding:20px">Cargando…</p>`;
  openModal('txDetailModal');

  try {
    const tx = await api.admin.transactionById(txId);
    let webhookParsed = null;
    try { webhookParsed = tx.rawWebhookSummary ? JSON.parse(tx.rawWebhookSummary) : null; } catch {}

    content.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;padding-bottom:14px;border-bottom:1px solid var(--border);margin-bottom:14px">
        <div style="flex:1">
          <div style="font-size:15px;font-weight:700;color:var(--text-1);margin-bottom:4px">${tx.username}</div>
          <div style="font-size:12px;color:var(--text-4);font-family:var(--mono)">${tx.email}</div>
        </div>
        ${txStatusBadge(tx.status)}
        ${tx.amount != null ? `<span style="font-family:var(--mono);font-size:16px;font-weight:700;color:var(--text-1)">${fmtCents(tx.amount)}</span>` : ''}
      </div>

      <div class="user-detail-grid">
        ${dr('Plan', tx.planKey ?? '—')}
        ${dr('Días otorgados', tx.grantedDays ? `${tx.grantedDays} días` : '—')}
        ${dr('Client Tx ID', `<span class="mono" style="font-size:11px;word-break:break-all">${tx.clientTransactionId}</span>`)}
        ${dr('Transaction ID', `<span class="mono" style="font-size:11px">${tx.transactionId}</span>`)}
        ${dr('Store ID', tx.storeId ? `<span class="mono" style="font-size:11px">••••${String(tx.storeId).slice(-6)}</span>` : '—')}
        ${dr('Status Code PayPhone', tx.statusCode ?? '—')}
        ${dr('Transaction Status', tx.transactionStatus ?? '—')}
        ${dr('Procesado', fmtDate(tx.processedAt))}
        ${dr('Registrado', fmtDate(tx.createdAt))}
        ${dr('User ID', `<span class="mono" style="font-size:10px;word-break:break-all">${tx.userId}</span>`)}
      </div>

      ${webhookParsed ? `
        <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:14px">
          <div style="font-size:10px;font-weight:700;text-transform:uppercase;letter-spacing:.08em;color:var(--text-4);margin-bottom:8px">Datos del webhook</div>
          <pre style="background:var(--bg-3,#111820);color:var(--text-2);font-size:11px;padding:10px 12px;border-radius:6px;overflow-x:auto;border:1px solid var(--border)">${JSON.stringify(webhookParsed, null, 2)}</pre>
        </div>
      ` : ''}

      <div style="margin-top:14px;border-top:1px solid var(--border);padding-top:12px">
        <div style="font-size:11px;color:var(--text-4);line-height:1.7">
          ${tx.status === 'approved'
            ? `<span style="color:var(--green)">✓</span> El pago fue aprobado por PayPhone (StatusCode ${tx.statusCode ?? '3'}) y el premium fue activado/extendido.`
            : tx.status === 'cancelled'
              ? `<span style="color:var(--red)">✗</span> El pago fue cancelado o rechazado por PayPhone (StatusCode ${tx.statusCode ?? 'N/D'}). No se otorgó acceso premium.`
              : `<span style="color:var(--yellow)">⏳</span> Transacción en estado pendiente. Esperando confirmación del webhook de PayPhone.`
          }
        </div>
      </div>
    `;
  } catch (err) {
    if (content) content.innerHTML = `<p style="color:var(--red);font-size:13px;text-align:center;padding:20px">Error: ${err instanceof ApiError ? err.message : 'No se pudo cargar.'}</p>`;
  }
}

function dr(key, val) {
  return `<div class="detail-row"><span class="detail-key">${key}</span><span class="detail-val">${val ?? '—'}</span></div>`;
}