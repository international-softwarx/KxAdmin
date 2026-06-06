import { icon } from '../../assets/icons/icons.js';
import { api, ApiError } from '../../core/api/apiClient.js';
import { state, setState, filteredUsers } from '../../shared/utils/state.js';
import {
  fmtDate, fmtDateShort, fmtExpiry, fmtRelative,
  getPlanBadge, getStatusBadge, getPaymentBadge,
  showAlert, clearAlert, debounce, initials, truncate,
} from '../../shared/utils/helpers.js';
import { createModal, openModal, closeModal, confirm, prompt } from '../../shared/components/Modal.js';

let onRefreshCallback = null;
export function setUsersRefreshCallback(fn) { onRefreshCallback = fn; }

export function renderUsers(container) {
  container.innerHTML = `
    <div id="usersAlert" class="alert"></div>

    <div class="toolbar">
      <div class="toolbar-search input-group">
        <span class="input-icon">${icon('search', 14)}</span>
        <input id="userSearch" class="input" type="text" placeholder="Buscar usuario, email o ID…" value="${state.searchQuery}">
      </div>
      <select id="planFilter" class="select toolbar-select">
        <option value="all" ${state.planFilter === 'all' ? 'selected' : ''}>Plan: Todos</option>
        <option value="premium" ${state.planFilter === 'premium' ? 'selected' : ''}>Premium</option>
        <option value="trial" ${state.planFilter === 'trial' ? 'selected' : ''}>Trial</option>
        <option value="free" ${state.planFilter === 'free' ? 'selected' : ''}>Free</option>
      </select>
      <select id="statusFilter" class="select toolbar-select">
        <option value="all" ${state.statusFilter === 'all' ? 'selected' : ''}>Estado: Todos</option>
        <option value="active" ${state.statusFilter === 'active' ? 'selected' : ''}>Activos</option>
        <option value="inactive" ${state.statusFilter === 'inactive' ? 'selected' : ''}>Inactivos</option>
      </select>
      <button class="btn btn-primary btn-md" id="createUserModalBtn">${icon('userPlus', 13)} Crear usuario</button>
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="table-scroll">
        <table id="usersTable">
          <thead>
            <tr>
              <th>Usuario</th>
              <th>Email</th>
              <th>Estado</th>
              <th>Plan</th>
              <th style="text-align:center">Trial</th>
              <th>Premium expira</th>
              <th style="text-align:center">Pago</th>
              <th style="text-align:center">Sesiones</th>
              <th style="text-align:center">Equipo</th>
              <th>Registro</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody id="usersBody">
            <tr><td colspan="11" class="text-dim" style="padding:30px;text-align:center">Cargando…</td></tr>
          </tbody>
        </table>
      </div>
      <div class="table-footer">
        <span id="usersCount" class="users-count"></span>
        <div class="pagination">
          <button class="btn btn-ghost btn-sm" id="prevPage">${icon('chevronLeft', 13)} Anterior</button>
          <span class="page-info" id="pageInfo">Pág. ${state.usersPage}</span>
          <button class="btn btn-ghost btn-sm" id="nextPage">Siguiente ${icon('chevronRight', 13)}</button>
        </div>
      </div>
    </div>

    <div class="card">
      <div class="card-header">
        <div class="card-title">${icon('gift', 13)} Acceso temporal rápido</div>
      </div>
      <div class="grid-2" style="padding:14px 14px 16px;align-items:end;gap:12px">
        <div class="form-group">
          <label class="form-label">Email del usuario</label>
          <div class="input-group">
            <span class="input-icon">${icon('mail', 14)}</span>
            <input id="trialEmail" class="input" type="email" placeholder="usuario@ejemplo.com">
          </div>
        </div>
        <div style="display:flex;align-items:end;gap:8px">
          <div class="form-group" style="width:80px">
            <label class="form-label">Días</label>
            <input id="trialDays" class="input" type="number" min="1" max="365" value="7">
          </div>
          <button class="btn btn-ok btn-md" id="grantTrialBtn">${icon('gift', 13)} Otorgar trial</button>
        </div>
      </div>
    </div>
  `;

  renderUsersTable();
  bindUsersEvents();
  setupCreateUserModal();
  setupUserDetailModal();
}

