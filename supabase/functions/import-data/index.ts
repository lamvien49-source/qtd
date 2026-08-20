// Edge Function "import-data" — nhập dữ liệu Excel (khách hàng + hợp đồng)
// vào Supabase thật. CHỈ admin role='super' gọi được (xác minh JWT + role
// tại server, y hệt tinh thần "login"/"create-account").
//
// Trình duyệt đã tự đọc file Excel + tách cột + parse ngày/số (giữ nguyên
// logic cũ trong js/state.js, không sensitive nên không cần chuyển) — chỉ
// gửi lên đây DANH SÁCH DÒNG ĐÃ PARSE SẴN để ghi vào database, vì việc ghi
// (đặc biệt tự tạo tài khoản cho khách hoàn toàn mới) cần chạy ở server.
//
// Body: { fullSync: boolean, rows: [{ cccd, name?, phone?, address?, code?,
//   principal?, disbursedDate, dueDate?, interestPaidUntil?, balance,
//   interestRate? }] }
// fullSync=true (tải file lên): hợp đồng nào không có trong "rows" bị XÓA,
//   khách hết hợp đồng + chưa có Use cũng bị dọn theo.
// fullSync=false (dán tay): chỉ thêm/cập nhật, không xóa gì.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
const JWT_SECRET = Deno.env.get('CUSTOM_JWT_SECRET')!; // secret giống hệt function "login"

const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

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
function genId(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}
function addDaysISO(iso: string, n: number): string {
  const dt = new Date(iso);
  dt.setDate(dt.getDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** Y hệt parseAddress trong js/state.js — tách "Xóm 01, Thôn A, Xã B, Tỉnh C" thành từng phần. */
function parseAddress(raw: string) {
  const text = String(raw || '').trim();
  const withoutNote = text.replace(/\([^)]*\)/g, '');
  const parts = withoutNote.split(',').map((s) => s.trim()).filter(Boolean);
  const result = { xom: '', thon: '', xa: '', tinh: '' };
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

function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
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

  const authHeader = req.headers.get('Authorization') || '';
  const token = authHeader.replace(/^Bearer\s+/i, '');
  const claims = token ? await verifyJwt(token) : null;
  if (!claims || claims.app_role !== 'admin') {
    return json({ ok: false, reason: 'Chưa đăng nhập hoặc phiên đã hết hạn.' }, 401);
  }
  const { data: callerAdmin, error: callerErr } = await admin.from('admins').select('*').eq('id', claims.row_id).maybeSingle();
  if (callerErr || !callerAdmin || callerAdmin.role !== 'super') {
    return json({ ok: false, reason: 'Chỉ quản trị viên toàn quyền mới được nhập dữ liệu.' }, 403);
  }

  let body: { rows?: any[]; fullSync?: boolean };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: 'Yêu cầu không hợp lệ.' }, 400);
  }
  const rows = Array.isArray(body.rows) ? body.rows : [];
  const fullSync = !!body.fullSync;

  const result = {
    newProfiles: 0, existingCustomers: 0, contracts: 0,
    deletedContracts: 0, deletedCustomers: 0, skipped: 0,
    newAccounts: [] as { name: string; cccd: string; tempPassword: string }[],
    errors: [] as string[],
  };

  // Tải toàn bộ khách hàng/hợp đồng hiện có 1 LẦN DUY NHẤT (không query lặp
  // lại từng dòng) — bài học từ lần sửa lỗi nhập chậm ở bản localStorage cũ.
  const { data: allCustomers } = await admin.from('customers').select('*');
  const { data: allContracts } = await admin.from('contracts').select('*');
  const customerByCccd = new Map((allCustomers || []).map((c: any) => [c.cccd, c]));
  const contractByCode = new Map((allContracts || []).filter((c: any) => c.code).map((c: any) => [c.code, c]));

  const customerUpserts: Record<string, unknown>[] = [];
  const contractUpserts: Record<string, unknown>[] = [];
  const touchedContractIds = new Set<string>();
  const usedCodes = new Set<string>(); // tránh sinh trùng mã tự động trong cùng 1 lần nhập

  for (const row of rows) {
    const cccd = String(row.cccd || '').trim();
    if (!cccd || !/^\d{9,12}$/.test(cccd)) { result.skipped++; continue; }

    let cust: any = customerByCccd.get(cccd);
    const wasNew = !cust;
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

  // Ghi hàng loạt (batch) thay vì từng dòng — nhanh hơn nhiều lần so với gọi
  // riêng từng insert/update, nhất là file vài trăm dòng trở lên.
  if (customerUpserts.length) {
    const { error } = await admin.from('customers').upsert(customerUpserts, { onConflict: 'id' });
    if (error) { result.errors.push('Lỗi ghi hồ sơ khách hàng: ' + error.message); }
  }
  if (contractUpserts.length) {
    const { error } = await admin.from('contracts').upsert(contractUpserts, { onConflict: 'id' });
    if (error) { result.errors.push('Lỗi ghi hợp đồng: ' + error.message); }
  }

  if (fullSync) {
    const toDeleteIds = (allContracts || []).filter((c: any) => !touchedContractIds.has(c.id)).map((c: any) => c.id);
    if (toDeleteIds.length) {
      const { error } = await admin.from('contracts').delete().in('id', toDeleteIds);
      if (!error) result.deletedContracts = toDeleteIds.length;
    }
    // Dọn hồ sơ hết dư nợ + chưa có tài khoản Use (tính lại dư nợ từ hợp đồng còn lại thật sự).
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
});
