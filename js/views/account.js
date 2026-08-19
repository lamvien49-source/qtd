import * as S from '../state.js';
import { icon } from '../icons.js';
import { pageHeader } from '../components/shell.js';
import { maskCccd, initials, colorFor } from '../utils.js';

export function renderHeader(headerEl) {
  headerEl.innerHTML = pageHeader({ title: 'Tài khoản' });
}

export function render(contentEl) {
  const session = S.getSession();
  const c = S.getCustomer(session.id);

  contentEl.innerHTML = `
    <div class="card card-pad mb-16">
      <div class="flex items-center gap-10 mb-16">
        <div class="row-thumb" style="width:52px;height:52px;font-size:19px;background:${colorFor(c.id)}">${initials(c.name)}</div>
        <div>
          <div class="fw-700" style="font-size:16px">${c.name}</div>
          <div class="text-sm text-muted">Số CCCD: ${maskCccd(c.cccd)}</div>
        </div>
      </div>
      <div class="oc-line"><span>Số điện thoại</span><b>${c.phone || '—'}</b></div>
      <div class="oc-line"><span>Địa chỉ</span><b>${c.address || '—'}</b></div>
    </div>

    <a href="#/doi-mat-khau" class="btn btn-outline btn-block">${icon('lock', 'icon-sm')} Đổi mật khẩu</a>
  `;
}
