# Quỹ Tín Dụng Nhân Dân Bình Nguyên — Cổng khách hàng (BẢN DEMO)

⚠️ **Đây là bản demo/prototype giao diện, KHÔNG PHẢI hệ thống sẵn sàng vận hành thật.** Toàn bộ dữ liệu khách hàng trong bản demo này (tên, CCCD, khoản vay...) là **dữ liệu giả**, được sinh tự động, không liên quan đến bất kỳ khách hàng thật nào. **Tuyệt đối không nhập dữ liệu thật của khách hàng vào bản demo này** cho đến khi đã hoàn tất phần backend + bảo mật thật (xem mục "Trước khi dùng thật" bên dưới).

## Bản demo này minh họa gì

Một cổng thông tin cho quỹ tín dụng, gồm:

- **Phía khách hàng**: đăng nhập bằng số CCCD + mật khẩu (admin cấp sẵn, bắt buộc đổi mật khẩu lần đầu) → xem hợp đồng vay của mình (dư nợ, ngày vay, ngày đến hạn, đã trả lãi đến ngày, lãi phát sinh đến hiện tại, hỗ trợ nhiều hợp đồng/người) → **Thanh toán**: chọn trả gốc (lãi tính cố định theo hợp đồng) hoặc trả lãi (mặc định lấy lãi phát sinh, có thể sửa), tự tạo nội dung chuyển khoản + **mã QR VietQR** để quét chuyển tiền → gửi yêu cầu tư vấn / mở khoản vay mới.
- **Phía quản trị** (`/#/admin`): quản lý khách hàng (nhập **1 ô địa chỉ**, hệ thống tự tách Xóm/Thôn/Tỉnh) & hợp đồng — thêm thủ công hoặc **đọc trực tiếp file Excel (.xlsx)** tải lên (tự động cập nhật theo đúng file, không cần thư viện ngoài), lọc danh sách theo Thôn/Xóm và theo "có nợ quá hạn", bấm vào hợp đồng xem đầy đủ (số tiền gốc, dư nợ, ngày vay, ngày đến hạn, đã trả lãi đến ngày, lãi đến nay) giống hệt màn hình khách hàng, số điện thoại bấm vào **gọi luôn** (`tel:`), cấp lại mật khẩu, xem/xử lý yêu cầu tư vấn, chỉnh banner + thông tin quỹ tín dụng + thông tin nhận thanh toán (QR) + **lãi suất/kỳ hạn mặc định khi nhập liệu** ngay trong app.
- **Phân quyền nhân viên**: tài khoản quản trị viên (`super`) toàn quyền, có thể tạo tài khoản **nhân viên** (`staff`) chỉ xem (không sửa/xóa) và chỉ thấy khách hàng/hợp đồng/yêu cầu thuộc các **Thôn được gán riêng** — dùng cho việc theo dõi nợ quá hạn theo địa bàn phụ trách.

## Tài khoản dùng thử

| Vai trò | Đăng nhập | Mật khẩu |
|---|---|---|
| Khách hàng | CCCD: `079300012345` | `Demo@123` (bắt buộc đổi ngay lần đầu) |
| Quản trị viên (toàn quyền) | `admin` | `Admin@123` |
| Nhân viên (chỉ xem, giới hạn Thôn 1) | `nhanvien1` | `Staff@123` |

## Chạy thử

```bash
node server.js 8080
```
Mở `http://localhost:8080`.

## Nhập dữ liệu từ Excel

Trang **Khách hàng & Hợp đồng** (quản trị viên) → **"Nhập từ Excel"** → chọn file `.xlsx` đúng theo cột trong file mẫu thật của quỹ (dòng đầu là tiêu đề sẽ tự bỏ qua):

**Bắt buộc (đúng theo file mẫu):**
```
Người nhận nợ (Họ tên) | Số CMND/CCCD | Địa chỉ | Ngày nhận nợ | Thu lãi đến ngày | Số dư
```

**Tùy chọn (thêm vào cuối nếu có, không có cũng nhập được):**
```
SĐT | Mã hợp đồng | Số tiền vay | Ngày đến hạn | Lãi suất
```

- File được đọc **trực tiếp trong trình duyệt** (giải nén ZIP + đọc XML bằng API có sẵn của trình duyệt), không cần thư viện ngoài, không cần tải file lên server nào.
- Chỉ đọc được **.xlsx** (Excel 2007 trở lên). File `.xls` cũ cần lưu lại dưới dạng `.xlsx` trước.
- Ô ngày tháng đọc đúng cả khi Excel lưu dạng ngày thật (số serial) lẫn dạng chữ `dd/mm/yyyy`.
- **Cột "Địa chỉ"**: chỉ cần 1 ô địa chỉ đầy đủ (vd: `Xóm 2, thôn Bình Bắc, xã Bình Sơn, tỉnh Quảng Ngãi`) — hệ thống **tự tách theo dấu phẩy** thành Xóm/Thôn/Tỉnh ngay khi nhập, không cần chia sẵn thành nhiều cột. Nhờ vậy quản trị viên lọc theo Thôn/Xóm và gán quyền cho nhân viên theo địa bàn được ngay.
- Các trường tùy chọn để trống sẽ **tự tính**: Mã hợp đồng tự sinh (`HD-{CCCD}-{số thứ tự}`), Số tiền vay mặc định = Số dư, Ngày đến hạn mặc định = Ngày nhận nợ + kỳ hạn mặc định, Lãi suất mặc định lấy theo **Cài đặt → Mặc định cho hợp đồng khi nhập liệu**.
- Khách hàng mới sẽ được tự tạo tài khoản (CCCD + mật khẩu tạm), hiển thị ngay sau khi nhập để gửi cho khách hàng.
- Vẫn có lựa chọn "dán dữ liệu thủ công" (copy từ Excel) làm phương án dự phòng.

