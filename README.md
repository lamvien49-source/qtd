# Quỹ Tín Dụng Nhân Dân Bình Nguyên — Cổng khách hàng (BẢN DEMO)

⚠️ **Đây là bản demo/prototype giao diện, KHÔNG PHẢI hệ thống sẵn sàng vận hành thật.** Toàn bộ dữ liệu khách hàng trong bản demo này (tên, CCCD, khoản vay...) là **dữ liệu giả**, được sinh tự động, không liên quan đến bất kỳ khách hàng thật nào. **Tuyệt đối không nhập dữ liệu thật của khách hàng vào bản demo này** cho đến khi đã hoàn tất phần backend + bảo mật thật (xem mục "Trước khi dùng thật" bên dưới).

## Bản demo này minh họa gì

Một cổng thông tin cho quỹ tín dụng, gồm:

- **Phía khách hàng**: đăng nhập bằng số CCCD + mật khẩu (admin cấp sẵn, bắt buộc đổi mật khẩu lần đầu) → xem hợp đồng vay của mình (dư nợ, ngày vay, ngày đến hạn, đã trả lãi đến ngày, lãi phát sinh đến hiện tại, hỗ trợ nhiều hợp đồng/người) → **Thanh toán**: chọn trả gốc (lãi tính cố định theo hợp đồng) hoặc trả lãi (mặc định lấy lãi phát sinh, có thể sửa — ô nhập tự có dấu chấm ngăn cách hàng nghìn khi gõ), tự tạo nội dung chuyển khoản + **mã QR VietQR** để quét chuyển tiền, hoặc bấm **"Thanh toán tiếp"** để mở thẳng trang chọn app ngân hàng → gửi yêu cầu tư vấn / mở khoản vay mới.
- **Phía quản trị** (`/#/admin`): quản lý khách hàng (nhập **1 ô địa chỉ**, hệ thống tự tách Xóm/Thôn/Tỉnh) — **đọc trực tiếp file Excel sổ theo dõi vay đang dùng (`.xls` hoặc `.xlsx`)** tải lên, tự khớp đúng cột, tự cập nhật/tạo tài khoản khách hàng, không cần thư viện ngoài. Trang **Khách hàng & Hợp đồng** hiện toàn bộ hợp đồng của mỗi khách hàng ngay khi mở lên (không cần bấm thêm) — mỗi hợp đồng có huy hiệu quá hạn/đang vay riêng; bấm vào 1 hợp đồng xem đầy đủ (số tiền gốc, dư nợ, ngày vay, ngày đến hạn, đã trả lãi đến ngày, lãi suất, lãi đến nay, SĐT) giống hệt màn hình khách hàng — **dữ liệu hợp đồng chỉ đọc, không có ô sửa** (lấy từ Excel, muốn cập nhật thì nhập lại file mới). Số điện thoại bấm vào **gọi luôn** (`tel:`). Ngoài ra: lọc theo Thôn/Xóm và "có nợ quá hạn", tạo tài khoản khách hàng thủ công, cấp lại mật khẩu, xem/xử lý yêu cầu tư vấn, chỉnh banner + thông tin quỹ tín dụng + thông tin nhận thanh toán (QR) + lãi suất mặc định khi nhập liệu.
- **Phân quyền nhân viên**: tài khoản quản trị viên (`super`) toàn quyền, vào **Quản lý nhân viên** để **tạo tài khoản nhân viên** (`staff`) chỉ xem (không sửa/xóa) và **gán quyền xem theo Thôn** — nhân viên chỉ thấy khách hàng/hợp đồng/yêu cầu thuộc các Thôn được gán, dùng cho việc theo dõi nợ quá hạn theo địa bàn phụ trách.

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

Trang **Khách hàng & Hợp đồng** (quản trị viên) → **"Nhập từ Excel"** → chọn đúng file sổ theo dõi vay đang dùng, **đúng theo cột thật của quỹ** (dòng đầu là tiêu đề sẽ tự bỏ qua):

```
Số HĐTD | Người nhận nợ | Địa chỉ | Số CMND/CCCD | Số di động | Ngày nhận nợ | Ngày đáo hạn | Thu lãi đến ngày | Số tiền giải ngân | Số dư | Lãi suất
```

