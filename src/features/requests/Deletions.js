import { icon } from '../../assets/icons/icons.js';
import { api, ApiError } from '../../core/api/apiClient.js';
import { state } from '../../shared/utils/state.js';
import { fmtDate, fmtRelative, showAlert, clearAlert } from '../../shared/utils/helpers.js';
import { confirm } from '../../shared/components/Modal.js';

let onRefreshCallback = null;
export function setDeletionsRefreshCallback(fn) { onRefreshCallback = fn; }

export function renderDeletions(container) {
  const requests = state.deletionRequests || [];
  const pending  = requests.filter(r => !r.dismissedAt);
  const reviewed = requests.filter(r => r.dismissedAt);

  container.innerHTML = `
    <div id="deletionsAlert" class="alert"></div>

    <div class="section-header">
      <div>
        <h2 class="section-title">Solicitudes de eliminación</h2>
        <p class="section-subtitle">${pending.length} pendiente${pending.length !== 1 ? 's' : ''} · ${reviewed.length} revisada${reviewed.length !== 1 ? 's' : ''}</p>
      </div>
      ${pending.length > 0
        ? `<span class="badge badge-inactive" style="font-size:12px">${pending.length} por revisar</span>`
        : `<span class="badge badge-active">Todo revisado</span>`
      }
    </div>

    <div class="card" style="margin-bottom:14px">
      <div class="card-header">
        <div class="card-title text-danger">${icon('alertTriangle', 13)} Pendientes</div>
      </div>
      ${pending.length === 0
        ? `<div class="empty-state"><div class="empty-icon deletions-empty-ok">${icon('checkCircle', 22)}</div><p class="empty-title">Sin solicitudes pendientes</p><p class="empty-text">Todas las solicitudes han sido revisadas</p></div>`
        : pending.map(r => renderCard(r, false)).join('')
      }
    </div>

    ${reviewed.length > 0 ? `
      <div class="card">
        <div class="card-header">
          <div class="card-title text-dim">${icon('checkCircle', 13)} Revisadas</div>
          <div style="display:flex;gap:8px;align-items:center">
            <span class="badge badge-free">${reviewed.length}</span>
            <button class="btn btn-ghost btn-xs" id="cleanupBtn" title="Eliminar revisadas con más de 30 días">
              ${icon('trash', 11)} Limpiar antiguas
            </button>
          </div>
        </div>
        ${reviewed.map(r => renderCard(r, true)).join('')}
      </div>
    ` : ''}
  `;

  container.querySelector('#cleanupBtn')?.addEventListener('click', handleCleanup);
  container.onclick = handleAction;
}

function renderCard(r, reviewed) {
  return `
    <div class="deletions-request-card ${reviewed ? 'is-reviewed' : ''}">
      <div class="deletions-request-head">
        <div class="deletions-request-left">
          <div class="deletions-user-row">
            <div class="deletions-user-avatar ${reviewed ? 'is-reviewed' : ''}">
              ${(r.username || '?').slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div class="deletions-user-name">${r.username}</div>
              <div class="deletions-user-email">${r.email}</div>
            </div>
          </div>
          <div class="deletions-reason"><strong>Motivo:</strong> ${r.reason}${r.detail ? ` — ${r.detail}` : ''}</div>
          <div class="deletions-meta">
            <span>${icon('clock', 11)} Solicitado: ${fmtRelative(r.requestedAt)}</span>
            <span>${icon('calendar', 11)} ${fmtDate(r.requestedAt)}</span>
            ${reviewed ? `<span class="text-ok">${icon('checkCircle', 11)} Revisado: ${fmtDate(r.dismissedAt)}</span>` : ''}
          </div>
          <div class="deletions-state-row">
            ${r.isActive
              ? `<span class="badge badge-active">Cuenta activa</span>`
              : `<span class="badge badge-inactive">Cuenta inactiva</span>`
            }
          </div>
        </div>

        ${reviewed
          ? '' /* Sin botones de acción en revisadas */
          : `<div class="deletions-actions">
              <button class="btn btn-ok btn-sm" data-req-action="restore" data-user-id="${r.userId}">${icon('checkCircle', 12)} Restaurar</button>
              <button class="btn btn-danger btn-sm" data-req-action="delete" data-user-id="${r.userId}" data-email="${r.email}">${icon('trash', 12)} Eliminar</button>
              <button class="btn btn-ghost btn-sm" data-req-action="dismiss" data-user-id="${r.userId}">${icon('check', 12)} Marcar revisada</button>
            </div>`
        }
      </div>
    </div>
  `;
}

async function handleCleanup(e) {
  e.stopPropagation();
  const btn = document.getElementById('cleanupBtn');
  const ok = await confirm(
    'Se eliminarán permanentemente las solicitudes ya revisadas con más de 30 días de antigüedad. ¿Continuar?',
    'Limpiar solicitudes antiguas'
  );
  if (!ok) return;

  if (btn) btn.disabled = true;
  clearAlert('deletionsAlert');

  try {
    const result = await api.admin.cleanupDeletionRequests();
    const cleaned = result?.cleaned ?? 0;
    showAlert('deletionsAlert', `${cleaned} solicitud${cleaned !== 1 ? 'es' : ''} eliminada${cleaned !== 1 ? 's' : ''}.`, 'success');
    await onRefreshCallback?.();
    const container = document.getElementById('pageContainer');
    if (container) renderDeletions(container);
  } catch (err) {
    showAlert('deletionsAlert', err instanceof ApiError ? err.message : 'No se pudo limpiar.');
    if (btn) btn.disabled = false;
  }
}

async function handleAction(e) {
  const btn = e.target.closest('[data-req-action]');
  if (!btn) return;
  const { reqAction, userId, email } = btn.dataset;
  clearAlert('deletionsAlert');

  try {
    if (reqAction === 'restore') {
      await api.admin.setStatus(userId, true, '', true);
      showAlert('deletionsAlert', 'Cuenta restaurada exitosamente.', 'success');
    }
    if (reqAction === 'delete') {
      const ok = await confirm(`¿Eliminar permanentemente a ${email}? Esta acción no se puede deshacer.`, 'Eliminación permanente');
      if (!ok) return;
      await api.admin.deleteUser(userId);
      showAlert('deletionsAlert', 'Usuario eliminado permanentemente.', 'success');
    }
    if (reqAction === 'dismiss') {
      await api.admin.dismissDeletion(userId);
      showAlert('deletionsAlert', 'Solicitud marcada como revisada.', 'success');
    }

    await onRefreshCallback?.();
    const container = document.getElementById('pageContainer');
    if (container) renderDeletions(container);
  } catch (err) {
    showAlert('deletionsAlert', err instanceof ApiError ? err.message : 'No se pudo completar la acción.');
  }
}