// Edge Function "login" — chốt kiểm tra mật khẩu chạy phía server (Supabase),
// KHÔNG chạy trong trình duyệt. Đây là lý do app an toàn dù chưa dùng OTP:
// mọi thao tác đọc/ghi dữ liệu khách hàng/hợp đồng sau này đều phải đi qua
// đúng 1 "vé vào cửa" (JWT) do hàm này cấp sau khi xác minh mật khẩu đúng —
// không ai lấy được vé nếu không biết đúng mật khẩu, vì bước băm/so sánh
// mật khẩu chỉ chạy ở đây, dùng service_role key không lộ ra trình duyệt.
//
// Logic băm mật khẩu giữ NGUYÊN VẸN so với js/state.js (sha256Hex(salt+':'+password))
// để tương thích với mật khẩu đã tạo trước đó — không đổi thuật toán.

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!;
const SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
// Tự đặt tên secret riêng CUSTOM_JWT_SECRET (không trùng biến hệ thống) — giá
// trị copy từ Project Settings → API → JWT Settings → "JWT Secret" (xem hướng
// dẫn deploy đi kèm nếu trang đó hiển thị khác, báo lại để điều chỉnh).
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

async function sha256Hex(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function verifyCredential(password: string, salt: string, hash: string): Promise<boolean> {
  return (await sha256Hex(salt + ':' + password)) === hash;
}

function base64url(input: Uint8Array | string): string {
  const bytes = typeof input === 'string' ? new TextEncoder().encode(input) : input;
  let str = '';
  for (const b of bytes) str += String.fromCharCode(b);
  return btoa(str).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/** Ký JWT chuẩn HS256 — Supabase (PostgREST) tự verify chữ ký này bằng đúng JWT Secret của project. */
async function signJwt(payload: Record<string, unknown>): Promise<string> {
  const header = { alg: 'HS256', typ: 'JWT' };
  const encHeader = base64url(JSON.stringify(header));
  const encPayload = base64url(JSON.stringify(payload));
  const toSign = `${encHeader}.${encPayload}`;
  const key = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(JWT_SECRET),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'],
  );
  const sigBuf = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(toSign));
  return `${toSign}.${base64url(new Uint8Array(sigBuf))}`;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS });
  if (req.method !== 'POST') return json({ ok: false, reason: 'Method not allowed' }, 405);

  let body: { role?: string; identifier?: string; password?: string };
  try {
    body = await req.json();
  } catch {
    return json({ ok: false, reason: 'Yêu cầu không hợp lệ.' }, 400);
  }
  const { role, identifier, password } = body;
  if (!identifier || !password || (role !== 'customer' && role !== 'admin')) {
    return json({ ok: false, reason: 'Thiếu thông tin đăng nhập.' }, 400);
  }

  const table = role === 'customer' ? 'customers' : 'admins';
  const idTrim = String(identifier).trim();

  let row: Record<string, any> | null = null;
  if (role === 'customer') {
    // Khách đăng nhập bằng CCCD HOẶC số điện thoại (SĐT có thể gõ có/không dấu cách).
    const noSpace = idTrim.replace(/\s/g, '');
    const { data, error } = await admin.from('customers').select('*');
    if (error) {
      console.error('query customers error:', error);
      // TẠM THỜI in chi tiết lỗi thật ra response để chẩn đoán — sẽ bỏ dòng "debug" này
      // sau khi chạy được, không để lộ chi tiết lỗi hệ thống khi dùng thật.
      return json({ ok: false, reason: 'Lỗi hệ thống, thử lại sau.', debug: error }, 500);
    }
    row = (data || []).find((c) => c.cccd === idTrim || (c.phone && c.phone.replace(/\s/g, '') === noSpace)) || null;
  } else {
    const { data, error } = await admin.from('admins').select('*').eq('username', idTrim).maybeSingle();
    if (error) {
      console.error('query admins error:', error);
      return json({ ok: false, reason: 'Lỗi hệ thống, thử lại sau.', debug: error }, 500);
    }
    row = data;
  }

  const notFoundMsg = role === 'customer'
    ? 'Không tìm thấy tài khoản với số CCCD/số điện thoại này.'
    : 'Sai tên đăng nhập hoặc mật khẩu.';
  if (!row) return json({ ok: false, reason: notFoundMsg });
  if (!row.salt || !row.hash) {
    return json({ ok: false, reason: 'Tài khoản này chưa được cấp mật khẩu đăng nhập — liên hệ quỹ tín dụng.' });
  }
  if (row.locked_until && new Date(row.locked_until).getTime() > Date.now()) {
    const mins = Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 60000);
    return json({ ok: false, reason: `Tài khoản tạm khóa do nhập sai nhiều lần. Thử lại sau ${mins} phút.` });
  }

  const okPw = await verifyCredential(password, row.salt, row.hash);
  if (!okPw) {
    const failedAttempts = (row.failed_attempts || 0) + 1;
    const patch: Record<string, unknown> = { failed_attempts: failedAttempts };
    if (failedAttempts >= LOCK_AFTER_FAILS) {
      patch.locked_until = new Date(Date.now() + LOCK_MINUTES * 60000).toISOString();
      patch.failed_attempts = 0;
    }
    await admin.from(table).update(patch).eq('id', row.id);
    return json({
      ok: false,
      reason: role === 'customer' ? 'Số CCCD/số điện thoại hoặc mật khẩu không đúng.' : 'Sai tên đăng nhập hoặc mật khẩu.',
    });
  }

  await admin.from(table).update({ failed_attempts: 0, locked_until: null }).eq('id', row.id);

  const now = Math.floor(Date.now() / 1000);
  const token = await signJwt({
    sub: row.auth_user_id,
    role: 'authenticated', // role chuẩn Postgres — bắt buộc để PostgREST cho phép gọi API
    app_role: role, // 'customer' | 'admin' — RLS dùng để phân biệt
    row_id: row.id, // id thật của customers/admins — RLS dùng để khớp đúng dòng
    iat: now,
    exp: now + SESSION_HOURS * 3600,
  });

  return json({
    ok: true,
    token,
    id: row.id,
    mustChangePassword: role === 'customer' ? !!row.must_change_password : false,
  });
});
