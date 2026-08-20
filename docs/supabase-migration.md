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
  auth_user_id uuid unique default gen_random_uuid(), -- xem mục 5 — KHÔNG phải auth.users thật
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
  auth_user_id uuid unique default gen_random_uuid(), -- xem mục 5 — KHÔNG phải auth.users thật
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

> Nếu lúc tạo project bạn đã **bỏ tick "Automatically expose new tables"** (khuyến nghị, an toàn
> hơn) thì cần chạy thêm đoạn cấp quyền sau — thiếu bước này thì dù RLS/policy đúng, API vẫn không
> gọi được vào bảng (không có quyền ở tầng bảng, chưa tới lượt RLS xét từng dòng):

```sql
grant usage on schema public to anon, authenticated;
grant select, insert, update, delete on orgs, admins, customers, contracts, requests
  to anon, authenticated;
```

*(Cấp quyền ở tầng bảng cho phép API "được thử" truy vấn; RLS + policy phía trên mới là lớp quyết
định thật sự lọc được đúng dòng nào — 2 lớp này bổ sung cho nhau, không lớp nào thay được lớp kia.)*

## 5. Xác thực (Auth) — đã chốt: đăng nhập tự chế + Edge Function, không tốn phí OTP

Quyết định thực tế (đã trao đổi trực tiếp): **hoãn OTP/SMS** (tốn phí thật, chưa cần ngay) nhưng
**vẫn phải an toàn** dù chưa có OTP — không chấp nhận để lộ toàn bộ dữ liệu qua "anon key" như 1
app bình thường không có gì canh gác. Giải pháp: **giữ nguyên logic kiểm tra mật khẩu hiện tại**
(CCCD/username + băm SHA-256 có muối, y hệt `js/state.js`), chỉ chuyển chỗ chạy nó ra
**Supabase Edge Function** (code chạy trên server của Supabase, không phải trong trình duyệt).

### Cách hoạt động
1. Khách/admin gõ CCCD (hoặc SĐT/tên đăng nhập) + mật khẩu trong app như bình thường.
2. Trình duyệt gọi Edge Function `login` (file `supabase/functions/login/index.ts` trong repo này)
   — gửi kèm `{ role, identifier, password }`.
3. Edge Function dùng `service_role key` (chỉ tồn tại phía server, không lộ ra trình duyệt) tra
   đúng dòng trong `customers`/`admins`, so mật khẩu bằng đúng thuật toán cũ, xử lý khóa tài khoản
   sau nhiều lần sai y hệt logic hiện tại.
4. Đúng mật khẩu → Edge Function **tự ký 1 JWT** (không qua Supabase Auth/GoTrue) chứa:
   - `sub`: giá trị cột `auth_user_id` (uuid tự sinh sẵn khi tạo tài khoản, KHÔNG phải user thật
     trong `auth.users` — chỉ mượn định dạng để PostgREST hiểu).
   - `role: "authenticated"` — bắt buộc, để PostgREST cấp đúng quyền Postgres tương ứng.
   - `app_role`: `"customer"` hoặc `"admin"` — RLS dùng để phân biệt.
   - `row_id`: đúng `id` của dòng đó — RLS dùng để khớp chính xác không cần join qua `auth_user_id`.
5. Trình duyệt cầm JWT này gọi thẳng Supabase (`Authorization: Bearer <token>`) cho mọi thao tác
   sau đó — RLS ở bên dưới tự lọc đúng phần dữ liệu của người đó.

**Vì sao an toàn dù không có OTP**: bước băm/so mật khẩu CHỈ chạy trong Edge Function (server), dùng
`service_role key` không ai lấy được ngoài bạn — trình duyệt/`anon key` không tự tạo được JWT hợp lệ
nếu không đi qua đúng bước xác minh mật khẩu này trước.

### RLS policy (dùng JWT ở trên, không cần `auth.uid()`/`auth.users` thật)
```sql
-- Khách hàng chỉ thấy đúng hồ sơ + hợp đồng của chính mình
create policy "customer sees own profile" on customers
  for select using (
    (auth.jwt() ->> 'app_role') = 'customer'
    and id = (auth.jwt() ->> 'row_id')
  );

create policy "customer sees own contracts" on contracts
  for select using (
    (auth.jwt() ->> 'app_role') = 'customer'
    and customer_id = (auth.jwt() ->> 'row_id')
  );

-- Admin toàn quyền (role='super') thấy tất cả khách hàng
create policy "super admin sees all customers" on customers
  for select using (
    (auth.jwt() ->> 'app_role') = 'admin'
    and exists (
      select 1 from admins a where a.id = (auth.jwt() ->> 'row_id') and a.role = 'super'
    )
  );

-- Nhân viên (role='staff') chỉ thấy khách trong Thôn/Xóm được gán
create policy "staff sees scoped customers" on customers
  for select using (
    (auth.jwt() ->> 'app_role') = 'admin'
    and exists (
      select 1 from admins a
      where a.id = (auth.jwt() ->> 'row_id') and a.role = 'staff'
        and (thon = any(a.allowed_thon) or xom = any(a.allowed_xom))
    )
  );
```
*(Đây mới là ví dụ 3 policy đầu tiên cho bảng `customers`/`contracts` — các bảng còn lại
(`admins`, `requests`, `orgs`) và các thao tác insert/update/delete sẽ viết tiếp khi làm tới phần
thay thế từng hàm trong `state.js`, mục 7.)*

### Việc cần bạn làm để deploy Edge Function `login`
1. Vào Supabase Dashboard → menu ☰ → **Edge Functions** → **New function** → đặt tên đúng là `login`.
2. Copy toàn bộ nội dung file `supabase/functions/login/index.ts` trong repo này, dán vào — **Deploy**.
3. Vào **Project Settings → API → JWT Settings**, tìm dòng **"JWT Secret"** (hoặc "Legacy JWT
   Secret" nếu project mới hiển thị khác — nếu không thấy chữ nào giống vậy, chụp màn hình gửi tôi,
   Supabase hay đổi giao diện phần này).
4. Copy giá trị đó → vào **Edge Functions → login → Settings/Secrets** → thêm secret mới, đặt tên
   **`CUSTOM_JWT_SECRET`**, dán giá trị vừa copy vào → Save. **Không dán giá trị này vào chat** —
   đây là bí mật thật, khác hẳn URL/anon key.
5. Chạy đoạn SQL ở mục "RLS policy" trên (SQL Editor như bước tạo bảng) — nhớ **bỏ dòng
   `references auth.users(id)`** nếu bạn đã chạy schema cũ trước đó (chạy `alter table customers
   drop constraint if exists customers_auth_user_id_fkey;` và tương tự cho `admins` trước khi thêm
   lại default `gen_random_uuid()` nếu cần).

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
