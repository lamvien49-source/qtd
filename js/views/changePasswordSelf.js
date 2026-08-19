import * as S from '../state.js';
import { pageHeader } from '../components/shell.js';
import { toast } from '../components/toast.js';

/** Màn tự đổi mật khẩu (tự chọn, dùng bất cứ lúc nào) — áp dụng cho mọi loại User: khách hàng và quản trị viên/nhân viên. */
export function renderHeader(headerEl) {
  headerEl.innerHTML = pageHeader({ title: 'Đổi mật khẩu' });
}

export function render(contentEl) {
  const session = S.getSession();
  const isAdmin = session.role === 'admin';

  contentEl.innerHTML = `
    <div class="card card-pad" style="max-width:420px">
      <p class="text-sm text-muted mb-16">Đặt mật khẩu mới cho tài khoản của bạn. Cần nhập đúng mật khẩu hiện tại để xác nhận.</p>
      <form id="self-pw-form">
        <div class="field">
          <label>Mật khẩu hiện tại</label>
          <input name="pwOld" type="password" required autocomplete="current-password"/>
        </div>
        <div class="field">
          <label>Mật khẩu mới</label>
          <input name="pw1" type="password" required minlength="6" autocomplete="new-password" placeholder="Tối thiểu 6 ký tự"/>
        </div>
        <div class="field">
          <label>Nhập lại mật khẩu mới</label>
          <input name="pw2" type="password" required minlength="6" autocomplete="new-password"/>
        </div>
        <div class="field-error" id="self-pw-error" style="display:none;margin-bottom:10px"></div>
        <button class="btn btn-primary btn-block" type="submit">Xác nhận đổi mật khẩu</button>
      </form>
    </div>
  `;

  contentEl.querySelector('#self-pw-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    const pwOld = fd.get('pwOld'), pw1 = fd.get('pw1'), pw2 = fd.get('pw2');
    const errEl = contentEl.querySelector('#self-pw-error');
    errEl.style.display = 'none';
    const showErr = (msg) => { errEl.textContent = msg; errEl.style.display = 'block'; };

    if (pw1 !== pw2) { showErr('Mật khẩu mới nhập lại không khớp.'); return; }

    const ok = isAdmin ? await S.verifyAdminPassword(session.id, pwOld) : await S.verifyCustomerPassword(session.id, pwOld);
    if (!ok) { showErr('Mật khẩu hiện tại không đúng.'); return; }

    if (isAdmin) {
      await S.setStaffPassword(session.id, pw1);
    } else {
      await S.setCustomerPassword(session.id, pw1, { mustChangePassword: false });
    }
    toast('Đã đổi mật khẩu thành công', 'success');
    e.target.reset();
  });
}