function renderUsersTable() {
  const users = filteredUsers();
  const tbody  = document.getElementById('usersBody');
  const count  = document.getElementById('usersCount');
  const pageInfo = document.getElementById('pageInfo');
  const prevBtn  = document.getElementById('prevPage');
  const nextBtn  = document.getElementById('nextPage');

  if (count) count.textContent = `${users.length} usuario${users.length !== 1 ? 's' : ''} (total: ${state.usersTotal})`;
  if (pageInfo) pageInfo.textContent = `Pág. ${state.usersPage}`;
  if (prevBtn) prevBtn.disabled = state.usersPage <= 1;
  if (nextBtn) nextBtn.disabled = state.usersPage * state.usersLimit >= state.usersTotal;
  if (!tbody) return;

  if (!users.length) {
    tbody.innerHTML = `<tr><td colspan="11"><div class="empty-state">
      <div class="empty-icon">${icon('users', 22)}</div>
      <p class="empty-title">Sin resultados</p>
      <p class="empty-text">Ajusta los filtros o crea un usuario</p>
    </div></td></tr>`;
    return;
  }

  tbody.innerHTML = users.map(u => {
    const hasDeletion = !!u.accountDeletionRequest && !u.accountDeletionRequest.dismissedAt;
    return `
      <tr>
        <td>
          <div class="user-cell">
            <div class="user-avatar">${initials(u.username)}</div>
            <span class="user-name">${u.username}</span>
            ${hasDeletion ? `<span class="user-deletion-badge" title="Solicitud de baja">!</span>` : ''}
          </div>
        </td>
        <td style="color:var(--text-3);font-size:12px;font-family:var(--mono)">${u.email}</td>
        <td>${getStatusBadge(u)}</td>
        <td>${getPlanBadge(u)}</td>
        <td style="text-align:center">
          <span class="${u.trialDaysLeft > 0 ? 'text-warn' : 'text-muted'}" style="font-family:var(--mono);font-size:11px">${u.trialDaysLeft}d</span>
        </td>
        <td style="font-size:12px">${fmtExpiry(u.premiumExpiry)}</td>
        <td style="text-align:center">${getPaymentBadge(u.payPhoneLastPaymentStatus)}</td>
        <td style="text-align:center;font-family:var(--mono);font-size:11px;color:var(--text-3)">${u.activeSessions?.length ?? 0}</td>
        <td style="text-align:center">
          <button class="btn btn-ghost btn-xs tooltip" 
            data-tip="Ver equipo / resetear límite" 
            data-action="machine" 
            data-id="${u.id}"
            data-machine="${u.machineIdCreated || ''}">
            ${icon('monitor', 12)}
          </button>
        </td>
        <td style="font-size:11.5px;color:var(--text-4)">${fmtDateShort(u.createdAt)}</td>
        <td>
          <div class="row-actions">
            <button class="btn btn-ghost btn-xs tooltip" data-tip="Detalle" data-action="detail" data-id="${u.id}">${icon('eye', 12)}</button>
            <button class="btn btn-info btn-xs tooltip" data-tip="Ajustar trial" data-action="adjust-trial" data-id="${u.id}">${icon('zap', 12)}</button>
            <button class="btn btn-ok btn-xs tooltip" data-tip="${u.isPremium ? 'Gestionar premium' : 'Dar premium'}" data-action="premium" data-id="${u.id}">${icon('star', 12)}</button>
            <button class="btn btn-secondary btn-xs tooltip" data-tip="${u.isActive ? 'Inactivar' : 'Restaurar'}" data-action="${u.isActive ? 'deactivate' : 'restore'}" data-id="${u.id}">
              ${u.isActive ? icon('xCircle', 12) : icon('checkCircle', 12)}
            </button>
            <button class="btn btn-danger btn-xs tooltip" data-tip="Eliminar" data-action="delete" data-id="${u.id}" data-email="${u.email}">
              ${icon('trash', 12)}
            </button>
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

function bindUsersEvents() {
  const search = document.getElementById('userSearch');
  search?.addEventListener('input', debounce(() => {
    setState({ searchQuery: search.value });
    renderUsersTable();
  }, 220));

  document.getElementById('planFilter')?.addEventListener('change', (e) => {
    setState({ planFilter: e.target.value });
    renderUsersTable();
  });

  document.getElementById('statusFilter')?.addEventListener('change', (e) => {
    setState({ statusFilter: e.target.value });
    renderUsersTable();
  });

  document.getElementById('prevPage')?.addEventListener('click', async () => {
    if (state.usersPage <= 1) return;
    setState({ usersPage: state.usersPage - 1 });
    try { await onRefreshCallback?.(); renderUsersTable(); }
    catch (err) { showAlert('usersAlert', err instanceof ApiError ? err.message : 'Error al cargar página.'); }
  });

  document.getElementById('nextPage')?.addEventListener('click', async () => {
    setState({ usersPage: state.usersPage + 1 });
    try { await onRefreshCallback?.(); renderUsersTable(); }
    catch (err) { showAlert('usersAlert', err instanceof ApiError ? err.message : 'Error al cargar página.'); }
  });

  document.getElementById('usersBody')?.addEventListener('click', handleUserAction);
  document.getElementById('grantTrialBtn')?.addEventListener('click', handleGrantTrial);
}

async function handleUserAction(e) {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;

  const { action, id, email } = btn.dataset;
  clearAlert('usersAlert');

  try {
    if (action === 'detail') {
      const user = state.users.find(u => u.id === id);
      if (user) openUserDetail(user);
      return;
    }
    if (action === 'machine') {
      const user = state.users.find(u => u.id === id);
      if (user) openMachineModal(user);
      return;
    }

    // ── Trial ───────────────────────────────────────────────────
    if (action === 'adjust-trial') {
      const user = state.users.find(u => u.id === id);
      if (!user) return;

      // Mostrar estado actual y opciones claras
      const choice = await promptTrialAction(user);
      if (!choice) return;

      if (choice.action === 'set') {
        await api.admin.adjustTrial(id, choice.days, true);
        showAlert('usersAlert', `Trial ajustado a ${choice.days} días para ${user.username}.`, 'success');
      } else if (choice.action === 'remove') {
        const ok = await confirm(`¿Quitar el trial completamente a ${user.username}? Quedará en estado Free.`, 'Quitar trial');
        if (!ok) return;
        await api.admin.removeTrial(id);
        showAlert('usersAlert', `Trial removido de ${user.username}.`, 'success');
      }
    }

    // ── Premium ─────────────────────────────────────────────────
    if (action === 'premium') {
      const user = state.users.find(u => u.id === id);
      if (!user) return;

      if (user.isPremium) {
        const choice = await promptPremiumAction(user);
        if (!choice) return;

        if (choice.action === 'extend') {
          await api.admin.setPremium(id, true, choice.days);
          showAlert('usersAlert', `Premium extendido ${choice.days} días para ${user.username}.`, 'success');
        } else if (choice.action === 'remove') {
          const ok = await confirm(`¿Quitar premium a ${user.username}? Pasará a Free (trial: ${user.trialDaysLeft}d restantes).`, 'Quitar premium');
          if (!ok) return;
          await api.admin.removePremium(id);
          showAlert('usersAlert', `Premium removido de ${user.username}.`, 'success');
        }
      } else {
        const daysStr = await prompt(
          `¿Cuántos días de premium para ${user.username}? (mínimo 1)`,
          '30',
          'Otorgar premium'
        );
        if (daysStr === null) return;
        const days = Math.max(1, parseInt(daysStr, 10) || 1);
        await api.admin.setPremium(id, true, days);
        showAlert('usersAlert', `Premium activado por ${days} días para ${user.username}.`, 'success');
      }
    }

    if (action === 'deactivate') {
      const reason = await prompt('Motivo (opcional)', 'Inactivada por administrador', 'Inactivar usuario');
      if (reason === null) return;
      await api.admin.setStatus(id, false, reason || 'Inactivada por administrador', false);
      showAlert('usersAlert', 'Usuario inactivado.', 'success');
    }

    if (action === 'restore') {
      await api.admin.setStatus(id, true, '', true);
      showAlert('usersAlert', 'Usuario restaurado.', 'success');
    }

    if (action === 'delete') {
      const ok = await confirm(`¿Eliminar permanentemente a ${email || 'este usuario'}? Esta acción no se puede deshacer.`, 'Eliminar usuario');
      if (!ok) return;
      await api.admin.deleteUser(id);
      showAlert('usersAlert', 'Usuario eliminado permanentemente.', 'success');
    }

    await onRefreshCallback?.();
    renderUsersTable();
  } catch (err) {
    showAlert('usersAlert', err instanceof ApiError ? err.message : 'No se pudo completar la acción.');
  }
}

// Diálogo para trial con opciones claras
async function promptTrialAction(user) {
  return new Promise((resolve) => {
    const id = 'trial-action-' + Date.now();
    const modal = createModal({
      id, title: `Trial — ${user.username}`, iconName: 'zap',
      body: `
        <div style="margin-bottom:12px">
          <div style="font-size:12px;color:var(--text-4);margin-bottom:8px">Estado actual</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap">
            ${getPlanBadge(user)}
            <span style="font-size:12px;color:var(--text-3)">Trial: <strong style="color:var(--text-1)">${user.trialDaysLeft}d</strong> restantes (duración: ${user.trialDurationDays}d)</span>
          </div>
        </div>
        <div class="form-group" style="margin-bottom:10px">
          <label class="form-label">Nuevos días de trial (mín. 1)</label>
          <input id="${id}-days" class="input mono" type="number" min="1" max="365" value="${Math.max(1, user.trialDaysLeft || 7)}" />
          <span class="form-hint">Reinicia el contador desde hoy.</span>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost btn-sm" data-close="${id}">Cancelar</button>
        <button class="btn btn-danger btn-sm" id="${id}-remove">Quitar trial</button>
        <button class="btn btn-primary btn-sm" id="${id}-set">Aplicar días</button>
      `,
    });

    let result = null;
    modal.addEventListener('modal:closed', (e) => {
      setTimeout(() => modal.remove(), 250);
      resolve(e.detail?.reason === 'submit' ? result : null);
    });

    modal.querySelector(`#${id}-set`)?.addEventListener('click', () => {
      const days = Math.max(1, parseInt(modal.querySelector(`#${id}-days`)?.value, 10) || 1);
      result = { action: 'set', days };
      closeModal(id, { reason: 'submit' });
    });

    modal.querySelector(`#${id}-remove`)?.addEventListener('click', () => {
      result = { action: 'remove' };
      closeModal(id, { reason: 'submit' });
    });

    openModal(id);
    setTimeout(() => { modal.querySelector(`#${id}-days`)?.focus(); }, 60);
  });
}

