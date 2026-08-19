import * as S from '../../state.js';
import { icon } from '../../icons.js';
import { pageHeader } from '../../components/shell.js';
import { emptyState } from '../../components/ui.js';
import { openModal, confirmDialog } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { initials, colorFor } from '../../utils.js';

export function renderHeader(headerEl) {
  headerEl.innerHTML = pageHeader({ title: 'Quản lý nhân viên' });
}

function permissionSummary(a) {
  const parts = [];
  if (a.allowedThon.length) parts.push(...a.allowedThon.map((t) => t));
  if (a.allowedXom.length) parts.push(...a.allowedXom.map((x) => `Xóm ${x}`));
  return parts.length ? parts.join(', ') : 'Chưa gán địa bàn nào';
}

export function render(contentEl) {
  const tree = S.thonXomTree();
  const staffList = S.listAdmins().filter((a) => a.role === 'staff');

  contentEl.innerHTML = `
    <div class="card card-pad mb-16">
      <p class="text-sm text-muted mb-8">Tài khoản nhân viên chỉ xem được (không sửa/xóa) danh sách khách hàng &amp; hợp đồng, giới hạn theo Thôn/Xóm được gán bên dưới.</p>
      <button class="btn btn-primary btn-sm" id="btn-add-staff">${icon('plus', 'icon-sm')} Tạo nhân viên</button>
    </div>
    <div class="card card-pad">
      <div class="text-sm text-muted mb-8">${staffList.length} nhân viên</div>
      ${staffList.length ? staffList.map((a) => `
        <div class="list-row">
          <div class="row-thumb" style="background:${colorFor(a.id)}">${initials(a.name)}</div>
          <div class="row-main">
            <div class="row-title">${a.name}</div>
            <div class="row-sub">@${a.username} · Xem được: ${permissionSummary(a)}</div>
          </div>
          <div class="row-end flex gap-6">
            <button class="btn btn-outline btn-sm" data-edit="${a.id}">${icon('edit', 'icon-sm')}</button>
            <button class="btn btn-outline btn-sm" data-reset="${a.id}">${icon('key', 'icon-sm')}</button>
            <button class="btn btn-danger-outline btn-sm" data-del="${a.id}">${icon('trash', 'icon-sm')}</button>
          </div>
        </div>
      `).join('') : emptyState({ iconName: 'idCard', title: 'Chưa có nhân viên', message: 'Bấm "Tạo nhân viên" để tạo tài khoản đầu tiên.' })}
    </div>
  `;

  contentEl.querySelector('#btn-add-staff').addEventListener('click', () => openStaffForm(tree));
  contentEl.querySelectorAll('[data-edit]').forEach((btn) => {
    btn.addEventListener('click', () => openStaffForm(tree, S.getAdmin(btn.dataset.edit)));
  });
  contentEl.querySelectorAll('[data-reset]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const a = S.getAdmin(btn.dataset.reset);
      const temp = await S.resetStaffPassword(a.id);
      showCredential(a, temp);
    });
  });
  contentEl.querySelectorAll('[data-del]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const a = S.getAdmin(btn.dataset.del);
      confirmDialog({
        title: 'Xóa nhân viên?', message: `Xóa tài khoản "${a.name}" (@${a.username})?`,
        confirmLabel: 'Xóa', danger: true,
        onConfirm: () => { S.deleteStaffAdmin(a.id); toast('Đã xóa nhân viên', 'success'); },
      });
    });
  });
}

function showCredential(staff, tempPassword) {
  openModal({
    title: 'Thông tin đăng nhập',
    bodyHtml: `
      <p class="text-sm text-muted mb-16">Gửi thông tin sau cho nhân viên:</p>
      <div class="card card-pad" style="background:var(--surface-alt)">
        <div class="oc-line"><span>Tên đăng nhập</span><b>${staff.username}</b></div>
        <div class="oc-line"><span>Mật khẩu</span><b>${tempPassword}</b></div>
      </div>
    `,
    footHtml: `<button class="btn btn-primary btn-block" data-close>Đã hiểu</button>`,
    onMount(sheet, closeFn) { sheet.querySelector('[data-close]').addEventListener('click', closeFn); },
  });
}

