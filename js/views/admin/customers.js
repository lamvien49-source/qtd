import * as S from '../../state.js';
import { icon } from '../../icons.js';
import { pageHeader } from '../../components/shell.js';
import { emptyState, statusBadge } from '../../components/ui.js';
import { openModal, confirmDialog } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { formatVND, formatNumber, formatDate, maskCccd, colorFor, initials, debounce } from '../../utils.js';

export function renderHeader(headerEl) {
  headerEl.innerHTML = pageHeader({ title: 'Khách hàng & Hợp đồng' });
}

let query = '';

export function render(contentEl, filterEl) {
  filterEl.innerHTML = `
    <div style="padding:10px 14px 0">
      <div class="search-box mb-8">${icon('search', 'icon-sm')}<input id="search-input" placeholder="Tìm theo tên, số CCCD, SĐT..." value="${query}"/></div>
      <div class="flex gap-8 mb-8">
        <button class="btn btn-outline btn-sm" id="btn-import">${icon('paperclip', 'icon-sm')} Nhập nhanh (dán bảng)</button>
        <button class="btn btn-primary btn-sm" id="btn-add">${icon('plus', 'icon-sm')} Thêm khách hàng</button>
      </div>
    </div>
  `;
  filterEl.querySelector('#search-input').addEventListener('input', debounce((e) => { query = e.target.value; draw(); }, 200));
  filterEl.querySelector('#btn-import').addEventListener('click', openImportModal);
  filterEl.querySelector('#btn-add').addEventListener('click', () => openCustomerForm());

  function draw() {
    let list = S.listCustomers();
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.cccd.includes(q) || (c.phone || '').includes(q));
    }
    contentEl.innerHTML = `
      <div class="card card-pad">
        <div class="text-sm text-muted mb-8">${list.length} khách hàng</div>
        ${list.length ? list.map((c) => {
          const contracts = S.listContractsByCustomer(c.id);
          const total = S.customerOutstandingTotal(c.id);
          return `
          <div class="list-row" data-id="${c.id}" style="cursor:pointer">
            <div class="row-thumb" style="background:${colorFor(c.id)}">${initials(c.name)}</div>
            <div class="row-main">
              <div class="row-title">${c.name}</div>
              <div class="row-sub">${maskCccd(c.cccd)} · ${c.phone || 'Chưa có SĐT'} · ${contracts.length} hợp đồng</div>
            </div>
            <div class="row-end">
              <div class="amount">${formatVND(total)}</div>
              ${c.mustChangePassword ? `<div class="amount-sub text-warning" style="color:var(--warning)">Chưa đổi MK</div>` : ''}
            </div>
          </div>`;
        }).join('') : emptyState({ iconName: 'users', title: 'Chưa có khách hàng', message: 'Dùng "Nhập nhanh" hoặc "Thêm khách hàng" để bắt đầu.' })}
      </div>
    `;
    contentEl.querySelectorAll('[data-id]').forEach((row) => {
      row.addEventListener('click', () => openCustomerDetail(row.dataset.id));
    });
  }
  draw();
  window.__qtdRedrawCustomers = draw;
}

function openCustomerForm(customer) {
  const isEdit = !!customer;
  const close = openModal({
    title: isEdit ? 'Sửa khách hàng' : 'Thêm khách hàng',
    bodyHtml: `
      <form id="cf">
        <div class="field"><label>Số CCCD</label><input name="cccd" required pattern="\\d{9,12}" value="${customer ? customer.cccd : ''}" ${isEdit ? 'readonly' : ''}/></div>
        <div class="field"><label>Họ tên</label><input name="name" required value="${customer ? esc(customer.name) : ''}"/></div>
        <div class="field-row">
          <div class="field"><label>Số điện thoại</label><input name="phone" value="${customer ? esc(customer.phone) : ''}"/></div>
          <div class="field"><label>Địa chỉ</label><input name="address" value="${customer ? esc(customer.address) : ''}"/></div>
        </div>
        ${!isEdit ? `<div class="field-hint">Hệ thống sẽ tự tạo mật khẩu tạm cho khách hàng, hiển thị sau khi lưu.</div>` : ''}
      </form>
    `,
    footHtml: `<button class="btn btn-primary btn-block" id="save">${isEdit ? 'Lưu' : 'Thêm khách hàng'}</button>`,
    onMount(sheet, closeFn) {
      sheet.querySelector('#save').addEventListener('click', async () => {
        const form = sheet.querySelector('#cf');
        if (!form.reportValidity()) return;
        const fd = new FormData(form);
        const res = await S.upsertCustomer({ cccd: fd.get('cccd'), name: fd.get('name'), phone: fd.get('phone'), address: fd.get('address') });
        closeFn();
        if (res.isNew) {
          toast('Đã thêm khách hàng mới', 'success');
          showCredential(res.customer, res.tempPassword);
        } else {
          toast('Đã cập nhật khách hàng', 'success');
        }
        window.__qtdRedrawCustomers && window.__qtdRedrawCustomers();
      });
    },
  });
  return close;
}

