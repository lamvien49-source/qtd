import * as S from '../../state.js';
import { icon } from '../../icons.js';
import { pageHeader } from '../../components/shell.js';
import { emptyState, statusBadge, openPicker, pillSelectHtml } from '../../components/ui.js';
import { openModal, confirmDialog } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { formatVND, formatDate, daysUntil, maskCccd, colorFor, initials, debounce } from '../../utils.js';
import { readExcelFirstSheet, rowsToTsv } from '../../lib/excelLite.js';

export function renderHeader(headerEl) {
  headerEl.innerHTML = pageHeader({ title: 'Khách hàng & Hợp đồng' });
}

const SORT_OPTIONS = [
  { value: 'default', label: 'Mặc định' },
  { value: 'principal-asc', label: 'Gốc: Thấp → Cao' },
  { value: 'principal-desc', label: 'Gốc: Cao → Thấp' },
  { value: 'interest-asc', label: 'Lãi: Thấp → Cao' },
  { value: 'interest-desc', label: 'Lãi: Cao → Thấp' },
];
const SORT_LABEL = Object.fromEntries(SORT_OPTIONS.map((o) => [o.value, o.label]));

let query = '';
let filterThon = 'all';
let filterXom = 'all';
let onlyOverdue = false;
let sortMode = 'default';

function currentAdmin() {
  const session = S.getSession();
  return S.getAdmin(session.id);
}

