import * as S from '../../state.js';
import { pageHeader } from '../../components/shell.js';
import { openModal } from '../../components/modal.js';
import { emptyState, statusBadge } from '../../components/ui.js';
import { formatVND, formatNumber, formatDate, daysUntil } from '../../utils.js';
import { openContractView } from './customers.js';

const NEAR_DUE_DAYS = 15;

export function renderHeader(headerEl) {
  headerEl.innerHTML = pageHeader({ title: 'Tổng quan quản trị' });
}

export function render(contentEl) {
  const session = S.getSession();
  const admin = S.getAdmin(session.id);
  const isStaff = admin.role === 'staff';
  const customers = S.listCustomers({ adminId: isStaff ? admin.id : undefined });
  const customerIds = new Set(customers.map((c) => c.id));
  const contracts = S.getState().contracts.filter((c) => !isStaff || customerIds.has(c.customerId));
  const requests = S.listRequests({}).filter((r) => !isStaff || customerIds.has(r.customerId));
  const totalOutstanding = contracts.filter((c) => S.effectiveContractStatus(c) !== 'da_tat_toan').reduce((s, c) => s + c.balance, 0);
  const overdue = contracts.filter((c) => S.effectiveContractStatus(c) === 'qua_han');
  const nearDue = contracts.filter((c) => S.effectiveContractStatus(c) === 'dang_vay' && daysUntil(c.dueDate) >= 0 && daysUntil(c.dueDate) <= NEAR_DUE_DAYS);
  const newRequests = requests.filter((r) => r.status === 'moi');

  const pad2 = (n) => String(n).padStart(2, '0');

  contentEl.innerHTML = `
    <div class="grid-4 mb-16">
      <div class="stat-tile c-blue"><div class="stat-label">Tổng khách hàng</div><div class="stat-value">${formatNumber(customers.length)}</div></div>
      <div class="stat-tile c-green"><div class="stat-label">Tổng dư nợ</div><div class="stat-value" style="font-size:15px">${formatVND(totalOutstanding)}</div></div>
      <div class="stat-tile c-pink"><div class="stat-label">Hợp đồng quá hạn</div><div class="stat-value">${formatNumber(overdue.length)}</div></div>
      <div class="stat-tile c-orange"><div class="stat-label">Gần đến hạn</div><div class="stat-value">${formatNumber(nearDue.length)}</div></div>
      <div class="stat-tile c-purple"><div class="stat-label">Yêu cầu mới</div><div class="stat-value">${formatNumber(newRequests.length)}</div></div>
    </div>

    <div class="dash-two-col">
      <div class="card card-pad">
        <div class="section-head"><h2 style="color:var(--danger)">Hợp đồng quá hạn (${pad2(overdue.length)})</h2><button class="link-more" id="btn-all-overdue" style="background:none;border:none;cursor:pointer">Xem tất cả</button></div>
        ${overdue.length ? overdue.slice(0, 5).map((c) => {
          const cust = S.getCustomer(c.customerId);
          return `<div class="table-store-row"><span class="name">${cust ? cust.name : '—'} · ${c.code}</span><span class="val text-danger">${formatVND(c.balance)}</span></div>`;
        }).join('') : `<p class="text-sm text-muted">Không có hợp đồng quá hạn.</p>`}
      </div>
      <div class="card card-pad">
        <div class="section-head"><h2 style="color:var(--warning)">Gần đến hạn (${pad2(nearDue.length)})</h2><button class="link-more" id="btn-all-neardue" style="background:none;border:none;cursor:pointer">Xem tất cả</button></div>
        ${nearDue.length ? nearDue.slice(0, 5).map((c) => {
          const cust = S.getCustomer(c.customerId);
          return `<div class="table-store-row"><span class="name">${cust ? cust.name : '—'} · ${c.code}</span><span class="val" style="color:var(--warning)">Còn ${daysUntil(c.dueDate)} ngày</span></div>`;
        }).join('') : `<p class="text-sm text-muted">Không có hợp đồng nào sắp đến hạn.</p>`}
      </div>
      <div class="card card-pad">
        <div class="section-head"><h2>Yêu cầu mới nhất</h2><a href="#/admin/yeu-cau" class="link-more">Xem tất cả</a></div>
        ${requests.slice(0, 5).map((r) => {
          const cust = S.getCustomer(r.customerId);
          return `<div class="table-store-row"><span class="name">${cust ? cust.name : '—'}</span><span class="val">${S.REQUEST_STATUS_MAP[r.status].label}</span></div>`;
        }).join('') || `<p class="text-sm text-muted">Chưa có yêu cầu nào.</p>`}
      </div>
    </div>
  `;

  contentEl.querySelector('#btn-all-overdue').addEventListener('click', () => openContractListModal('Hợp đồng quá hạn', overdue, isStaff));
  contentEl.querySelector('#btn-all-neardue').addEventListener('click', () => openContractListModal('Gần đến hạn', nearDue, isStaff));
}

/** Danh sách gọn chỉ gồm các hợp đồng thuộc đúng nhóm (quá hạn / gần đến hạn) — bấm vào 1 dòng để mở thẳng chi tiết hợp đồng. */
function openContractListModal(title, contracts, isStaff) {
  openModal({
    title: `${title} (${contracts.length})`,
    bodyHtml: `
      ${contracts.length ? contracts.map((ct) => {
        const cust = S.getCustomer(ct.customerId);
        const status = S.CONTRACT_STATUS_MAP[S.effectiveContractStatus(ct)];
        const d = daysUntil(ct.dueDate);
        return `
        <div class="list-row" data-view-ct="${ct.id}" style="cursor:pointer">
          <div class="row-main">
            <div class="row-title">${cust ? cust.name : '—'} · ${ct.code}</div>
            <div class="row-sub">Đến hạn ${formatDate(ct.dueDate)} · ${d < 0 ? `Quá hạn ${Math.abs(d)} ngày` : `Còn ${d} ngày`}</div>
          </div>
          <div class="row-end">${statusBadge(status)}</div>
        </div>`;
      }).join('') : emptyState({ iconName: 'checkCircle', title: 'Không có hợp đồng nào', message: 'Danh sách hiện đang trống.' })}
    `,
    onMount(sheet, closeFn) {
      sheet.querySelectorAll('[data-view-ct]').forEach((row) => {
        row.addEventListener('click', () => {
          const ct = S.getContract(row.dataset.viewCt);
          closeFn();
          openContractView(ct.customerId, ct, { readOnly: isStaff });
        });
      });
    },
  });
}