## Phân quyền theo địa bàn (Thôn/Xóm)

Quản trị viên vào **Quản lý nhân viên** để tạo tài khoản nhân viên, chọn các **Thôn** nhân viên đó được phép xem. Nhân viên đăng nhập sẽ:
- Chỉ thấy khách hàng, hợp đồng, yêu cầu tư vấn thuộc Thôn được gán (ở mọi trang: Tổng quan, Khách hàng & Hợp đồng, Yêu cầu tư vấn).
- Không thấy mục **Cài đặt** và **Quản lý nhân viên** (chỉ quản trị viên `super` mới truy cập được, kể cả gõ thẳng địa chỉ cũng bị chuyển hướng ra ngoài).
- Không sửa/xóa được khách hàng, hợp đồng — chỉ xem.
- Danh sách khách hàng có thể lọc thêm theo Thôn/Xóm cụ thể và theo "Có nợ quá hạn" để tra cứu nhanh.

## Thanh toán bằng mã QR (VietQR)

Ở trang chi tiết hợp đồng, khách hàng bấm **Thanh toán**:
- **Trả gốc**: nhập số tiền gốc muốn trả; tiền lãi tự lấy đúng theo "Lãi đến nay" của hợp đồng (không sửa được).
- **Trả lãi**: mặc định lấy đúng "Lãi đến nay", khách có thể sửa lại số tiền.
- Nội dung chuyển khoản tự sinh theo mẫu: `HỌ TÊN THANH TOAN GOC/LAI SỐ TIỀN HDTD MÃ_HỢP_ĐỒNG` (bỏ dấu, viết hoa, đúng quy ước ngân hàng).
- Hiển thị mã **QR VietQR** (dùng dịch vụ ảnh công khai `img.vietqr.io`, cần Internet khi khách hàng dùng thật — trong môi trường phát triển không có mạng nên không xem trước được ảnh QR, nhưng sẽ hiển thị bình thường khi deploy thật).
- Thông tin ngân hàng (tên NH, mã BIN VietQR, số tài khoản, tên chủ tài khoản) chỉnh tại **Cài đặt**. **Đã điền sẵn theo thông tin bạn cung cấp (Ngân hàng Hợp tác xã Việt Nam - Co-op Bank, mã BIN 970446) nhưng cần bạn xác minh lại chính xác** tại vietqr.io hoặc với ngân hàng trước khi dùng thật — mã BIN sai sẽ tạo QR không quét được hoặc chuyển nhầm nơi nhận.

## Giới hạn của bản demo (quan trọng)

- **Không có backend/database thật** — dữ liệu lưu trong `localStorage` của trình duyệt, mỗi thiết bị/trình duyệt là 1 kho dữ liệu riêng biệt, không đồng bộ giữa các máy.
- **Không có OTP** — chỉ có tài khoản do admin cấp (CCCD + mật khẩu tạm) + bắt buộc đổi mật khẩu lần đầu + khóa tạm sau nhiều lần đăng nhập sai, KHÔNG thay thế được lớp bảo mật OTP nếu triển khai thật.
- **Nút "Mở app ngân hàng tự động"** theo đúng app khách hàng đang cài không khả thi từ 1 trang web thuần (mỗi ngân hàng có cơ chế riêng) — bản demo dùng cách phổ quát và đáng tin cậy hơn là **quét mã QR VietQR** bằng app ngân hàng/ví điện tử bất kỳ.
- Mật khẩu được băm bằng `crypto.subtle` (SHA-256 + muối) ngay trong trình duyệt cho đúng nguyên tắc, nhưng vì không có server thật đứng sau nên đây **chỉ minh họa luồng**, chưa đạt chuẩn bảo mật để vận hành thật.

## Trước khi dùng thật (bắt buộc)

1. Thay lớp lưu trữ `js/state.js` bằng kết nối tới **database + backend thật** (vd: Supabase) — dữ liệu khách hàng/hợp đồng phải nằm trên server, không phải localStorage.
2. Thêm **OTP** gửi qua SMS thật (nhà cung cấp SMS Brandname) cho đăng nhập/thao tác nhạy cảm.
3. **Xác minh lại mã BIN ngân hàng + số tài khoản** tại Cài đặt trước khi dùng thật.
4. Rà soát tuân thủ **Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân** trước khi thu thập/lưu trữ CCCD của khách hàng thật.
5. Thực hiện **rà soát bảo mật (security review)** độc lập trước khi cho khách hàng thật sử dụng.
