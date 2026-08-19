import * as S from '../state.js';
import { icon } from '../icons.js';
import { pageHeader } from '../components/shell.js';
import { orderStatusBadge, emptyState } from '../components/ui.js';
import { formatVND, formatDate, daysUntil } from '../utils.js';

export function renderHeader(headerEl) {
  headerEl.innerHTML = pageHeader({ title: 'Trang chủ' });
}

export function render(contentEl) {
  const session = S.getSession();
  const customer = S.getCustomer(session.id);
  const org = S.getOrg();
  const contracts = S.listContractsByCustomer(customer.id);
  const total = S.customerOutstandingTotal(customer.id);
  const active = contracts.filter((c) => c.status !== 'da_tat_toan');

  contentEl.innerHTML = `
    ${org.bannerEnabled ? `
    <div class="card card-pad mb-16" style="background:linear-gradient(120deg, var(--color-primary), #1a9484);color:#fff;border:none">
      <div class="fw-700" style="font-size:15px">${org.bannerTitle}</div>
      <div class="text-sm mt-4" style="opacity:.92">${org.bannerText}</div>
    </div>` : ''}

    <div class="card card-pad mb-16">
      <div class="text-sm text-muted">Xin chào,</div>
      <div class="fw-700" style="font-size:17px;margin-bottom:14px">${customer.name}</div>
      <div class="stat-tile c-blue" style="max-width:340px">
        <div class="stat-icon">${icon('wallet', 'icon-sm')}</div>
        <div class="stat-label">Tổng dư nợ hiện tại (${active.length} hợp đồng)</div>
        <div class="stat-value">${formatVND(total)}</div>
      </div>
    </div>

    <div class="section-head">
      <h2>Hợp đồng vay của bạn</h2>
      <a href="#/yeu-cau-tu-van" class="link-more">${icon('plus', 'icon-sm')} Yêu cầu vay mới</a>
    </div>

    ${contracts.length ? contracts.map((c) => {
      const status = S.CONTRACT_STATUS_MAP[c.status];
      const d = daysUntil(c.dueDate);
      let dueNote = '';
      if (c.status !== 'da_tat_toan') {
        dueNote = d < 0 ? `<span class="text-danger">Quá hạn ${Math.abs(d)} ngày</span>` : `<span class="text-muted">Còn ${d} ngày đến hạn</span>`;
      }
      return `
      <a href="#/hop-dong/${c.id}" class="card order-card" style="display:block;cursor:pointer">
        <div class="oc-top">
          <span class="oc-code">Hợp đồng ${c.code}</span>
          <span class="badge ${status.badge}">${status.label}</span>
        </div>
        <div class="oc-line"><span>Số tiền vay</span><b>${formatVND(c.principal)}</b></div>
        <div class="oc-line"><span>Dư nợ hiện tại</span><b>${formatVND(c.balance)}</b></div>
        <div class="oc-line"><span>Ngày vay</span><b>${formatDate(c.disbursedDate)}</b></div>
        <div class="oc-line"><span>Ngày đến hạn</span><b>${formatDate(c.dueDate)} ${dueNote}</b></div>
        <div class="oc-foot"><span class="link-more">Xem chi tiết →</span></div>
      </a>`;
    }).join('') : `<div class="card card-pad">${emptyState({ iconName: 'landmark', title: 'Chưa có hợp đồng vay', message: 'Bạn hiện chưa có hợp đồng vay nào tại quỹ tín dụng.' })}</div>`}

    <div class="card card-pad mt-16">
      <div class="section-head"><h2>Liên hệ hỗ trợ</h2></div>
      <div class="oc-line"><span>Hotline</span><b>${org.hotline}</b></div>
      <div class="oc-line"><span>Địa chỉ</span><b>${org.address}</b></div>
    </div>
  `;
}
