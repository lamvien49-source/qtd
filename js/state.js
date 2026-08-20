// ============================================================
// Lớp dữ liệu & nghiệp vụ trung tâm (state) — BẢN DEMO, lưu trong
// localStorage của trình duyệt. KHÔNG kết nối database thật, KHÔNG
// dùng để vận hành thật — chỉ minh họa giao diện & luồng nghiệp vụ.
// Toàn bộ dữ liệu khách hàng trong file này là dữ liệu GIẢ.
// ============================================================
import { genId, mulberry32, randInt, addDays, daysBetween } from './utils.js';
import { getSupabaseClient, callLoginFunction } from './lib/supabaseClient.js';

export const STORAGE_KEY = 'qtd_demo_v3';

export const REQUEST_TYPE = [
  { id: 'vay_moi', label: 'Yêu cầu mở khoản vay mới' },
  { id: 'tu_van', label: 'Yêu cầu tư vấn khác' },
];
export const REQUEST_STATUS = [
  { id: 'moi', label: 'Mới', badge: 'badge-blue' },
  { id: 'dang_xu_ly', label: 'Đang xử lý', badge: 'badge-yellow' },
  { id: 'da_lien_he', label: 'Đã liên hệ', badge: 'badge-green' },
];
export const REQUEST_STATUS_MAP = Object.fromEntries(REQUEST_STATUS.map((s) => [s.id, s]));

export const CONTRACT_STATUS = [
  { id: 'dang_vay', label: 'Trong hạn', badge: 'badge-blue' },
  { id: 'qua_han', label: 'Quá hạn', badge: 'badge-red' },
  { id: 'da_tat_toan', label: 'Đã tất toán', badge: 'badge-green' },
];
export const CONTRACT_STATUS_MAP = Object.fromEntries(CONTRACT_STATUS.map((s) => [s.id, s]));

const LOCK_AFTER_FAILS = 5;
const LOCK_MINUTES = 15;
export const NEAR_DUE_DAYS = 15;

let state = null;
const listeners = new Set();
function notify() { persist(); listeners.forEach((fn) => fn()); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getState() { return state; }
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.error('Không lưu được dữ liệu', e); }
}

/** Vá dữ liệu cũ đã lưu trong localStorage từ bản trước — thêm field mới còn thiếu để tránh lỗi (VD: allowedXom). */
function migrateState() {
  if (!state) return;
  (state.admins || []).forEach((a) => {
    if (!Array.isArray(a.allowedThon)) a.allowedThon = [];
    if (!Array.isArray(a.allowedXom)) a.allowedXom = [];
  });
}

export async function init() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { state = JSON.parse(raw); migrateState(); return; }
    catch (e) { console.warn('Dữ liệu lỗi, tạo lại dữ liệu mẫu.', e); }
  }
  await seedDemoData();
  persist();
}

export async function resetDemoData() {
  await seedDemoData();
  notify();
}

// ------------------------------------------------------------
// Mật khẩu — băm bằng Web Crypto API (SHA-256 + muối), không cần thư viện ngoài.
// Lưu ý: đây vẫn là mô hình demo (không có backend thật đứng sau).
// ------------------------------------------------------------
async function sha256Hex(text) {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function randomHex(bytes) {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function genTempPassword() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const arr = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(arr).map((b) => chars[b % chars.length]).join('');
}
async function makeCredential(plainPassword) {
  const salt = randomHex(8);
  const hash = await sha256Hex(salt + ':' + plainPassword);
  return { salt, hash };
}
async function verifyCredential(plainPassword, salt, hash) {
  return (await sha256Hex(salt + ':' + plainPassword)) === hash;
}

// ------------------------------------------------------------
// Tổ chức (thông tin quỹ tín dụng, banner) — admin chỉnh trực tiếp trong app
// ------------------------------------------------------------
export function getOrg() { return state.org; }
export function updateOrg(patch) { Object.assign(state.org, patch); notify(); }

// ------------------------------------------------------------
// Tách địa chỉ dạng "Xóm 01, thôn Bình Nguyên, xã Bình Sơn, tỉnh Quảng Ngãi"
// thành từng phần theo từ khóa đầu câu — để admin lọc/phân quyền theo Thôn/Xóm
// mà không cần người nhập liệu tự tách sẵn.
// ------------------------------------------------------------
export function parseAddress(raw) {
  const text = String(raw || '').trim();
  const withoutNote = text.replace(/\([^)]*\)/g, ''); // bỏ ghi chú kiểu "(Trước đây là: ...)"
  const parts = withoutNote.split(',').map((s) => s.trim()).filter(Boolean);
  const result = { xom: '', thon: '', xa: '', tinh: '' };
  const rest = [];
  for (const p of parts) {
    const low = p.toLowerCase();
    if (low.startsWith('xóm') || low.startsWith('xom')) result.xom = p;
    else if (low.startsWith('thôn') || low.startsWith('thon')) result.thon = p;
    else if (low.startsWith('xã') || low.startsWith('xa ') || low.startsWith('phường') || low.startsWith('thị trấn') || low.startsWith('huyện')) result.xa = p;
    else if (low.startsWith('tỉnh') || low.startsWith('tp') || low.startsWith('thành phố')) result.tinh = p;
    else rest.push(p);
  }
  // Dự phòng theo vị trí nếu không nhận ra từ khóa (địa chỉ ghi tắt, không tiền tố)
  if (!result.tinh && parts.length) result.tinh = parts[parts.length - 1];
  if (!result.xa && rest.length) result.xa = rest.shift();
  if (!result.thon && parts.length >= 2) result.thon = parts[1];
  if (!result.xom && parts.length >= 1) result.xom = parts[0];
  return result;
}