- **Đọc được cả file `.xls` (Excel 97-2003) lẫn `.xlsx`** — nhận diện đúng định dạng tự động, không cần chuyển đổi trước. Cả hai đều đọc **trực tiếp trong trình duyệt** (file .xlsx: giải nén ZIP + đọc XML; file .xls: tự phân tích cấu trúc OLE2 + BIFF8), không cần thư viện ngoài, không cần tải file lên server nào. **Lần sau chỉ cần tải đúng file mẫu này lên là hệ thống tự cập nhật lại toàn bộ dữ liệu khách hàng.**
- Ô ngày tháng đọc đúng cả khi Excel lưu dạng chữ `dd/mm/yyyy` lẫn dạng ngày thật (số serial).
- **Cột "Địa chỉ"**: chỉ cần 1 ô địa chỉ đầy đủ (vd: `Xóm 2, thôn Bình Bắc, xã Bình Sơn, tỉnh Quảng Ngãi`) — hệ thống **tự tách theo dấu phẩy** thành Xóm/Thôn/Tỉnh ngay khi nhập, không cần chia sẵn thành nhiều cột. Nhờ vậy quản trị viên lọc theo Thôn/Xóm và gán quyền cho nhân viên theo địa bàn được ngay.
- Dòng nào thiếu dữ liệu ở 1 vài cột vẫn nhập được — hệ thống tự tính/tự sinh: mã hợp đồng tự sinh nếu thiếu Số HĐTD, Số tiền giải ngân mặc định = Số dư, Ngày đáo hạn mặc định = Ngày nhận nợ + 1 năm, Lãi suất mặc định lấy theo **Cài đặt → Mặc định cho hợp đồng khi nhập liệu**.
- Nhập lại đúng **Số HĐTD** đã có sẽ **cập nhật** hợp đồng đó (không tạo trùng) — vì vậy cách sửa dữ liệu hợp đồng là sửa trong Excel rồi nhập lại, quản trị viên không có ô sửa trực tiếp trên app (xem mục "Khách hàng & Hợp đồng" bên dưới).
- Khách hàng mới sẽ được tự tạo tài khoản (CCCD + mật khẩu tạm), hiển thị ngay sau khi nhập để gửi cho khách hàng.
- Vẫn có lựa chọn "dán dữ liệu thủ công" (copy từ Excel) làm phương án dự phòng.

## Phân quyền theo địa bàn (Thôn/Xóm)

Quản trị viên vào **Quản lý nhân viên** để tạo tài khoản nhân viên, chọn các **Thôn** nhân viên đó được phép xem. Nhân viên đăng nhập sẽ:
- Chỉ thấy khách hàng, hợp đồng, yêu cầu tư vấn thuộc Thôn được gán (ở mọi trang: Tổng quan, Khách hàng & Hợp đồng, Yêu cầu tư vấn).
- Không thấy mục **Cài đặt** và **Quản lý nhân viên** (chỉ quản trị viên `super` mới truy cập được, kể cả gõ thẳng địa chỉ cũng bị chuyển hướng ra ngoài).
- Không sửa/xóa được khách hàng, hợp đồng — chỉ xem.
- Danh sách khách hàng có thể lọc thêm theo Thôn/Xóm cụ thể và theo "Có nợ quá hạn" để tra cứu nhanh.

## Khách hàng & Hợp đồng (quản trị viên) — dữ liệu chỉ đọc

Mỗi khách hàng hiện toàn bộ hợp đồng của họ ngay trong danh sách chính (không cần bấm vào mới thấy) — mỗi hợp đồng có trạng thái Đang vay/Quá hạn/Đã tất toán riêng. Bấm vào 1 hợp đồng để xem đầy đủ: số tiền vay, dư nợ, lãi suất, ngày vay, ngày đến hạn, đã trả lãi đến ngày, lãi đến nay, và số điện thoại (bấm gọi luôn). **Không có ô nhập/nút "Sửa"** — toàn bộ dữ liệu hợp đồng lấy từ Excel, quản trị viên chỉ có nút xóa (dùng khi nhập nhầm); muốn sửa số liệu thì sửa trong file Excel rồi nhập lại. Cột "Kỳ hạn (tháng)" đã bỏ hẳn khỏi hệ thống vì file thật không có và không cần.

Nút **"Tạo tài khoản khách hàng"** dùng khi cần tạo trước 1 tài khoản đăng nhập cho khách chưa có khoản vay nào (chỉ CCCD/họ tên/SĐT/địa chỉ, không có hợp đồng — hợp đồng chỉ vào qua Excel).

## Thanh toán bằng mã QR (VietQR)