function showCredential(customer, tempPassword) {
  openModal({
    title: 'Tài khoản đã tạo',
    bodyHtml: `
      <p class="text-sm text-muted mb-16">Gửi thông tin sau cho khách hàng để họ đăng nhập lần đầu (bắt buộc đổi mật khẩu ngay sau khi đăng nhập):</p>
      <div class="card card-pad" style="background:var(--surface-alt)">
        <div class="oc-line"><span>Tên đăng nhập (CCCD)</span><b>${customer.cccd}</b></div>
        <div class="oc-line"><span>Mật khẩu tạm</span><b>${tempPassword}</b></div>
      </div>
    `,
    footHtml: `<button class="btn btn-primary btn-block" data-close>Đã hiểu</button>`,
    onMount(sheet, closeFn) { sheet.querySelector('[data-close]').addEventListener('click', closeFn); },
  });
}

function openCustomerDetail(customerId) {
  const c = S.getCustomer(customerId);
  const contracts = S.listContractsByCustomer(customerId);
  const close = openModal({
    title: c.name,
    bodyHtml: `
      <div class="oc-line"><span>CCCD</span><b>${c.cccd}</b></div>
      <div class="oc-line"><span>SĐT</span><b>${c.phone || '—'}</b></div>
      <div class="oc-line"><span>Địa chỉ</span><b>${c.address || '—'}</b></div>
      <div class="flex gap-8 mt-16 mb-16">
        <button class="btn btn-outline btn-sm" id="btn-reset-pw">${icon('key', 'icon-sm')} Cấp lại mật khẩu</button>
        <button class="btn btn-outline btn-sm" id="btn-add-contract">${icon('plus', 'icon-sm')} Thêm hợp đồng</button>
        <button class="btn btn-danger-outline btn-sm" id="btn-del-cust">${icon('trash', 'icon-sm')}</button>
      </div>
      <div class="section-head"><h2 style="font-size:14px">Hợp đồng (${contracts.length})</h2></div>
      <div id="contract-list">${contracts.map((ct) => contractRow(ct)).join('') || '<p class="text-sm text-muted">Chưa có hợp đồng.</p>'}</div>
    `,
    onMount(sheet, closeFn) {
      sheet.querySelector('#btn-reset-pw').addEventListener('click', async () => {
        const temp = await S.adminResetCustomerPassword(customerId);
        showCredential(c, temp);
      });
      sheet.querySelector('#btn-add-contract').addEventListener('click', () => { closeFn(); openContractForm(customerId); });
      sheet.querySelector('#btn-del-cust').addEventListener('click', () => {
        confirmDialog({
          title: 'Xóa khách hàng?', message: `Xóa "${c.name}" và toàn bộ hợp đồng liên quan?`,
          confirmLabel: 'Xóa', danger: true,
          onConfirm: () => { S.deleteCustomer(customerId); closeFn(); toast('Đã xóa khách hàng', 'success'); window.__qtdRedrawCustomers?.(); },
        });
      });
      sheet.querySelectorAll('[data-edit-contract]').forEach((btn) => {
        btn.addEventListener('click', () => { closeFn(); openContractForm(customerId, S.getContract(btn.dataset.editContract)); });
      });
    },
  });
}

function contractRow(ct) {
  const status = S.CONTRACT_STATUS_MAP[ct.status];
  return `
    <div class="list-row" data-edit-contract="${ct.id}" style="cursor:pointer">
      <div class="row-main">
        <div class="row-title">${ct.code}</div>
        <div class="row-sub">Vay ${formatVND(ct.principal)} · ${formatDate(ct.disbursedDate)} → ${formatDate(ct.dueDate)}</div>
      </div>
      <div class="row-end"><div class="amount">${formatVND(ct.balance)}</div>${statusBadge(status)}</div>
    </div>`;
}

