import * as S from '../../state.js';
import { pageHeader } from '../../components/shell.js';
import { toast } from '../../components/toast.js';

export function renderHeader(headerEl) {
  headerEl.innerHTML = pageHeader({ title: 'Cài đặt' });
}

export function render(contentEl) {
  const org = S.getOrg();
  contentEl.innerHTML = `
    <div class="card card-pad mb-16">
      <div class="section-head"><h2>Thông tin quỹ tín dụng</h2></div>
      <form id="org-form">
        <div class="field"><label>Tên đầy đủ</label><input name="name" value="${esc(org.name)}" required/></div>
        <div class="field"><label>Tên viết tắt (hiển thị ở sidebar)</label><input name="shortName" value="${esc(org.shortName)}"/></div>
        <div class="field-row">
          <div class="field"><label>Hotline</label><input name="hotline" value="${esc(org.hotline)}"/></div>
          <div class="field"><label>Địa chỉ</label><input name="address" value="${esc(org.address)}"/></div>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Lưu thông tin</button>
      </form>
    </div>

    <div class="card card-pad mb-16">
      <div class="section-head"><h2>Thông tin nhận thanh toán (QR)</h2></div>
      <p class="text-sm text-muted mb-8">Dùng để tạo mã QR chuyển khoản cho khách hàng ở trang hợp đồng. <b class="text-danger">Kiểm tra lại chính xác trước khi dùng thật</b> — mã ngân hàng (BIN) sai sẽ tạo QR không quét được hoặc chuyển nhầm nơi nhận.</p>
      <form id="bank-form">
        <div class="field"><label>Tên ngân hàng</label><input name="bankName" value="${esc(org.bankName)}"/></div>
        <div class="field"><label>Mã ngân hàng VietQR (BIN)</label><input name="bankBin" value="${esc(org.bankBin)}" placeholder="VD: 970446"/></div>
        <div class="field-row">
          <div class="field"><label>Số tài khoản</label><input name="bankAccountNo" value="${esc(org.bankAccountNo)}"/></div>
          <div class="field"><label>Tên chủ tài khoản</label><input name="bankAccountName" value="${esc(org.bankAccountName)}"/></div>
        </div>
        <button class="btn btn-primary btn-block" type="submit">Lưu thông tin ngân hàng</button>
      </form>
    </div>

    <div class="card card-pad mb-16">
      <div class="section-head"><h2>Banner trang chủ khách hàng</h2></div>
      <form id="banner-form">
        <div class="field">
          <label>Hiển thị banner</label>
          <div class="radio-row">
            <div class="radio-opt ${org.bannerEnabled ? 'active' : ''}" data-enabled="true">Bật</div>
            <div class="radio-opt ${!org.bannerEnabled ? 'active' : ''}" data-enabled="false">Tắt</div>
          </div>
        </div>
        <div class="field"><label>Tiêu đề</label><input name="bannerTitle" value="${esc(org.bannerTitle)}"/></div>
        <div class="field"><label>Nội dung</label><textarea name="bannerText" rows="3">${esc(org.bannerText)}</textarea></div>
        <button class="btn btn-primary btn-block" type="submit">Lưu banner</button>
      </form>
    </div>

  `;

  let bannerEnabled = org.bannerEnabled;
  contentEl.querySelectorAll('[data-enabled]').forEach((opt) => {
    opt.addEventListener('click', () => {
      bannerEnabled = opt.dataset.enabled === 'true';
      contentEl.querySelectorAll('[data-enabled]').forEach((o) => o.classList.toggle('active', o === opt));
    });
  });

  contentEl.querySelector('#org-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await S.updateOrg({ name: fd.get('name'), shortName: fd.get('shortName'), hotline: fd.get('hotline'), address: fd.get('address') });
      toast('Đã lưu thông tin quỹ tín dụng', 'success');
    } catch (err) { toast(err.message || 'Có lỗi xảy ra', 'error'); }
  });

  contentEl.querySelector('#bank-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await S.updateOrg({
        bankName: fd.get('bankName'), bankBin: fd.get('bankBin').trim(),
        bankAccountNo: fd.get('bankAccountNo').trim(), bankAccountName: fd.get('bankAccountName').trim(),
      });
      toast('Đã lưu thông tin nhận thanh toán', 'success');
    } catch (err) { toast(err.message || 'Có lỗi xảy ra', 'error'); }
  });

  contentEl.querySelector('#banner-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const fd = new FormData(e.target);
    try {
      await S.updateOrg({ bannerEnabled, bannerTitle: fd.get('bannerTitle'), bannerText: fd.get('bannerText') });
      toast('Đã lưu banner', 'success');
    } catch (err) { toast(err.message || 'Có lỗi xảy ra', 'error'); }
  });
}
function esc(s) { return String(s || '').replace(/"/g, '&quot;'); }
