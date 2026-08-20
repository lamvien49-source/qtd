// Edge Function "create-account" — tạo tài khoản đăng nhập (khách hàng hoặc
// quản trị viên/nhân viên), CHỈ cho phép quản trị viên toàn quyền (role
// 'super') gọi. Đây là lý do việc này không thể để trình duyệt tự làm thẳng
// (dù có RLS): tạo tài khoản là hành động NHẠY CẢM, phải xác minh đúng người
// gọi có quyền "super" NGAY TẠI SERVER, không tin vào bất cứ gì trình duyệt
// tự khai — y hệt tinh thần của Edge Function "login".
//
// Cách gọi: header Authorization: Bearer <JWT do Edge Function "login" cấp
// cho 1 admin role=super>. Body:
//   { type: 'customer', cccd, name?, phone?, password? }
//   { type: 'staff', username, name?, password?, role, allowedThon?, allowedXom? }
// password bỏ trống thì tự sinh mật khẩu tạm ngẫu nhiên (trả về trong response).

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

// ---------- Mật khẩu — GIỐNG HỆT thuật toán trong js/state.js / function "login" ----------
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

// ---------- Xác minh JWT do function "login" cấp (không dùng auth.users thật) ----------
function base64urlDecode(str: string): Uint8Array {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (str.length % 4)) % 4);
  const bin = atob(padded);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}
async function verifyJwt(token: string): Promise<Record<string, any> | null> {
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const [encHeader, encPayload, encSig] = parts;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['verify'],
  );
  const ok = await crypto.subtle.verify('HMAC', key, base64urlDecode(encSig), new TextEncoder().encode(`${encHeader}.${encPayload}`));
  if (!ok) return null;
  const payload = JSON.parse(new TextDecoder().decode(base64urlDecode(encPayload)));
  if (!payload.exp || payload.exp < Math.floor(Date.now() / 1000)) return null; // hết hạn
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

  // Xác minh LẠI role từ database (không tin claims cho quyết định phân quyền —
  // phòng trường hợp quyền của admin đã bị đổi sau khi JWT được cấp).
  const { data: callerAdmin, error: callerErr } = await admin.from('admins').select('*').eq('id', claims.row_id).maybeSingle();
  if (callerErr || !callerAdmin || callerAdmin.role !== 'super') {
    return json({ ok: false, reason: 'Chỉ quản trị viên toàn quyền mới được tạo tài khoản.' }, 403);
  }

  let body: Record<string, any>;
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: 'Yêu cầu không hợp lệ.' }, 400);
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

  return json({ ok: false, reason: 'Thiếu hoặc sai "type" (phải là "customer" hoặc "staff").' }, 400);
});