// ------------------------------------------------------------
// Khách hàng
// ------------------------------------------------------------
export function listCustomers(filters = {}) {
  let list = state.customers;
  const thonList = [].concat(filters.thon || []).filter(Boolean);
  const xomList = [].concat(filters.xom || []).filter(Boolean);
  if (thonList.length) list = list.filter((c) => thonList.includes(c.thon));
  if (xomList.length) list = list.filter((c) => xomList.includes(c.xom));
  if (filters.adminId) {
    const admin = getAdmin(filters.adminId);
    if (admin && admin.role === 'staff') {
      const allowedThon = new Set(admin.allowedThon || []);
      const allowedXom = new Set(admin.allowedXom || []);
      list = list.filter((c) => allowedThon.has(c.thon) || allowedXom.has(c.xom));
    }
  }
  return list;
}
export function getCustomer(id) { return state.customers.find((c) => c.id === id); }
export function findCustomerByCccd(cccd) { return state.customers.find((c) => c.cccd === String(cccd).trim()); }
/** Tìm khách hàng theo CCCD HOẶC số điện thoại — dùng cho đăng nhập, khách có thể dùng 1 trong 2 số. */
export function findCustomerByIdentifier(value) {
  const v = String(value || '').trim();
  const vNoSpace = v.replace(/\s/g, '');
  return state.customers.find((c) => c.cccd === v || (c.phone && c.phone.replace(/\s/g, '') === vNoSpace));
}

export function listContractsByCustomer(customerId) {
  return state.contracts.filter((c) => c.customerId === customerId).sort((a, b) => new Date(b.disbursedDate) - new Date(a.disbursedDate));
}
export function getContract(id) { return state.contracts.find((c) => c.id === id); }

export function customerOutstandingTotal(customerId) {
  return listContractsByCustomer(customerId)
    .filter((c) => effectiveContractStatus(c) !== 'da_tat_toan')
    .reduce((s, c) => s + c.balance, 0);
}

/**
 * Trạng thái THỰC TẾ của hợp đồng — tính trực tiếp từ dư nợ + ngày đến hạn,
 * không phụ thuộc trường "status" lưu sẵn (file Excel thật không có cột
 * trạng thái nên trường đó luôn là 'dang_vay' lúc nhập, không tự cập nhật
 * theo thời gian). Coi là:
 * - "Đã tất toán" nếu dư nợ ≤ 0.
 * - "Quá hạn" nếu còn dư nợ và đã qua ngày đến hạn.
 * - "Trong hạn" (id nội bộ vẫn là 'dang_vay') các trường hợp còn lại.
 */
export function effectiveContractStatus(contract, asOf = new Date()) {
  if ((contract.balance || 0) <= 0) return 'da_tat_toan';
  if (daysBetween(new Date(contract.dueDate), asOf) > 0) return 'qua_han';
  return 'dang_vay';
}

/** 'qua_han' | 'gan_den_han' | null — mức cần chú ý của 1 hợp đồng, dùng để gắn badge/lọc. */
export function contractUrgency(contract, asOf = new Date()) {
  const status = effectiveContractStatus(contract, asOf);
  if (status === 'qua_han') return 'qua_han';
  if (status === 'dang_vay') {
    const d = daysBetween(asOf, new Date(contract.dueDate));
    if (d >= 0 && d <= NEAR_DUE_DAYS) return 'gan_den_han';
  }
  return null;
}

/**
 * Số ngày tính lãi — tính bình thường (số ngày từ "Thu lãi đến ngày" tới hôm
 * nay), TRỪ trường hợp đặc biệt "Thu lãi đến ngày" = ngày giải ngân + 1 ngày
 * (quy ước thu lãi ngày đầu ngay lúc giải ngân) thì cộng thêm 1 ngày nữa.
 * VD: giải ngân 17/08, thu lãi đến ngày 18/08 (= giải ngân + 1), hôm nay
 * 19/08 -> bình thường ra 1 ngày, cộng thêm 1 ngày đặc biệt = 2 ngày.
 */
export function interestDaysAccrued(contract, asOf = new Date()) {
  const paidUntil = contract.interestPaidUntil || contract.disbursedDate;
  let days = Math.max(0, daysBetween(new Date(paidUntil), asOf));
  if (contract.disbursedDate && daysBetween(new Date(contract.disbursedDate), new Date(paidUntil)) === 1) {
    days += 1;
  }
  return days;
}
/**
 * Lãi phát sinh từ ngày đã trả lãi đến ngày hiện tại.
 * Công thức: Số dư × số ngày × lãi suất năm / 365, làm tròn đến HÀNG NGHÌN
 * gần nhất (VD: 81.500 -> 82.000; 81.350 -> 81.000).
 */
export function accruedInterest(contract, asOf = new Date()) {
  if (effectiveContractStatus(contract, asOf) === 'da_tat_toan') return 0;
  const days = interestDaysAccrued(contract, asOf);
  const raw = contract.balance * days * (contract.interestRate / 100) / 365;
  return Math.round(raw / 1000) * 1000;
}

