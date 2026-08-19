import * as S from '../state.js';
import { icon } from '../icons.js';
import { pageHeader, bindHeaderActions } from '../components/shell.js';
import { statusBadge } from '../components/ui.js';
import { formatVND, formatDate, daysUntil } from '../utils.js';

export function renderHeader(headerEl) {
  headerEl.innerHTML = pageHeader({ title: 'Chi tiết hợp đồng', back: true });
  bindHeaderActions(headerEl, { back: () => history.back() });
}

export function render(contentEl, filterEl, params) {
  const contract = S.getContract(params.id);
  if (!contract) { contentEl.innerHTML = `<div class="card card-pad"><p>Không tìm thấy hợp đồng.</p></div>`; return; }
  const status = S.CONTRACT_STATUS_MAP[contract.status];
  const d = daysUntil(contract.dueDate);
  const interestPaidUntil = contract.interestPaidUntil || contract.disbursedDate;
  const interestDays = Math.max(0, -daysUntil(interestPaidUntil));
  const accrued = S.accruedInterest(contract);

  contentEl.innerHTML = `
    <div class="card card-pad mb-16">
      <div class="flex justify-between items-center mb-10">
        <span class="fw-700" style="font-size:15px">Hợp đồng ${contract.code}</span>
        ${statusBadge(status)}
      </div>
      <div class="oc-line"><span>Số tiền vay ban đầu</span><b>${formatVND(contract.principal)}</b></div>
      <div class="oc-line"><span>Dư nợ hiện tại</span><b style="color:var(--color-primary)">${formatVND(contract.balance)}</b></div>
      <div class="oc-line"><span>Lãi suất</span><b>${contract.interestRate}%/năm</b></div>
      <div class="oc-line"><span>Kỳ hạn</span><b>${contract.termMonths ? contract.termMonths + ' tháng' : '—'}</b></div>
      <div class="oc-line"><span>Ngày giải ngân</span><b>${formatDate(contract.disbursedDate)}</b></div>
      <div class="oc-line"><span>Ngày đến hạn</span><b>${formatDate(contract.dueDate)}</b></div>
      <div class="oc-line"><span>Đã trả lãi đến ngày</span><b>${formatDate(interestPaidUntil)}</b></div>
      ${contract.status !== 'da_tat_toan' ? `
      <div class="oc-line" style="padding-top:8px;border-top:1px dashed var(--border);margin-top:6px">
        <span class="fw-700">Lãi đến nay</span>
        <b style="color:var(--warning)">${formatVND(accrued)}</b>
      </div>
      <div class="field-hint">(${formatVND(contract.balance)} × ${interestDays} ngày × ${contract.interestRate}%/năm ÷ 365)</div>
      ` : ''}
      ${contract.status !== 'da_tat_toan' ? `
      <div class="field-hint ${d < 0 ? 'text-danger' : ''}" style="margin-top:8px;font-size:13px">
        ${d < 0 ? `${icon('alert', 'icon-sm')} Hợp đồng đã quá hạn ${Math.abs(d)} ngày` : `Còn ${d} ngày đến hạn thanh toán`}
      </div>` : ''}
    </div>

    ${(() => {
      const history = S.listPaymentsByContract(contract.id);
      if (!history.length) return '';
      return `
      <div class="card card-pad mb-16">
        <div class="section-head"><h2>Lịch sử thanh toán</h2></div>
        ${history.map((p) => `
          <div class="list-row">
            <div class="row-main">
              <div class="row-title">${formatDate(p.date)}</div>
              ${p.note ? `<div class="row-sub">${p.note}</div>` : ''}
            </div>
            <div class="row-end">
              ${p.interestAmount ? `<div class="amount-sub">Lãi: ${formatVND(p.interestAmount)}</div>` : ''}
              ${p.principalAmount ? `<div class="amount-sub">Gốc: ${formatVND(p.principalAmount)}</div>` : ''}
            </div>
          </div>`).join('')}
      </div>`;
    })()}

    <a href="#/yeu-cau-tu-van?hop_dong=${contract.code}" class="btn btn-outline btn-block">
      ${icon('phone', 'icon-sm')} Liên hệ tư vấn về hợp đồng này
    </a>
  `;
}