// Diálogo para premium con opciones claras
async function promptPremiumAction(user) {
  const expiry = user.premiumExpiry ? new Date(user.premiumExpiry).toLocaleDateString('es-CO') : 'sin vencimiento';
  return new Promise((resolve) => {
    const id = 'premium-action-' + Date.now();
    const modal = createModal({
      id, title: `Premium — ${user.username}`, iconName: 'star',
      body: `
        <div style="margin-bottom:12px">
          <div style="font-size:12px;color:var(--text-4);margin-bottom:8px">Estado actual</div>
          <div style="display:flex;gap:8px;flex-wrap:wrap;align-items:center">
            <span class="badge badge-premium">⭐ Premium activo</span>
            <span style="font-size:12px;color:var(--text-3)">Vence: <strong style="color:var(--text-1)">${expiry}</strong></span>
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Extender días (se suman al vencimiento actual)</label>
          <input id="${id}-days" class="input mono" type="number" min="1" max="3650" value="30" />
          <span class="form-hint">Mínimo 1 día. Los días se acumulan sobre la fecha actual de vencimiento.</span>
        </div>
      `,
      footer: `
        <button class="btn btn-ghost btn-sm" data-close="${id}">Cancelar</button>
        <button class="btn btn-danger btn-sm" id="${id}-remove">Quitar premium</button>
        <button class="btn btn-primary btn-sm" id="${id}-extend">Extender</button>
      `,
    });

    let result = null;
    modal.addEventListener('modal:closed', (e) => {
      setTimeout(() => modal.remove(), 250);
      resolve(e.detail?.reason === 'submit' ? result : null);
    });

    modal.querySelector(`#${id}-extend`)?.addEventListener('click', () => {
      const days = Math.max(1, parseInt(modal.querySelector(`#${id}-days`)?.value, 10) || 1);
      result = { action: 'extend', days };
      closeModal(id, { reason: 'submit' });
    });

    modal.querySelector(`#${id}-remove`)?.addEventListener('click', () => {
      result = { action: 'remove' };
      closeModal(id, { reason: 'submit' });
    });

    openModal(id);
    setTimeout(() => { modal.querySelector(`#${id}-days`)?.focus(); }, 60);
  });
}

