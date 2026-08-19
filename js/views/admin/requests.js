import * as S from '../../state.js';
import { pageHeader } from '../../components/shell.js';
import { statusBadge, emptyState, openPicker } from '../../components/ui.js';
import { toast } from '../../components/toast.js';
import { formatVND, formatDateTime } from '../../utils.js';

export function renderHeader(headerEl) {
  headerEl.innerHTML = pageHeader({ title: 'Yêu cầu tư vấn' });
}

let activeStatus = 'all';

export function render(contentEl, filterEl) {
  filterEl.innerHTML = `
    <div class="chip-row" style="padding:10px 14px">
      <button class="chip ${activeStatus === 'all' ? 'active' : ''}" data-s="all">Tất cả</button>
      ${S.REQUEST_STATUS.map((s) => `<button class="chip ${activeStatus === s.id ? 'active' : ''}" data-s="${s.id}">${s.label}</button>`).join('')}
    </div>
  `;
  filterEl.querySelectorAll('[data-s]').forEach((chip) => {
    chip.addEventListener('click', () => { activeStatus = chip.dataset.s; render(contentEl, filterEl); });
  });

  const list = S.listRequests({ status: activeStatus });
  contentEl.innerHTML = list.length ? list.map((r) => {
    const cust = S.getCustomer(r.customerId);
    return `
    <div class="card order-card" data-id="${r.id}">
      <div class="oc-top">
        <span class="oc-code">${cust ? cust.name : '—'} · ${cust ? cust.phone : ''}</span>
        ${statusBadge(S.REQUEST_STATUS_MAP[r.status])}
      </div>
      <div class="oc-line"><span>Loại</span><b>${S.REQUEST_TYPE.find((t) => t.id === r.type)?.label}</b></div>
      ${r.amount ? `<div class="oc-line"><span>Số tiền</span><b>${formatVND(r.amount)}</b></div>` : ''}
      <div class="oc-line"><span>Nội dung</span><b>${r.note || r.purpose || '—'}</b></div>
      <div class="oc-line"><span>Ngày gửi</span><b>${formatDateTime(r.createdAt)}</b></div>
      <div class="oc-foot"><button class="link-more" data-update="${r.id}" style="border:none;background:none;cursor:pointer">Cập nhật trạng thái →</button></div>
    </div>`;
  }).join('') : `<div class="card card-pad">${emptyState({ iconName: 'clipboard', title: 'Không có yêu cầu', message: 'Chưa có yêu cầu tư vấn nào phù hợp.' })}</div>`;

  contentEl.querySelectorAll('[data-update]').forEach((btn) => {
    btn.addEventListener('click', () => {
      openPicker({
        title: 'Cập nhật trạng thái', options: S.REQUEST_STATUS.map((s) => ({ value: s.id, label: s.label })),
        selected: null,
        onSelect: (val) => { S.updateRequestStatus(btn.dataset.update, val); toast('Đã cập nhật trạng thái', 'success'); },
      });
    });
  });
}