/**
 * Đăng nhập khách hàng bằng CCCD HOẶC số điện thoại + mật khẩu.
 * ĐÃ CHUYỂN SANG SUPABASE THẬT (xem docs/supabase-migration.md) — không còn
 * kiểm tra mật khẩu ở đây nữa, mà gọi Edge Function "login" (chạy phía
 * server, an toàn dù chưa có OTP). Đúng mật khẩu thì tải luôn hồ sơ + toàn
 * bộ hợp đồng của khách đó từ Supabase vào state (THAY HẲN dữ liệu demo cũ)
 * để các màn hình khác (dashboard, chi tiết hợp đồng...) dùng lại y nguyên,
 * không cần sửa gì thêm. Vé (JWT) trả về trong "sbToken" — nơi gọi hàm này
 * (login.js) cần lưu vào session để dùng cho các lần gọi Supabase sau.
 *
 * LƯU Ý (giai đoạn chuyển tiếp): mới migrate riêng phần đăng nhập + xem hợp
 * đồng của khách hàng. Đăng nhập quản trị viên/nhân viên, yêu cầu tư vấn,
 * và mọi thao tác ghi khác VẪN đang chạy trên dữ liệu demo cục bộ như cũ —
 * sẽ chuyển tiếp ở các bước sau.
 */
export async function loginCustomer(identifier, password) {
  const res = await callLoginFunction({ role: 'customer', identifier, password });
  if (!res.ok) return { ok: false, reason: res.reason };
  await loadCustomerSessionData(res.id, res.token);
  return { ok: true, customerId: res.id, mustChangePassword: !!res.mustChangePassword, sbToken: res.token };
}

/** Tải hồ sơ + toàn bộ hợp đồng của 1 khách hàng từ Supabase, thay hoàn toàn state.customers/state.contracts. */
async function loadCustomerSessionData(customerId, token) {
  const sb = getSupabaseClient(token);
  const [{ data: custRow }, { data: contractRows }] = await Promise.all([
    sb.from('customers').select('*').eq('id', customerId).maybeSingle(),
    sb.from('contracts').select('*').eq('customer_id', customerId),
  ]);
  state.customers = custRow ? [mapCustomerRow(custRow)] : [];
  state.contracts = (contractRows || []).map(mapContractRow);
}

/** snake_case (cột Postgres) -> camelCase (đúng field app đang dùng khắp nơi). */
function mapCustomerRow(row) {
  return {
    id: row.id, cccd: row.cccd, name: row.name, phone: row.phone || '', address: row.address || '',
    thon: row.thon || '', xom: row.xom || '', xa: row.xa || '', tinh: row.tinh || '',
    salt: row.salt, hash: row.hash,
    mustChangePassword: !!row.must_change_password,
    failedAttempts: row.failed_attempts || 0,
    lockedUntil: row.locked_until ? new Date(row.locked_until).getTime() : null,
    createdAt: row.created_at,
  };
}
function mapContractRow(row) {
  return {
    id: row.id, customerId: row.customer_id, code: row.code,
    principal: Number(row.principal), balance: Number(row.balance),
    disbursedDate: row.disbursed_date, dueDate: row.due_date,
    interestRate: Number(row.interest_rate),
    interestPaidUntil: row.interest_paid_until,
  };
}

/** Kiểm tra mật khẩu hiện tại của khách hàng — dùng cho màn tự đổi mật khẩu. */
export async function verifyCustomerPassword(customerId, password) {
  const c = getCustomer(customerId);
  if (!c || !c.salt || !c.hash) return false;
  return verifyCredential(password, c.salt, c.hash);
}

export async function setCustomerPassword(customerId, newPassword, opts = {}) {
  const c = getCustomer(customerId);
  if (!c) return;
  const cred = await makeCredential(newPassword);
  c.salt = cred.salt;
  c.hash = cred.hash;
  c.mustChangePassword = !!opts.mustChangePassword;
  c.tempPassword = opts.mustChangePassword ? newPassword : null; // chỉ giữ tạm để admin xem/cấp lại
  notify();
}

/** Admin cấp lại mật khẩu cho khách — có thể tự nhập mật khẩu cụ thể, để trống thì tự sinh ngẫu nhiên. */
export async function adminResetCustomerPassword(customerId, customPassword) {
  const temp = customPassword && customPassword.trim() ? customPassword.trim() : genTempPassword();
  await setCustomerPassword(customerId, temp, { mustChangePassword: true });
  return temp;
}

/**
 * Tạo/cập nhật HỒ SƠ khách hàng (tên, SĐT, địa chỉ) — KHÔNG đụng đến tài
 * khoản đăng nhập. Dùng cho luồng nhập từ Excel: file chỉ cho biết ai đang
 * có khoản vay, không phải là nơi cấp tài khoản. Nếu khách chưa từng được
 * "Tạo User" thì hồ sơ này chưa đăng nhập được (salt/hash rỗng) — vẫn xem
 * là 1 khách hàng hợp lệ để gắn hợp đồng vào, admin có thể tạo tài khoản
 * cho họ sau bất cứ lúc nào qua nút "Tạo User" (không mất dữ liệu hợp đồng).
 */
/**
 * Phần lõi của upsertCustomerProfile — KHÔNG gọi notify(). Dùng khi cần gộp
 * nhiều thay đổi lại rồi chỉ notify() 1 lần ở cuối (VD: nhập cả trăm dòng từ
 * Excel cùng lúc — gọi notify() riêng từng dòng sẽ rất chậm vì mỗi lần đều
 * lưu localStorage + vẽ lại toàn bộ trang).
 */
function upsertCustomerProfileCore({ cccd, name, phone, address }, existing) {
  const parsed = address != null ? parseAddress(address) : null;
  const phoneClean = phone != null ? String(phone).replace(/\s/g, '') : phone;
  let c = existing !== undefined ? existing : findCustomerByCccd(cccd);
  if (c) {
    c.name = name || c.name;
    c.phone = phoneClean || c.phone;
    if (address) { c.address = address; Object.assign(c, parsed); }
    return { customer: c, isNew: false };
  }
  c = {
    id: genId('cust'), cccd: String(cccd).trim(), name: name || '', phone: phoneClean || '',
    address: address || '', ...(parsed || { xom: '', thon: '', xa: '', tinh: '' }),
    salt: null, hash: null, mustChangePassword: false, tempPassword: null,
    failedAttempts: 0, lockedUntil: null, createdAt: new Date().toISOString(),
  };
  state.customers.push(c);
  return { customer: c, isNew: true };
}
export function upsertCustomerProfile(args) {
  const result = upsertCustomerProfileCore(args);
  notify();
  return result;
}