async function handleGrantTrial() {
  const email = document.getElementById('trialEmail')?.value.trim();
  const days  = Math.max(1, parseInt(document.getElementById('trialDays')?.value, 10) || 7);
  const btn   = document.getElementById('grantTrialBtn');
  if (!email) { showAlert('usersAlert', 'Ingresa un email válido.'); return; }
  if (!btn) return;

  btn.disabled = true;
  clearAlert('usersAlert');

  try {
    await api.admin.grantTrial(email, days);
    showAlert('usersAlert', `${days} días de trial otorgados a ${email}.`, 'success');
    const inp = document.getElementById('trialEmail');
    if (inp) inp.value = '';
    await onRefreshCallback?.();
    renderUsersTable();
  } catch (err) {
    showAlert('usersAlert', err instanceof ApiError ? err.message : 'No se pudo otorgar el trial.');
  } finally {
    btn.disabled = false;
  }
}

function setupCreateUserModal() {
  createModal({
    id: 'createUserModal', title: 'Crear nuevo usuario', iconName: 'userPlus',
    body: `
      <div id="createUserAlert" class="alert" style="margin-bottom:10px"></div>
      <div class="create-user-form">
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Usuario <span class="required">*</span></label>
            <input id="cuUsername" class="input mono" type="text" placeholder="johndoe" />
          </div>
          <div class="form-group">
            <label class="form-label">Email <span class="required">*</span></label>
            <input id="cuEmail" class="input" type="email" placeholder="john@ejemplo.com" />
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Contraseña temporal <span class="required">*</span></label>
          <div class="input-group">
            <span class="input-icon">${icon('lock', 14)}</span>
            <input id="cuPassword" class="input" type="password" placeholder="Mínimo 8 caracteres" />
          </div>
        </div>
        <div class="grid-2">
          <div class="form-group">
            <label class="form-label">Días de trial</label>
            <input id="cuTrialDays" class="input" type="number" min="1" max="365" value="7" />
          </div>
          <div class="form-group">
            <label class="form-label">Días premium (si aplica)</label>
            <input id="cuPremiumDays" class="input" type="number" min="1" max="3650" value="30" />
          </div>
        </div>
        <div class="modal-toggle-stack">
          <label class="toggle">
            <input type="checkbox" id="cuIsPremium" />
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            <span class="toggle-label-text">Crear como premium</span>
          </label>
          <label class="toggle">
            <input type="checkbox" id="cuIsActive" checked />
            <span class="toggle-track"><span class="toggle-thumb"></span></span>
            <span class="toggle-label-text">Cuenta activa al crear</span>
          </label>
        </div>
      </div>
    `,
    footer: `
      <button class="btn btn-ghost btn-md" data-close="createUserModal">Cancelar</button>
      <button class="btn btn-primary btn-md" id="createUserSubmit">${icon('userPlus', 13)} Crear usuario</button>
    `,
  });

  document.getElementById('createUserModalBtn')?.addEventListener('click', () => {
    clearAlert('createUserAlert');
    openModal('createUserModal');
  });

  document.getElementById('createUserSubmit')?.addEventListener('click', submitCreateUser);
}

