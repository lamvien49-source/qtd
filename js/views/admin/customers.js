import * as S from '../../state.js';
import { icon } from '../../icons.js';
import { pageHeader } from '../../components/shell.js';
import { emptyState, statusBadge, openPicker, pillSelectHtml, openResetPasswordModal } from '../../components/ui.js';
import { openModal, confirmDialog } from '../../components/modal.js';
import { toast } from '../../components/toast.js';
import { formatVND, formatDate, daysUntil, maskCccd, colorFor, initials, debounce, stripDiacritics } from '../../utils.js';
import { readExcelFirstSheet, rowsToTsv } from '../../lib/excelLite.js';
import { buildVietQrUrl, downloadQrImage, shareQrImage, bindMoneyInput } from '../contractDetail.js';

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
let filterThon = []; // rỗng = Tất cả — có thể tích chọn nhiều Thôn cùng lúc
let filterXom = [];  // rỗng = Tất cả — có thể tích chọn nhiều Xóm cùng lúc
let urgencyFilters = new Set(); // rỗng = Tất cả — có thể tích cả "qua_han" lẫn "gan_den_han" cùng lúc
let sortMode = 'default';

function multiPillLabel(prefix, values) {
  if (!values.length) return `${prefix}: Tất cả `;
  if (values.length === 1) return `${prefix}: ${values[0]} `;
  return `${prefix}: ${values.length} đã chọn `;
}

function currentAdmin() {
  const session = S.getSession();
  return S.getAdmin(session.id);
}