/** Cây chọn quyền 2 cấp: tích cả Thôn = xem trọn Thôn đó; tích riêng từng Xóm = chỉ xem Xóm đó dù Thôn không được cấp trọn. */
function permissionTreeHtml(tree, staff) {
  if (!tree.length) return `<p class="text-sm text-muted">Chưa có dữ liệu Thôn/Xóm nào trong danh sách khách hàng.</p>`;
  return `<div class="flex-col gap-10">${tree.map(({ thon, xomList }) => `
    <div class="card card-pad" style="background:var(--surface-alt)">
      <label class="flex items-center gap-8" style="font-size:14px;font-weight:700">
        <input type="checkbox" name="thon" value="${thon}" ${staff?.allowedThon.includes(thon) ? 'checked' : ''}/> ${thon} <span class="text-faint fw-500">(cả thôn)</span>
      </label>
      ${xomList.length ? `
      <div class="flex-col gap-6 mt-8" style="padding-left:22px">
        ${xomList.map((x) => `
          <label class="flex items-center gap-8" style="font-size:13.5px;font-weight:500">
            <input type="checkbox" name="xom" value="${x}" ${staff?.allowedXom.includes(x) ? 'checked' : ''}/> ${x}
          </label>`).join('')}
      </div>` : ''}
    </div>`).join('')}</div>`;
}

function openStaffForm(tree, staff) {
  const isEdit = !!staff;
  const close = openModal({
    title: isEdit ? `Sửa nhân viên — ${staff.name}` : 'Tạo nhân viên',
    bodyHtml: `
      <form id="sf">
        ${!isEdit ? `
        <div class="field"><label>Tên đăng nhập</label><input name="username" required placeholder="VD: nhanvien2"/></div>
        <div class="field"><label>Họ tên</label><input name="name" required/></div>
        <div class="field">
          <label>Mật khẩu</label>
          <input name="password" placeholder="Để trống sẽ tự sinh mật khẩu"/>
          <div class="field-hint">Có thể tự đặt mật khẩu ngay ở đây, hoặc để trống cho hệ thống tự sinh (hiện ra sau khi lưu để gửi cho nhân viên).</div>
        </div>
        ` : `<p class="text-sm text-muted mb-8">Đổi tên đăng nhập/mật khẩu: dùng nút cấp lại mật khẩu ở danh sách. Ở đây chỉ sửa quyền xem.</p>`}
        <div class="field">
          <label>Địa bàn được xem</label>
          <div class="field-hint mb-8">Tích cả Thôn để xem toàn bộ Xóm trong Thôn đó, hoặc tích riêng từng Xóm nếu chỉ cần xem 1 phần của Thôn.</div>
          ${permissionTreeHtml(tree, staff)}
        </div>
      </form>
    `,
    footHtml: `<button class="btn btn-primary btn-block" id="save">${isEdit ? 'Lưu quyền' : 'Tạo nhân viên'}</button>`,
    onMount(sheet, closeFn) {
      sheet.querySelector('#save').addEventListener('click', async () => {
        const form = sheet.querySelector('#sf');
        if (!form.reportValidity()) return;
        const fd = new FormData(form);
        const allowedThon = fd.getAll('thon');
        const allowedXom = fd.getAll('xom');
        if (isEdit) {
          S.updateStaffPermissions(staff.id, allowedThon, allowedXom);
          toast('Đã cập nhật quyền xem', 'success');
          closeFn();
        } else {
          try {
            const { staff: newStaff, tempPassword } = await S.addStaffAdmin({
              username: fd.get('username'), name: fd.get('name'), password: fd.get('password'),
              allowedThon, allowedXom,
            });
            toast('Đã tạo nhân viên', 'success');
            closeFn();
            showCredential(newStaff, tempPassword);
          } catch (err) {
            toast(err.message || 'Có lỗi xảy ra', 'error');
          }
        }
      });
    },
  });
  return close;
}