async function submitCreateUser() {
  const btn = document.getElementById('createUserSubmit');
  if (!btn) return;

  btn.disabled = true;
  clearAlert('createUserAlert');

  try {
    await api.admin.createUser({
      username:   document.getElementById('cuUsername')?.value.trim(),
      email:      document.getElementById('cuEmail')?.value.trim(),
      password:   document.getElementById('cuPassword')?.value,
      trialDays:  Math.max(1, parseInt(document.getElementById('cuTrialDays')?.value, 10) || 7),
      isPremium:  Boolean(document.getElementById('cuIsPremium')?.checked),
      premiumDays: Math.max(1, parseInt(document.getElementById('cuPremiumDays')?.value, 10) || 30),
      isActive:   document.getElementById('cuIsActive')?.checked !== false,
    });

    showAlert('createUserAlert', 'Usuario creado correctamente.', 'success');
    ['cuUsername', 'cuEmail', 'cuPassword'].forEach(id => {
      const el = document.getElementById(id);
      if (el) el.value = '';
    });

    setTimeout(async () => {
      closeModal('createUserModal');
      await onRefreshCallback?.();
      renderUsersTable();
    }, 900);
  } catch (err) {
    showAlert('createUserAlert', err instanceof ApiError ? err.message : 'No se pudo crear el usuario.');
  } finally {
    btn.disabled = false;
  }
}