/**
 * "Tạo User" — cấp tài khoản đăng nhập (CCCD + mật khẩu) cho 1 khách hàng.
 * Nếu CCCD đã có hồ sơ sẵn (từ Excel) thì chỉ gắn thêm tài khoản vào đúng
 * hồ sơ đó (giữ nguyên tên/địa chỉ/hợp đồng đã có) — khách đăng nhập là tự
 * thấy ngay mọi hợp đồng khớp CCCD, không cần làm gì thêm. Nếu CCCD chưa có
 * hồ sơ nào thì tạo mới (chỉ cần CCCD, tên tùy chọn — không cần địa chỉ).
 */
export async function activateCustomerAccount({ cccd, name, phone, password }) {
  const cccdTrim = String(cccd || '').trim();
  if (!cccdTrim) throw new Error('Cần nhập số CCCD');
  let c = findCustomerByCccd(cccdTrim);
  if (c && c.salt && c.hash) throw new Error('Số CCCD này đã có tài khoản Use rồi — dùng "Cấp lại mật khẩu" nếu cần đặt lại.');
  const phoneClean = phone ? String(phone).replace(/\s/g, '') : '';
  const finalPassword = password && password.trim() ? password.trim() : genTempPassword();
  const cred = await makeCredential(finalPassword);
  if (c) {
    if (name) c.name = name;
    if (phoneClean) c.phone = phoneClean;
  } else {
    c = {
      id: genId('cust'), cccd: cccdTrim, name: name || cccdTrim, phone: phoneClean,
      address: '', xom: '', thon: '', xa: '', tinh: '',
      failedAttempts: 0, lockedUntil: null, createdAt: new Date().toISOString(),
    };
    state.customers.push(c);
  }
  Object.assign(c, cred, { mustChangePassword: true, tempPassword: finalPassword, failedAttempts: 0, lockedUntil: null });
  notify();
  return { customer: c, tempPassword: finalPassword };
}

/**
 * "Xóa Use" — chỉ gỡ TÀI KHOẢN ĐĂNG NHẬP (mật khẩu/salt/hash), KHÔNG đụng gì
 * đến hồ sơ khách hàng hay hợp đồng — 2 thứ đó độc lập với tài khoản đăng
 * nhập. Khách trở lại trạng thái "chỉ có hồ sơ" như mới nhập từ Excel, admin
 * có thể "Tạo User" lại bất cứ lúc nào mà không mất dữ liệu hợp đồng.
 */
export function deactivateCustomerAccount(customerId) {
  const c = getCustomer(customerId);
  if (!c) return;
  c.salt = null; c.hash = null; c.mustChangePassword = false; c.tempPassword = null;
  c.failedAttempts = 0; c.lockedUntil = null;
  notify();
}

/** Danh sách các Thôn / Xóm đang có trong dữ liệu khách hàng (dùng để lọc & gán quyền). */
/**
 * So sánh tên Xóm kiểu "tự nhiên" theo số — Xóm thường đặt tên bằng số (có
 * khi kèm số phụ dạng "8/1", "8/2"): sắp đúng thứ tự 01, 02, 03, 08, 8/1,
 * 8/2, 09, 10... thay vì so chuỗi kiểu chữ cái (sẽ ra "01, 09, 10, 8/1..."
 * sai thứ tự vì "1" < "8" < "9" theo ký tự).
 */
function naturalXomCompare(a, b) {
  const parse = (s) => {
    const m = String(s).match(/(\d+)(?:\s*\/\s*(\d+))?/);
    return m ? [parseInt(m[1], 10), m[2] ? parseInt(m[2], 10) : 0] : [Infinity, 0];
  };
  const [aMajor, aMinor] = parse(a);
  const [bMajor, bMinor] = parse(b);
  if (aMajor !== bMajor) return aMajor - bMajor;
  if (aMinor !== bMinor) return aMinor - bMinor;
  return String(a).localeCompare(String(b), 'vi');
}
export function distinctThon() {
  return [...new Set(state.customers.map((c) => c.thon).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'vi'));
}
export function distinctXom(thon) {
  const thonList = [].concat(thon || []).filter(Boolean);
  const list = thonList.length ? state.customers.filter((c) => thonList.includes(c.thon)) : state.customers;
  return [...new Set(list.map((c) => c.xom).filter(Boolean))].sort(naturalXomCompare);
}
/** Cây Thôn -> danh sách Xóm trong thôn đó — dùng cho phân quyền nhân viên theo từng cấp. */
export function thonXomTree() {
  return distinctThon().map((thon) => ({ thon, xomList: distinctXom(thon) }));
}

/** Sinh mã hợp đồng tự động khi không có sẵn (không bắt buộc phải nhập). */
function autoContractCode(cccd) {
  const n = state.contracts.filter((c) => c.autoCode).length + 1;
  return `HD-${cccd}-${String(n).padStart(3, '0')}`;
}

