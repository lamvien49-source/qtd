// Edge Function GỘP CHUNG (1 function duy nhất, đỡ phải deploy nhiều chỗ) —
// xử lý: đăng nhập, tạo/xóa/sửa tài khoản khách hàng & quản trị viên, và
// nhập dữ liệu Excel. Toàn bộ logic nhạy cảm (băm/so mật khẩu, cấp JWT, ghi
// database) chạy Ở ĐÂY (server), KHÔNG chạy trong trình duyệt — dùng
// service_role key không lộ ra ngoài. Xem docs/supabase-migration.md.
//
// Cách gọi: POST body luôn có field "type":
//   { type: 'login', role: 'customer'|'admin', identifier, password }
//     -> PHẢI gọi trước để lấy JWT — không cần JWT sẵn có.
//   Tất cả các "type" còn lại BẮT BUỘC header Authorization: Bearer <JWT>
//   của 1 admin role='super' (xác minh lại tại server, không tin JWT mù):
//     { type: 'customer', cccd, name?, phone?, password? }
//     { type: 'staff', username, name?, password?, role, allowedThon?, allowedXom? }
//     { type: 'update-customer-profile', cccd, name?, phone?, address? }
//     { type: 'reset-customer-password', customerId, password? }
//     { type: 'deactivate-customer', customerId }
//     { type: 'delete-customer', customerId }
//     { type: 'delete-contract', contractId }
//     { type: 'reset-staff-password', staffId, password? }
//     { type: 'update-staff-permissions', staffId, allowedThon?, allowedXom? }
//     { type: 'delete-staff', staffId }
//     { type: 'import', fullSync, rows: [...] } — nhập Excel/dán tay hàng loạt
// password bỏ trống thì tự sinh mật khẩu tạm ngẫu nhiên (trả về trong response).

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const JWT_SECRET = Deno.env.get('CUSTOM_JWT_SECRET')!;

const LOCK_AFTER_FAILS = 5;
const LOCK_MINUTES = 15;
const SESSION_HOURS = 8;

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

// ---------- Mật khẩu — GIỐNG HỆT thuật toán trong js/state.js ----------
async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function randomHex(bytes: number): string {
  const arr = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(arr).map((b) => b.toString(16).padStart(2, '0')).join('');
}
function genTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  const arr = crypto.getRandomValues(new Uint8Array(8));
  return Array.from(arr).map((b) => chars[b % chars.length]).join('');
}
async function makeCredential(plainPassword: string): Promise<{ salt: string; hash: string }> {
  const salt = randomHex(8);
  const hash = await sha256Hex(salt + ':' + plainPassword);
  return { salt, hash };
}
async function verifyCredential(password: string, salt: string, hash: string): Promise<boolean> {
  return (await sha256Hex(salt + ':' + password)) === hash;
}
function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
function addDaysISO(iso: string, n: number): string {
  const dt = new Date(iso);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Y hệt parseAddress trong js/state.js. */
function parseAddress(raw: string) {
  const text = String(raw || '').trim();
  const withoutNote = text.replace(/\([^)]*\)/g, '');
  const parts = withoutNote.split(',').map((s) => s.trim()).filter(Boolean);
  const result = { xom: '', thon: '', xa: '', tinh: '' } as Record<string, string>;
  const rest: string[] = [];
  for (const p of parts) {
    const low = p.toLowerCase();
    if (low.startsWith('xóm') || low.startsWith('xom')) result.xom = p;
    else if (low.startsWith('thôn') || low.startsWith('thon')) result.thon = p;
    else if (low.startsWith('xã') || low.startsWith('xa ') || low.startsWith('phường') || low.startsWith('thị trấn') || low.startsWith('huyện')) result.xa = p;
    else if (low.startsWith('tỉnh') || low.startsWith('tp') || low.startsWith('thành phố')) result.tinh = p;
    else rest.push(p);
  }
  if (!result.tinh && parts.length) result.tinh = parts[parts.length - 1];
  if (!result.xa && rest.length) result.xa = rest.shift()!;
  if (!result.thon && parts.length >= 2) result.thon = parts[1];
  if (!result.xom && parts.length >= 1) result.xom = parts[0];
  return result;
}