function setupUserDetailModal() {
  createModal({
    id: 'userDetailModal', title: 'Detalle de usuario', iconName: 'user',
    maxWidth: '700px',
    body: `<div id="userDetailContent"></div>`,
  });
}

function openUserDetail(user) {
  const content = document.getElementById('userDetailContent');
  if (!content) return;

  // Calcular estado real
  const isActivePremium = user.isPremium && (!user.premiumExpiry || new Date(user.premiumExpiry) > new Date());
  const planLabel = isActivePremium ? 'Premium activo' : user.trialDaysLeft > 0 ? `Trial (${user.trialDaysLeft}d)` : 'Free';

  content.innerHTML = `
    <div class="user-detail-head">
      <div class="user-detail-avatar">${initials(user.username)}</div>
      <div class="user-detail-main" style="flex:1">
        <div class="user-detail-name">${user.username}</div>
        <div class="user-detail-email">${user.email}</div>
        <div class="user-detail-badges">
          ${getPlanBadge(user)}
          ${getStatusBadge(user)}
          ${user.emailVerified
            ? `<span class="badge badge-info">${icon('check', 10)} Verificado</span>`
            : `<span class="badge badge-inactive">Sin verificar</span>`
          }
        </div>
      </div>
    </div>

    <div class="user-detail-grid">
      ${dr('Equipo creación', `<span class="mono" style="font-size:10px">${user.machineIdCreated || '—'}</span>`)}
      ${dr('Estado real', `<strong style="color:var(--text-1)">${planLabel}</strong>`)}
      ${dr('Registro', fmtDate(user.createdAt))}
      ${dr('Actualizado', fmtDate(user.updatedAt))}
      ${dr('Trial restante', `<span style="font-family:var(--mono)">${user.trialDaysLeft}d</span> <span style="color:var(--text-4);font-size:11px">(duración: ${user.trialDurationDays}d)</span>`)}
      ${dr('Trial inicio', fmtDate(user.trialStartedAt))}
      ${dr('Premium expira', fmtExpiry(user.premiumExpiry))}
      ${dr('Sesiones activas', `<span style="font-family:var(--mono)">${user.activeSessions?.length ?? 0}</span>`)}
      ${user.deactivatedAt ? dr('Desactivado', fmtDate(user.deactivatedAt)) : ''}
      ${user.deactivatedReason ? dr('Motivo baja', user.deactivatedReason) : ''}
    </div>

    ${user.payPhoneLastClientTransactionId ? `
      <div class="user-detail-section">
        <div class="user-detail-section-title">Último pago</div>
        <div class="user-detail-grid">
          ${dr('Estado', getPaymentBadge(user.payPhoneLastPaymentStatus))}
          ${dr('ID cliente', `<span class="mono">${user.payPhoneLastClientTransactionId}</span>`)}
          ${dr('ID transacción', `<span class="mono">${user.payPhoneLastTransactionId || '—'}</span>`)}
          ${dr('Actualizado', fmtDate(user.payPhoneLastPaymentUpdatedAt))}
        </div>
      </div>
    ` : ''}

    ${user.accountDeletionRequest ? `
      <div class="user-detail-warning">
        <div class="user-detail-warning-title">⚠ Solicitud de eliminación</div>
        <div class="user-detail-warning-body">
          <strong>Motivo:</strong> ${user.accountDeletionRequest.reason}<br>
          ${user.accountDeletionRequest.detail ? `<strong>Detalle:</strong> ${user.accountDeletionRequest.detail}<br>` : ''}
          <strong>Fecha:</strong> ${fmtDate(user.accountDeletionRequest.requestedAt)}
          ${user.accountDeletionRequest.dismissedAt ? `<br><strong>Revisado:</strong> ${fmtDate(user.accountDeletionRequest.dismissedAt)}` : ''}
        </div>
      </div>
    ` : ''}

    ${user.activeSessions?.length > 0 ? `
      <div class="user-detail-section">
        <div class="user-detail-section-title">Sesiones activas</div>
        <div class="user-session-list">
          ${user.activeSessions.map(s => `
            <div class="user-session-item">
              <span class="mono user-session-machine">${s.machineId}</span>
              <span class="user-session-meta">IP: ${s.ip || '—'} · Último acceso: ${fmtRelative(s.lastSeenAt)}</span>
            </div>
          `).join('')}
        </div>
      </div>
    ` : ''}
  `;

  openModal('userDetailModal');
}