Ở trang chi tiết hợp đồng, khách hàng bấm **Thanh toán**:
- **Trả gốc**: nhập số tiền gốc muốn trả (ô nhập tự hiện dấu chấm ngăn cách hàng nghìn khi gõ, vd `1.500.000`); tiền lãi tự lấy đúng theo "Lãi đến nay" của hợp đồng (không sửa được).
- **Trả lãi**: mặc định lấy đúng "Lãi đến nay", khách có thể sửa lại số tiền (cùng kiểu ô nhập có dấu chấm).
- Nội dung chuyển khoản tự sinh theo mẫu: `HỌ TÊN THANH TOAN GOC/LAI HDTD MÃ_HỢP_ĐỒNG` (bỏ dấu, viết hoa, không kèm số tiền trong nội dung vì số tiền đã có ở dòng riêng và trong mã QR).
- Hiển thị mã **QR VietQR** (dùng dịch vụ ảnh công khai `img.vietqr.io`, cần Internet khi khách hàng dùng thật — trong môi trường phát triển không có mạng nên không xem trước được ảnh QR, nhưng sẽ hiển thị bình thường khi deploy thật).
- Nút **"Thanh toán tiếp — Mở app ngân hàng"**: mở liên kết thanh toán nhanh của VietQR (`dl.vietqr.io`) đã điền sẵn số tài khoản/số tiền/nội dung. Trên điện thoại, liên kết này đưa khách hàng tới trang chọn app ngân hàng của VietQR — bấm đúng app đang dùng sẽ nhảy thẳng vào màn hình chuyển khoản điền sẵn thông tin. **Lưu ý:** một trang web thuần không thể tự biết và mở thẳng đúng 1 app ngân hàng cụ thể khách đang cài (không có quyền truy vấn danh sách app trên máy) — đây là cách thực tế gần nhất (1 lần bấm chọn app), và **là dịch vụ ngoài (cần Internet), chưa kiểm thử được với app ngân hàng thật trong môi trường phát triển này** — cần thử trên điện thoại thật trước khi dùng chính thức.
- Thông tin ngân hàng (tên NH, mã BIN VietQR, số tài khoản, tên chủ tài khoản) chỉnh tại **Cài đặt**. **Đã điền sẵn theo thông tin bạn cung cấp (Ngân hàng Hợp tác xã Việt Nam - Co-op Bank, mã BIN 970446) nhưng cần bạn xác minh lại chính xác** tại vietqr.io hoặc với ngân hàng trước khi dùng thật — mã BIN sai sẽ tạo QR không quét được hoặc chuyển nhầm nơi nhận.

## Giới hạn của bản demo (quan trọng)

- **Không có backend/database thật** — dữ liệu lưu trong `localStorage` của trình duyệt, mỗi thiết bị/trình duyệt là 1 kho dữ liệu riêng biệt, không đồng bộ giữa các máy.
- **Không có OTP** — chỉ có tài khoản do admin cấp (CCCD + mật khẩu tạm) + bắt buộc đổi mật khẩu lần đầu + khóa tạm sau nhiều lần đăng nhập sai, KHÔNG thay thế được lớp bảo mật OTP nếu triển khai thật.
- **"Thanh toán tiếp — Mở app ngân hàng"** phụ thuộc dịch vụ `dl.vietqr.io` bên ngoài, chưa thử được với app ngân hàng thật trong môi trường phát triển không có mạng — cần kiểm tra lại trên điện thoại thật (vài app cụ thể) trước khi dùng chính thức; mã QR VietQR để quét thủ công vẫn luôn hoạt động như phương án chính.
- Mật khẩu được băm bằng `crypto.subtle` (SHA-256 + muối) ngay trong trình duyệt cho đúng nguyên tắc, nhưng vì không có server thật đứng sau nên đây **chỉ minh họa luồng**, chưa đạt chuẩn bảo mật để vận hành thật.

## Trước khi dùng thật (bắt buộc)

1. Thay lớp lưu trữ `js/state.js` bằng kết nối tới **database + backend thật** (vd: Supabase) — dữ liệu khách hàng/hợp đồng phải nằm trên server, không phải localStorage.
2. Thêm **OTP** gửi qua SMS thật (nhà cung cấp SMS Brandname) cho đăng nhập/thao tác nhạy cảm.
3. **Xác minh lại mã BIN ngân hàng + số tài khoản** tại Cài đặt trước khi dùng thật.
4. Rà soát tuân thủ **Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân** trước khi thu thập/lưu trữ CCCD của khách hàng thật.
5. Thực hiện **rà soát bảo mật (security review)** độc lập trước khi cho khách hàng thật sử dụng.