/** Phần lõi của upsertContract — KHÔNG gọi notify() (xem ghi chú ở upsertCustomerProfileCore). */
function upsertContractCore({ customerId, code, principal, disbursedDate, dueDate, interestRate, balance, status, interestPaidUntil }, existing) {
  const customer = getCustomer(customerId);
  const bal = Number(balance) || 0;
  let ct = existing !== undefined ? existing : (code ? state.contracts.find((c) => c.code === code) : null);
  const data = {
    customerId,
    code: code || (ct ? ct.code : autoContractCode(customer?.cccd || customerId)),
    autoCode: !code,
    principal: principal != null && principal !== '' ? Number(principal) || 0 : bal, // mặc định = dư nợ nếu không có số tiền vay gốc
    disbursedDate,
    dueDate: dueDate || addDays(new Date(disbursedDate), 365).toISOString().slice(0, 10), // mặc định 1 năm nếu Excel không có
    interestRate: interestRate != null && interestRate !== '' ? Number(interestRate) || 0 : (ct ? ct.interestRate : 0),
    balance: bal, status: status || 'dang_vay',
    interestPaidUntil: interestPaidUntil || disbursedDate,
  };
  if (ct) { Object.assign(ct, data); }
  else { ct = { id: genId('hd'), ...data }; state.contracts.push(ct); }
  return ct;
}
export function upsertContract(args) {
  const ct = upsertContractCore(args);
  notify();
  return ct;
}

export function deleteCustomer(id) {
  state.customers = state.customers.filter((c) => c.id !== id);
  state.contracts = state.contracts.filter((c) => c.customerId !== id);
  notify();
}
export function deleteContract(id) {
  state.contracts = state.contracts.filter((c) => c.id !== id);
  pruneEmptyCustomerProfiles(); // hết hợp đồng mà chưa có tài khoản Use thì dọn luôn hồ sơ
  notify();
}

// ------------------------------------------------------------
// Nhập dữ liệu từ bảng (đọc trực tiếp file .xlsx/.xls hoặc dán dữ liệu copy
// từ Excel) — đúng thứ tự cột theo mẫu sổ theo dõi vay đang dùng:
// Số HĐTD | Người nhận nợ | Địa chỉ | Số CMND/CCCD | Số di động |
// Ngày nhận nợ | Ngày đáo hạn | Thu lãi đến ngày | Số tiền giải ngân |
// Số dư | Lãi suất
// (địa chỉ tự tách Xóm/Thôn/Tỉnh; cột nào thiếu dữ liệu sẽ tự tính/tự sinh)
// ------------------------------------------------------------
export function parseVNNumber(str) {
  let s = String(str ?? '').trim().replace(/[^\d.,-]/g, '');
  if (!s) return 0;
  // "42.500.000" kiểu VN (chấm ngăn cách hàng nghìn, đúng từng nhóm 3 số) -> bỏ chấm
  if (/^-?\d{1,3}(\.\d{3})+$/.test(s)) s = s.replace(/\./g, '');
  else if (s.includes(',') && s.includes('.')) s = s.replace(/\./g, '').replace(',', '.'); // "1.234.567,89"
  else if (s.includes(',')) s = s.replace(',', '.'); // chỉ có phẩy -> coi là dấu thập phân
  // còn lại (vd "9.5" từ ô số của Excel/JS): giữ nguyên dấu chấm làm phần thập phân
  const n = parseFloat(s);
  return Number.isFinite(n) ? n : 0;
}
export function parseVNDate(str) {
  const s = String(str || '').trim();
  const m = s.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    if (y.length === 2) y = '20' + y;
    return `${y}-${mo.padStart(2, '0')}-${d.padStart(2, '0')}`;
  }
  // Số serial ngày kiểu Excel (ô định dạng Ngày tháng khi đọc từ file .xlsx sẽ ra số thuần)
  if (/^\d{4,6}$/.test(s)) {
    const dt = new Date(Date.UTC(1899, 11, 30) + Number(s) * 86400000);
    if (!Number.isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  }
  const dt = new Date(s);
  return Number.isNaN(dt.getTime()) ? '' : dt.toISOString().slice(0, 10);
}

/**
 * Dọn hồ sơ khách hàng không còn dư nợ nào (hết hợp đồng, hoặc còn hợp đồng
 * nhưng tổng dư nợ = 0, đã tất toán hết) VÀ chưa có tài khoản Use — xóa luôn
 * khỏi mục Khách hàng, kèm dọn theo các hợp đồng dư nợ 0 còn sót của họ. Use
 * thì LUÔN giữ lại dù hết dư nợ (2 thứ độc lập với nhau).
 */
function pruneEmptyCustomerProfiles() {
  const balanceByCustomer = new Map();
  for (const ct of state.contracts) {
    balanceByCustomer.set(ct.customerId, (balanceByCustomer.get(ct.customerId) || 0) + (ct.balance || 0));
  }
  const keepIds = new Set(
    state.customers.filter((c) => (balanceByCustomer.get(c.id) || 0) > 0 || (c.salt && c.hash)).map((c) => c.id)
  );
  const before = state.customers.length;
  state.customers = state.customers.filter((c) => keepIds.has(c.id));
  state.contracts = state.contracts.filter((ct) => keepIds.has(ct.customerId));
  return before - state.customers.length;
}