function dr(key, val) {
  return `<div class="detail-row"><span class="detail-key">${key}</span><span class="detail-val">${val ?? '—'}</span></div>`;
}
function openMachineModal(user) {
  const id = 'machine-modal-' + Date.now();
  const machineId = user.machineIdCreated || '';

  const modal = createModal({
    id, title: `Equipo — ${user.username}`, iconName: 'monitor',
    body: `
      <div id="${id}-alert" class="alert" style="margin-bottom:10px"></div>
      <div class="user-detail-grid" style="margin-bottom:14px">
        ${dr('Machine ID', machineId
          ? `<span class="mono" style="font-size:11px">${machineId}</span>`
          : '<span class="text-muted">Sin equipo registrado</span>'
        )}
      </div>
      ${machineId ? `
        <div id="${id}-accounts" style="margin-bottom:14px">
          <div style="font-size:12px;color:var(--text-4);margin-bottom:8px">Cuentas en este equipo</div>
          <div style="color:var(--text-3);font-size:12px">Cargando…</div>
        </div>
      ` : ''}
      <div style="background:var(--surface-2);border-radius:8px;padding:12px;font-size:12px;color:var(--text-3)">
        ${icon('info', 11)} Resetear el límite permite registrar más cuentas desde este equipo.
      </div>
    `,
    footer: `
      <button class="btn btn-ghost btn-md" data-close="${id}">Cerrar</button>
      ${machineId ? `<button class="btn btn-warn btn-md" id="${id}-reset">Resetear límite de equipo</button>` : ''}
    `,
  });

  if (machineId) {
    api.admin.machineAccounts(machineId)
      .then(result => {
        const container = document.getElementById(`${id}-accounts`);
        if (!container) return;
  
        const accounts = result?.accounts || [];
  
        container.innerHTML = `
          <div style="font-size:12px;color:var(--text-4);margin-bottom:8px">
            Cuentas en este equipo 
            <span class="badge badge-free" style="margin-left:4px">
              ${result?.count ?? 0}/${result?.max ?? 3}
            </span>
          </div>
  
          ${accounts.length === 0
            ? `<div style="color:var(--text-4);font-size:12px">Sin cuentas encontradas.</div>`
            : accounts.map(a => `
              <div style="display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid var(--border)">
                <div>
                  <span style="font-weight:600;color:var(--text-1);font-size:12px">${a.username}</span>
                  <span style="color:var(--text-4);font-size:11px;margin-left:6px">${a.email}</span>
                </div>
                <div style="display:flex;gap:6px">
                  ${a.hasActivePremium
                    ? `<span class="badge badge-premium">Premium</span>`
                    : a.trialDaysLeft > 0
                      ? `<span class="badge badge-trial">Trial</span>`
                      : `<span class="badge badge-free">Free</span>`
                  }
                </div>
              </div>
            `).join('')}
        `;
      })
      .catch(() => {
        const container = document.getElementById(`${id}-accounts`);
        if (container) {
          container.innerHTML = `<div style="color:red;font-size:12px">Error cargando cuentas</div>`;
        }
      });
  }

  document.getElementById(`${id}-reset`)?.addEventListener('click', async () => {
    const ok = await confirm(
      `¿Resetear el límite del equipo de ${user.username}?`,
      'Resetear límite'
    );
    if (!ok) return;
  
    try {
      await api.admin.resetMachineLimit(user.id);
      showAlert('usersAlert', 'Límite reseteado correctamente.', 'success');
      await onRefreshCallback?.();
    } catch (err) {
      showAlert('usersAlert', 'Error al resetear el límite.');
    }
  });

  openModal(id);
}