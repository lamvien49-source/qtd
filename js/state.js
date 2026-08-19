// ============================================================
// Lớp dữ liệu & nghiệp vụ trung tâm (state) — BẢN DEMO, lưu trong
// localStorage của trình duyệt. KHÔNG kết nối database thật, KHÔNG
// dùng để vận hành thật — chỉ minh họa giao diện & luồng nghiệp vụ.
// Toàn bộ dữ liệu khách hàng trong file này là dữ liệu GIẢ.
// ============================================================
import { genId, mulberry32, randInt, addDays, daysBetween } from './utils.js';

export const STORAGE_KEY = 'qtd_demo_v2';

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
  { id: 'dang_vay', label: 'Đang vay', badge: 'badge-blue' },
  { id: 'qua_han', label: 'Quá hạn', badge: 'badge-red' },
  { id: 'da_tat_toan', label: 'Đã tất toán', badge: 'badge-green' },
];
export const CONTRACT_STATUS_MAP = Object.fromEntries(CONTRACT_STATUS.map((s) => [s.id, s]));

const LOCK_AFTER_FAILS = 5;
const LOCK_MINUTES = 15;

let state = null;
const listeners = new Set();
function notify() { persist(); listeners.forEach((fn) => fn()); }
export function subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }
export function getState() { return state; }
function persist() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(state)); }
  catch (e) { console.error('Không lưu được dữ liệu', e); }
}

