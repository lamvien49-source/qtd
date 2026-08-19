import * as S from '../state.js';
import { icon } from '../icons.js';
import { pageHeader, bindHeaderActions } from '../components/shell.js';
import { statusBadge } from '../components/ui.js';
import { openModal } from '../components/modal.js';
import { formatVND, formatDate, formatNumber, daysUntil, stripDiacritics } from '../utils.js';

export function renderHeader(headerEl) {
  headerEl.innerHTML = pageHeader({ title: 'Chi tiết hợp đồng', back: true });
  bindHeaderActions(headerEl, { back: () => history.back() });
}

export function render(contentEl, filterEl, params) {
  const contract = S.getContract(params.id);
  if (!contract) { contentEl.innerHTML = `<div class="card card-pad"><p>Không tìm thấy hợp đồng.</p></div>`; return; }
  const customer = S.getCustomer(contract.customerId);
  const status = S.CONTRACT_STATUS_MAP[contract.status];
  const d = daysUntil(contract.dueDate);
  const interestPaidUntil = contract.interestPaidUntil || contract.disbursedDate;
  const interestDays = Math.max(0, -daysUntil(interestPaidUntil));
  const accrued = S.accruedInterest(contract);
  const canPay = contract.status !== 'da_tat_toan';

  contentEl.innerHTML = `
    <div class="card card-pad mb-16">
      <div class="flex justify-between items-center mb-10">
        <span class="fw-700" style="font-size:15px">Hợp đồng ${contract.code}</span>
        ${statusBadge(status)}
      </div>
      <div class="oc-line"><span>Số tiền vay ban đầu</span><b>${formatVND(contract.principal)}</b></div>
      <div class="oc-line"><span>Dư nợ hiện tại</span><b style="color:var(--color-primary)">${formatVND(contract.balance)}</b></div>
      <div class="oc-line"><span>Lãi suất</span><b>${contract.interestRate}%/năm</b></div>
      <div class="oc-line"><span>Ngày giải ngân</span><b>${formatDate(contract.disbursedDate)}</b></div>
      <div class="oc-line"><span>Ngày đến hạn</span><b>${formatDate(contract.dueDate)}</b></div>
      <div class="oc-line"><span>Đã trả lãi đến ngày</span><b>${formatDate(interestPaidUntil)}</b></div>
      ${canPay ? `
      <div class="oc-line" style="padding-top:8px;border-top:1px dashed var(--border);margin-top:6px">
        <span class="fw-700">Lãi đến nay</span>
        <b style="color:var(--warning)">${formatVND(accrued)}</b>
      </div>
      <div class="field-hint">(${formatVND(contract.balance)} × ${interestDays} ngày × ${contract.interestRate}%/năm ÷ 365)</div>
      ` : ''}
      ${canPay ? `
      <div class="field-hint ${d < 0 ? 'text-danger' : ''}" style="margin-top:8px;font-size:13px">
        ${d < 0 ? `${icon('alert', 'icon-sm')} Hợp đồng đã quá hạn ${Math.abs(d)} ngày` : `Còn ${d} ngày đến hạn thanh toán`}
      </div>` : ''}
    </div>

    ${canPay ? `<button class="btn btn-primary btn-block mb-10" id="btn-thanh-toan">${icon('wallet', 'icon-sm')} Thanh toán</button>` : ''}

    <a href="#/yeu-cau-tu-van?hop_dong=${contract.code}" class="btn btn-outline btn-block">
      ${icon('phone', 'icon-sm')} Liên hệ tư vấn về hợp đồng này
    </a>
  `;

  const btnPay = contentEl.querySelector('#btn-thanh-toan');
  if (btnPay) btnPay.addEventListener('click', () => openPaymentModal(contract, customer, accrued));
}

function buildVietQrUrl({ bin, accountNo, amount, content, accountName }) {
  const info = encodeURIComponent(content);
  const name = encodeURIComponent(accountName);
  return `https://img.vietqr.io/image/${bin}-${accountNo}-compact2.png?amount=${Math.round(amount)}&addInfo=${info}&accountName=${name}`;
}

/**
 * Liên kết thanh toán nhanh VietQR — mở trên điện thoại sẽ đưa thẳng tới màn
 * hình chọn app ngân hàng của VietQR, bấm vào app đang dùng sẽ nhảy vào đúng
 * màn hình chuyển khoản đã điền sẵn số tiền/nội dung (dịch vụ của VietQR,
 * cần Internet trên máy khách hàng — không xem trước được trong môi trường
 * phát triển không có mạng ở đây).
 */
function buildVietQrPayLink({ bin, accountNo, amount, content }) {
  const params = new URLSearchParams({ ba: `${accountNo}-${bin}`, am: String(Math.round(amount)), tn: content });
  return `https://dl.vietqr.io/pay?${params.toString()}`;
}

/** Ô nhập số tiền hiển thị có dấu chấm ngăn cách hàng nghìn (VD: 1.500.000) khi gõ. */
function bindMoneyInput(inputEl, initial, onChange) {
  inputEl.value = initial ? formatNumber(initial) : '';
  inputEl.addEventListener('input', () => {
    const raw = Number(inputEl.value.replace(/\D/g, '')) || 0;
    inputEl.value = raw ? formatNumber(raw) : '';
    onChange(raw);
  });
}

