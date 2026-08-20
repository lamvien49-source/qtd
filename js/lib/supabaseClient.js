// Kết nối tới Supabase thật (thay dần cho localStorage) — xem
// docs/supabase-migration.md để biết đầy đủ kiến trúc/lý do thiết kế.
//
// URL + anon key được PHÉP để công khai/commit vào repo — bảo mật thật nằm
// ở Row Level Security + 2 Edge Function (login/create-account), không phải
// ở việc giấu 2 giá trị này. KHÔNG bao giờ đặt service_role key ở đây hay
// bất cứ file nào chạy trong trình duyệt.
import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = 'https://amwiyxhawueqlmnzkdls.supabase.co';
export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImFtd2l5eGhhd3VlcWxtbnprZGxzIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODcxNjgzODIsImV4cCI6MjEwMjc0NDM4Mn0.KlTd_BbDjH3ZPipXE76qshgXkusZzW8YfhoSDN_w8oE';

// URL thật của 2 Edge Function — LƯU Ý tên hiển thị trên Dashboard có thể
// khác đường dẫn thật (đã gặp thực tế: function tên "login" nhưng URL lại là
// .../clever-processor vì lúc tạo qua "Via Editor" không đổi được slug).
export const LOGIN_FN_URL = 'https://amwiyxhawueqlmnzkdls.supabase.co/functions/v1/clever-processor';
export const CREATE_ACCOUNT_FN_URL = 'https://amwiyxhawueqlmnzkdls.supabase.co/functions/v1/create-account';

/**
 * Tạo 1 Supabase client — nếu có JWT riêng (do function "login" cấp sau khi
 * xác minh mật khẩu) thì gắn vào header Authorization để RLS lọc đúng dữ
 * liệu của đúng người đó; không truyền gì thì chỉ có quyền của "anon" (gần
 * như không đọc/ghi được gì, vì mọi bảng đều yêu cầu đúng vé mới cho xem).
 */
export function getSupabaseClient(jwt) {
  return createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: jwt ? { headers: { Authorization: `Bearer ${jwt}` } } : {},
  });
}

/** Gọi Edge Function "login" — trả về { ok, token, id, mustChangePassword, reason }. */
export async function callLoginFunction({ role, identifier, password }) {
  try {
    const res = await fetch(LOGIN_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${SUPABASE_ANON_KEY}` },
      body: JSON.stringify({ role, identifier, password }),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, reason: 'Không kết nối được máy chủ, kiểm tra lại mạng và thử lại.' };
  }
}

/** Gọi Edge Function "create-account" — cần JWT của admin role='super'. */
export async function callCreateAccountFunction(adminJwt, payload) {
  try {
    const res = await fetch(CREATE_ACCOUNT_FN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', apikey: SUPABASE_ANON_KEY, Authorization: `Bearer ${adminJwt}` },
      body: JSON.stringify(payload),
    });
    return await res.json();
  } catch (e) {
    return { ok: false, reason: 'Không kết nối được máy chủ, kiểm tra lại mạng và thử lại.' };
  }
}