export async function init() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (raw) {
    try { state = JSON.parse(raw); return; }
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
// Khách hàng
// ------------------------------------------------------------
export function listCustomers(filters = {}) {
  let list = state.customers;
  if (filters.thon) list = list.filter((c) => c.thon === filters.thon);
  if (filters.xom) list = list.filter((c) => c.xom === filters.xom);
  if (filters.adminId) {
    const admin = getAdmin(filters.adminId);
    if (admin && admin.role === 'staff') {
      const allowed = new Set(admin.allowedThon || []);
      list = list.filter((c) => allowed.has(c.thon));
    }
  }
  return list;
}
export function getCustomer(id) { return state.customers.find((c) => c.id === id); }
export function findCustomerByCccd(cccd) { return state.customers.find((c) => c.cccd === String(cccd).trim()); }

export function listContractsByCustomer(customerId) {
  return state.contracts.filter((c) => c.customerId === customerId).sort((a, b) => new Date(b.disbursedDate) - new Date(a.disbursedDate));
}
export function getContract(id) { return state.contracts.find((c) => c.id === id); }

export function customerOutstandingTotal(customerId) {
  return listContractsByCustomer(customerId)
    .filter((c) => c.status !== 'da_tat_toan')
    .reduce((s, c) => s + c.balance, 0);
}

/**
 * Lãi phát sinh từ ngày đã trả lãi đến ngày hiện tại.
 * Công thức: Số dư × số ngày × lãi suất năm / 365
 */
export function accruedInterest(contract, asOf = new Date()) {
  if (contract.status === 'da_tat_toan') return 0;
  const from = contract.interestPaidUntil || contract.disbursedDate;
  const days = Math.max(0, daysBetween(new Date(from), asOf));
  return Math.round(contract.balance * days * (contract.interestRate / 100) / 365);
}

/** Đăng nhập khách hàng bằng CCCD + mật khẩu. */
export async function loginCustomer(cccd, password) {
  const c = findCustomerByCccd(cccd);
  if (!c) return { ok: false, reason: 'Không tìm thấy tài khoản với số CCCD này.' };
  if (c.lockedUntil && c.lockedUntil > Date.now()) {
    const mins = Math.ceil((c.lockedUntil - Date.now()) / 60000);
    return { ok: false, reason: `Tài khoản tạm khóa do nhập sai nhiều lần. Thử lại sau ${mins} phút.` };
  }
  const ok = await verifyCredential(password, c.salt, c.hash);
  if (!ok) {
    c.failedAttempts = (c.failedAttempts || 0) + 1;
    if (c.failedAttempts >= LOCK_AFTER_FAILS) {
      c.lockedUntil = Date.now() + LOCK_MINUTES * 60000;
      c.failedAttempts = 0;
    }
    notify();
    return { ok: false, reason: 'Số CCCD hoặc mật khẩu không đúng.' };
  }
  c.failedAttempts = 0;
  c.lockedUntil = null;
  notify();
  return { ok: true, customerId: c.id, mustChangePassword: !!c.mustChangePassword };
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

export async function adminResetCustomerPassword(customerId) {
  const temp = genTempPassword();
  await setCustomerPassword(customerId, temp, { mustChangePassword: true });
  return temp;
}

export async function upsertCustomer({ cccd, name, phone, xom, thon, tinh }) {
  let c = findCustomerByCccd(cccd);
  if (c) {
    c.name = name || c.name;
    c.phone = phone || c.phone;
    if (xom) c.xom = xom;
    if (thon) c.thon = thon;
    if (tinh) c.tinh = tinh;
    notify();
    return { customer: c, isNew: false, tempPassword: null };
  }
  const temp = genTempPassword();
  const cred = await makeCredential(temp);
  c = {
    id: genId('cust'), cccd: String(cccd).trim(), name, phone: phone || '',
    xom: xom || '', thon: thon || '', tinh: tinh || '',
    salt: cred.salt, hash: cred.hash, mustChangePassword: true, tempPassword: temp,
    failedAttempts: 0, lockedUntil: null, createdAt: new Date().toISOString(),
  };
  state.customers.push(c);
  notify();
  return { customer: c, isNew: true, tempPassword: temp };
}

/** Danh sách các Thôn / Xóm đang có trong dữ liệu khách hàng (dùng để lọc & gán quyền). */
export function distinctThon() {
  return [...new Set(state.customers.map((c) => c.thon).filter(Boolean))].sort();
}
export function distinctXom(thon) {
  const list = thon ? state.customers.filter((c) => c.thon === thon) : state.customers;
  return [...new Set(list.map((c) => c.xom).filter(Boolean))].sort();
}

export function upsertContract({ customerId, code, principal, disbursedDate, dueDate, interestRate, balance, status, termMonths, interestPaidUntil }) {
  let ct = state.contracts.find((c) => c.code === code);
  const data = {
    customerId, code, principal: Number(principal) || 0,
    disbursedDate, dueDate, interestRate: Number(interestRate) || 0,
    balance: Number(balance) || 0, status: status || 'dang_vay',
    termMonths: Number(termMonths) || null,
    interestPaidUntil: interestPaidUntil || disbursedDate,
  };
  if (ct) { Object.assign(ct, data); }
  else { ct = { id: genId('hd'), ...data }; state.contracts.push(ct); }
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
  notify();
}

// ------------------------------------------------------------
// Nhập dữ liệu từ bảng (đọc trực tiếp file .xlsx hoặc dán dữ liệu copy từ Excel)
// Định dạng mỗi dòng (phân cách bằng Tab hoặc dấu phẩy):
// CCCD | Họ tên | SĐT | Xóm | Thôn | Tỉnh | Mã hợp đồng | Số tiền vay | Ngày vay | Ngày đến hạn | Lãi suất(%) | Dư nợ | Đã trả lãi đến ngày
// ------------------------------------------------------------
export function parseVNNumber(str) {
  const cleaned = String(str || '').replace(/[^\d.,-]/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(cleaned);
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

const HEADER_HINTS = ['cccd', 'cmnd', 'họ tên', 'ho ten', 'mã hợp đồng', 'ma hop dong'];
export async function importFromPastedTable(text) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const result = { createdCustomers: [], updatedCustomers: 0, contracts: 0, skipped: 0, errors: [] };
  for (const line of lines) {
    const cells = line.includes('\t') ? line.split('\t') : line.split(',');
    if (cells.length < 2) { result.skipped++; continue; }
    const first = cells[0].toLowerCase();
    if (HEADER_HINTS.some((h) => first.includes(h))) continue; // bỏ qua dòng tiêu đề

    const [cccd, name, phone, xom, thon, tinh, code, principal, disbursedDate, dueDate, interestRate, balance, interestPaidUntil] = cells.map((c) => c.trim());
    if (!cccd || !/^\d{9,12}$/.test(cccd.replace(/\s/g, ''))) { result.errors.push(`Bỏ qua dòng (CCCD không hợp lệ): ${line.slice(0, 40)}...`); continue; }

    const { customer, isNew, tempPassword } = await upsertCustomer({ cccd: cccd.replace(/\s/g, ''), name, phone, xom, thon, tinh });
    if (isNew) result.createdCustomers.push({ cccd: customer.cccd, name: customer.name, tempPassword });
    else result.updatedCustomers++;

    if (code) {
      const disbursed = parseVNDate(disbursedDate) || new Date().toISOString().slice(0, 10);
      upsertContract({
        customerId: customer.id, code,
        principal: parseVNNumber(principal), disbursedDate: disbursed,
        dueDate: parseVNDate(dueDate), interestRate: parseVNNumber(interestRate),
        balance: parseVNNumber(balance || principal), status: 'dang_vay',
        interestPaidUntil: parseVNDate(interestPaidUntil) || disbursed,
      });
      result.contracts++;
    }
  }
  return result;
}

// ------------------------------------------------------------
// Quản trị viên
// ------------------------------------------------------------
export async function loginAdmin(username, password) {
  const a = state.admins.find((x) => x.username === username.trim());
  if (!a) return { ok: false, reason: 'Sai tài khoản hoặc mật khẩu.' };
  const ok = await verifyCredential(password, a.salt, a.hash);
  if (!ok) return { ok: false, reason: 'Sai tài khoản hoặc mật khẩu.' };
  return { ok: true, adminId: a.id };
}
export function getAdmin(id) { return state.admins.find((a) => a.id === id); }
export function listAdmins() { return state.admins; }
export function isSuperAdmin(id) { return getAdmin(id)?.role === 'super'; }

/** Quản trị viên (role 'super') tạo tài khoản nhân viên (role 'staff'), giới hạn xem theo danh sách Thôn. */
export async function addStaffAdmin({ username, name, allowedThon }) {
  const uname = String(username || '').trim();
  if (!uname) throw new Error('Cần nhập tên đăng nhập');
  if (state.admins.some((a) => a.username === uname)) throw new Error('Tên đăng nhập đã tồn tại');
  const temp = genTempPassword();
  const cred = await makeCredential(temp);
  const staff = {
    id: genId('staff'), username: uname, name: name || uname, role: 'staff',
    allowedThon: Array.isArray(allowedThon) ? allowedThon : [],
    ...cred, createdAt: new Date().toISOString(),
  };
  state.admins.push(staff);
  notify();
  return { staff, tempPassword: temp };
}
export function updateStaffPermissions(id, allowedThon) {
  const a = getAdmin(id);
  if (!a || a.role !== 'staff') return;
  a.allowedThon = Array.isArray(allowedThon) ? allowedThon : [];
  notify();
}
export async function resetStaffPassword(id) {
  const a = getAdmin(id);
  if (!a) throw new Error('Không tìm thấy tài khoản');
  const temp = genTempPassword();
  const cred = await makeCredential(temp);
  a.salt = cred.salt;
  a.hash = cred.hash;
  notify();
  return temp;
}
export function deleteStaffAdmin(id) {
  const a = getAdmin(id);
  if (!a || a.role !== 'staff') return; // không cho xóa tài khoản quản trị chính
  state.admins = state.admins.filter((x) => x.id !== id);
  notify();
}

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
    { id: 'admin_1', username: 'admin', name: 'Quản trị viên', role: 'super', allowedThon: [], ...adminCred },
    { id: 'staff_1', username: 'nhanvien1', name: 'Nhân viên địa bàn Thôn 1', role: 'staff', allowedThon: ['Thôn 1'], ...staffCred, createdAt: new Date().toISOString() },
  ];

  const demoDefs = [
    ['079300012345', 'Trần Văn Mẫu', '0901 000 001', 'Xóm A', 'Thôn 1', 'Tỉnh Demo'],
    ['079300012346', 'Nguyễn Thị Mẫu', '0901 000 002', 'Xóm B', 'Thôn 1', 'Tỉnh Demo'],
    ['079300012347', 'Lê Văn Ví Dụ', '0901 000 003', 'Xóm A', 'Thôn 2', 'Tỉnh Demo'],
    ['079300012348', 'Phạm Thị Ví Dụ', '0901 000 004', 'Xóm B', 'Thôn 2', 'Tỉnh Demo'],
  ];
  const customers = [];
  for (const [cccd, name, phone, xom, thon, tinh] of demoDefs) {
    const temp = 'Demo@123';
    const cred = await makeCredential(temp);
    customers.push({
      id: genId('cust'), cccd, name, phone, xom, thon, tinh,
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
        termMonths: randInt(rng, 6, 24),
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