// ---------- JWT tự ký/tự xác minh (không dùng Supabase Auth/auth.users thật) ----------
function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}
function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
async function signJwt(payload: Record<string, unknown>): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(payload));
  const toSign = `${encHeader}.${encPayload}`;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign));
  return `${toSign}.${base64url(new Uint8Array(sigBuf))}`;
}
async function verifyJwt(token: string): Promise<Record<string, any> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encHeader, encPayload, encSig] = parts;
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(JWT_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
  const ok = await crypto.subtle.verify('HMAC', key, base64urlDecode(encSig), new TextEncoder().encode(`${encHeader}.${encPayload}`));
  if (!ok) return null;
  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(encPayload)));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, reason: 'Method not allowed' }, 405);

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: 'Yêu cầu không hợp lệ.' }, 400);
  }

  // ===== type: 'login' — KHÔNG cần JWT sẵn có, đây là chỗ tạo ra JWT =====
  if (body.type === 'login') {
    const { role, identifier, password } = body;
    if (!identifier || !password || (role !== 'customer' && role !== 'admin')) {
      return json({ ok: false, reason: 'Thiếu thông tin đăng nhập.' }, 400);
    }
    const table = role === 'customer' ? 'customers' : 'admins';
    const idTrim = String(identifier).trim();

    let row: Record<string, any> | null = null;
    if (role === 'customer') {
      const noSpace = idTrim.replace(/\s/g, '');
      const { data, error } = await admin.from('customers').select('*');
      if (error) { console.error('query customers error:', error); return json({ ok: false, reason: 'Lỗi hệ thống, thử lại sau.' }, 500); }
      row = (data || []).find((c) => c.cccd === idTrim || (c.phone && c.phone.replace(/\s/g, '') === noSpace)) || null;
    } else {
      const { data, error } = await admin.from('admins').select('*').eq('username', idTrim).maybeSingle();
      if (error) { console.error('query admins error:', error); return json({ ok: false, reason: 'Lỗi hệ thống, thử lại sau.' }, 500); }
      row = data;
    }

    const notFoundMsg = role === 'customer' ? 'Không tìm thấy tài khoản với số CCCD/số điện thoại này.' : 'Sai tên đăng nhập hoặc mật khẩu.';
    if (!row) return json({ ok: false, reason: notFoundMsg });
    if (!row.salt || !row.hash) return json({ ok: false, reason: 'Tài khoản này chưa được cấp mật khẩu đăng nhập — liên hệ quỹ tín dụng.' });
    if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
      const mins = Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 60000);
      return json({ ok: false, reason: `Tài khoản tạm khóa do nhập sai nhiều lần. Thử lại sau ${mins} phút.` });
    }

    const okPw = await verifyCredential(password, row.salt, row.hash);
    if (!okPw) {
      const failedAttempts = (row.failed_attempts || 0) + 1;
      const patch: Record<string, unknown> = { failed_attempts: failedAttempts };
      if (failedAttempts >= LOCK_AFTER_FAILS) { patch.locked_until = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString(); patch.failed_attempts = 0; }
      await admin.from(table).update(patch).eq('id', row.id);
      return json({ ok: false, reason: role === 'customer' ? 'Số CCCD/số điện thoại hoặc mật khẩu không đúng.' : 'Sai tên đăng nhập hoặc mật khẩu.' });
    }

    await admin.from(table).update({ failed_attempts: 0, locked_until: null }).eq('id', row.id);

    const now = Math.floor(Date.now() / 1000);
    const token = await signJwt({
      sub: row.auth_user_id, role: 'authenticated', app_role: role, row_id: row.id,
      iat: now, exp: now + SESSION_HOURS * 3600,
    });
    return json({ ok: true, token, id: row.id, mustChangePassword: role === 'customer' ? !!row.must_change_password : false });
  }

  // ===== Mọi type khác: bắt buộc JWT admin role='super' =====
  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const claims = token ? await verifyJwt(token) : null;
  if (!claims || claims.app_role !== 'admin') {
    return json({ ok: false, reason: 'Chưa đăng nhập hoặc phiên đã hết hạn.' }, 401);
  }
  const { data: callerAdmin, error: callerErr } = await admin.from('admins').select('*').eq('id', claims.row_id).maybeSingle();
  if (callerErr || !callerAdmin || callerAdmin.role !== 'super') {
    return json({ ok: false, reason: 'Chỉ quản trị viên toàn quyền mới được thực hiện thao tác này.' }, 403);
  }

  if (body.type === 'customer') {
    const cccd = String(body.cccd || '').trim();
    if (!cccd) return json({ ok: false, reason: 'Cần nhập số CCCD.' }, 400);
    const phone = body.phone ? String(body.phone).replace(/\s/g, '') : '';
    const finalPassword = body.password && String(body.password).trim() ? String(body.password).trim() : genTempPassword();
    const cred = await makeCredential(finalPassword);

    const { data: existing } = await admin.from('customers').select('*').eq('cccd', cccd).maybeSingle();
    if (existing && existing.salt && existing.hash) {
      return json({ ok: false, reason: 'Số CCCD này đã có tài khoản rồi — dùng chức năng cấp lại mật khẩu nếu cần đặt lại.' }, 409);
    }

    let customerId: string;
    if (existing) {
      customerId = existing.id;
      const patch: Record<string, unknown> = { ...cred, must_change_password: true, failed_attempts: 0, locked_until: null };
      if (body.name) patch.name = body.name;
      if (phone) patch.phone = phone;
      const { error } = await admin.from('customers').update(patch).eq('id', customerId);
      if (error) return json({ ok: false, reason: 'Lỗi hệ thống, thử lại sau.' }, 500);
    } else {
      customerId = genId('cust');
      const { error } = await admin.from('customers').insert({
        id: customerId, cccd, name: body.name || cccd, phone,
        salt: cred.salt, hash: cred.hash, must_change_password: true,
        failed_attempts: 0, locked_until: null,
      });
      if (error) return json({ ok: false, reason: 'Lỗi hệ thống, thử lại sau.' }, 500);
    }
    return json({ ok: true, id: customerId, tempPassword: finalPassword });
  }

  if (body.type === 'staff') {
    const username = String(body.username || '').trim();
    if (!username) return json({ ok: false, reason: 'Cần nhập tên đăng nhập.' }, 400);
    const { data: existing } = await admin.from('admins').select('id').eq('username', username).maybeSingle();
    if (existing) return json({ ok: false, reason: 'Tên đăng nhập đã tồn tại.' }, 409);

    const finalRole = body.role === 'super' ? 'super' : 'staff';
    const finalPassword = body.password && String(body.password).trim() ? String(body.password).trim() : genTempPassword();
    const cred = await makeCredential(finalPassword);
    const staffId = genId('staff');

    const { error } = await admin.from('admins').insert({
      id: staffId, username, name: body.name || username, role: finalRole,
      allowed_thon: finalRole === 'staff' && Array.isArray(body.allowedThon) ? body.allowedThon : [],
      allowed_xom: finalRole === 'staff' && Array.isArray(body.allowedXom) ? body.allowedXom : [],
      salt: cred.salt, hash: cred.hash,
    });
    if (error) return json({ ok: false, reason: 'Lỗi hệ thống, thử lại sau.' }, 500);
    return json({ ok: true, id: staffId, tempPassword: finalPassword });
  }

  if (body.type === 'update-customer-profile') {
    const cccd = String(body.cccd || '').trim();
    if (!cccd) return json({ ok: false, reason: 'Cần nhập số CCCD.' }, 400);
    const patch: Record<string, unknown> = {};
    if (body.name) patch.name = body.name;
    if (body.phone) patch.phone = String(body.phone).replace(/\s/g, '');
    if (body.address) { patch.address = body.address; Object.assign(patch, parseAddress(body.address)); }
    const { error } = await admin.from('customers').update(patch).eq('cccd', cccd);
    if (error) return json({ ok: false, reason: 'Lỗi hệ thống, thử lại sau.' }, 500);
    return json({ ok: true });
  }

  if (body.type === 'reset-customer-password') {
    const customerId = String(body.customerId || '').trim();
    if (!customerId) return json({ ok: false, reason: 'Thiếu mã khách hàng.' }, 400);
    const finalPassword = body.password && String(body.password).trim() ? String(body.password).trim() : genTempPassword();
    const cred = await makeCredential(finalPassword);
    const { error } = await admin.from('customers').update({ ...cred, must_change_password: true, failed_attempts: 0, locked_until: null }).eq('id', customerId);
    if (error) return json({ ok: false, reason: 'Lỗi hệ thống, thử lại sau.' }, 500);
    return json({ ok: true, tempPassword: finalPassword });
  }

  if (body.type === 'deactivate-customer') {
    const customerId = String(body.customerId || '').trim();
    if (!customerId) return json({ ok: false, reason: 'Thiếu mã khách hàng.' }, 400);
    const { error } = await admin.from('customers').update({ salt: null, hash: null, must_change_password: false, failed_attempts: 0, locked_until: null }).eq('id', customerId);
    if (error) return json({ ok: false, reason: 'Lỗi hệ thống, thử lại sau.' }, 500);
    return json({ ok: true });
  }

  if (body.type === 'delete-customer') {
    const customerId = String(body.customerId || '').trim();
    if (!customerId) return json({ ok: false, reason: 'Thiếu mã khách hàng.' }, 400);
    const { error } = await admin.from('customers').delete().eq('id', customerId);
    if (error) return json({ ok: false, reason: 'Lỗi hệ thống, thử lại sau.' }, 500);
    return json({ ok: true });
  }

  if (body.type === 'delete-contract') {
    const contractId = String(body.contractId || '').trim();
    if (!contractId) return json({ ok: false, reason: 'Thiếu mã hợp đồng.' }, 400);
    const { error } = await admin.from('contracts').delete().eq('id', contractId);
    if (error) return json({ ok: false, reason: 'Lỗi hệ thống, thử lại sau.' }, 500);
    return json({ ok: true });
  }

  if (body.type === 'reset-staff-password') {
    const staffId = String(body.staffId || '').trim();
    if (!staffId) return json({ ok: false, reason: 'Thiếu mã tài khoản.' }, 400);
    const finalPassword = body.password && String(body.password).trim() ? String(body.password).trim() : genTempPassword();
    const cred = await makeCredential(finalPassword);
    const { error } = await admin.from('admins').update(cred).eq('id', staffId);
    if (error) return json({ ok: false, reason: 'Lỗi hệ thống, thử lại sau.' }, 500);
    return json({ ok: true, tempPassword: finalPassword });
  }

  if (body.type === 'update-staff-permissions') {
    const staffId = String(body.staffId || '').trim();
    if (!staffId) return json({ ok: false, reason: 'Thiếu mã tài khoản.' }, 400);
    const { error } = await admin.from('admins').update({
      allowed_thon: Array.isArray(body.allowedThon) ? body.allowedThon : [],
      allowed_xom: Array.isArray(body.allowedXom) ? body.allowedXom : [],
    }).eq('id', staffId).eq('role', 'staff');
    if (error) return json({ ok: false, reason: 'Lỗi hệ thống, thử lại sau.' }, 500);
    return json({ ok: true });
  }

  if (body.type === 'delete-staff') {
    const staffId = String(body.staffId || '').trim();
    if (!staffId) return json({ ok: false, reason: 'Thiếu mã tài khoản.' }, 400);
    const { data: target } = await admin.from('admins').select('role').eq('id', staffId).maybeSingle();
    if (target && target.role === 'super') {
      const { count } = await admin.from('admins').select('id', { count: 'exact', head: true }).eq('role', 'super');
      if ((count || 0) <= 1) return json({ ok: false, reason: 'Phải giữ lại ít nhất 1 quản trị viên toàn quyền.' }, 409);
    }
    const { error } = await admin.from('admins').delete().eq('id', staffId);
    if (error) return json({ ok: false, reason: 'Lỗi hệ thống, thử lại sau.' }, 500);
    return json({ ok: true });
  }

  if (body.type === 'import') {
    const rows = Array.isArray(body.rows) ? body.rows : [];
    const fullSync = !!body.fullSync;
    const result = {
      newProfiles: 0, existingCustomers: 0, contracts: 0,
      deletedContracts: 0, deletedCustomers: 0, skipped: 0,
      newAccounts: [] as { name: string; cccd: string; tempPassword: string }[],
      errors: [] as string[],
    };

    const { data: allCustomers } = await admin.from('customers').select('*');
    const { data: allContracts } = await admin.from('contracts').select('*');
    const customerByCccd = new Map((allCustomers || []).map((c: any) => [c.cccd, c]));
    const contractByCode = new Map((allContracts || []).filter((c: any) => c.code).map((c: any) => [c.code, c]));

    const customerUpserts: Record<string, unknown>[] = [];
    const contractUpserts: Record<string, unknown>[] = [];
    const touchedContractIds = new Set<string>();
    const usedCodes = new Set<string>();

    for (const row of rows) {
      const cccd = String(row.cccd || '').trim();
      if (!cccd || !/^\d{9,12}$/.test(cccd)) { result.skipped++; continue; }

      let cust: any = customerByCccd.get(cccd);
      const parsedAddr = row.address ? parseAddress(row.address) : null;

      if (cust) {
        const patch: Record<string, unknown> = {};
        if (row.name) patch.name = row.name;
        if (row.phone) patch.phone = String(row.phone).replace(/\s/g, '');
        if (row.address) { patch.address = row.address; Object.assign(patch, parsedAddr); }
        cust = { ...cust, ...patch };
        customerByCccd.set(cccd, cust);
        customerUpserts.push({ id: cust.id, ...patch });
        result.existingCustomers++;
      } else {
        const custId = genId('cust');
        const temp = genTempPassword();
        const cred = await makeCredential(temp);
        cust = {
          id: custId, cccd, name: row.name || '', phone: row.phone ? String(row.phone).replace(/\s/g, '') : '',
          address: row.address || '', ...(parsedAddr || { xom: '', thon: '', xa: '', tinh: '' }),
          salt: cred.salt, hash: cred.hash, must_change_password: true,
          failed_attempts: 0, locked_until: null,
        };
        customerByCccd.set(cccd, cust);
        customerUpserts.push(cust);
        result.newProfiles++;
        result.newAccounts.push({ name: cust.name, cccd, tempPassword: temp });
      }

      const disbursed = row.disbursedDate || new Date().toISOString().slice(0, 10);
      const bal = Number(row.balance) || 0;
      let ct: any = row.code ? contractByCode.get(row.code) : null;
      let code = row.code || (ct ? ct.code : null);
      if (!code) {
        do { code = `HD-${cccd}-${Date.now().toString(36).slice(-5)}${Math.random().toString(36).slice(2, 4)}`; }
        while (contractByCode.has(code) || usedCodes.has(code));
      }
      usedCodes.add(code);

      const contractId = ct ? ct.id : genId('hd');
      const contractRow = {
        id: contractId, customer_id: cust.id, code,
        principal: row.principal != null && row.principal !== '' ? Number(row.principal) || 0 : bal,
        disbursed_date: disbursed,
        due_date: row.dueDate || addDaysISO(disbursed, 365),
        interest_rate: row.interestRate != null && row.interestRate !== '' ? Number(row.interestRate) || 0 : (ct ? ct.interest_rate : 0),
        balance: bal,
        interest_paid_until: row.interestPaidUntil || disbursed,
      };
      contractByCode.set(code, contractRow);
      contractUpserts.push(contractRow);
      touchedContractIds.add(contractId);
      result.contracts++;
    }

    if (customerUpserts.length) {
      const { error } = await admin.from('customers').upsert(customerUpserts, { onConflict: 'id' });
      if (error) result.errors.push('Lỗi ghi hồ sơ khách hàng: ' + error.message);
    }
    if (contractUpserts.length) {
      const { error } = await admin.from('contracts').upsert(contractUpserts, { onConflict: 'id' });
      if (error) result.errors.push('Lỗi ghi hợp đồng: ' + error.message);
    }

    if (fullSync) {
      const toDeleteIds = (allContracts || []).filter((c: any) => !touchedContractIds.has(c.id)).map((c: any) => c.id);
      if (toDeleteIds.length) {
        const { error } = await admin.from('contracts').delete().in('id', toDeleteIds);
        if (!error) result.deletedContracts = toDeleteIds.length;
      }
      const { data: remaining } = await admin.from('contracts').select('customer_id, balance');
      const balByCust = new Map<string, number>();
      for (const c of remaining || []) balByCust.set(c.customer_id, (balByCust.get(c.customer_id) || 0) + (Number(c.balance) || 0));
      const { data: custNow } = await admin.from('customers').select('id, salt, hash');
      const pruneIds = (custNow || []).filter((c: any) => (balByCust.get(c.id) || 0) <= 0 && !(c.salt && c.hash)).map((c: any) => c.id);
      if (pruneIds.length) {
        const { error } = await admin.from('customers').delete().in('id', pruneIds);
        if (!error) result.deletedCustomers = pruneIds.length;
      }
    }

    return json({ ok: true, ...result });
  }

  return json({ ok: false, reason: 'Thiếu hoặc sai "type".' }, 400);
});