function openPaymentModal(contract, customer, accrued) {
  const org = S.getOrg();
  let payType = 'lai'; // 'goc' | 'lai'
  let principalAmount = 0;
  let interestAmount = accrued;

  const close = openModal({
    title: 'Thanh toán khoản vay',
    bodyHtml: `<div id="pay-body"></div>`,
    onMount(sheet) {
      const body = sheet.querySelector('#pay-body');

      function content() {
        const total = payType === 'goc' ? principalAmount + accrued : interestAmount;
        const loai = payType === 'goc' ? 'GOC' : 'LAI';
        // Không nhúng số tiền vào nội dung — số tiền đã có ở dòng riêng + mã QR, tránh trùng lặp.
        const text = `${stripDiacritics(customer.name)} THANH TOAN ${loai} HDTD ${contract.code}`;
        return { total, text };
      }

      const hasBank = org.bankBin && org.bankAccountNo;

      /** Chỉ cập nhật phần số tiền/nội dung/QR — không vẽ lại ô nhập để không mất focus khi đang gõ. */
      function updateSummary() {
        const { total, text } = content();
        body.querySelector('#sum-amount').textContent = formatVND(total);
        body.querySelector('#sum-content').textContent = text;
        if (hasBank) {
          body.querySelector('#qr-img').src = buildVietQrUrl({ bin: org.bankBin, accountNo: org.bankAccountNo, amount: total, content: text, accountName: org.bankAccountName });
          body.querySelector('#btn-continue-pay').href = buildVietQrPayLink({ bin: org.bankBin, accountNo: org.bankAccountNo, amount: total, content: text });
        }
      }

      function draw() {
        body.innerHTML = `
          <div class="field">
            <label>Chọn loại thanh toán</label>
            <div class="radio-row">
              <div class="radio-opt ${payType === 'goc' ? 'active' : ''}" data-type="goc">Trả gốc</div>
              <div class="radio-opt ${payType === 'lai' ? 'active' : ''}" data-type="lai">Trả lãi</div>
            </div>
          </div>
          ${payType === 'goc' ? `
            <div class="field-hint mb-8">Tiền lãi tính đúng theo hợp đồng (không đổi được): <b>${formatVND(accrued)}</b></div>
            <div class="field"><label>Số tiền gốc muốn trả</label><input type="text" inputmode="numeric" id="principal-input"/></div>
          ` : `
            <div class="field"><label>Số tiền lãi</label><input type="text" inputmode="numeric" id="interest-input"/></div>
            <div class="field-hint mb-8">Mặc định lấy theo lãi phát sinh đến hôm nay, bạn có thể sửa lại nếu cần.</div>
          `}
          <div class="card card-pad mb-16" style="background:var(--surface-alt)">
            <div class="oc-line"><span>Ngân hàng</span><b>${org.bankName || '—'}</b></div>
            <div class="oc-line"><span>Số tài khoản</span><b>${org.bankAccountNo || '—'}</b></div>
            <div class="oc-line"><span>Chủ tài khoản</span><b>${org.bankAccountName || '—'}</b></div>
            <div class="oc-line"><span>Số tiền</span><b id="sum-amount" style="color:var(--color-primary)"></b></div>
            <div class="oc-line" style="align-items:flex-start"><span>Nội dung</span><b id="sum-content" style="text-align:right;max-width:65%"></b></div>
          </div>
          ${hasBank ? `
            <div style="text-align:center">
              <img id="qr-img" alt="Mã QR chuyển khoản" style="max-width:220px;width:100%;border:1px solid var(--border);border-radius:12px"/>
              <div class="field-hint mt-8 mb-12">Mở app ngân hàng/ví điện tử bất kỳ hỗ trợ VietQR và quét mã này để chuyển khoản. Có thể gửi mã này cho người khác chuyển giúp.</div>
              <a id="btn-continue-pay" class="btn btn-primary btn-block" target="_blank" rel="noopener">${icon('wallet', 'icon-sm')} Thanh toán tiếp — Mở app ngân hàng</a>
              <div class="field-hint mt-8">Bấm vào sẽ mở trang chọn app ngân hàng của VietQR, chọn đúng app khách hàng đang dùng sẽ tự điền sẵn số tiền &amp; nội dung để chuyển ngay.</div>
            </div>
          ` : `
            <div class="field-hint text-danger">Quỹ chưa cấu hình mã QR (mã ngân hàng). Vui lòng chuyển khoản thủ công theo thông tin ở trên, hoặc liên hệ quầy giao dịch.</div>
          `}
        `;
        body.querySelectorAll('[data-type]').forEach((opt) => {
          opt.addEventListener('click', () => { payType = opt.dataset.type; draw(); });
        });
        const pInput = body.querySelector('#principal-input');
        if (pInput) bindMoneyInput(pInput, principalAmount, (v) => { principalAmount = v; updateSummary(); });
        const iInput = body.querySelector('#interest-input');
        if (iInput) bindMoneyInput(iInput, interestAmount, (v) => { interestAmount = v; updateSummary(); });
        updateSummary();
      }
      draw();
    },
  });
  return close;
}
