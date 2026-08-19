// Trang "Quản lý User" — quản lý TẤT CẢ tài khoản trong hệ thống ở 1 chỗ:
// "Use" (tài khoản khách hàng) và "Quản trị viên" (super toàn quyền hoặc
// staff chỉ xem, có phân quyền theo Thôn/Xóm). Chỉ quản trị viên toàn quyền
// mới vào được trang này (route đã đặt superOnly ở app.js).
import * as S from '../../state.js';
import { icon } from '../../icons.js';
import { pageHeader } from '../../components/shell.js';
import { emptyState } from '../../components/ui.js';
import { openModal, confirmDialog } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { initials, colorFor, maskCccd, formatNumber } from '../../utils.js';
import { openCustomerDetail } from './customers.js';

export function renderHeader(headerEl) {
  headerEl.innerHTML = pageHeader({ title: 'Quản lý User' });
}

let filterRole = 'all'; // 'all' | 'use' | 'admin'

export function render(contentEl) {
  filterRole = 'all';
  draw(contentEl);
}

function permissionSummary(a) {
  const parts = [...a.allowedThon, ...a.allowedXom.map((x) => `Xóm ${x}`)];
  return parts.length ? parts.join(', ') : 'Chưa gán địa bàn nào';
}

function draw(contentEl) {
  const customers = S.getState().customers;
  const admins = S.listAdmins();
  const lockedCount = customers.filter((c) => S.isCustomerLocked(c)).length;
  const tree = S.thonXomTree();

  const rows = [];
  if (filterRole !== 'admin') customers.forEach((c) => rows.push({ kind: 'use', data: c }));
  if (filterRole !== 'use') admins.forEach((a) => rows.push({ kind: 'admin', data: a }));

  contentEl.innerHTML = `
    <div class="grid-2 mb-16">
      <div class="stat-tile c-blue">
        <div class="stat-label">Use đã tạo</div>
        <div class="stat-value">${formatNumber(customers.length)}</div>
        ${lockedCount ? `<div class="stat-trend" style="color:var(--danger)">${formatNumber(lockedCount)} đang tạm khóa</div>` : `<div class="stat-trend">Tất cả đang hoạt động</div>`}
      </div>
      <div class="stat-tile c-purple">
        <div class="stat-label">Quản trị viên đã tạo</div>
        <div class="stat-value">${formatNumber(admins.length)}</div>
        <div class="stat-trend">${formatNumber(admins.filter((a) => a.role === 'super').length)} toàn quyền · ${formatNumber(admins.filter((a) => a.role === 'staff').length)} chỉ xem</div>
      </div>
    </div>

    <div class="card card-pad mb-16">
      <button class="btn btn-primary btn-block" id="btn-add-user">${icon('plus', 'icon-sm')} Tạo User</button>
    </div>

    <div class="chip-row mb-16">
      <button class="chip ${filterRole === 'all' ? 'active' : ''}" data-role="all">Tất cả</button>
      <button class="chip ${filterRole === 'use' ? 'active' : ''}" data-role="use">Use (khách hàng)</button>
      <button class="chip ${filterRole === 'admin' ? 'active' : ''}" data-role="admin">Quản trị viên</button>
    </div>

    <div class="card card-pad">
      <div class="text-sm text-muted mb-8">${rows.length} tài khoản</div>
      ${rows.length ? rows.map((r) => r.kind === 'use' ? userRowHtml(r.data) : adminRowHtml(r.data)).join('')
        : emptyState({ iconName: 'idCard', title: 'Chưa có tài khoản nào', message: 'Bấm "Tạo User" để tạo tài khoản đầu tiên.' })}
    </div>
  `;

  contentEl.querySelectorAll('[data-role]').forEach((btn) => {
    btn.addEventListener('click', () => { filterRole = btn.dataset.role; draw(contentEl); });
  });
  contentEl.querySelector('#btn-add-user').addEventListener('click', () => openCreateUserModal(tree, contentEl));
  contentEl.querySelectorAll('[data-open-use]').forEach((row) => {
    row.addEventListener('click', () => openCustomerDetail(row.dataset.openUse, { readOnly: false }));
  });
  contentEl.querySelectorAll('[data-open-admin]').forEach((row) => {
    row.addEventListener('click', () => openAdminDetail(S.getAdmin(row.dataset.openAdmin), tree, contentEl));
  });
}

