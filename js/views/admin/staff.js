// Trang "Quản lý User" — quản lý TẤT CẢ tài khoản trong hệ thống ở 1 chỗ:
// "Use" (tài khoản khách hàng) và "Quản trị viên" (super toàn quyền hoặc
// staff chỉ xem, có phân quyền theo Thôn/Xóm). Chỉ quản trị viên toàn quyền
// mới vào được trang này (route đã đặt superOnly ở app.js).
import * as S from '../../state.js';
import { icon } from '../../icons.js';
import { pageHeader } from '../../components/shell.js';
import { emptyState, openResetPasswordModal } from '../../components/ui.js';
import { openModal, confirmDialog } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { initials, colorFor, maskCccd, formatNumber, debounce } from '../../utils.js';
import { openCustomerDetail } from './customers.js';

export function renderHeader(headerEl) {
  headerEl.innerHTML = pageHeader({ title: 'Quản lý User' });
}

let filterRole = 'all'; // 'all' | 'use' | 'admin'
let query = '';

export function render(contentEl, filterEl) {
  filterRole = 'all';
  query = '';
  // Ô tìm kiếm nằm ở filterEl (không bị vẽ lại cùng danh sách) để không mất
  // focus/con trỏ mỗi khi gõ — giống cách trang Khách hàng & Hợp đồng làm.
  filterEl.innerHTML = `<div style="padding:10px 14px 0"><div class="search-box mb-8">${icon('search', 'icon-sm')}<input id="search-input" placeholder="Tìm theo tên, CCCD, SĐT, tên đăng nhập..." value=""/></div></div>`;
  filterEl.querySelector('#search-input').addEventListener('input', debounce((e) => { query = e.target.value; draw(contentEl); }, 200));
  draw(contentEl);
}

function permissionSummary(a) {
  const parts = [...a.allowedThon, ...a.allowedXom.map((x) => `Xóm ${x}`)];
  return parts.length ? parts.join(', ') : 'Chưa gán địa bàn nào';
}

function draw(contentEl) {
  // "Use" ở trang này chỉ tính khách hàng ĐÃ có tài khoản đăng nhập (salt+hash) —
  // hồ sơ nhập từ Excel chưa được "Tạo User" thuộc về trang Khách hàng & Hợp
  // đồng, không phải Use, để 2 khái niệm không lẫn vào nhau.
  const customers = S.getState().customers.filter((c) => c.salt && c.hash);
  const admins = S.listAdmins();
  const lockedCount = customers.filter((c) => S.isCustomerLocked(c)).length;
  const tree = S.thonXomTree();

  let rows = [];
  if (filterRole !== 'admin') customers.forEach((c) => rows.push({ kind: 'use', data: c }));
  if (filterRole !== 'use') admins.forEach((a) => rows.push({ kind: 'admin', data: a }));
  if (query.trim()) {
    const q = query.trim().toLowerCase();
    rows = rows.filter(({ kind, data }) => kind === 'use'
      ? data.name.toLowerCase().includes(q) || data.cccd.includes(q) || (data.phone || '').includes(q)
      : data.name.toLowerCase().includes(q) || data.username.toLowerCase().includes(q));
  }

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
        : emptyState({ iconName: 'idCard', title: 'Không có tài khoản phù hợp', message: 'Bấm "Tạo User" để tạo tài khoản đầu tiên.' })}
    </div>
  `;

  contentEl.querySelectorAll('[data-role]').forEach((btn) => {
    btn.addEventListener('click', () => { filterRole = btn.dataset.role; draw(contentEl); });
  });
  contentEl.querySelector('#btn-add-user').addEventListener('click', () => openCreateUserModal(tree, contentEl));
  contentEl.querySelectorAll('[data-open-use]').forEach((row) => {
    row.addEventListener('click', () => openCustomerDetail(row.dataset.openUse, { readOnly: false, context: 'use' }));
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
  return `
    <div class="flex gap-8 mb-8">
      <button type="button" class="btn btn-outline btn-sm" data-perm-select-all>Chọn tất cả</button>
      <button type="button" class="btn btn-outline btn-sm" data-perm-clear-all>Bỏ chọn tất cả</button>
    </div>
    <div class="flex-col gap-10">${tree.map(({ thon, xomList }) => `
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
  const selectAllBtn = sheet.querySelector('[data-perm-select-all]');
  const clearAllBtn = sheet.querySelector('[data-perm-clear-all]');
  if (selectAllBtn) selectAllBtn.addEventListener('click', () => {
    sheet.querySelectorAll('input[name="thon"], input[name="xom"]').forEach((cb) => {
      cb.checked = true;
      if (cb.name === 'xom') cb.closest('label').classList.add('active');
    });
  });
  if (clearAllBtn) clearAllBtn.addEventListener('click', () => {
    sheet.querySelectorAll('input[name="thon"], input[name="xom"]').forEach((cb) => {
      cb.checked = false;
      if (cb.name === 'xom') cb.closest('label').classList.remove('active');
    });
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
      sheet.querySelector('#btn-reset-pw').addEventListener('click', () => {
        openResetPasswordModal({
          title: 'Cấp lại mật khẩu',
          onConfirm: async (val) => {
            const temp = await S.resetStaffPassword(admin.id, val);
            closeFn();
            showCredential('Đã cấp lại mật khẩu', admin.username, temp);
          },
        });
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
            <div class="field">
              <label>Mật khẩu đăng nhập</label>
              <input name="password" placeholder="Để trống sẽ tự sinh mật khẩu"/>
              <div class="field-hint">Đây là mật khẩu để User đăng nhập lần đầu — có thể tự đặt hoặc để trống cho hệ thống tự sinh, hiện ra sau khi lưu để gửi cho khách.</div>
            </div>
            <div class="field-hint mb-8">Không cần nhập họ tên/SĐT/địa chỉ — nhập file Excel có CCCD này thì User sẽ tự động đồng bộ lấy đúng thông tin, tự thấy ngay hợp đồng khớp CCCD.</div>
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
          try {
            const res = await S.activateCustomerAccount({ cccd: fd.get('cccd'), password: fd.get('password') });
            closeFn();
            toast('Đã tạo User mới', 'success');
            showCredential('Đã tạo User', res.customer.cccd, res.tempPassword);
            draw(contentEl);
          } catch (err) {
            toast(err.message || 'Có lỗi xảy ra', 'error');
          }
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
