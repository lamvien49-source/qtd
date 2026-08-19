# Chuyển sang Supabase (thay `localStorage` bằng database thật)

> Tài liệu này là hướng dẫn triển khai cho mục **"Trước khi dùng thật (bắt buộc)"** trong README —
> bước đầu tiên trong đó: *"Thay lớp lưu trữ `js/state.js` bằng kết nối tới database + backend thật (vd: Supabase)"*.
> "Supdata" trong yêu cầu ban đầu là tên gọi khác của **Supabase**.

## 1. Supabase là gì

Supabase = Postgres (database thật, có thật trên server) + Auth (đăng nhập) + API tự sinh + Storage,
có gói miễn phí đủ dùng cho quỹ tín dụng cỡ nhỏ/vừa. Nó thay thế đúng phần `localStorage` hiện tại —
dữ liệu nằm trên server, đồng bộ giữa mọi thiết bị/trình duyệt, thay vì mỗi máy 1 kho riêng như bây giờ.

## 2. Tạo project

1. Vào [supabase.com](https://supabase.com) → **Sign up** (dùng GitHub cho nhanh).
2. **New project** → chọn tổ chức (org) → đặt tên project (VD: `qtd-binh-nguyen`) → đặt **Database
   Password** (lưu lại chỗ an toàn, không phải thứ commit lên git) → chọn **Region** gần Việt Nam nhất
   (Singapore) → **Create new project**. Đợi ~2 phút để khởi tạo.
3. Vào **Project Settings → API**, lấy 2 giá trị:
   - **Project URL** (dạng `https://xxxx.supabase.co`)
   - **anon public key** (chuỗi JWT dài) — key này **được phép** để lộ ở phía trình duyệt/commit vào
     repo, vì Supabase thiết kế để bảo vệ dữ liệu bằng **Row Level Security (RLS)** chứ không phải
     bằng cách giấu key này.
   - **TUYỆT ĐỐI không** dùng `service_role key` ở phía trình duyệt — key đó bỏ qua toàn bộ RLS, chỉ
     dùng trong môi trường server tin cậy (Edge Function, backend riêng).

## 3. Thiết kế bảng (schema)

Mở **SQL Editor** trong Supabase, chạy đoạn sau — ánh xạ trực tiếp từ cấu trúc `state.js` hiện tại
(`org`, `admins`, `customers`, `contracts`, `requests`):

```sql
create extension if not exists pgcrypto;

create table orgs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  short_name text,
  hotline text,
  address text,
  banner_enabled boolean default true,
  banner_title text,
  banner_text text,
  bank_bin text,
  bank_name text,
  bank_account_no text,
  bank_account_name text
);

create table admins (
  id text primary key,
  username text unique not null,
  name text not null,
  role text not null check (role in ('super', 'staff')),
  allowed_thon text[] default '{}',
  allowed_xom text[] default '{}',
  salt text,
  hash text,
  auth_user_id uuid references auth.users(id), -- xem mục 5
  created_at timestamptz default now()
);

create table customers (
  id text primary key,
  cccd text unique not null,
  name text not null,
  phone text,
  address text,
  thon text,
  xom text,
  tinh text,
  salt text,
  hash text,
  must_change_password boolean default true,
  failed_attempts int default 0,
  locked_until timestamptz,
  auth_user_id uuid references auth.users(id), -- xem mục 5
  created_at timestamptz default now()
);
-- KHÔNG có cột temp_password: mật khẩu tạm chỉ nên trả về 1 LẦN DUY NHẤT lúc tạo
-- tài khoản (qua kênh riêng: hiện trên màn hình admin, không lưu lại trong DB).

create table contracts (
  id text primary key,
  customer_id text not null references customers(id) on delete cascade,
  code text not null,
  principal numeric not null,
  disbursed_date date not null,
  due_date date not null,
  interest_rate numeric not null,
  balance numeric not null,
  interest_paid_until date,
  created_at timestamptz default now()
);
-- Bỏ cột "status" lưu sẵn — giữ đúng cách app đang làm: effectiveContractStatus()
-- luôn TỰ TÍNH từ balance + due_date, không dựa vào cột trạng thái tĩnh.

create table requests (
  id text primary key,
  customer_id text not null references customers(id) on delete cascade,
  type text not null,
  amount numeric,
  purpose text,
  term_months int,
  note text,
  status text not null default 'moi',
  created_at timestamptz default now()
);

create index on contracts (customer_id);
create index on requests (customer_id);
create index on customers (thon, xom);
```

## 4. Row Level Security (RLS) — bắt buộc, đây là lớp bảo mật chính

Mặc định Supabase để trống bảng qua API là **chặn hết** cho tới khi bật RLS + viết policy.

```sql
alter table orgs enable row level security;
alter table admins enable row level security;
alter table customers enable row level security;
alter table contracts enable row level security;
alter table requests enable row level security;
```

Policy cụ thể phụ thuộc vào việc bạn chọn **phương án xác thực** ở mục 5 bên dưới — vì RLS trong
Supabase dựa vào `auth.uid()` (người dùng đã đăng nhập qua Supabase Auth), nên cần map được
`auth_user_id` → đúng customer/admin tương ứng trước khi viết policy chi tiết.

## 5. Xác thực (Auth) — điểm cần quyết định trước khi code

App hiện tại **tự làm đăng nhập riêng** (CCCD/username + băm mật khẩu bằng `crypto.subtle` ngay
trong trình duyệt) — không dùng Supabase Auth. Có 2 hướng:

### Hướng A — Chuyển sang Supabase Auth (khuyến nghị)
- Khách hàng: dùng **Phone OTP** của Supabase Auth (đăng nhập bằng SĐT, nhận mã OTP qua SMS) — vừa
  thay được backend thật, vừa giải quyết luôn mục **"Thêm OTP"** cũng đang ghi trong README là bắt
  buộc trước khi dùng thật. Cần đăng ký 1 nhà cung cấp SMS (Twilio, MessageBird...) trong Supabase Auth
  settings.
- Quản trị viên/nhân viên: dùng **Email + mật khẩu** (hoặc magic link) của Supabase Auth.
- Sau khi đăng nhập, `auth.uid()` cho biết chính xác ai đang gọi API → RLS viết được thẳng theo
  `auth_user_id` trong bảng `customers`/`admins`.
- Bỏ hẳn cột `salt`/`hash` tự làm — Supabase Auth tự lo phần băm mật khẩu.

Ví dụ policy khi dùng hướng A:
```sql
-- Khách hàng chỉ thấy đúng hợp đồng của chính mình
create policy "customer sees own contracts" on contracts
  for select using (
    customer_id in (select id from customers where auth_user_id = auth.uid())
  );

-- Admin (role='super') thấy tất cả; nhân viên chỉ thấy khách trong Thôn/Xóm được gán
create policy "admin/staff sees scoped customers" on customers
  for select using (
    exists (
      select 1 from admins a
      where a.auth_user_id = auth.uid()
        and (a.role = 'super' or thon = any(a.allowed_thon) or xom = any(a.allowed_xom))
    )
  );
```

### Hướng B — Giữ nguyên cách đăng nhập tự chế hiện tại
- Không dùng được RLS dựa vào `auth.uid()` một cách trực tiếp.
- Cần viết **Supabase Edge Function** (chạy phía server, dùng `service_role key` — không lộ ra
  trình duyệt) để tự kiểm tra phiên đăng nhập tự chế rồi mới truy vấn DB thay khách.
- Nhiều việc hơn, vẫn thiếu OTP thật (README vẫn yêu cầu bổ sung mục này riêng).

**→ Khuyến nghị dùng Hướng A** — vừa đúng chuẩn, vừa giải quyết 2 mục còn thiếu trong README cùng lúc.

## 6. Gắn Supabase JS client vào code (giữ đúng kiến trúc "0 dependency, ES Module thuần")

Dự án hiện không dùng bundler/npm — vẫn giữ được điều đó bằng import map trỏ tới CDN ESM:

`index.html` — thêm trước script chính:
```html
<script type="importmap">
{ "imports": { "@supabase/supabase-js": "https://esm.sh/@supabase/supabase-js@2" } }
</script>
```

`js/lib/supabaseClient.js` (file mới):
```js
import { createClient } from '@supabase/supabase-js';

// URL + anon key được phép public — bảo mật thật nằm ở RLS (mục 4), không phải ở đây.
const SUPABASE_URL = 'https://xxxx.supabase.co';
const SUPABASE_ANON_KEY = 'eyJ...';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
```

## 7. Chiến lược thay thế trong `state.js`

Không cần viết lại toàn bộ UI — `state.js` đang có sẵn pattern `notify()`/`subscribe()` (pub-sub),
các view chỉ gọi hàm public (`S.listCustomers()`, `S.upsertContract()`...) chứ không đụng trực tiếp
vào `localStorage`. Vì vậy chỉ cần thay **bên trong** các hàm đó:

- `persist()` (hiện đang `localStorage.setItem(...)`) → xóa hẳn, vì giờ Postgres tự lưu.
- Các hàm đọc (`listCustomers`, `getContract`...) → giữ nguyên chữ ký, nhưng lấy dữ liệu từ 1 cache
  trong bộ nhớ được nạp sẵn lúc khởi động (`await supabase.from('customers').select('*')`), thay vì
  đọc trực tiếp `state.customers`.
- Các hàm ghi (`upsertCustomer`, `upsertContract`, `deleteContract`...) → gọi
  `supabase.from(...).upsert(...)` / `.delete()`, đợi kết quả thành công rồi mới cập nhật cache +
  gọi `notify()` như cũ (để UI tự vẽ lại, không đổi gì ở tầng view).
- Import Excel (`importFromPastedTable`) → vẫn đọc file ở trình duyệt như hiện tại (không đổi), chỉ
  đổi bước cuối: thay vì gộp vào `state` rồi `persist()`, gọi 1 loạt `upsert` lên Supabase.
- Nên làm dần từng bảng một (VD: `requests` trước — ít rủi ro nhất), test kỹ, rồi mới sang
  `customers`/`contracts` (có PII, rủi ro cao hơn).

## 8. Việc còn lại sau khi chuyển xong

- [ ] OTP thật cho đăng nhập khách hàng (nếu chọn Hướng A ở mục 5, coi như xong luôn).
- [ ] Rà soát tuân thủ **Nghị định 13/2023/NĐ-CP** trước khi lưu CCCD khách hàng thật.
- [ ] Bật **Point-in-time Recovery** / backup định kỳ trong Supabase (gói trả phí).
- [ ] Security review độc lập trước khi cho khách hàng thật dùng (đã ghi trong README).

---

*Tài liệu hướng dẫn — chưa có code triển khai thật trong repo này. Cần tạo project Supabase thật
(mục 2) và cung cấp Project URL + anon key thì mới viết được code kết nối cụ thể ở mục 6-7.*
