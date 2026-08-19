import * as S from '../../state.js';
import { icon } from '../../icons.js';
import { pageHeader } from '../../components/shell.js';
import { emptyState, statusBadge, openPicker, pillSelectHtml } from '../../components/ui.js';
import { openModal, confirmDialog } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { formatVND, formatDate, daysUntil, maskCccd, colorFor, initials, debounce } from '../../utils.js';
import { readXlsxFirstSheet, rowsToTsv } from '../../lib/xlsxLite.js';

export function renderHeader(headerEl) {
  headerEl.innerHTML = pageHeader({ title: 'Khách hàng & Hợp đồng' });
}

let query = '';
let filterThon = 'all';
let filterXom = 'all';
let onlyOverdue = false;

function currentAdmin() {
  const session = S.getSession();
  return S.getAdmin(session.id);
}

export function render(contentEl, filterEl) {
  const admin = currentAdmin();
  const isStaff = admin.role === 'staff';
  filterThon = 'all'; filterXom = 'all'; // reset bộ lọc mỗi lần vào trang

  filterEl.innerHTML = `
    <div style="padding:10px 14px 0">
      <div class="search-box mb-8">${icon('search', 'icon-sm')}<input id="search-input" placeholder="Tìm theo tên, số CCCD, SĐT..." value="${query}"/></div>
      <div class="filter-row" style="padding:0 0 8px">
        ${pillSelectHtml('pill-thon', 'Thôn: Tất cả')}
        ${pillSelectHtml('pill-xom', 'Xóm: Tất cả')}
      </div>
      <div class="chip-row mb-8">
        <button class="chip ${!onlyOverdue ? 'active' : ''}" data-overdue="0">Tất cả</button>
        <button class="chip ${onlyOverdue ? 'active' : ''}" data-overdue="1">${icon('alert', 'icon-sm')} Có nợ quá hạn</button>
      </div>
      ${!isStaff ? `
      <div class="flex gap-8 mb-8">
        <button class="btn btn-outline btn-sm" id="btn-import">${icon('paperclip', 'icon-sm')} Nhập từ Excel</button>
        <button class="btn btn-primary btn-sm" id="btn-add">${icon('plus', 'icon-sm')} Thêm khách hàng</button>
      </div>` : `<p class="field-hint mb-8">Tài khoản nhân viên — chỉ xem, không chỉnh sửa được dữ liệu.</p>`}
    </div>
  `;
  filterEl.querySelector('#search-input').addEventListener('input', debounce((e) => { query = e.target.value; draw(); }, 200));
  if (!isStaff) {
    filterEl.querySelector('#btn-import').addEventListener('click', openImportModal);
    filterEl.querySelector('#btn-add').addEventListener('click', () => openCustomerForm());
  }
  filterEl.querySelectorAll('[data-overdue]').forEach((chip) => {
    chip.addEventListener('click', () => { onlyOverdue = chip.dataset.overdue === '1'; render(contentEl, filterEl); });
  });

  function bindPickers() {
    filterEl.querySelector('#pill-thon').addEventListener('click', () => {
      const allowedThon = isStaff ? (admin.allowedThon || []) : S.distinctThon();
      openPicker({
        title: 'Chọn Thôn', selected: filterThon,
        options: [{ value: 'all', label: 'Tất cả' }, ...allowedThon.map((t) => ({ value: t, label: t }))],
        onSelect: (val) => {
          filterThon = val; filterXom = 'all';
          filterEl.querySelector('#pill-thon').firstChild.textContent = val === 'all' ? 'Thôn: Tất cả ' : `Thôn: ${val} `;
          draw();
        },
      });
    });
    filterEl.querySelector('#pill-xom').addEventListener('click', () => {
      const xomList = S.distinctXom(filterThon === 'all' ? undefined : filterThon);
      openPicker({
        title: 'Chọn Xóm', selected: filterXom,
        options: [{ value: 'all', label: 'Tất cả' }, ...xomList.map((x) => ({ value: x, label: x }))],
        onSelect: (val) => {
          filterXom = val;
          filterEl.querySelector('#pill-xom').firstChild.textContent = val === 'all' ? 'Xóm: Tất cả ' : `Xóm: ${val} `;
          draw();
        },
      });
    });
  }
  bindPickers();

  function draw() {
    let list = S.listCustomers({
      adminId: isStaff ? admin.id : undefined,
      thon: filterThon === 'all' ? undefined : filterThon,
      xom: filterXom === 'all' ? undefined : filterXom,
    });
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.cccd.includes(q) || (c.phone || '').includes(q));
    }
    if (onlyOverdue) {
      list = list.filter((c) => S.listContractsByCustomer(c.id).some((ct) => ct.status === 'qua_han'));
    }
    contentEl.innerHTML = `
      <div class="card card-pad">
        <div class="text-sm text-muted mb-8">${list.length} khách hàng</div>
        ${list.length ? list.map((c) => {
          const contracts = S.listContractsByCustomer(c.id);
          const total = S.customerOutstandingTotal(c.id);
          const hasOverdue = contracts.some((ct) => ct.status === 'qua_han');
          return `
          <div class="list-row" data-id="${c.id}" style="cursor:pointer">
            <div class="row-thumb" style="background:${colorFor(c.id)}">${initials(c.name)}</div>
            <div class="row-main">
              <div class="row-title">${c.name}${hasOverdue ? ` <span class="badge badge-red">Quá hạn</span>` : ''}</div>
              <div class="row-sub">${maskCccd(c.cccd)} · ${c.phone || 'Chưa có SĐT'} · ${contracts.length} hợp đồng</div>
              <div class="row-sub">${[c.xom, c.thon, c.tinh].filter(Boolean).join(', ') || c.address || 'Chưa có địa bàn'}</div>
            </div>
            <div class="row-end">
              <div class="amount">${formatVND(total)}</div>
              ${c.mustChangePassword ? `<div class="amount-sub" style="color:var(--warning)">Chưa đổi MK</div>` : ''}
            </div>
          </div>`;
        }).join('') : emptyState({ iconName: 'users', title: 'Không có khách hàng phù hợp', message: isStaff ? 'Chưa có khách hàng nào ở địa bàn bạn được xem.' : 'Dùng "Nhập từ Excel" hoặc "Thêm khách hàng" để bắt đầu.' })}
      </div>
    `;
    contentEl.querySelectorAll('[data-id]').forEach((row) => {
      row.addEventListener('click', () => openCustomerDetail(row.dataset.id, { readOnly: isStaff }));
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
        <div class="field"><label>Số điện thoại</label><input name="phone" value="${customer ? esc(customer.phone) : ''}"/></div>
        <div class="field">
          <label>Địa chỉ</label>
          <input name="address" value="${customer ? esc(customer.address) : ''}" placeholder="VD: Xóm 01, thôn Bình Nguyên, xã Bình Sơn, tỉnh Quảng Ngãi"/>
          <div class="field-hint">Hệ thống tự tách Xóm/Thôn/Tỉnh theo dấu phẩy để lọc & phân quyền, không cần nhập riêng từng ô.</div>
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
        const res = await S.upsertCustomer({
          cccd: fd.get('cccd'), name: fd.get('name'), phone: fd.get('phone'), address: fd.get('address'),
        });
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

function openCustomerDetail(customerId, { readOnly = false } = {}) {
  const c = S.getCustomer(customerId);
  const contracts = S.listContractsByCustomer(customerId);
  const close = openModal({
    title: c.name,
    bodyHtml: `
      <div class="oc-line"><span>CCCD</span><b>${c.cccd}</b></div>
      <div class="oc-line"><span>SĐT</span><b>${c.phone ? `<a href="tel:${c.phone.replace(/\s/g, '')}" style="color:var(--color-primary)">${icon('phone', 'icon-sm')} ${c.phone}</a>` : '—'}</b></div>
      <div class="oc-line" style="align-items:flex-start"><span>Địa chỉ</span><b style="text-align:right;max-width:65%">${c.address || [c.xom, c.thon, c.tinh].filter(Boolean).join(', ') || '—'}</b></div>
      ${!readOnly ? `
      <div class="flex gap-8 mt-16 mb-16">
        <button class="btn btn-outline btn-sm" id="btn-reset-pw">${icon('key', 'icon-sm')} Cấp lại mật khẩu</button>
        <button class="btn btn-outline btn-sm" id="btn-edit-cust">${icon('edit', 'icon-sm')} Sửa</button>
        <button class="btn btn-outline btn-sm" id="btn-add-contract">${icon('plus', 'icon-sm')} Thêm hợp đồng</button>
        <button class="btn btn-danger-outline btn-sm" id="btn-del-cust">${icon('trash', 'icon-sm')}</button>
      </div>` : '<div class="mt-16"></div>'}
      <div class="section-head"><h2 style="font-size:14px">Hợp đồng (${contracts.length})</h2></div>
      <div id="contract-list">${contracts.map((ct) => contractRow(ct)).join('') || '<p class="text-sm text-muted">Chưa có hợp đồng.</p>'}</div>
    `,
    onMount(sheet, closeFn) {
      sheet.querySelectorAll('[data-view-contract]').forEach((btn) => {
        btn.addEventListener('click', () => { closeFn(); openContractView(customerId, S.getContract(btn.dataset.viewContract), { readOnly }); });
      });
      if (readOnly) return;
      sheet.querySelector('#btn-reset-pw').addEventListener('click', async () => {
        const temp = await S.adminResetCustomerPassword(customerId);
        showCredential(c, temp);
      });
      sheet.querySelector('#btn-edit-cust').addEventListener('click', () => { closeFn(); openCustomerForm(c); });
      sheet.querySelector('#btn-add-contract').addEventListener('click', () => { closeFn(); openContractForm(customerId); });
      sheet.querySelector('#btn-del-cust').addEventListener('click', () => {
        confirmDialog({
          title: 'Xóa khách hàng?', message: `Xóa "${c.name}" và toàn bộ hợp đồng liên quan?`,
          confirmLabel: 'Xóa', danger: true,
          onConfirm: () => { S.deleteCustomer(customerId); closeFn(); toast('Đã xóa khách hàng', 'success'); window.__qtdRedrawCustomers?.(); },
        });
      });
    },
  });
}

function contractRow(ct) {
  const status = S.CONTRACT_STATUS_MAP[ct.status];
  const interest = S.accruedInterest(ct);
  return `
    <div class="list-row" data-view-contract="${ct.id}" style="cursor:pointer">
      <div class="row-main">
        <div class="row-title">${ct.code}</div>
        <div class="row-sub">Vay ${formatVND(ct.principal)} · ${formatDate(ct.disbursedDate)} → ${formatDate(ct.dueDate)}</div>
        <div class="row-sub">Đã trả lãi đến ${formatDate(ct.interestPaidUntil || ct.disbursedDate)}${interest > 0 ? ` · Lãi đến nay: ${formatVND(interest)}` : ''}</div>
      </div>
      <div class="row-end"><div class="amount">${formatVND(ct.balance)}</div>${statusBadge(status)}</div>
    </div>`;
}

/** Xem chi tiết hợp đồng — hiển thị đầy đủ giống hệt trang khách hàng thấy khi họ bấm vào. */
function openContractView(customerId, contract, { readOnly = false } = {}) {
  const status = S.CONTRACT_STATUS_MAP[contract.status];
  const d = daysUntil(contract.dueDate);
  const interestPaidUntil = contract.interestPaidUntil || contract.disbursedDate;
  const interestDays = Math.max(0, -daysUntil(interestPaidUntil));
  const accrued = S.accruedInterest(contract);
  const canPay = contract.status !== 'da_tat_toan';

  const close = openModal({
    title: `Hợp đồng ${contract.code}`,
    bodyHtml: `
      <div class="flex justify-between items-center mb-10">
        <span class="fw-700">Trạng thái</span>
        ${statusBadge(status)}
      </div>
      <div class="oc-line"><span>Số tiền vay ban đầu</span><b>${formatVND(contract.principal)}</b></div>
      <div class="oc-line"><span>Dư nợ hiện tại</span><b style="color:var(--color-primary)">${formatVND(contract.balance)}</b></div>
      <div class="oc-line"><span>Lãi suất</span><b>${contract.interestRate}%/năm</b></div>
      <div class="oc-line"><span>Kỳ hạn</span><b>${contract.termMonths ? contract.termMonths + ' tháng' : '—'}</b></div>
      <div class="oc-line"><span>Ngày giải ngân (ngày vay)</span><b>${formatDate(contract.disbursedDate)}</b></div>
      <div class="oc-line"><span>Ngày đến hạn</span><b>${formatDate(contract.dueDate)}</b></div>
      <div class="oc-line"><span>Đã trả lãi đến ngày</span><b>${formatDate(interestPaidUntil)}</b></div>
      ${canPay ? `
      <div class="oc-line" style="padding-top:8px;border-top:1px dashed var(--border);margin-top:6px">
        <span class="fw-700">Lãi đến nay</span>
        <b style="color:var(--warning)">${formatVND(accrued)}</b>
      </div>
      <div class="field-hint">(${formatVND(contract.balance)} × ${interestDays} ngày × ${contract.interestRate}%/năm ÷ 365)</div>
      <div class="field-hint ${d < 0 ? 'text-danger' : ''}" style="margin-top:6px">
        ${d < 0 ? `${icon('alert', 'icon-sm')} Đã quá hạn ${Math.abs(d)} ngày` : `Còn ${d} ngày đến hạn thanh toán`}
      </div>` : ''}
    `,
    footHtml: readOnly ? '' : `<button class="btn btn-primary btn-block" id="edit-contract">${icon('edit', 'icon-sm')} Sửa hợp đồng</button>`,
    onMount(sheet, closeFn) {
      const editBtn = sheet.querySelector('#edit-contract');
      if (editBtn) editBtn.addEventListener('click', () => { closeFn(); openContractForm(customerId, contract); });
    },
  });
  return close;
}

function openContractForm(customerId, contract) {
  const isEdit = !!contract;
  const close = openModal({
    title: isEdit ? `Sửa hợp đồng ${contract.code}` : 'Thêm hợp đồng vay',
    bodyHtml: `
      <form id="ctf">
        <div class="field">
          <label>Mã hợp đồng</label>
          <input name="code" value="${contract ? contract.code : ''}" ${isEdit ? 'readonly' : ''} placeholder="Để trống sẽ tự sinh mã"/>
        </div>
        <div class="field-row">
          <div class="field"><label>Số tiền vay</label><input name="principal" type="number" min="0" step="1000000" value="${contract ? contract.principal : ''}" placeholder="Mặc định = Dư nợ"/></div>
          <div class="field"><label>Dư nợ hiện tại</label><input name="balance" type="number" min="0" step="100000" required value="${contract ? contract.balance : ''}"/></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Ngày vay</label><input name="disbursedDate" type="date" required value="${contract ? contract.disbursedDate : ''}"/></div>
          <div class="field"><label>Ngày đến hạn</label><input name="dueDate" type="date" value="${contract ? contract.dueDate : ''}" placeholder="Tự tính nếu để trống"/></div>
        </div>
        <div class="field-row">
          <div class="field"><label>Lãi suất (%/năm)</label><input name="interestRate" type="number" min="0" step="0.1" value="${contract ? contract.interestRate : ''}" placeholder="Mặc định: ${S.getOrg().defaultInterestRate}%"/></div>
          <div class="field"><label>Kỳ hạn (tháng)</label><input name="termMonths" type="number" min="1" value="${contract ? contract.termMonths || '' : ''}" placeholder="Mặc định: ${S.getOrg().defaultTermMonths}"/></div>
        </div>
        <div class="field">
          <label>Đã trả lãi đến ngày</label>
          <input name="interestPaidUntil" type="date" value="${contract ? contract.interestPaidUntil || contract.disbursedDate : ''}"/>
          <div class="field-hint">Dùng để tính lãi phát sinh đến hiện tại (Số dư × số ngày × lãi suất năm / 365).</div>
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
          customerId, code: fd.get('code') || (isEdit ? contract.code : null),
          principal: fd.get('principal'), balance: fd.get('balance'),
          disbursedDate: fd.get('disbursedDate'), dueDate: fd.get('dueDate'),
          interestRate: fd.get('interestRate'), termMonths: fd.get('termMonths'), status: fd.get('status'),
          interestPaidUntil: fd.get('interestPaidUntil'),
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

const REQUIRED_COLUMNS = 'Người nhận nợ (Họ tên), Số CMND/CCCD, Địa chỉ, Ngày nhận nợ, Thu lãi đến ngày, Số dư';
const OPTIONAL_COLUMNS = 'SĐT, Mã hợp đồng, Số tiền vay, Ngày đến hạn, Lãi suất';

function openImportModal() {
  const close = openModal({
    title: 'Nhập dữ liệu từ Excel',
    bodyHtml: `
      <p class="text-sm text-muted mb-8">
        Chọn file Excel (<b>.xlsx</b>) — đúng theo mẫu file bạn đang quản lý, có 6 cột bắt buộc theo thứ tự sau (dòng đầu là tiêu đề sẽ tự bỏ qua):<br/>
        <b>${REQUIRED_COLUMNS}</b>
      </p>
      <p class="text-sm text-muted mb-8">
        Có thể thêm các cột sau vào cuối nếu có (không bắt buộc, thiếu sẽ tự tính/tự sinh):<br/>
        <b>${OPTIONAL_COLUMNS}</b>
      </p>
      <div class="field">
        <input type="file" id="file-input" accept=".xlsx"/>
        <div class="field-hint">Chỉ đọc được file .xlsx (Excel 2007 trở lên). File .xls cũ cần lưu lại dưới dạng .xlsx trước.</div>
      </div>
      <div id="import-result"></div>
      <details class="mt-16">
        <summary class="text-sm fw-700" style="cursor:pointer">Hoặc dán dữ liệu thủ công (copy từ Excel)</summary>
        <div class="field mt-8"><textarea id="paste-area" rows="6" placeholder="Dán dữ liệu vào đây..." style="width:100%;border:1px solid var(--border-strong);border-radius:8px;padding:10px;font-size:13px;font-family:monospace"></textarea></div>
        <button class="btn btn-outline btn-block" id="do-paste-import">${icon('paperclip', 'icon-sm')} Nhập từ dữ liệu đã dán</button>
      </details>
    `,
    onMount(sheet, closeFn) {
      const resultEl = sheet.querySelector('#import-result');
      const runImport = async (tsvText) => {
        if (!tsvText.trim()) { toast('Không có dữ liệu để nhập', 'error'); return; }
        try {
          const res = await S.importFromPastedTable(tsvText);
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
        } catch (err) {
          toast(err.message || 'Có lỗi khi nhập dữ liệu', 'error');
        }
      };

      sheet.querySelector('#file-input').addEventListener('change', async (e) => {
        const file = e.target.files[0];
        if (!file) return;
        try {
          const rows = await readXlsxFirstSheet(file);
          await runImport(rowsToTsv(rows));
        } catch (err) {
          toast('Không đọc được file: ' + (err.message || ''), 'error');
        }
      });
      sheet.querySelector('#do-paste-import').addEventListener('click', () => {
        runImport(sheet.querySelector('#paste-area').value);
      });
    },
  });
}

function esc(s) { return String(s || '').replace(/"/g, '&quot;'); }
