import { icon } from '../../assets/icons/icons.js';
import { setAdminToken } from '../../core/api/apiClient.js';
import { showAlert, clearAlert } from '../../shared/utils/helpers.js';

export function renderLogin(onSuccess) {
  document.body.innerHTML = `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
        <div class="login-logo-mark">
          <img src="assets/images/logo.png" alt="Kx" onerror="this.style.display='none';this.parentElement.textContent='Kx'" />
        </div>
          <div>
            <div class="login-logo-text">Kx Admin</div>
            <div class="login-logo-sub">Panel de administración</div>
          </div>
        </div>

        <h1 class="login-title">Acceso restringido</h1>
        <p class="login-subtitle">Ingresa el token de administrador para continuar.</p>

        <div id="loginAlert" class="alert" style="margin-bottom:14px"></div>

        <div class="form-group" style="margin-bottom:16px">
          <label class="form-label">${icon('lock', 12)} Token de administrador</label>
          <div class="input-group">
            <span class="input-icon">${icon('shield', 14)}</span>
            <input id="adminTokenInput" class="input mono" type="password" placeholder="••••••••••••••••" autocomplete="current-password" />
          </div>
          <span class="form-hint">Se guarda localmente en este dispositivo.</span>
        </div>

        <button class="btn btn-primary btn-lg btn-block" id="loginBtn">
          ${icon('shield', 14)} Entrar al panel
        </button>
      </div>
    </div>
  `;

  const input = document.getElementById('adminTokenInput');
  const btn   = document.getElementById('loginBtn');

  async function doLogin() {
    clearAlert('loginAlert');
    const token = input.value.trim();
    if (!token) { showAlert('loginAlert', 'Ingresa un token válido.'); input.focus(); return; }

    btn.disabled = true;
    btn.innerHTML = `<span class="spinner"></span> Verificando…`;
    setAdminToken(token);

    try {
      await onSuccess();
    } catch (err) {
      setAdminToken('');
      showAlert('loginAlert', `Error: ${err.message || 'Token inválido'}`);
      btn.disabled = false;
      btn.innerHTML = `${icon('shield', 14)} Entrar al panel`;
      input.focus();
    }
  }

  btn.addEventListener('click', doLogin);
  input.addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
  setTimeout(() => input.focus(), 100);
}