const HEADER_HINTS = ['cccd', 'cmnd', 'người nhận nợ', 'nguoi nhan no', 'họ tên', 'ho ten', 'số hđtd', 'so hdtd'];
/**
 * Nhập dữ liệu hợp đồng từ Excel/dữ liệu dán — coi file/dữ liệu nhập là
 * NGUỒN SỰ THẬT mới nhất: tên/SĐT/địa chỉ luôn được cập nhật ghi đè theo
 * đúng dữ liệu vừa nhập cho MỌI khách hàng khớp CCCD (dù mới hay đã có sẵn
 * hồ sơ/tài khoản) — Use đã tạo trước cho CCCD đó lần đăng nhập sau sẽ tự
 * thấy ngay thông tin mới vì dùng chung 1 hồ sơ.
 * - CCCD CHƯA từng có trong hệ thống -> ngoài tạo hồ sơ còn tự cấp luôn tài
 *   khoản Use (mật khẩu tự sinh ngẫu nhiên, trả về trong result.newAccounts
 *   để hiện cho admin gửi khách).
 * - CCCD ĐÃ có sẵn -> chỉ cập nhật hồ sơ + hợp đồng, KHÔNG đụng đến tài
 *   khoản đăng nhập đã cấp (mật khẩu vẫn giữ nguyên).
 * Khi `fullSync` bật (dùng cho tải file Excel) — coi file là danh sách ĐẦY ĐỦ
 * hiện tại: hợp đồng nào đang có trong hệ thống mà KHÔNG xuất hiện trong
 * lần nhập này sẽ bị XÓA, để danh sách hợp đồng luôn khớp đúng file mới
 * nhất; khách hàng nào sau đó không còn dư nợ nào và cũng chưa có tài
 * khoản Use thì dọn luôn hồ sơ (xem pruneEmptyCustomerProfiles). Không bật
 * fullSync với kiểu dán tay (chỉ thêm/cập nhật, không xóa/dọn gì).
 */
export async function importFromPastedTable(text, { fullSync = false } = {}) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const result = { newProfiles: 0, newAccounts: [], existingCustomers: 0, contracts: 0, deletedContracts: 0, deletedCustomers: 0, skipped: 0, errors: [] };
  const touchedContractIds = new Set();
  // Tra cứu bằng Map (thay vì .find() quét lại toàn bộ mảng mỗi dòng) + dùng
  // bản "Core" không tự notify() từng dòng — cực kỳ quan trọng với file lớn
  // (hàng trăm/nghìn dòng): notify() lưu localStorage + vẽ lại cả trang, gọi
  // lặp lại mỗi dòng sẽ làm việc tải file chậm hẳn đi. Chỉ notify() 1 lần
  // duy nhất sau khi xử lý xong toàn bộ file.
  const customerByCccd = new Map(state.customers.map((c) => [c.cccd, c]));
  const contractByCode = new Map(state.contracts.filter((c) => c.code).map((c) => [c.code, c]));
  for (const line of lines) {
    const cells = line.includes('\t') ? line.split('\t') : line.split(',');
    if (cells.length < 2) { result.skipped++; continue; }
    const headerCheck = cells.slice(0, 2).join(' ').toLowerCase();
    if (HEADER_HINTS.some((h) => headerCheck.includes(h))) continue; // bỏ qua dòng tiêu đề

    const [code, name, address, cccdRaw, phone, disbursedDate, dueDate, interestPaidUntil, principal, balance, interestRate] = cells.map((c) => c.trim());
    const cccd = (cccdRaw || '').replace(/\s/g, '');
    if (!cccd || !/^\d{9,12}$/.test(cccd)) { result.errors.push(`Bỏ qua dòng (CCCD không hợp lệ): ${line.slice(0, 40)}...`); continue; }

    const wasNew = !customerByCccd.has(cccd);
    const { customer } = upsertCustomerProfileCore({ cccd, name, phone, address }, customerByCccd.get(cccd)); // luôn ghi đè hồ sơ theo dữ liệu mới nhất
    if (wasNew) {
      customerByCccd.set(cccd, customer);
      result.newProfiles++;
      const temp = genTempPassword();
      const cred = await makeCredential(temp);
      Object.assign(customer, cred, { mustChangePassword: true, tempPassword: temp, failedAttempts: 0, lockedUntil: null });
      result.newAccounts.push({ name: customer.name, cccd: customer.cccd, tempPassword: temp });
    } else {
      result.existingCustomers++;
    }

    const disbursed = parseVNDate(disbursedDate) || new Date().toISOString().slice(0, 10);
    const ct = upsertContractCore({
      customerId: customer.id, code: code || null,
      principal: principal ? parseVNNumber(principal) : null, disbursedDate: disbursed,
      dueDate: dueDate ? parseVNDate(dueDate) : null,
      interestRate: interestRate ? parseVNNumber(interestRate) : null,
      balance: parseVNNumber(balance), status: 'dang_vay',
      interestPaidUntil: parseVNDate(interestPaidUntil) || disbursed,
    }, code ? contractByCode.get(code) : null);
    contractByCode.set(ct.code, ct);
    touchedContractIds.add(ct.id);
    result.contracts++;
  }
  if (fullSync) {
    const before = state.contracts.length;
    state.contracts = state.contracts.filter((ct) => touchedContractIds.has(ct.id));
    result.deletedContracts = before - state.contracts.length;
    result.deletedCustomers = pruneEmptyCustomerProfiles();
  }
  notify(); // 1 lần duy nhất cho cả lần nhập, dù fullSync hay dán tay
  return result;
}

// ------------------------------------------------------------
// Quản trị viên
// ------------------------------------------------------------
/**
 * Đăng nhập quản trị viên/nhân viên — ĐÃ CHUYỂN SANG SUPABASE THẬT, cùng cơ
 * chế với loginCustomer() (xem ghi chú ở đó). Đúng mật khẩu thì tải toàn bộ
 * admins/customers/contracts từ Supabase vào state — RLS tự lọc đúng phạm
 * vi (nhân viên chỉ thấy khách trong Thôn/Xóm được gán, quản trị toàn
 * quyền thấy hết), y hệt logic phân quyền client-side cũ, chỉ khác là giờ
 * chặn được thật ở tầng server chứ không chỉ ẩn trên giao diện.
 */
export async function loginAdmin(username, password) {
  const res = await callLoginFunction({ role: 'admin', identifier: username, password });
  if (!res.ok) return { ok: false, reason: res.reason };
  await loadAdminSessionData(res.token);
  return { ok: true, adminId: res.id, sbToken: res.token };
}