function userRowHtml(c) {
  const locked = S.isCustomerLocked(c);
  return `
    <div class="list-row" data-open-use="${c.id}" style="cursor:pointer">
      <div class="row-thumb" style="background:${colorFor(c.id)}">${initials(c.name)}</div>
      <div class="row-main">
        <div class="row-title">${c.name} <span class="badge badge-blue">Use</span>${locked ? ' <span class="badge badge-red">Đang khóa</span>' : ''}</div>
        <div class="row-sub">${maskCccd(c.cccd)} · ${c.phone || 'Chưa có SĐT'}</div>
      </div>
    </div>`;
}

function adminRowHtml(a) {
  const roleLabel = a.role === 'super' ? 'Toàn quyền' : 'Chỉ xem';
  return `
    <div class="list-row" data-open-admin="${a.id}" style="cursor:pointer">
      <div class="row-thumb" style="background:${colorFor(a.id)}">${initials(a.name)}</div>
      <div class="row-main">
        <div class="row-title">${a.name} <span class="badge ${a.role === 'super' ? 'badge-purple' : 'badge-green'}">Quản trị viên · ${roleLabel}</span></div>
        <div class="row-sub">@${a.username}${a.role === 'staff' ? ' · Xem được: ' + permissionSummary(a) : ''}</div>
      </div>
    </div>`;
}

function showCredential(title, username, password) {
  openModal({
    title,
    bodyHtml: `
      <p class="text-sm text-muted mb-16">Gửi thông tin sau cho người dùng:</p>
      <div class="card card-pad" style="background:var(--surface-alt)">
        <div class="oc-line"><span>Tên đăng nhập</span><b>${username}</b></div>
        <div class="oc-line"><span>Mật khẩu</span><b>${password}</b></div>
      </div>
    `,
    footHtml: `<button class="btn btn-primary btn-block" data-close>Đã hiểu</button>`,
    onMount(sheet, closeFn) { sheet.querySelector('[data-close]').addEventListener('click', closeFn); },
  });
}

/** Cây chọn quyền 2 cấp: tích cả Thôn = xem trọn Thôn đó; tích riêng từng Xóm (dạng chip) = chỉ xem Xóm đó dù Thôn không được cấp trọn. */
function permissionTreeHtml(tree, admin) {
  if (!tree.length) return `<p class="text-sm text-muted">Chưa có dữ liệu Thôn/Xóm nào trong danh sách khách hàng.</p>`;
  return `<div class="flex-col gap-10">${tree.map(({ thon, xomList }) => `
    <div class="card card-pad" style="background:var(--surface-alt)">
      <label class="flex items-center gap-8" style="font-size:14px;font-weight:700;cursor:pointer">
        <input type="checkbox" name="thon" value="${thon}" ${admin?.allowedThon.includes(thon) ? 'checked' : ''}/>
        ${icon('mapPin', 'icon-sm')} ${thon} <span class="text-faint" style="font-weight:500">(cả thôn)</span>
      </label>
      ${xomList.length ? `
      <div class="chip-row mt-8" style="flex-wrap:wrap">
        ${xomList.map((x) => `
          <label class="chip xom-chip ${admin?.allowedXom.includes(x) ? 'active' : ''}" style="cursor:pointer">
            <input type="checkbox" name="xom" value="${x}" ${admin?.allowedXom.includes(x) ? 'checked' : ''} style="position:absolute;opacity:0;width:0;height:0"/>
            ${x}
          </label>`).join('')}
      </div>` : ''}
    </div>`).join('')}</div>`;
}
function bindPermissionTreeChips(sheet) {
  sheet.querySelectorAll('.xom-chip input[name="xom"]').forEach((cb) => {
    cb.addEventListener('change', () => cb.closest('label').classList.toggle('active', cb.checked));
  });
}

