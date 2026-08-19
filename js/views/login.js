import * as S from '../state.js';
import { icon } from '../icons.js';
import { toast } from '../components/toast.js';

let mode = 'customer';

export function renderLogin(root, onLoggedIn) {
  const org = S.getOrg();
  root.innerHTML = `
    <div class="demo-ribbon">BẢN DEMO — dữ liệu giả, chưa kết nối hệ thống thật</div>
    <div class="login-wrap">
      <div class="login-card">
        <div class="logo-mark">${icon('landmark', 'icon-lg')}</div>
        <h1 style="text-align:center;font-size:18px;margin-bottom:4px">${org.name}</h1>
        <p style="text-align:center;font-size:12.5px;color:var(--text-muted);margin-bottom:20px">Cổng tra cứu khoản vay dành cho khách hàng</p>

        <div class="tabs mb-16">
          <button data-mode="customer" class="${mode === 'customer' ? 'active' : ''}">Khách hàng</button>
          <button data-mode="admin" class="${mode === 'admin' ? 'active' : ''}">Quản trị viên</button>
        </div>

        <form id="login-form">
          <div class="field" id="field-primary">
            <label id="label-primary">Số CCCD</label>
            <input name="primary" id="input-primary" required inputmode="numeric" placeholder="Nhập số CCCD của bạn"/>
          </div>
          <div class="field">
            <label>Mật khẩu</label>
            <input name="password" type="password" required placeholder="Nhập mật khẩu"/>
          </div>
          <div class="field-error" id="login-error" style="display:none;margin-bottom:10px"></div>
          <button class="btn btn-primary btn-block" type="submit">${icon('lock', 'icon-sm')} Đăng nhập</button>
        </form>

        <div class="card card-pad mt-16" style="background:var(--surface-alt);border-style:dashed" id="demo-hint">
          <div class="text-sm fw-700 mb-8">Tài khoản dùng thử (demo)</div>
          <div class="text-sm text-muted" id="demo-hint-body"></div>
        </div>
      </div>
    </div>
  `;

  function updateMode() {
    root.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    const isAdmin = mode === 'admin';
    root.querySelector('#label-primary').textContent = isAdmin ? 'Tên đăng nhập' : 'Số CCCD';
    root.querySelector('#input-primary').placeholder = isAdmin ? 'Nhập tên đăng nhập quản trị' : 'Nhập số CCCD của bạn';
    root.querySelector('#input-primary').inputMode = isAdmin ? 'text' : 'numeric';
    root.querySelector('#demo-hint-body').innerHTML = isAdmin
      ? `Tài khoản: <b>admin</b><br/>Mật khẩu: <b>Admin@123</b>`
      : `Số CCCD: <b>079300012345</b><br/>Mật khẩu: <b>Demo@123</b><br/><span class="text-faint">(sẽ yêu cầu đổi mật khẩu ngay lần đầu đăng nhập)</span>`;
  }
  updateMode();

  root.querySelectorAll('[data-mode]').forEach((btn) => {
    btn.addEventListener('click', () => { mode = btn.dataset.mode; updateMode(); });
  });

  root.querySelector('#login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const primary = fd.get('primary').trim();
    const password = fd.get('password');
    const errEl = root.querySelector('#login-error');
    errEl.style.display = 'none';

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    try {
      if (mode === 'admin') {
        const res = await S.loginAdmin(primary, password);
        if (!res.ok) { errEl.textContent = res.reason; errEl.style.display = 'block'; return; }
        S.setSession({ role: 'admin', id: res.adminId });
        toast('Đăng nhập thành công', 'success');
        onLoggedIn();
      } else {
        const res = await S.loginCustomer(primary, password);
        if (!res.ok) { errEl.textContent = res.reason; errEl.style.display = 'block'; return; }
        S.setSession({ role: 'customer', id: res.customerId, mustChangePassword: res.mustChangePassword });
        toast('Đăng nhập thành công', 'success');
        onLoggedIn();
      }
    } finally {
      submitBtn.disabled = false;
    }
  });
}
