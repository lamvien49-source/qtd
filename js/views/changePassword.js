import * as S from '../state.js';
import { icon } from '../icons.js';
import { toast } from '../components/toast.js';

export function renderChangePassword(root, customerId, onDone, opts = {}) {
  root.innerHTML = `
    <div class="demo-ribbon">BẢN DEMO — dữ liệu giả, chưa kết nối hệ thống thật</div>
    <div class="login-wrap">
      <div class="login-card">
        <div class="logo-mark">${icon('shieldCheck', 'icon-lg')}</div>
        <h1 style="text-align:center;font-size:17px;margin-bottom:6px">${opts.forced ? 'Bắt buộc đổi mật khẩu' : 'Đổi mật khẩu'}</h1>
        <p style="text-align:center;font-size:12.5px;color:var(--text-muted);margin-bottom:20px">
          ${opts.forced ? 'Đây là lần đăng nhập đầu tiên, vui lòng đặt mật khẩu mới trước khi tiếp tục.' : 'Đặt mật khẩu mới cho tài khoản của bạn.'}
        </p>
        <form id="pw-form">
          <div class="field">
            <label>Mật khẩu mới</label>
            <input name="pw1" type="password" required minlength="6" placeholder="Tối thiểu 6 ký tự"/>
          </div>
          <div class="field">
            <label>Nhập lại mật khẩu mới</label>
            <input name="pw2" type="password" required minlength="6"/>
          </div>
          <div class="field-error" id="pw-error" style="display:none;margin-bottom:10px"></div>
          <button class="btn btn-primary btn-block" type="submit">${icon('check', 'icon-sm')} Xác nhận</button>
        </form>
      </div>
    </div>
  `;

  root.querySelector('#pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const pw1 = fd.get('pw1'), pw2 = fd.get('pw2');
    const errEl = root.querySelector('#pw-error');
    if (pw1 !== pw2) { errEl.textContent = 'Mật khẩu nhập lại không khớp.'; errEl.style.display = 'block'; return; }
    await S.setCustomerPassword(customerId, pw1, { mustChangePassword: false });
    S.setSession({ ...S.getSession(), mustChangePassword: false });
    toast('Đã đổi mật khẩu thành công', 'success');
    onDone();
  });
}