function openAdminDetail(admin, tree, contentEl) {
  const isSelf = S.getSession()?.id === admin.id;
  const close = openModal({
    title: admin.name,
    bodyHtml: `
      <div class="oc-line"><span>Tên đăng nhập</span><b>@${admin.username}</b></div>
      <div class="oc-line"><span>Vai trò</span><b>${admin.role === 'super' ? 'Quản trị viên toàn quyền' : 'Quản trị viên chỉ xem'}</b></div>
      ${admin.role === 'staff' ? `
      <div class="section-head mt-16"><h2 style="font-size:14px">Địa bàn được xem</h2></div>
      <form id="perm-form">${permissionTreeHtml(tree, admin)}</form>
      <button class="btn btn-primary btn-block mt-16" id="btn-save-perm">Lưu quyền</button>
      ` : `<p class="field-hint mt-16">Quản trị viên toàn quyền xem được mọi địa bàn, không cần gán riêng.</p>`}
      <div class="flex gap-8 mt-16">
        <button class="btn btn-outline btn-sm" id="btn-reset-pw">${icon('key', 'icon-sm')} Cấp lại mật khẩu</button>
        ${!isSelf ? `<button class="btn btn-danger-outline btn-sm" id="btn-del-admin">${icon('trash', 'icon-sm')} Xóa</button>` : ''}
      </div>
      ${isSelf ? `<p class="field-hint mt-8">Không thể tự xóa tài khoản đang đăng nhập.</p>` : ''}
    `,
    onMount(sheet, closeFn) {
      bindPermissionTreeChips(sheet);
      const saveBtn = sheet.querySelector('#btn-save-perm');
      if (saveBtn) saveBtn.addEventListener('click', () => {
        const fd = new FormData(sheet.querySelector('#perm-form'));
        S.updateStaffPermissions(admin.id, fd.getAll('thon'), fd.getAll('xom'));
        toast('Đã cập nhật quyền xem', 'success');
        closeFn();
        draw(contentEl);
      });
      sheet.querySelector('#btn-reset-pw').addEventListener('click', async () => {
        const temp = await S.resetStaffPassword(admin.id);
        closeFn();
        showCredential('Đã cấp lại mật khẩu', admin.username, temp);
      });
      const delBtn = sheet.querySelector('#btn-del-admin');
      if (delBtn) delBtn.addEventListener('click', () => {
        confirmDialog({
          title: 'Xóa quản trị viên?', message: `Xóa tài khoản "${admin.name}" (@${admin.username})?`,
          confirmLabel: 'Xóa', danger: true,
          onConfirm: () => {
            S.deleteStaffAdmin(admin.id);
            closeFn();
            toast('Đã xóa quản trị viên', 'success');
            draw(contentEl);
          },
        });
      });
    },
  });
  return close;
}