export function render(contentEl, filterEl) {
  const admin = currentAdmin();
  const isStaff = admin.role === 'staff';
  filterThon = 'all'; filterXom = 'all'; sortMode = 'default'; // reset bộ lọc mỗi lần vào trang

  filterEl.innerHTML = `
    <div style="padding:10px 14px 0">
      <div class="search-box mb-8">${icon('search', 'icon-sm')}<input id="search-input" placeholder="Tìm theo tên, số CCCD, SĐT..." value="${query}"/></div>
      <div class="filter-row" style="padding:0 0 8px">
        ${pillSelectHtml('pill-thon', 'Thôn: Tất cả')}
        ${pillSelectHtml('pill-xom', 'Xóm: Tất cả')}
        ${pillSelectHtml('pill-sort', 'Sắp xếp: Mặc định')}
      </div>
      <div class="chip-row mb-8">
        <button class="chip ${!onlyOverdue ? 'active' : ''}" data-overdue="0">Tất cả</button>
        <button class="chip ${onlyOverdue ? 'active' : ''}" data-overdue="1">${icon('alert', 'icon-sm')} Có nợ quá hạn</button>
      </div>
      ${!isStaff ? `
      <div class="flex gap-8 mb-8">
        <button class="btn btn-outline btn-sm" id="btn-import">${icon('paperclip', 'icon-sm')} Nhập từ Excel</button>
        <button class="btn btn-primary btn-sm" id="btn-add">${icon('plus', 'icon-sm')} Tạo tài khoản khách hàng</button>
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
    filterEl.querySelector('#pill-sort').addEventListener('click', () => {
      openPicker({
        title: 'Sắp xếp theo', selected: sortMode,
        options: SORT_OPTIONS,
        onSelect: (val) => {
          sortMode = val;
          filterEl.querySelector('#pill-sort').firstChild.textContent = `Sắp xếp: ${SORT_LABEL[val]} `;
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
    // Gộp sẵn hợp đồng + tổng gốc/lãi từng khách hàng — dùng để hiển thị & sắp xếp
    let enriched = list.map((c) => {
      const contracts = S.listContractsByCustomer(c.id);
      const totalPrincipal = contracts.reduce((s, ct) => s + (ct.principal || 0), 0);
      const totalInterest = contracts.reduce((s, ct) => s + S.accruedInterest(ct), 0);
      return { c, contracts, totalPrincipal, totalInterest };
    });
    if (onlyOverdue) enriched = enriched.filter((e) => e.contracts.some((ct) => ct.status === 'qua_han'));
    if (sortMode !== 'default') {
      const [field, dir] = sortMode.split('-');
      const key = field === 'principal' ? 'totalPrincipal' : 'totalInterest';
      enriched.sort((a, b) => (dir === 'asc' ? a[key] - b[key] : b[key] - a[key]));
    }

    contentEl.innerHTML = `
      <div class="text-sm text-muted mb-8">${enriched.length} khách hàng</div>
      ${enriched.length ? enriched.map(({ c, contracts }) => {
        const hasOverdue = contracts.some((ct) => ct.status === 'qua_han');
        return `
        <div class="card card-pad mb-8">
          <div class="list-row" data-id="${c.id}" style="cursor:pointer;padding:0">
            <div class="row-thumb" style="background:${colorFor(c.id)}">${initials(c.name)}</div>
            <div class="row-main">
              <div class="row-title">${c.name}${hasOverdue ? ` <span class="badge badge-red">Quá hạn</span>` : ''}${c.mustChangePassword ? ` <span class="badge badge-yellow">Chưa đổi MK</span>` : ''}</div>
              <div class="row-sub">${maskCccd(c.cccd)} · ${c.phone || 'Chưa có SĐT'}</div>
              <div class="row-sub">${[c.xom, c.thon, c.tinh].filter(Boolean).join(', ') || c.address || 'Chưa có địa bàn'}</div>
            </div>
            ${contracts.length === 1 ? contractAmountsHtml(contracts[0]) : ''}
          </div>
          ${contracts.length > 1 ? `
          <div style="border-top:1px dashed var(--border);margin-top:6px">
            ${contracts.map((ct) => contractRowCompact(ct)).join('')}
          </div>` : ''}
          ${!contracts.length ? '<p class="text-sm text-muted mt-8">Chưa có hợp đồng.</p>' : ''}
        </div>`;
      }).join('') : emptyState({ iconName: 'users', title: 'Không có khách hàng phù hợp', message: isStaff ? 'Chưa có khách hàng nào ở địa bàn bạn được xem.' : 'Dùng "Nhập từ Excel" hoặc "Tạo tài khoản khách hàng" để bắt đầu.' })}
    `;
    contentEl.querySelectorAll('[data-id]').forEach((row) => {
      row.addEventListener('click', () => openCustomerDetail(row.dataset.id, { readOnly: isStaff }));
    });
    contentEl.querySelectorAll('[data-view-contract]').forEach((row) => {
      row.addEventListener('click', (e) => {
        e.stopPropagation();
        const customerId = row.dataset.customerId;
        openContractView(customerId, S.getContract(row.dataset.viewContract), { readOnly: isStaff });
      });
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
        <button class="btn btn-danger-outline btn-sm" id="btn-del-cust">${icon('trash', 'icon-sm')}</button>
      </div>` : '<div class="mt-16"></div>'}
      <div class="section-head"><h2 style="font-size:14px">Hợp đồng (${contracts.length})</h2></div>
      <div id="contract-list">${contracts.map((ct) => contractRowCompact(ct)).join('') || '<p class="text-sm text-muted">Chưa có hợp đồng — nhập từ Excel để thêm.</p>'}</div>
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

/** Cột phải "Gốc / Lãi" — dùng cho hàng khách hàng chỉ có 1 hợp đồng lẫn từng dòng hợp đồng gọn. */
function contractAmountsHtml(ct) {
  const interest = S.accruedInterest(ct);
  return `
    <div class="row-end">
      <div class="amount">Gốc: ${formatVND(ct.principal)}</div>
      <div class="amount-sub" style="color:var(--warning)">Lãi: ${formatVND(interest)}</div>
    </div>`;
}

/** Dòng hợp đồng gọn — chỉ mã + trạng thái + gốc/lãi, bấm vào mới ra đầy đủ chi tiết (openContractView). */
function contractRowCompact(ct) {
  const status = S.CONTRACT_STATUS_MAP[ct.status];
  return `
    <div class="list-row" data-view-contract="${ct.id}" data-customer-id="${ct.customerId}" style="cursor:pointer;padding:8px 0">
      <div class="row-main">
        <div class="row-title" style="font-size:13.5px">Hợp đồng: ${ct.code}</div>
        <div>${statusBadge(status)}</div>
      </div>
      ${contractAmountsHtml(ct)}
    </div>`;
}

/** Soạn sẵn tin nhắn SMS báo lãi cho khách hàng — mở app nhắn tin sẵn có trên điện thoại quản trị viên, không cần dịch vụ SMS ngoài. */
function buildSmsLink(customer, contract, accrued) {
  const org = S.getOrg();
  const msg = `${org.shortName}: Hop dong ${contract.code}, lai tinh den ngay ${formatDate(new Date())} la ${formatVND(accrued)}. Quy khach vui long thanh toan dung han. Hotline: ${org.hotline}`;
  return `sms:${customer.phone.replace(/\s/g, '')}?body=${encodeURIComponent(msg)}`;
}

/**
 * Xem chi tiết hợp đồng — hiển thị đầy đủ giống hệt trang khách hàng thấy khi
 * họ bấm vào. Dữ liệu lấy từ Excel, quản trị viên KHÔNG chỉnh sửa trực tiếp
 * tại đây (không có ô nhập/nút "Sửa") — muốn cập nhật thì nhập lại file Excel
 * mới nhất, hệ thống tự khớp đúng hợp đồng theo Số HĐTD.
 */
function openContractView(customerId, contract, { readOnly = false } = {}) {
  const customer = S.getCustomer(customerId);
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
      <div class="oc-line"><span>Ngày giải ngân (ngày vay)</span><b>${formatDate(contract.disbursedDate)}</b></div>
      <div class="oc-line"><span>Ngày đến hạn</span><b>${formatDate(contract.dueDate)}</b></div>
      <div class="oc-line"><span>Đã trả lãi đến ngày</span><b>${formatDate(interestPaidUntil)}</b></div>
      <div class="oc-line"><span>SĐT</span><b>${customer && customer.phone ? `<a href="tel:${customer.phone.replace(/\s/g, '')}" style="color:var(--color-primary)">${icon('phone', 'icon-sm')} ${customer.phone}</a>` : '—'}</b></div>
      ${customer && customer.phone && canPay ? `
      <a href="${buildSmsLink(customer, contract, accrued)}" class="btn btn-outline btn-sm btn-block mt-8">${icon('message', 'icon-sm')} Nhắn SMS báo lãi cho khách</a>
      ` : ''}
      ${canPay ? `
      <div class="oc-line" style="padding-top:8px;border-top:1px dashed var(--border);margin-top:6px">
        <span class="fw-700">Lãi đến nay</span>
        <b style="color:var(--warning)">${formatVND(accrued)}</b>
      </div>
      <div class="field-hint">(${formatVND(contract.balance)} × ${interestDays} ngày × ${contract.interestRate}%/năm ÷ 365)</div>
      <div class="field-hint ${d < 0 ? 'text-danger' : ''}" style="margin-top:6px">
        ${d < 0 ? `${icon('alert', 'icon-sm')} Đã quá hạn ${Math.abs(d)} ngày` : `Còn ${d} ngày đến hạn thanh toán`}
      </div>` : ''}
      <div class="field-hint" style="margin-top:10px">Dữ liệu hợp đồng lấy từ file Excel — cập nhật bằng cách nhập lại file mới nhất, hệ thống tự khớp theo Số HĐTD.</div>
    `,
    footHtml: readOnly ? '' : `<button class="btn btn-danger-outline btn-block" id="del-contract">${icon('trash', 'icon-sm')} Xóa hợp đồng</button>`,
    onMount(sheet, closeFn) {
      const delBtn = sheet.querySelector('#del-contract');
      if (delBtn) delBtn.addEventListener('click', () => {
        confirmDialog({
          title: 'Xóa hợp đồng?', message: `Xóa hợp đồng ${contract.code}? Nếu hợp đồng vẫn còn trong file Excel, lần nhập sau sẽ tạo lại.`,
          confirmLabel: 'Xóa', danger: true,
          onConfirm: () => { S.deleteContract(contract.id); closeFn(); toast('Đã xóa hợp đồng', 'success'); window.__qtdRedrawCustomers?.(); },
        });
      });
    },
  });
  return close;
}

const REQUIRED_COLUMNS = 'Số HĐTD, Người nhận nợ, Địa chỉ, Số CMND/CCCD, Số di động, Ngày nhận nợ, Ngày đáo hạn, Thu lãi đến ngày, Số tiền giải ngân, Số dư, Lãi suất';

function openImportModal() {
  const close = openModal({
    title: 'Nhập dữ liệu từ Excel',
    bodyHtml: `
      <p class="text-sm text-muted mb-8">
        Chọn đúng file Excel sổ theo dõi vay bạn đang dùng (<b>.xls</b> hoặc <b>.xlsx</b>) — có các cột theo đúng thứ tự sau (dòng đầu là tiêu đề sẽ tự bỏ qua):<br/>
        <b>${REQUIRED_COLUMNS}</b>
      </p>
      <p class="text-sm text-muted mb-8">Cột nào thiếu dữ liệu ở 1 dòng vẫn nhập được — hệ thống tự tính/tự sinh (mã hợp đồng, ngày đến hạn, lãi suất mặc định...).</p>
      <div class="field">
        <input type="file" id="file-input" accept=".xls,.xlsx"/>
        <div class="field-hint">Đọc trực tiếp trong trình duyệt, hỗ trợ cả file .xls (Excel 97-2003) lẫn .xlsx — không cần chuyển đổi định dạng trước, không cần thư viện ngoài.</div>
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
          const rows = await readExcelFirstSheet(file);
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
