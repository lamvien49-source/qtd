import * as S from '../../state.js';
import { pageHeader } from '../../components/shell.js';
import { openModal } from '../../components/modal.js';
import { emptyState, statusBadge } from '../../components/ui.js';
import { formatVND, formatNumber, formatDate, formatDateTime, daysUntil, initials, colorFor } from '../../utils.js';
import { openContractView } from './customers.js';

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
  const overdue = contracts.filter((c) => S.contractUrgency(c) === 'qua_han');
  const nearDue = contracts.filter((c) => S.contractUrgency(c) === 'gan_den_han');
  const overdueTotal = overdue.reduce((s, c) => s + c.balance, 0);
  const nearDueTotal = nearDue.reduce((s, c) => s + c.balance, 0);

  const pad2 = (n) => String(n).padStart(2, '0');

  contentEl.innerHTML = `
    <div class="grid-4 mb-16">
      <div class="stat-tile c-blue"><div class="stat-label">Tổng khách hàng</div><div class="stat-value">${formatNumber(customers.length)}</div></div>
      <div class="stat-tile c-green"><div class="stat-label">Tổng dư nợ</div><div class="stat-value" style="font-size:15px">${formatVND(totalOutstanding)}</div></div>
      <div class="stat-tile c-pink"><div class="stat-label">Hợp đồng quá hạn</div><div class="stat-value">${formatNumber(overdue.length)}</div></div>
      <div class="stat-tile c-orange"><div class="stat-label">Gần đến hạn</div><div class="stat-value">${formatNumber(nearDue.length)}</div></div>
    </div>

    <div class="dash-two-col">
      <div class="card card-pad">
        <div class="section-head"><h2 style="color:var(--danger)">Hợp đồng quá hạn (${pad2(overdue.length)})</h2><button class="link-more" id="btn-all-overdue" style="background:none;border:none;cursor:pointer">Xem tất cả</button></div>
        <div class="text-sm text-muted mb-8">Tổng cộng: <b class="text-danger">${formatVND(overdueTotal)}</b></div>
        ${overdue.length ? overdue.slice(0, 5).map((c) => {
          const cust = S.getCustomer(c.customerId);
          return `<div class="table-store-row"><span class="name">${cust ? cust.name : '—'} · ${c.code}</span><span class="val text-danger">${formatVND(c.balance)}</span></div>`;
        }).join('') : `<p class="text-sm text-muted">Không có hợp đồng quá hạn.</p>`}
      </div>
      <div class="card card-pad">
        <div class="section-head"><h2 style="color:var(--warning)">Gần đến hạn (${pad2(nearDue.length)})</h2><button class="link-more" id="btn-all-neardue" style="background:none;border:none;cursor:pointer">Xem tất cả</button></div>
        <div class="text-sm text-muted mb-8">Tổng cộng: <b style="color:var(--warning)">${formatVND(nearDueTotal)}</b></div>
        ${nearDue.length ? nearDue.slice(0, 5).map((c) => {
          const cust = S.getCustomer(c.customerId);
          return `<div class="table-store-row"><span class="name">${cust ? cust.name : '—'} · ${c.code}</span><span class="val" style="color:var(--warning)">${formatVND(c.balance)}</span></div>`;
        }).join('') : `<p class="text-sm text-muted">Không có hợp đồng nào sắp đến hạn.</p>`}
      </div>
      <div class="card card-pad">
        <div class="section-head"><h2>Yêu cầu mới nhất</h2><a href="#/admin/yeu-cau" class="link-more">Xem tất cả</a></div>
        ${requests.length ? requests.slice(0, 5).map((r) => {
          const cust = S.getCustomer(r.customerId);
          const typeLabel = S.REQUEST_TYPE.find((t) => t.id === r.type)?.label || '';
          return `
          <div class="list-row" style="padding:8px 0">
            <div class="row-thumb" style="background:${colorFor(r.customerId)}">${initials(cust ? cust.name : '?')}</div>
            <div class="row-main">
              <div class="row-title" style="font-size:13.5px">${cust ? cust.name : '—'}</div>
              <div class="row-sub">${typeLabel} · ${formatDateTime(r.createdAt)}</div>
            </div>
            <div class="row-end">${statusBadge(S.REQUEST_STATUS_MAP[r.status])}</div>
          </div>`;
        }).join('') : `<p class="text-sm text-muted">Chưa có yêu cầu nào.</p>`}
      </div>
    </div>
  `;

  contentEl.querySelector('#btn-all-overdue').addEventListener('click', () => openContractListModal('Hợp đồng quá hạn', overdue, isStaff, 'var(--danger)'));
  contentEl.querySelector('#btn-all-neardue').addEventListener('click', () => openContractListModal('Gần đến hạn', nearDue, isStaff, 'var(--warning)'));
}

/**
 * Danh sách gọn chỉ gồm các hợp đồng thuộc đúng nhóm (quá hạn / gần đến hạn)
 * — bấm vào 1 dòng để mở thẳng chi tiết hợp đồng. Bên phải hiện thẳng số
 * tiền (tô màu theo nhóm) thay vì nhãn trạng thái, kèm tổng cộng cả nhóm ở
 * đầu danh sách để dễ theo dõi.
 */
function openContractListModal(title, contracts, isStaff, colorVar) {
  const total = contracts.reduce((s, ct) => s + ct.balance, 0);
  openModal({
    title: `${title} (${contracts.length})`,
    bodyHtml: `
      <div class="text-sm text-muted mb-12">Tổng cộng: <b style="color:${colorVar}">${formatVND(total)}</b></div>
      ${contracts.length ? contracts.map((ct) => {
        const cust = S.getCustomer(ct.customerId);
        const d = daysUntil(ct.dueDate);
        return `
        <div class="list-row" data-view-ct="${ct.id}" style="cursor:pointer">
          <div class="row-main">
            <div class="row-title">${cust ? cust.name : '—'} · ${ct.code}</div>
            <div class="row-sub">Đến hạn ${formatDate(ct.dueDate)} · ${d < 0 ? `Quá hạn ${Math.abs(d)} ngày` : `Còn ${d} ngày`}</div>
          </div>
          <div class="row-end"><b style="color:${colorVar}">${formatVND(ct.balance)}</b></div>
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