function openCreateUserModal(tree, contentEl) {
  let kind = 'use'; // 'use' | 'admin'
  let adminRole = 'staff'; // 'staff' | 'super'

  const close = openModal({
    title: 'Tạo User',
    bodyHtml: `<div id="cu-body"></div>`,
    footHtml: `<button class="btn btn-primary btn-block" id="cu-save">Tạo User</button>`,
    onMount(sheet, closeFn) {
      const body = sheet.querySelector('#cu-body');
      function draw2() {
        body.innerHTML = `
          <div class="field">
            <label>Loại tài khoản</label>
            <div class="radio-row">
              <div class="radio-opt ${kind === 'use' ? 'active' : ''}" data-kind="use">Use (khách hàng)</div>
              <div class="radio-opt ${kind === 'admin' ? 'active' : ''}" data-kind="admin">Quản trị viên</div>
            </div>
          </div>
          ${kind === 'use' ? `
          <form id="use-form">
            <div class="field"><label>Số CCCD</label><input name="cccd" required pattern="\\d{9,12}"/></div>
            <div class="field"><label>Họ tên</label><input name="name" required/></div>
            <div class="field">
              <label>Số điện thoại</label>
              <input name="phone"/>
              <div class="field-hint">User đăng nhập được bằng CCCD hoặc SĐT này — nên nhập cả 2.</div>
            </div>
            <div class="field">
              <label>Địa chỉ</label>
              <input name="address" placeholder="VD: Xóm 01, thôn Bình Nguyên, xã Bình Sơn, tỉnh Quảng Ngãi"/>
              <div class="field-hint">Hệ thống tự tách Xóm/Thôn/Tỉnh theo dấu phẩy.</div>
            </div>
            <div class="field-hint mb-8">User chỉ xem được hợp đồng của mình (nhập qua Excel) — không có mục phân quyền.</div>
          </form>
          ` : `
          <form id="admin-form">
            <div class="field"><label>Tên đăng nhập</label><input name="username" required placeholder="VD: nhanvien2"/></div>
            <div class="field"><label>Họ tên</label><input name="name" required/></div>
            <div class="field">
              <label>Mật khẩu</label>
              <input name="password" placeholder="Để trống sẽ tự sinh mật khẩu"/>
            </div>
            <div class="field">
              <label>Vai trò</label>
              <div class="radio-row">
                <div class="radio-opt ${adminRole === 'staff' ? 'active' : ''}" data-admin-role="staff">Chỉ xem (nhân viên)</div>
                <div class="radio-opt ${adminRole === 'super' ? 'active' : ''}" data-admin-role="super">Toàn quyền</div>
              </div>
            </div>
            ${adminRole === 'staff' ? `
            <div class="field">
              <label>Địa bàn được xem</label>
              <div class="field-hint mb-8">Tích cả Thôn để xem toàn bộ Xóm trong Thôn đó, hoặc bấm riêng từng Xóm nếu chỉ cần xem 1 phần của Thôn.</div>
              ${permissionTreeHtml(tree, null)}
            </div>
            ` : `<p class="field-hint">Quản trị viên toàn quyền xem được mọi địa bàn và truy cập Cài đặt, Quản lý User.</p>`}
          </form>
          `}
        `;
        body.querySelectorAll('[data-kind]').forEach((opt) => opt.addEventListener('click', () => { kind = opt.dataset.kind; draw2(); }));
        body.querySelectorAll('[data-admin-role]').forEach((opt) => opt.addEventListener('click', () => { adminRole = opt.dataset.adminRole; draw2(); }));
        bindPermissionTreeChips(body);
      }
      draw2();

      sheet.querySelector('#cu-save').addEventListener('click', async () => {
        if (kind === 'use') {
          const form = sheet.querySelector('#use-form');
          if (!form.reportValidity()) return;
          const fd = new FormData(form);
          const res = await S.upsertCustomer({ cccd: fd.get('cccd'), name: fd.get('name'), phone: fd.get('phone'), address: fd.get('address') });
          closeFn();
          toast(res.isNew ? 'Đã tạo User mới' : 'Đã cập nhật User', 'success');
          if (res.isNew) showCredential('Đã tạo User', res.customer.cccd, res.tempPassword);
          draw(contentEl);
        } else {
          const form = sheet.querySelector('#admin-form');
          if (!form.reportValidity()) return;
          const fd = new FormData(form);
          try {
            const { staff, tempPassword } = await S.addStaffAdmin({
              username: fd.get('username'), name: fd.get('name'), password: fd.get('password'),
              role: adminRole, allowedThon: fd.getAll('thon'), allowedXom: fd.getAll('xom'),
            });
            closeFn();
            toast('Đã tạo quản trị viên', 'success');
            showCredential('Đã tạo quản trị viên', staff.username, tempPassword);
            draw(contentEl);
          } catch (err) {
            toast(err.message || 'Có lỗi xảy ra', 'error');
          }
        }
      });
    },
  });
  return close;
}