function openContractForm(customerId, contract) {
  const isEdit = !!contract;
  const close = openModal({
    title: isEdit ? `Sửa hợp đồng ${contract.code}` : 'Thêm hợp đồng vay',
    bodyHtml: `
      <form id="ctf">
        <div class="field"><label>Mã hợp đồng</label><input name="code" required value="${contract ? contract.code : ''}" ${isEdit ? 'readonly' : ''}/></div>
        <div class="field-row">
          <div class="field"><label>Số tiền vay</label><input name="principal" type="number" min="0" step="1000000" required value="${contract ? contract.principal : ''}"/></div>
          <div class="field"><label>Dư nợ hiện tại</label><input name="balance" type="number" min="0" step="100000" required value="${contract ? contract.balance : ''}"/></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Ngày vay</label><input name="disbursedDate" type="date" required value="${contract ? contract.disbursedDate : ''}"/></div>
          <div class="field"><label>Ngày đến hạn</label><input name="dueDate" type="date" required value="${contract ? contract.dueDate : ''}"/></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Lãi suất (%/năm)</label><input name="interestRate" type="number" min="0" step="0.1" value="${contract ? contract.interestRate : ''}"/></div>
          <div class="field"><label>Kỳ hạn (tháng)</label><input name="termMonths" type="number" min="1" value="${contract ? contract.termMonths || '' : ''}"/></div>
        </div>
        <div class="field">
          <label>Trạng thái</label>
          <select name="status">
            ${S.CONTRACT_STATUS.map((s) => `<option value="${s.id}" ${contract?.status === s.id ? 'selected' : ''}>${s.label}</option>`).join('')}
          </select>
        </div>
      </form>
    `,
    footHtml: `
      ${isEdit ? `<button class="btn btn-danger-outline" id="del">${icon('trash', 'icon-sm')}</button>` : ''}
      <button class="btn btn-primary btn-block" id="save">Lưu</button>`,
    onMount(sheet, closeFn) {
      sheet.querySelector('#save').addEventListener('click', () => {
        const form = sheet.querySelector('#ctf');
        if (!form.reportValidity()) return;
        const fd = new FormData(form);
        S.upsertContract({
          customerId, code: fd.get('code'), principal: fd.get('principal'), balance: fd.get('balance'),
          disbursedDate: fd.get('disbursedDate'), dueDate: fd.get('dueDate'),
          interestRate: fd.get('interestRate'), termMonths: fd.get('termMonths'), status: fd.get('status'),
        });
        toast('Đã lưu hợp đồng', 'success');
        closeFn();
        window.__qtdRedrawCustomers?.();
      });
      const delBtn = sheet.querySelector('#del');
      if (delBtn) delBtn.addEventListener('click', () => {
        confirmDialog({
          title: 'Xóa hợp đồng?', message: `Xóa hợp đồng ${contract.code}?`, confirmLabel: 'Xóa', danger: true,
          onConfirm: () => { S.deleteContract(contract.id); closeFn(); toast('Đã xóa hợp đồng', 'success'); window.__qtdRedrawCustomers?.(); },
        });
      });
    },
  });
}

function openImportModal() {
  const close = openModal({
    title: 'Nhập nhanh từ bảng (dán từ Excel)',
    bodyHtml: `
      <p class="text-sm text-muted mb-8">
        Mở file Excel, chọn vùng dữ liệu (không lấy dòng tiêu đề), <b>Copy</b>, rồi <b>dán (Ctrl+V)</b> vào ô bên dưới.
        Thứ tự cột: <b>CCCD, Họ tên, SĐT, Mã hợp đồng, Số tiền vay, Ngày vay, Ngày đến hạn, Lãi suất, Dư nợ</b>.
      </p>
      <div class="field"><textarea id="paste-area" rows="8" placeholder="Dán dữ liệu vào đây..." style="width:100%;border:1px solid var(--border-strong);border-radius:8px;padding:10px;font-size:13px;font-family:monospace"></textarea></div>
      <div id="import-result"></div>
    `,
    footHtml: `<button class="btn btn-primary btn-block" id="do-import">${icon('paperclip', 'icon-sm')} Nhập dữ liệu</button>`,
    onMount(sheet, closeFn) {
      sheet.querySelector('#do-import').addEventListener('click', async () => {
        const text = sheet.querySelector('#paste-area').value;
        if (!text.trim()) { toast('Chưa có dữ liệu để nhập', 'error'); return; }
        const res = await S.importFromPastedTable(text);
        const resultEl = sheet.querySelector('#import-result');
        resultEl.innerHTML = `
          <div class="card card-pad mt-16" style="background:var(--surface-alt)">
            <div class="text-sm mb-8">✅ ${res.createdCustomers.length} khách hàng mới · ${res.updatedCustomers} khách đã cập nhật · ${res.contracts} hợp đồng</div>
            ${res.createdCustomers.length ? `
              <div class="fw-700 text-sm mb-6">Tài khoản mới tạo (gửi cho khách hàng):</div>
              ${res.createdCustomers.map((c) => `<div class="oc-line"><span>${c.name} (${c.cccd})</span><b>${c.tempPassword}</b></div>`).join('')}
            ` : ''}
            ${res.errors.length ? `<div class="text-sm text-danger mt-8">${res.errors.slice(0, 5).join('<br/>')}</div>` : ''}
          </div>
        `;
        toast('Đã nhập dữ liệu', 'success');
        window.__qtdRedrawCustomers?.();
      });
    },
  });
}

function esc(s) { return String(s || '').replace(/"/g, '&quot;'); }
