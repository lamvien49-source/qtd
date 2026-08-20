import * as S from '../state.js';
import { icon } from '../icons.js';
import { toast } from '../components/toast.js';

let mode = 'customer';

export function renderLogin(root, onLoggedIn) {
  const org = S.getOrg();
  root.innerHTML = `
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
            <label id="label-primary">Số CCCD hoặc SĐT</label>
            <input name="primary" id="input-primary" required inputmode="numeric" autocomplete="username" placeholder="Nhập số CCCD hoặc SĐT của bạn"/>
          </div>
          <div class="field">
            <label>Mật khẩu</label>
            <input name="password" type="password" required autocomplete="current-password" placeholder="Nhập mật khẩu"/>
          </div>
          <div class="field-error" id="login-error" style="display:none;margin-bottom:10px"></div>
          <button class="btn btn-primary btn-block" type="submit">${icon('lock', 'icon-sm')} Đăng nhập</button>
        </form>
      </div>
    </div>
  `;

  function updateMode() {
    root.querySelectorAll('[data-mode]').forEach((b) => b.classList.toggle('active', b.dataset.mode === mode));
    const isAdmin = mode === 'admin';
    root.querySelector('#label-primary').textContent = isAdmin ? 'Tên đăng nhập' : 'Số CCCD hoặc SĐT';
    root.querySelector('#input-primary').placeholder = isAdmin ? 'Nhập tên đăng nhập quản trị' : 'Nhập số CCCD hoặc SĐT của bạn';
    root.querySelector('#input-primary').inputMode = isAdmin ? 'text' : 'numeric';
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
    root.querySelector('#login-error').style.display = 'none';

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.disabled = true;

    // Đăng nhập khách hàng sai mật khẩu sẽ gọi notify() (để lưu số lần nhập sai) —
    // notify() kích hoạt render lại toàn bộ màn hình đăng nhập, xóa mất các phần tử
    // DOM đã lấy ở trên. Vì vậy sau khi await xong phải lấy lại #login-error/nút bấm
    // MỚI từ `root` (chỉ `root` là còn nguyên) thay vì dùng lại tham chiếu cũ.
    try {
      if (mode === 'admin') {
        const res = await S.loginAdmin(primary, password);
        if (!res.ok) {
          const err = root.querySelector('#login-error');
          if (err) { err.textContent = res.reason; err.style.display = 'block'; }
          return;
        }
        S.setSession({ role: 'admin', id: res.adminId, sbToken: res.sbToken });
        toast('Đăng nhập thành công', 'success');
        onLoggedIn();
      } else {
        const res = await S.loginCustomer(primary, password);
        if (!res.ok) {
          const err = root.querySelector('#login-error');
          if (err) { err.textContent = res.reason; err.style.display = 'block'; }
          return;
        }
        S.setSession({ role: 'customer', id: res.customerId, mustChangePassword: res.mustChangePassword, sbToken: res.sbToken });
        toast('Đăng nhập thành công', 'success');
        onLoggedIn();
      }
    } finally {
      const btn = root.querySelector('#login-form button[type="submit"]');
      if (btn) btn.disabled = false;
    }
  });
}
