# Quỹ Tín Dụng Demo — Cổng khách hàng (BẢN DEMO)

⚠️ **Đây là bản demo/prototype giao diện, KHÔNG PHẢI hệ thống sẵn sàng vận hành thật.** Toàn bộ dữ liệu khách hàng trong bản demo này (tên, CCCD, khoản vay...) là **dữ liệu giả**, được sinh tự động, không liên quan đến bất kỳ khách hàng thật nào. **Tuyệt đối không nhập dữ liệu thật của khách hàng vào bản demo này** cho đến khi đã hoàn tất phần backend + bảo mật thật (xem mục "Trước khi dùng thật" bên dưới).

## Bản demo này minh họa gì

Một cổng thông tin cho quỹ tín dụng, gồm:

- **Phía khách hàng**: đăng nhập bằng số CCCD + mật khẩu (admin cấp sẵn, bắt buộc đổi mật khẩu lần đầu) → xem hợp đồng vay của mình (dư nợ, ngày vay, ngày đến hạn, hỗ trợ nhiều hợp đồng/người) → gửi yêu cầu tư vấn / mở khoản vay mới.
- **Phía quản trị** (`/#/admin`, đăng nhập bằng tài khoản admin riêng): quản lý khách hàng & hợp đồng (thêm thủ công hoặc **dán dữ liệu copy từ Excel** để nhập nhanh nhiều dòng), cấp lại mật khẩu, xem/xử lý yêu cầu tư vấn, chỉnh banner + thông tin quỹ tín dụng ngay trong app.

## Tài khoản dùng thử

| Vai trò | Đăng nhập | Mật khẩu |
|---|---|---|
| Khách hàng | CCCD: `079300012345` | `Demo@123` (bắt buộc đổi ngay lần đầu) |
| Quản trị viên | `admin` | `Admin@123` |

## Chạy thử

```bash
node server.js 8080
```
Mở `http://localhost:8080`.

## Giới hạn của bản demo (quan trọng)

- **Không có backend/database thật** — dữ liệu lưu trong `localStorage` của trình duyệt, mỗi thiết bị/trình duyệt là 1 kho dữ liệu riêng biệt, không đồng bộ giữa các máy.
- **Không có OTP** — chỉ có tài khoản do admin cấp (CCCD + mật khẩu tạm) + bắt buộc đổi mật khẩu lần đầu + khóa tạm sau nhiều lần đăng nhập sai, KHÔNG thay thế được lớp bảo mật OTP nếu triển khai thật.
- **Nhập từ Excel** thực hiện bằng cách dán (copy/paste) dữ liệu dạng bảng vào ô văn bản — không đọc trực tiếp file `.xlsx`/`.xls` (do môi trường phát triển không cài được thư viện đọc file nhị phân).
- Mật khẩu được băm bằng `crypto.subtle` (SHA-256 + muối) ngay trong trình duyệt cho đúng nguyên tắc, nhưng vì không có server thật đứng sau nên đây **chỉ minh họa luồng**, chưa đạt chuẩn bảo mật để vận hành thật.

## Trước khi dùng thật (bắt buộc)

1. Thay lớp lưu trữ `js/state.js` bằng kết nối tới **database + backend thật** (vd: Supabase) — dữ liệu khách hàng/hợp đồng phải nằm trên server, không phải localStorage.
2. Thêm **OTP** gửi qua SMS thật (nhà cung cấp SMS Brandname) cho đăng nhập/thao tác nhạy cảm.
3. Rà soát tuân thủ **Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân** trước khi thu thập/lưu trữ CCCD của khách hàng thật.
4. Thực hiện **rà soát bảo mật (security review)** độc lập trước khi cho khách hàng thật sử dụng.
