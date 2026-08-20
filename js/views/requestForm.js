import * as S from '../state.js';
import { icon } from '../icons.js';
import { pageHeader } from '../components/shell.js';
import { statusBadge, emptyState } from '../components/ui.js';
import { toast } from '../components/toast.js';
import { formatVND, formatDateTime } from '../utils.js';

export function renderHeader(headerEl) {
  headerEl.innerHTML = pageHeader({ title: 'Yêu cầu tư vấn' });
}

export function render(contentEl, filterEl, params, query) {
  const session = S.getSession();
  const customer = S.getCustomer(session.id);
  const presetContract = query ? query.get('hop_dong') : null;
  let type = 'vay_moi';

  function draw() {
    const myRequests = S.listRequests({ customerId: customer.id });
    contentEl.innerHTML = `
      <div class="card card-pad mb-16">
        <div class="section-head"><h2>Gửi yêu cầu mới</h2></div>
        <div class="field">
          <label>Loại yêu cầu</label>
          <div class="radio-row">
            <div class="radio-opt ${type === 'vay_moi' ? 'active' : ''}" data-type="vay_moi">Mở khoản vay mới</div>
            <div class="radio-opt ${type === 'tu_van' ? 'active' : ''}" data-type="tu_van">Tư vấn khác</div>
          </div>
        </div>
        <form id="req-form">
          ${type === 'vay_moi' ? `
          <div class="field-row">
            <div class="field"><label>Số tiền muốn vay (ước tính)</label><input name="amount" type="number" min="0" step="1000000" placeholder="VD: 50000000"/></div>
            <div class="field"><label>Thời hạn mong muốn (tháng)</label><input name="termMonths" type="number" min="1"/></div>
          </div>
          <div class="field"><label>Mục đích vay</label><input name="purpose" placeholder="VD: Bổ sung vốn kinh doanh"/></div>
          ` : ''}
          <div class="field">
            <label>Nội dung ${presetContract ? `(liên quan hợp đồng ${presetContract})` : ''}</label>
            <textarea name="note" rows="3" placeholder="Mô tả yêu cầu của bạn...">${presetContract ? `Liên quan hợp đồng ${presetContract}: ` : ''}</textarea>
          </div>
          <button class="btn btn-primary btn-block" type="submit">${icon('check', 'icon-sm')} Gửi yêu cầu</button>
        </form>
      </div>

      <div class="section-head"><h2>Yêu cầu đã gửi</h2></div>
      ${myRequests.length ? myRequests.map((r) => `
        <div class="card order-card">
          <div class="oc-top">
            <span class="oc-code">${S.REQUEST_TYPE.find((t) => t.id === r.type)?.label}</span>
            ${statusBadge(S.REQUEST_STATUS_MAP[r.status])}
          </div>
          ${r.amount ? `<div class="oc-line"><span>Số tiền</span><b>${formatVND(r.amount)}</b></div>` : ''}
          <div class="oc-line"><span>Nội dung</span><b>${r.note || r.purpose || '—'}</b></div>
          <div class="oc-line"><span>Ngày gửi</span><b>${formatDateTime(r.createdAt)}</b></div>
        </div>
      `).join('') : `<div class="card card-pad">${emptyState({ iconName: 'clipboard', title: 'Chưa có yêu cầu nào', message: 'Các yêu cầu bạn gửi sẽ hiển thị tại đây.' })}</div>`}
    `;

    contentEl.querySelectorAll('[data-type]').forEach((opt) => {
      opt.addEventListener('click', () => { type = opt.dataset.type; draw(); });
    });

    contentEl.querySelector('#req-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const fd = new FormData(e.target);
      try {
        await S.createRequest({
          customerId: customer.id, type,
          amount: fd.get('amount'), termMonths: fd.get('termMonths'),
          purpose: fd.get('purpose'), note: fd.get('note'),
        });
        toast('Đã gửi yêu cầu, nhân viên sẽ liên hệ với bạn sớm', 'success');
        draw();
      } catch (err) { toast(err.message || 'Có lỗi xảy ra', 'error'); }
    });
  }
  draw();
}
