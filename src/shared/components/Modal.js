import { icon } from '../../assets/icons/icons.js';

let activeModal = null;

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && activeModal) closeModal(activeModal, { reason: 'escape' });
});

export function createModal({ id, title, iconName, body, footer, maxWidth = '520px' }) {
  document.getElementById(id)?.remove();

  const backdrop = document.createElement('div');
  backdrop.className = 'modal-backdrop';
  backdrop.id = id;
  backdrop.setAttribute('role', 'dialog');
  backdrop.setAttribute('aria-modal', 'true');

  backdrop.innerHTML = `
    <div class="modal" style="max-width:${maxWidth}">
      <div class="modal-header">
        <div class="modal-title">
          ${iconName ? `<span style="color:var(--text-4)">${icon(iconName, 15)}</span>` : ''}
          ${title}
        </div>
        <button class="modal-close" data-close="${id}">${icon('close', 12)}</button>
      </div>
      <div class="modal-body">${body}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ''}
    </div>
  `;

  document.body.appendChild(backdrop);

  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) { closeModal(id, { reason: 'backdrop' }); return; }
    if (e.target.closest(`[data-close="${id}"]`)) closeModal(id, { reason: 'button' });
  });

  return backdrop;
}

export function openModal(id) {
  const el = document.getElementById(id);
  if (!el) return;
  requestAnimationFrame(() => el.classList.add('open'));
  activeModal = id;
  document.body.style.overflow = 'hidden';
}

export function closeModal(id, { reason = 'programmatic', remove = false } = {}) {
  const el = document.getElementById(id);
  if (!el) return;
  const wasOpen = el.classList.contains('open');
  el.classList.remove('open');
  if (activeModal === id) activeModal = null;
  if (!document.querySelector('.modal-backdrop.open')) document.body.style.overflow = '';
  if (wasOpen) el.dispatchEvent(new CustomEvent('modal:closed', { detail: { id, reason } }));
  if (remove) setTimeout(() => document.getElementById(id)?.remove(), 250);
}

export function confirm(message, title = 'Confirmar') {
  return new Promise((resolve) => {
    const id = 'confirm-' + Date.now();
    const modal = createModal({
      id, title, iconName: 'alertTriangle',
      body: `<p style="color:var(--text-2);font-size:13.5px;line-height:1.65">${message}</p>`,
      footer: `
        <button class="btn btn-ghost btn-md" data-close="${id}">Cancelar</button>
        <button class="btn btn-danger btn-md" id="${id}-ok">Confirmar</button>
      `,
    });

    let done = false;
    const settle = (val) => { if (!done) { done = true; resolve(val); } };

    modal.addEventListener('modal:closed', (e) => {
      setTimeout(() => modal.remove(), 250);
      settle(e.detail?.reason === 'confirm');
    });

    modal.querySelector(`#${id}-ok`)?.addEventListener('click', () => closeModal(id, { reason: 'confirm' }));
    openModal(id);
  });
}

export function prompt(message, defaultVal = '', title = 'Ingresa un valor') {
  return new Promise((resolve) => {
    const id = 'prompt-' + Date.now();
    const modal = createModal({
      id, title, iconName: 'edit',
      body: `
        <p style="color:var(--text-3);font-size:12.5px;margin-bottom:10px">${message}</p>
        <input class="input" id="${id}-input" value="${String(defaultVal).replace(/"/g, '&quot;')}" type="text" />
      `,
      footer: `
        <button class="btn btn-ghost btn-md" id="${id}-cancel">Cancelar</button>
        <button class="btn btn-primary btn-md" id="${id}-ok">Aceptar</button>
      `,
    });

    let submittedValue = null;

    modal.addEventListener('modal:closed', (e) => {
      setTimeout(() => modal.remove(), 250);
      resolve(e.detail?.reason === 'accept' ? submittedValue : null);
    });

    openModal(id);
    setTimeout(() => {
      const inp = modal.querySelector(`#${id}-input`);
      inp?.focus();
      inp?.select();
    }, 60);

    const accept = () => {
      submittedValue = modal.querySelector(`#${id}-input`)?.value ?? null;
      closeModal(id, { reason: 'accept' });
    };

    modal.querySelector(`#${id}-ok`)?.addEventListener('click', accept);
    modal.querySelector(`#${id}-cancel`)?.addEventListener('click', () => closeModal(id, { reason: 'cancel' }));
    modal.querySelector(`#${id}-input`)?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') accept();
      if (e.key === 'Escape') closeModal(id, { reason: 'cancel' });
    });
  });
}