async function loadAdminSessionData(token) {
  const sb = getSupabaseClient(token);
  const [{ data: adminRows }, { data: customerRows }, { data: contractRows }] = await Promise.all([
    sb.from('admins').select('*'),
    sb.from('customers').select('*'),
    sb.from('contracts').select('*'),
  ]);
  state.admins = (adminRows || []).map(mapAdminRow);
  state.customers = (customerRows || []).map(mapCustomerRow);
  state.contracts = (contractRows || []).map(mapContractRow);
}

function mapAdminRow(row) {
  return {
    id: row.id, username: row.username, name: row.name, role: row.role,
    allowedThon: row.allowed_thon || [], allowedXom: row.allowed_xom || [],
    salt: row.salt, hash: row.hash, createdAt: row.created_at,
  };
}
export function getAdmin(id) { return state.admins.find((a) => a.id === id); }
export function listAdmins() { return state.admins; }
export function isSuperAdmin(id) { return getAdmin(id)?.role === 'super'; }

/**
 * Tạo tài khoản quản trị (role 'super' toàn quyền hoặc 'staff' chỉ xem) —
 * có tên đăng nhập + mật khẩu (tự sinh nếu không nhập) + phân quyền xem ngay
 * trong lúc tạo (chỉ áp dụng cho 'staff'). Phân quyền 2 cấp: allowedThon
 * (xem trọn cả Thôn, gồm mọi Xóm trong đó) và allowedXom (chỉ xem riêng 1
 * vài Xóm cụ thể dù Thôn chứa nó không được cấp trọn).
 */
export async function addStaffAdmin({ username, name, password, role, allowedThon, allowedXom }) {
  const uname = String(username || '').trim();
  if (!uname) throw new Error('Cần nhập tên đăng nhập');
  if (state.admins.some((a) => a.username === uname)) throw new Error('Tên đăng nhập đã tồn tại');
  const finalRole = role === 'super' ? 'super' : 'staff';
  const finalPassword = password && password.trim() ? password.trim() : genTempPassword();
  const cred = await makeCredential(finalPassword);
  const staff = {
    id: genId('staff'), username: uname, name: name || uname, role: finalRole,
    allowedThon: finalRole === 'staff' && Array.isArray(allowedThon) ? allowedThon : [],
    allowedXom: finalRole === 'staff' && Array.isArray(allowedXom) ? allowedXom : [],
    ...cred, createdAt: new Date().toISOString(),
  };
  state.admins.push(staff);
  notify();
  return { staff, tempPassword: finalPassword };
}
export function updateStaffPermissions(id, allowedThon, allowedXom) {
  const a = getAdmin(id);
  if (!a || a.role !== 'staff') return;
  a.allowedThon = Array.isArray(allowedThon) ? allowedThon : [];
  a.allowedXom = Array.isArray(allowedXom) ? allowedXom : [];
  notify();
}
/** Cấp lại mật khẩu cho quản trị viên/nhân viên — có thể tự nhập mật khẩu cụ thể, để trống thì tự sinh ngẫu nhiên. */
export async function resetStaffPassword(id, customPassword) {
  const a = getAdmin(id);
  if (!a) throw new Error('Không tìm thấy tài khoản');
  const temp = customPassword && customPassword.trim() ? customPassword.trim() : genTempPassword();
  const cred = await makeCredential(temp);
  a.salt = cred.salt;
  a.hash = cred.hash;
  notify();
  return temp;
}
/** Kiểm tra mật khẩu hiện tại của quản trị viên/nhân viên — dùng cho màn tự đổi mật khẩu. */
export async function verifyAdminPassword(id, password) {
  const a = getAdmin(id);
  if (!a || !a.salt || !a.hash) return false;
  return verifyCredential(password, a.salt, a.hash);
}

/** Tự đổi mật khẩu (Quản trị viên/nhân viên tự đặt mật khẩu mới cho chính mình). */
export async function setStaffPassword(id, newPassword) {
  const a = getAdmin(id);
  if (!a) throw new Error('Không tìm thấy tài khoản');
  const cred = await makeCredential(newPassword);
  a.salt = cred.salt;
  a.hash = cred.hash;
  notify();
}
export function deleteStaffAdmin(id) {
  const a = getAdmin(id);
  if (!a) return;
  if (a.role === 'super' && state.admins.filter((x) => x.role === 'super').length <= 1) return; // luôn giữ lại ít nhất 1 quản trị viên toàn quyền
  state.admins = state.admins.filter((x) => x.id !== id);
  notify();
}
/** Tài khoản khách hàng có đang bị tạm khóa hay không (do nhập sai mật khẩu nhiều lần). */
export function isCustomerLocked(c) { return !!(c.lockedUntil && c.lockedUntil > Date.now()); }

// ------------------------------------------------------------
// Yêu cầu tư vấn / mở khoản vay
// ------------------------------------------------------------
export function listRequests(filters = {}) {
  let list = [...state.requests];
  if (filters.customerId) list = list.filter((r) => r.customerId === filters.customerId);
  if (filters.status && filters.status !== 'all') list = list.filter((r) => r.status === filters.status);
  return list.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
}
export function createRequest({ customerId, type, amount, purpose, termMonths, note }) {
  const req = {
    id: genId('yc'), customerId, type, amount: Number(amount) || 0, purpose: purpose || '',
    termMonths: Number(termMonths) || null, note: note || '', status: 'moi',
    createdAt: new Date().toISOString(),
  };
  state.requests.push(req);
  notify();
  return req;
}
export function updateRequestStatus(id, status) {
  const r = state.requests.find((x) => x.id === id);
  if (r) { r.status = status; notify(); }
}