export function render(contentEl, filterEl) {
  const admin = currentAdmin();
  const isStaff = admin.role === 'staff';
  filterThon = []; filterXom = []; sortMode = 'default'; // reset bộ lọc mỗi lần vào trang

  filterEl.innerHTML = `
    <div style="padding:10px 14px 0">
      <div class="search-box mb-8">${icon('search', 'icon-sm')}<input id="search-input" placeholder="Tìm theo tên, số CCCD, SĐT..." value="${query}"/></div>
      <div class="filter-row" style="padding:0 0 8px">
        ${pillSelectHtml('pill-thon', 'Thôn: Tất cả')}
        ${pillSelectHtml('pill-xom', 'Xóm: Tất cả')}
        ${pillSelectHtml('pill-sort', 'Sắp xếp: Mặc định')}
      </div>
      <div class="chip-row mb-8">
        <button class="chip ${urgencyFilters.size === 0 ? 'active' : ''}" data-urgency="all">Tất cả</button>
        <button class="chip ${urgencyFilters.has('qua_han') ? 'active' : ''}" data-urgency="qua_han">${icon('alert', 'icon-sm')} Nợ quá hạn</button>
        <button class="chip ${urgencyFilters.has('gan_den_han') ? 'active' : ''}" data-urgency="gan_den_han">Gần đến hạn</button>
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
  filterEl.querySelectorAll('[data-urgency]').forEach((chip) => {
    chip.addEventListener('click', () => {
      const val = chip.dataset.urgency;
      if (val === 'all') urgencyFilters.clear();
      else if (urgencyFilters.has(val)) urgencyFilters.delete(val);
      else urgencyFilters.add(val);
      render(contentEl, filterEl);
    });
  });

  function bindPickers() {
    filterEl.querySelector('#pill-thon').addEventListener('click', () => {
      const allowedThon = isStaff ? (admin.allowedThon || []) : S.distinctThon();
      openPicker({
        title: 'Chọn Thôn (chọn được nhiều)', selected: filterThon, multiSelect: true,
        options: allowedThon.map((t) => ({ value: t, label: t })),
        onSelect: (vals) => {
          filterThon = vals; filterXom = [];
          filterEl.querySelector('#pill-thon').firstChild.textContent = multiPillLabel('Thôn', filterThon);
          draw();
        },
      });
    });
    filterEl.querySelector('#pill-xom').addEventListener('click', () => {
      const xomList = S.distinctXom(filterThon.length ? filterThon : undefined);
      openPicker({
        title: 'Chọn Xóm (chọn được nhiều)', selected: filterXom, multiSelect: true,
        options: xomList.map((x) => ({ value: x, label: x })),
        onSelect: (vals) => {
          filterXom = vals;
          filterEl.querySelector('#pill-xom').firstChild.textContent = multiPillLabel('Xóm', filterXom);
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
      thon: filterThon,
      xom: filterXom,
    });
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter((c) => c.name.toLowerCase().includes(q) || c.cccd.includes(q) || (c.phone || '').includes(q));
    }
    // Gộp sẵn hợp đồng + tổng gốc (= dư nợ hiện tại)/lãi từng khách hàng — dùng để hiển thị & sắp xếp
    let enriched = list.map((c) => {
      const contracts = S.listContractsByCustomer(c.id);
      const totalBalance = contracts.reduce((s, ct) => s + (ct.balance || 0), 0);
      const totalInterest = contracts.reduce((s, ct) => s + S.accruedInterest(ct), 0);
      return { c, contracts, totalBalance, totalInterest };
    });
    // Khách không còn dư nợ nào (hết hợp đồng, hoặc file mới nhất không còn
    // họ nữa nên hợp đồng đã bị full-sync xóa) thì KHÔNG hiển thị ở đây nữa
    // — dù hồ sơ/tài khoản Use của họ vẫn được giữ (xem Quản lý User), chỉ
    // là không còn hiện trong danh sách khách hàng đang vay này.
    enriched = enriched.filter((e) => e.totalBalance > 0);
    if (urgencyFilters.size) enriched = enriched.filter((e) => e.contracts.some((ct) => urgencyFilters.has(S.contractUrgency(ct))));
    if (sortMode !== 'default') {
      const [field, dir] = sortMode.split('-');
      const key = field === 'principal' ? 'totalBalance' : 'totalInterest';
      enriched.sort((a, b) => (dir === 'asc' ? a[key] - b[key] : b[key] - a[key]));
    }
    const totalContracts = enriched.reduce((s, e) => s + e.contracts.length, 0);

    contentEl.innerHTML = `
      <div class="text-sm text-muted mb-8">${enriched.length} khách hàng · ${totalContracts} hợp đồng</div>
      ${enriched.length ? enriched.map(({ c, contracts }) => {
        const overdueContracts = contracts.filter((ct) => S.contractUrgency(ct) === 'qua_han');
        const nearDueContracts = contracts.filter((ct) => S.contractUrgency(ct) === 'gan_den_han');
        const hasOverdue = overdueContracts.length > 0;
        const hasNearDue = !hasOverdue && nearDueContracts.length > 0;
        // Hợp đồng quá hạn/gần đến hạn NHIỀU ngày nhất (đáng chú ý nhất) — hiện kèm số ngày cho dễ nhìn ngay từ danh sách.
        const mostOverdueDays = hasOverdue ? Math.max(...overdueContracts.map((ct) => Math.abs(daysUntil(ct.dueDate)))) : 0;
        const mostNearDueDays = hasNearDue ? Math.min(...nearDueContracts.map((ct) => daysUntil(ct.dueDate))) : 0;
        return `
        <div class="card card-pad mb-8">
          <div class="flex items-center gap-6 mb-8" style="flex-wrap:wrap">
            <span style="font-size:15px;font-weight:700">${c.name}</span>
            ${hasOverdue ? `<span class="badge badge-red">Quá hạn ${mostOverdueDays} ngày</span>` : ''}
            ${hasNearDue ? `<span class="badge badge-yellow">Gần đến hạn ${mostNearDueDays} ngày</span>` : ''}
          </div>
          <div class="list-row" data-id="${c.id}" style="cursor:pointer;padding:0">
            <div class="row-thumb" style="background:${colorFor(c.id)}">${initials(c.name)}</div>
            <div class="row-main">
              <div class="row-sub">${maskCccd(c.cccd)} · ${c.phone || 'Chưa có SĐT'}</div>
              <div class="row-sub">${[c.xom, c.thon, c.tinh].filter(Boolean).join(', ') || c.address || 'Chưa có địa bàn'}</div>
            </div>
            ${contracts.length === 1 ? `<div data-view-contract="${contracts[0].id}" data-customer-id="${c.id}" style="cursor:pointer">${contractAmountsHtml(contracts[0])}</div>` : ''}
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
    title: isEdit ? 'Sửa khách hàng' : 'Tạo tài khoản khách hàng',
    bodyHtml: isEdit ? `
      <form id="cf">
        <div class="field"><label>Số CCCD</label><input name="cccd" required pattern="\\d{9,12}" value="${customer.cccd}" readonly/></div>
        <div class="field"><label>Họ tên</label><input name="name" required value="${esc(customer.name)}"/></div>
        <div class="field">
          <label>Số điện thoại</label>
          <input name="phone" value="${esc(customer.phone)}"/>
          <div class="field-hint">Khách hàng đăng nhập được bằng CCCD hoặc số điện thoại này — nên nhập cả 2 để khách dùng số nào cũng tra được đúng hợp đồng.</div>
        </div>
        <div class="field">
          <label>Địa chỉ</label>
          <input name="address" value="${esc(customer.address)}" placeholder="VD: Xóm 01, thôn Bình Nguyên, xã Bình Sơn, tỉnh Quảng Ngãi"/>
          <div class="field-hint">Hệ thống tự tách Xóm/Thôn/Tỉnh theo dấu phẩy để lọc & phân quyền, không cần nhập riêng từng ô.</div>
        </div>
      </form>
    ` : `
      <form id="cf">
        <div class="field"><label>Số CCCD</label><input name="cccd" required pattern="\\d{9,12}"/></div>
        <div class="field">
          <label>Mật khẩu đăng nhập</label>
          <input name="password" placeholder="Để trống sẽ tự sinh mật khẩu"/>
          <div class="field-hint">Để trống thì hệ thống tự sinh mật khẩu ngẫu nhiên, hiện ra sau khi lưu để gửi cho khách. Không cần nhập họ tên/SĐT/địa chỉ — nhập file Excel có CCCD này thì tài khoản sẽ tự động đồng bộ lấy đúng thông tin, tự thấy ngay các hợp đồng khớp CCCD.</div>
        </div>
      </form>
    `,
    footHtml: `<button class="btn btn-primary btn-block" id="save">${isEdit ? 'Lưu' : 'Tạo tài khoản'}</button>`,
    onMount(sheet, closeFn) {
      sheet.querySelector('#save').addEventListener('click', async () => {
        const form = sheet.querySelector('#cf');
        if (!form.reportValidity()) return;
        const fd = new FormData(form);
        if (isEdit) {
          S.upsertCustomerProfile({
            cccd: fd.get('cccd'), name: fd.get('name'), phone: fd.get('phone'), address: fd.get('address'),
          });
          closeFn();
          toast('Đã cập nhật khách hàng', 'success');
          window.__qtdRedrawCustomers && window.__qtdRedrawCustomers();
          return;
        }
        try {
          const res = await S.activateCustomerAccount({ cccd: fd.get('cccd'), password: fd.get('password') });
          closeFn();
          toast('Đã tạo tài khoản khách hàng', 'success');
          showCredential(res.customer, res.tempPassword);
          window.__qtdRedrawCustomers && window.__qtdRedrawCustomers();
        } catch (err) {
          toast(err.message || 'Có lỗi xảy ra', 'error');
        }
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

/**
 * context 'customer' (mặc định, mở từ trang Khách hàng & Hợp đồng): nút xóa
 * là "Xóa khách hàng" — xóa cả hồ sơ lẫn hợp đồng.
 * context 'use' (mở từ trang Quản lý User): nút xóa là "Xóa Use" — chỉ gỡ
 * tài khoản đăng nhập, KHÔNG đụng đến hồ sơ/hợp đồng vì 2 thứ này độc lập
 * với nhau (hợp đồng vẫn còn nguyên trong Khách hàng & Hợp đồng sau khi xóa).
 */
export function openCustomerDetail(customerId, { readOnly = false, context = 'customer' } = {}) {
  const c = S.getCustomer(customerId);
  const contracts = S.listContractsByCustomer(customerId);
  const close = openModal({
    title: c.name,
    bodyHtml: `
      <div class="oc-line"><span>CCCD</span><b>${c.cccd}</b></div>
      <div class="oc-line"><span>SĐT</span><b>${c.phone ? `<a href="tel:${c.phone.replace(/\s/g, '')}" style="color:var(--color-primary)">${icon('phone', 'icon-sm')} ${c.phone}</a>` : '—'}</b></div>
      <div class="oc-line" style="align-items:flex-start"><span>Địa chỉ</span><b style="text-align:right;max-width:65%">${c.address || [c.xom, c.thon, c.tinh].filter(Boolean).join(', ') || '—'}</b></div>
      ${c.mustChangePassword && c.tempPassword ? `
      <div class="oc-line"><span>Mật khẩu hiện tại</span><b style="color:var(--color-primary)">${c.tempPassword}</b></div>
      <div class="field-hint">Khách chưa đăng nhập lần nào (hoặc đã đăng nhập nhưng chưa đổi mật khẩu) nên vẫn xem được mật khẩu này để đưa cho khách.</div>
      ` : !readOnly ? `<div class="field-hint">Khách đã tự đổi mật khẩu — không thể xem lại, dùng nút "Cấp lại mật khẩu" nếu cần đặt mật khẩu mới.</div>` : ''}
      ${!readOnly ? `
      <div class="flex gap-8 mt-16 mb-16" style="flex-wrap:wrap">
        <button class="btn btn-outline btn-sm" id="btn-reset-pw">${icon('key', 'icon-sm')} Cấp lại mật khẩu</button>
        ${context === 'customer' ? `<button class="btn btn-outline btn-sm" id="btn-edit-cust">${icon('edit', 'icon-sm')} Sửa</button>` : ''}
        <button class="btn btn-danger-outline btn-sm" id="btn-del-cust">${icon('trash', 'icon-sm')} ${context === 'use' ? 'Xóa Use' : ''}</button>
      </div>` : '<div class="mt-16"></div>'}
      <div class="section-head"><h2 style="font-size:14px">Hợp đồng (${contracts.length})</h2></div>
      <div id="contract-list">${contracts.map((ct) => contractRowCompact(ct)).join('') || '<p class="text-sm text-muted">Chưa có hợp đồng — nhập từ Excel để thêm.</p>'}</div>
    `,
    onMount(sheet, closeFn) {
      // Mở chi tiết hợp đồng CHỒNG lên trên (không đóng màn khách hàng này
      // trước) — đóng chi tiết hợp đồng lại là quay ngay về đúng màn khách
      // hàng đang xem, không phải mở lại từ danh sách ngoài cùng.
      sheet.querySelectorAll('[data-view-contract]').forEach((btn) => {
        btn.addEventListener('click', () => { openContractView(customerId, S.getContract(btn.dataset.viewContract), { readOnly }); });
      });
      if (readOnly) return;
      sheet.querySelector('#btn-reset-pw').addEventListener('click', () => {
        openResetPasswordModal({
          title: 'Cấp lại mật khẩu cho khách',
          onConfirm: async (val) => {
            const temp = await S.adminResetCustomerPassword(customerId, val);
            showCredential(c, temp);
          },
        });
      });
      const editBtn = sheet.querySelector('#btn-edit-cust');
      if (editBtn) editBtn.addEventListener('click', () => { closeFn(); openCustomerForm(c); });
      sheet.querySelector('#btn-del-cust').addEventListener('click', () => {
        if (context === 'use') {
          confirmDialog({
            title: 'Xóa Use?', message: `Gỡ tài khoản đăng nhập của "${c.name}"? Hồ sơ và hợp đồng vẫn được giữ nguyên bên Khách hàng & Hợp đồng — có thể "Tạo User" lại bất cứ lúc nào.`,
            confirmLabel: 'Xóa Use', danger: true,
            onConfirm: async () => {
              try { await S.deactivateCustomerAccount(customerId); closeFn(); toast('Đã xóa Use (hồ sơ/hợp đồng vẫn còn)', 'success'); }
              catch (err) { toast(err.message || 'Có lỗi xảy ra', 'error'); }
            },
          });
          return;
        }
        confirmDialog({
          title: 'Xóa khách hàng?', message: `Xóa "${c.name}" và toàn bộ hợp đồng liên quan?`,
          confirmLabel: 'Xóa', danger: true,
          onConfirm: async () => {
            try { await S.deleteCustomer(customerId); closeFn(); toast('Đã xóa khách hàng', 'success'); window.__qtdRedrawCustomers?.(); }
            catch (err) { toast(err.message || 'Có lỗi xảy ra', 'error'); }
          },
        });
      });
    },
  });
}

/**
 * Cột phải "Gốc / Lãi" — dùng cho hàng khách hàng chỉ có 1 hợp đồng lẫn từng
 * dòng hợp đồng gọn. "Gốc" ở đây là DƯ NỢ HIỆN TẠI (số còn phải trả), không
 * phải số tiền vay ban đầu — số tiền vay ban đầu chỉ hiện trong màn chi tiết
 * hợp đồng (mục "Số tiền vay ban đầu").
 */
function contractAmountsHtml(ct) {
  const interest = S.accruedInterest(ct);
  return `
    <div class="row-end">
      <div class="amount">Gốc: ${formatVND(ct.balance)}</div>
      <div class="amount-sub" style="color:var(--warning)">Lãi: ${formatVND(interest)}</div>
    </div>`;
}

/** Dòng hợp đồng gọn — chỉ mã + trạng thái + gốc/lãi, bấm vào mới ra đầy đủ chi tiết (openContractView). */
function contractRowCompact(ct) {
  // "Trong hạn" thay bằng "Gần đến hạn" khi sắp tới ngày đến hạn, để dễ chú ý hơn ở dòng hợp đồng gọn.
  const urgency = S.contractUrgency(ct);
  const status = urgency === 'gan_den_han' ? { badge: 'badge-yellow', label: 'Gần đến hạn' } : S.CONTRACT_STATUS_MAP[S.effectiveContractStatus(ct)];
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
export function openContractView(customerId, contract, { readOnly = false } = {}) {
  const customer = S.getCustomer(customerId);
  const status = S.CONTRACT_STATUS_MAP[S.effectiveContractStatus(contract)];
  const d = daysUntil(contract.dueDate);
  const interestPaidUntil = contract.interestPaidUntil || contract.disbursedDate;
  const interestDays = S.interestDaysAccrued(contract);
  const accrued = S.accruedInterest(contract);
  const canPay = S.effectiveContractStatus(contract) !== 'da_tat_toan';

  // Mã QR VietQR cho quản trị viên/nhân viên — 2 ô Gốc/Lãi riêng, cộng lại ra
  // số tiền trên QR. Mặc định chỉ có sẵn Lãi (= "Lãi đến nay", giống nội dung
  // nút "Nhắn SMS báo lãi" ở trên), ô Gốc để trống, cần thì tự gõ vào (VD:
  // khách trả gộp cả gốc lẫn lãi, hoặc trả 1 phần gốc).
  const org = S.getOrg();
  const hasBank = canPay && org.bankBin && org.bankAccountNo;
  function buildQrContent(goc, lai) {
    const loai = goc > 0 && lai > 0 ? 'GOC LAI' : goc > 0 ? 'GOC' : 'LAI';
    return customer ? `${stripDiacritics(customer.name)} THANH TOAN ${loai} HDTD ${contract.code}` : '';
  }
  const qrUrl = hasBank ? buildVietQrUrl({ bin: org.bankBin, accountNo: org.bankAccountNo, amount: accrued, content: buildQrContent(0, accrued), accountName: org.bankAccountName }) : '';

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
      ${hasBank ? `
      <div class="grid-2" style="padding-top:8px;border-top:1px dashed var(--border);margin-top:10px">
        <div class="field"><label>Gốc</label><input type="text" inputmode="numeric" id="qr-goc-input" placeholder="0"/></div>
        <div class="field"><label>Lãi</label><input type="text" inputmode="numeric" id="qr-lai-input"/></div>
      </div>
      <div class="grid-2 mb-8">
        <button type="button" class="btn btn-outline btn-block" id="btn-download-qr-ct">${icon('download', 'icon-sm')} Tải ảnh mã QR</button>
        <button type="button" class="btn btn-outline btn-block" id="btn-share-qr-ct">${icon('wallet', 'icon-sm')} Chia sẻ ảnh QR</button>
      </div>
      <div style="text-align:center">
        <img id="qr-img-ct" src="${qrUrl}" alt="Mã QR chuyển khoản" style="max-width:200px;width:100%;border:1px solid var(--border);border-radius:12px"/>
      </div>
      ` : ''}
    `,
    footHtml: readOnly ? '' : `<button class="btn btn-danger-outline btn-block" id="del-contract">${icon('trash', 'icon-sm')} Xóa hợp đồng</button>`,
    onMount(sheet, closeFn) {
      const qrImgEl = sheet.querySelector('#qr-img-ct');
      let gocAmount = 0;
      let laiAmount = accrued;
      /** Sửa ô Gốc hoặc Lãi là vẽ lại ảnh QR ngay theo tổng 2 ô cộng lại. */
      function refreshQr() {
        if (!qrImgEl) return;
        qrImgEl.src = buildVietQrUrl({ bin: org.bankBin, accountNo: org.bankAccountNo, amount: gocAmount + laiAmount, content: buildQrContent(gocAmount, laiAmount), accountName: org.bankAccountName });
      }
      const gocInput = sheet.querySelector('#qr-goc-input');
      if (gocInput) bindMoneyInput(gocInput, 0, (v) => { gocAmount = v; refreshQr(); });
      const laiInput = sheet.querySelector('#qr-lai-input');
      if (laiInput) bindMoneyInput(laiInput, accrued, (v) => { laiAmount = v; refreshQr(); });
      const downloadQrBtn = sheet.querySelector('#btn-download-qr-ct');
      if (downloadQrBtn) downloadQrBtn.addEventListener('click', () => downloadQrImage(qrImgEl.src, `qr-thanh-toan-${contract.code}.png`));
      const shareQrBtn = sheet.querySelector('#btn-share-qr-ct');
      if (shareQrBtn) shareQrBtn.addEventListener('click', () => shareQrImage(qrImgEl.src, buildQrContent(gocAmount, laiAmount)));
      const delBtn = sheet.querySelector('#del-contract');
      if (delBtn) delBtn.addEventListener('click', () => {
        confirmDialog({
          title: 'Xóa hợp đồng?', message: `Xóa hợp đồng ${contract.code}? Nếu hợp đồng vẫn còn trong file Excel, lần nhập sau sẽ tạo lại.`,
          confirmLabel: 'Xóa', danger: true,
          onConfirm: async () => {
            try { await S.deleteContract(contract.id); closeFn(); toast('Đã xóa hợp đồng', 'success'); window.__qtdRedrawCustomers?.(); }
            catch (err) { toast(err.message || 'Có lỗi xảy ra', 'error'); }
          },
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
      <p class="text-sm text-muted mb-8">Cột nào thiếu dữ liệu ở 1 dòng vẫn nhập được — hệ thống tự tính/tự sinh (mã hợp đồng, ngày đến hạn...). <b class="text-danger">Tải file lên = danh sách hợp đồng đầy đủ hiện tại</b>: hợp đồng nào đang có trong hệ thống mà không còn trong file này sẽ tự động bị xóa để luôn khớp đúng file mới nhất (khách hết hợp đồng và chưa có tài khoản Use sẽ dọn hồ sơ luôn). Khách hàng <b>hoàn toàn mới</b> (CCCD chưa từng có) sẽ được <b>tự động cấp tài khoản Use</b> (mật khẩu tự sinh, hiện ra sau khi nhập). Khách <b>đã có sẵn</b> hồ sơ/tài khoản thì Excel <b>không đụng gì</b> đến tên/SĐT/địa chỉ/tài khoản của họ — chỉ cập nhật hợp đồng.</p>
      <div class="field">
        <input type="file" id="file-input" accept=".xls,.xlsx"/>
        <div class="field-hint">Đọc trực tiếp trong trình duyệt, hỗ trợ cả file .xls (Excel 97-2003) lẫn .xlsx — không cần chuyển đổi định dạng trước, không cần thư viện ngoài.</div>
      </div>
      <button class="btn btn-primary btn-block mt-8" id="btn-upload-file" disabled>${icon('upload', 'icon-sm')} Tải lên</button>
      <div id="import-result"></div>
      <details class="mt-16">
        <summary class="text-sm fw-700" style="cursor:pointer">Hoặc dán dữ liệu thủ công (copy từ Excel)</summary>
        <div class="field-hint mb-8">Dán tay chỉ thêm/cập nhật — KHÔNG xóa hợp đồng nào khác, khác với tải file.</div>
        <div class="field mt-8"><textarea id="paste-area" rows="6" placeholder="Dán dữ liệu vào đây..." style="width:100%;border:1px solid var(--border-strong);border-radius:8px;padding:10px;font-size:13px;font-family:monospace"></textarea></div>
        <button class="btn btn-outline btn-block" id="do-paste-import">${icon('paperclip', 'icon-sm')} Nhập từ dữ liệu đã dán</button>
      </details>
    `,
    onMount(sheet, closeFn) {
      const resultEl = sheet.querySelector('#import-result');
      const fileInput = sheet.querySelector('#file-input');
      const uploadBtn = sheet.querySelector('#btn-upload-file');

      // Chỉ lo việc nhập + hiện kết quả + thông báo — KHÔNG đụng vào trạng
      // thái nút bấm (nút "Tải lên" và nút "Nhập từ dữ liệu đã dán" tự quản
      // lý trạng thái bận/xong của riêng mình bên dưới, vì mỗi nút có 1 giai
      // đoạn chờ trước đó khác nhau — trộn chung dễ bị kẹt ở chữ "Đang..." mãi).
      const runImport = async (tsvText, fullSync) => {
        if (!tsvText.trim()) { toast('Không có dữ liệu để nhập', 'error'); return; }
        const res = await S.importFromPastedTable(tsvText, { fullSync });
        resultEl.innerHTML = `
          <div class="card card-pad mt-16" style="background:var(--surface-alt)">
            <div class="text-sm mb-8">✅ Đã nhập xong — ${res.newProfiles} khách hàng mới · ${res.existingCustomers} khách đã có sẵn (giữ nguyên) · ${res.contracts} hợp đồng</div>
            ${res.deletedContracts ? `<div class="text-sm mb-8" style="color:var(--warning)">${icon('alert', 'icon-sm')} Đã xóa ${res.deletedContracts} hợp đồng không còn trong file này</div>` : ''}
            ${res.deletedCustomers ? `<div class="text-sm mb-8" style="color:var(--warning)">${icon('alert', 'icon-sm')} Đã dọn ${res.deletedCustomers} hồ sơ không còn hợp đồng nào (chưa có tài khoản Use)</div>` : ''}
            ${res.newAccounts.length ? `
              <div class="fw-700 text-sm mb-6">Tài khoản Use mới tự tạo (gửi cho khách hàng):</div>
              ${res.newAccounts.map((a) => `<div class="oc-line"><span>${a.name} (${a.cccd})</span><b>${a.tempPassword}</b></div>`).join('')}
            ` : ''}
            ${res.errors.length ? `<div class="text-sm text-danger mt-8">${res.errors.slice(0, 5).join('<br/>')}</div>` : ''}
          </div>
        `;
        resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        toast('Đã nhập dữ liệu xong', 'success');
        window.__qtdRedrawCustomers?.();
      };

      // Chọn file xong chỉ hiện tên file + bật nút "Tải lên" — bấm nút mới
      // thật sự đọc/xử lý file, tránh xử lý nhầm ngay khi vừa chọn nhầm file.
      fileInput.addEventListener('change', () => {
        uploadBtn.disabled = !fileInput.files[0];
      });
      const uploadBtnIdleHtml = uploadBtn.innerHTML;
      uploadBtn.addEventListener('click', async () => {
        const file = fileInput.files[0];
        if (!file) return;
        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Đang đọc file...';
        let rows;
        try {
          rows = await readExcelFirstSheet(file);
        } catch (err) {
          toast('Không đọc được file: ' + (err.message || ''), 'error');
          uploadBtn.innerHTML = uploadBtnIdleHtml;
          uploadBtn.disabled = !fileInput.files[0];
          return;
        }
        uploadBtn.textContent = 'Đang xử lý...';
        try {
          await runImport(rowsToTsv(rows), true);
        } catch (err) {
          toast(err.message || 'Có lỗi khi nhập dữ liệu', 'error');
        } finally {
          uploadBtn.innerHTML = uploadBtnIdleHtml;
          uploadBtn.disabled = !fileInput.files[0];
        }
      });

      const pasteBtn = sheet.querySelector('#do-paste-import');
      const pasteBtnIdleHtml = pasteBtn.innerHTML;
      pasteBtn.addEventListener('click', async () => {
        pasteBtn.disabled = true;
        pasteBtn.textContent = 'Đang xử lý...';
        try {
          await runImport(sheet.querySelector('#paste-area').value, false);
        } catch (err) {
          toast(err.message || 'Có lỗi khi nhập dữ liệu', 'error');
        } finally {
          pasteBtn.disabled = false;
          pasteBtn.innerHTML = pasteBtnIdleHtml;
        }
      });
    },
  });
}

function esc(s) { return String(s || '').replace(/"/g, '&quot;'); }