// ------------------------------------------------------------
// Session (đăng nhập hiện tại)
// ------------------------------------------------------------
export function getSession() { return state.session; }
export function setSession(session) { state.session = session; notify(); }
export function logout() { state.session = null; notify(); }

// ============================================================
// Sinh dữ liệu DEMO — toàn bộ tên/CCCD/số liệu dưới đây là GIẢ,
// không liên quan đến bất kỳ khách hàng thật nào.
// ============================================================
async function seedDemoData() {
  const rng = mulberry32(7717);
  const org = {
    name: 'Quỹ Tín Dụng Nhân Dân Bình Nguyên',
    shortName: 'QTD Bình Nguyên',
    hotline: '1900 000 000',
    address: '01 Đường Mẫu, Phường Trung Tâm, Tỉnh Demo',
    bannerEnabled: true,
    bannerTitle: 'Ưu đãi lãi suất vay tiêu dùng',
    bannerText: 'Liên hệ quầy giao dịch hoặc gửi yêu cầu tư vấn ngay trên ứng dụng để được hỗ trợ.',
    // Thông tin nhận thanh toán — HIỂN THỊ CHO KHÁCH HÀNG THẬT, cần admin xác minh lại tại Cài đặt.
    bankBin: '970446', // Ngân hàng Hợp tác xã Việt Nam (Co-op Bank) — kiểm tra lại tại vietqr.io trước khi dùng thật
    bankName: 'Ngân hàng Hợp tác xã Việt Nam (Co-op Bank)',
    bankAccountNo: '5200000000825012',
    bankAccountName: 'QUY TIN DUNG NHAN DAN BINH NGUYEN',
  };

  const adminCred = await makeCredential('Admin@123');
  const staffCred = await makeCredential('Staff@123');
  const admins = [
    { id: 'admin_1', username: 'admin', name: 'Quản trị viên', role: 'super', allowedThon: [], allowedXom: [], ...adminCred },
    { id: 'staff_1', username: 'nhanvien1', name: 'Nhân viên địa bàn Thôn 1', role: 'staff', allowedThon: ['Thôn 1'], allowedXom: [], ...staffCred, createdAt: new Date().toISOString() },
  ];

  const demoDefs = [
    ['079300012345', 'Trần Văn Mẫu', '0901 000 001', 'Xóm A, Thôn 1, Tỉnh Demo'],
    ['079300012346', 'Nguyễn Thị Mẫu', '0901 000 002', 'Xóm B, Thôn 1, Tỉnh Demo'],
    ['079300012347', 'Lê Văn Ví Dụ', '0901 000 003', 'Xóm A, Thôn 2, Tỉnh Demo'],
    ['079300012348', 'Phạm Thị Ví Dụ', '0901 000 004', 'Xóm B, Thôn 2, Tỉnh Demo'],
  ];
  const customers = [];
  for (const [cccd, name, phone, address] of demoDefs) {
    const temp = 'Demo@123';
    const cred = await makeCredential(temp);
    customers.push({
      id: genId('cust'), cccd, name, phone, address, ...parseAddress(address),
      ...cred, mustChangePassword: true, tempPassword: temp,
      failedAttempts: 0, lockedUntil: null, createdAt: new Date().toISOString(),
    });
  }

  const contracts = [];
  const now = new Date();
  customers.forEach((c, i) => {
    const nContracts = i === 0 ? 2 : 1; // khách đầu tiên có nhiều hợp đồng để minh họa
    for (let k = 0; k < nContracts; k++) {
      const principal = randInt(rng, 20, 150) * 1_000_000;
      const disbursed = addDays(now, -randInt(rng, 30, 400));
      const due = addDays(disbursed, randInt(rng, 6, 24) * 30);
      // Trạng thái phải khớp với ngày đến hạn để dữ liệu demo hợp lý
      const isPastDue = due < now;
      const status = isPastDue
        ? (rng() < 0.65 ? 'qua_han' : 'da_tat_toan')
        : (rng() < 0.85 ? 'dang_vay' : 'da_tat_toan');
      contracts.push({
        id: genId('hd'), customerId: c.id,
        code: `HD${2026}${String(1000 + contracts.length)}`,
        principal, disbursedDate: disbursed.toISOString().slice(0, 10),
        dueDate: due.toISOString().slice(0, 10),
        interestRate: [8.5, 9.2, 10.0][randInt(rng, 0, 2)],
        balance: status === 'da_tat_toan' ? 0 : Math.round((principal * (0.3 + rng() * 0.7)) / 100000) * 100000,
        status,
        // Giả lập lần đóng lãi gần nhất: cách đây một số ngày (0-45 ngày), không vượt quá ngày giải ngân
        interestPaidUntil: (() => {
          const lastPaid = addDays(now, -randInt(rng, 0, 45));
          return (lastPaid < disbursed ? disbursed : lastPaid).toISOString().slice(0, 10);
        })(),
      });
    }
  });

  const requests = [
    {
      id: genId('yc'), customerId: customers[1].id, type: 'vay_moi', amount: 50_000_000,
      purpose: 'Bổ sung vốn kinh doanh', termMonths: 12, note: '',
      status: 'moi', createdAt: addDays(now, -1).toISOString(),
    },
    {
      id: genId('yc'), customerId: customers[2].id, type: 'tu_van', amount: 0,
      purpose: 'Hỏi về lãi suất tất toán trước hạn', termMonths: null, note: 'Muốn tất toán hợp đồng HD20261000',
      status: 'dang_xu_ly', createdAt: addDays(now, -3).toISOString(),
    },
  ];

  state = { org, admins, customers, contracts, requests, session: null };
}
