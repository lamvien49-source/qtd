# Quỹ Tín Dụng Nhân Dân Bình Nguyên — Cổng khách hàng (BẢN DEMO)

⚠️ **Đây là bản demo/prototype giao diện, KHÔNG PHẢI hệ thống sẵn sàng vận hành thật.** Toàn bộ dữ liệu khách hàng trong bản demo này (tên, CCCD, khoản vay...) là **dữ liệu giả**, được sinh tự động, không liên quan đến bất kỳ khách hàng thật nào. **Tuyệt đối không nhập dữ liệu thật của khách hàng vào bản demo này** cho đến khi đã hoàn tất phần backend + bảo mật thật (xem mục "Trước khi dùng thật" bên dưới).

## Bản demo này minh họa gì

Một cổng thông tin cho quỹ tín dụng, gồm:

- **Phía khách hàng**: đăng nhập bằng **số CCCD hoặc số điện thoại** + mật khẩu (admin cấp sẵn, bắt buộc đổi mật khẩu lần đầu) → xem hợp đồng vay của mình (dư nợ, ngày vay, ngày đến hạn, đã trả lãi đến ngày, lãi phát sinh đến hiện tại, hỗ trợ nhiều hợp đồng/người) → **Thanh toán**: chọn trả gốc (lãi tính cố định theo hợp đồng) hoặc trả lãi (mặc định lấy lãi phát sinh, có thể sửa — ô nhập tự có dấu chấm ngăn cách hàng nghìn khi gõ), tự tạo nội dung chuyển khoản + **mã QR VietQR** để quét chuyển tiền, bấm **"Chọn app ngân hàng để trả"** để mở bảng chọn ứng dụng có sẵn trên điện thoại (chia sẻ ảnh QR), hoặc **tải ảnh QR về máy** → gửi yêu cầu tư vấn / mở khoản vay mới.
- **Phía quản trị** (`/#/admin`): quản lý khách hàng (nhập **1 ô địa chỉ**, hệ thống tự tách Xóm/Thôn/Tỉnh) — **đọc trực tiếp file Excel sổ theo dõi vay đang dùng (`.xls` hoặc `.xlsx`)** tải lên, tự khớp đúng cột, tự cập nhật/tạo tài khoản khách hàng, không cần thư viện ngoài. Trang **Khách hàng & Hợp đồng**: tên khách hàng luôn hiện trọn 1 dòng riêng (không bị cắt bớt dù tên dài); mỗi khách chỉ 1 hợp đồng thì hiện gọn Gốc/Lãi ngang hàng với thông tin khách, bấm vào là ra thẳng chi tiết hợp đồng; khách nhiều hợp đồng thì mỗi hợp đồng 1 dòng riêng (mã hợp đồng, trạng thái, Gốc/Lãi) — **bấm vào mới ra đầy đủ chi tiết** (số tiền gốc, dư nợ, ngày vay, ngày đến hạn, đã trả lãi đến ngày, lãi suất, lãi đến nay, SĐT) giống hệt màn hình khách hàng, kèm nút **nhắn SMS báo lãi cho khách** ngay tại đó — **dữ liệu hợp đồng chỉ đọc, không có ô sửa** (lấy từ Excel, muốn cập nhật thì nhập lại file mới). Có thể **lọc Thôn/Xóm chọn nhiều mục cùng lúc** và **sắp xếp theo Gốc/Lãi tăng dần-giảm dần**. Số điện thoại bấm vào **gọi luôn** (`tel:`). Trang **Tổng quan** có thêm ô đếm + danh sách **hợp đồng gần đến hạn**, tiêu đề tô màu kèm số lượng để dễ chú ý. Ngoài ra: tạo tài khoản khách hàng thủ công, cấp lại mật khẩu, xem/xử lý yêu cầu tư vấn, chỉnh banner + thông tin quỹ tín dụng + thông tin nhận thanh toán (QR) + lãi suất mặc định khi nhập liệu.
- **Phân quyền nhân viên**: tài khoản quản trị viên (`super`) toàn quyền, vào **Quản lý nhân viên** → **"Tạo nhân viên"** để tạo tài khoản + đặt mật khẩu (hoặc để trống cho tự sinh) + **gán quyền xem ngay trong cùng 1 form** — chọn cả 1 Thôn (xem hết mọi Xóm trong đó) hoặc tích riêng từng Xóm cụ thể nếu chỉ cần 1 phần của Thôn. Nhân viên chỉ thấy khách hàng/hợp đồng/yêu cầu thuộc địa bàn được gán (kể cả ở Tổng quan), dùng cho việc theo dõi nợ quá hạn theo địa bàn phụ trách.

## Tài khoản dùng thử

| Vai trò | Đăng nhập | Mật khẩu |
|---|---|---|
| Khách hàng | CCCD `079300012345` hoặc SĐT `0901 000 001` | `Demo@123` (bắt buộc đổi ngay lần đầu) |
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

Quản trị viên vào **Quản lý nhân viên → "Tạo nhân viên"** — 1 form duy nhất gồm tên đăng nhập, mật khẩu (đặt sẵn hoặc để trống cho tự sinh) và phân quyền xem:
- Tích cả 1 **Thôn** → nhân viên xem được mọi Xóm trong Thôn đó.
- Tích riêng từng **Xóm** (không tích cả Thôn chứa nó) → chỉ xem đúng (các) Xóm đó, phần còn lại của Thôn vẫn bị ẩn.

Nhân viên đăng nhập sẽ:
- Chỉ thấy khách hàng, hợp đồng, yêu cầu tư vấn thuộc Thôn/Xóm được gán (ở mọi trang: Tổng quan, Khách hàng & Hợp đồng, Yêu cầu tư vấn).
- Không thấy mục **Cài đặt** và **Quản lý nhân viên** (chỉ quản trị viên `super` mới truy cập được, kể cả gõ thẳng địa chỉ cũng bị chuyển hướng ra ngoài).
- Không sửa/xóa được khách hàng, hợp đồng — chỉ xem.
- Danh sách khách hàng lọc thêm được theo Thôn/Xóm (**chọn được nhiều mục cùng lúc**) và theo "Có nợ quá hạn" để tra cứu nhanh.

## Khách hàng & Hợp đồng (quản trị viên) — dữ liệu chỉ đọc

Danh sách chính giữ **gọn**, chỉ đủ để lướt nhanh — tên khách hàng luôn hiện trọn 1 dòng riêng phía trên (không bị cắt bớt dù tên dài), thông tin/số tiền nằm ở dòng dưới:
- Khách chỉ có **1 hợp đồng**: dòng thông tin khách hiện thẳng **Gốc / Lãi** của hợp đồng đó ngang hàng với CCCD/SĐT, không có dòng hợp đồng riêng — **bấm vào đúng ô Gốc/Lãi là ra thẳng chi tiết hợp đồng luôn**, không cần qua màn hình khách hàng trước.
- Khách có **nhiều hợp đồng**: mỗi hợp đồng 1 dòng gọn — "Hợp đồng: {mã}", trạng thái (Đang vay/Quá hạn/Đã tất toán), Gốc/Lãi bên phải, bấm vào ra chi tiết hợp đồng đó.
- Có thể **sắp xếp** theo Gốc hoặc Lãi, tăng dần/giảm dần (nút "Sắp xếp" cạnh bộ lọc Thôn/Xóm) — dùng để tìm nhanh khoản vay lớn nhất/nhỏ nhất.
- **Bấm vào mới ra đầy đủ chi tiết**: số tiền vay, dư nợ, lãi suất, ngày vay, ngày đến hạn, đã trả lãi đến ngày, lãi đến nay, số điện thoại (bấm gọi luôn), và nút **"Nhắn SMS báo lãi cho khách"** (mở sẵn app nhắn tin trên điện thoại quản trị viên với nội dung lãi hiện tại, không cần dịch vụ SMS ngoài, không tốn phí phần mềm — dùng đúng SMS/data của máy quản trị viên).
- **Không có ô nhập/nút "Sửa"** — toàn bộ dữ liệu hợp đồng lấy từ Excel, quản trị viên chỉ có nút xóa (dùng khi nhập nhầm); muốn sửa số liệu thì sửa trong file Excel rồi nhập lại. Cột "Kỳ hạn (tháng)" đã bỏ hẳn khỏi hệ thống vì file thật không có và không cần.

Nút **"Tạo tài khoản khách hàng"** dùng khi cần tạo trước 1 tài khoản đăng nhập cho khách chưa có khoản vay nào (CCCD + họ tên + SĐT + địa chỉ — nên nhập cả CCCD lẫn SĐT vì khách đăng nhập được bằng cả 2 số; không có hợp đồng — hợp đồng chỉ vào qua Excel).

## Cảnh báo gần đến hạn

Trang **Tổng quan** (cả quản trị viên và nhân viên) có thêm ô đếm + danh sách **"Gần đến hạn"** — các hợp đồng còn tối đa 15 ngày nữa tới ngày đến hạn (chưa quá hạn), cạnh ô hợp đồng quá hạn, để chủ động nhắc khách trước khi trễ hạn. Cả 2 tiêu đề "Hợp đồng quá hạn" và "Gần đến hạn" đều tô màu (đỏ/cam) kèm số lượng ngay trong tiêu đề (VD: "Hợp đồng quá hạn (05)") để dễ chú ý. Nhân viên chỉ thấy hợp đồng thuộc Thôn/Xóm được gán, giống mọi số liệu khác trên trang này.

## Thanh toán bằng mã QR (VietQR)

Ở trang chi tiết hợp đồng, khách hàng bấm **Thanh toán**:
- **Trả gốc**: nhập số tiền gốc muốn trả (ô nhập tự hiện dấu chấm ngăn cách hàng nghìn khi gõ, vd `1.500.000`); tiền lãi tự lấy đúng theo "Lãi đến nay" của hợp đồng (không sửa được).
- **Trả lãi**: mặc định lấy đúng "Lãi đến nay", khách có thể sửa lại số tiền (cùng kiểu ô nhập có dấu chấm).
- Nội dung chuyển khoản tự sinh theo mẫu: `HỌ TÊN THANH TOAN GOC/LAI HDTD MÃ_HỢP_ĐỒNG` (bỏ dấu, viết hoa, không kèm số tiền trong nội dung vì số tiền đã có ở dòng riêng và trong mã QR).
- Hiển thị mã **QR VietQR** (dùng dịch vụ ảnh công khai `img.vietqr.io`, cần Internet khi khách hàng dùng thật — trong môi trường phát triển không có mạng nên không xem trước được ảnh QR, nhưng sẽ hiển thị bình thường khi deploy thật). **Đây là cách chắc chắn hoạt động** với mọi ngân hàng/ví hỗ trợ VietQR.
- Nút **"Chọn app ngân hàng để trả"**: dùng Web Share API chuẩn của trình duyệt (`navigator.share`) — bấm vào sẽ mở đúng **bảng chọn ứng dụng có sẵn trên điện thoại** (giống khi chia sẻ ảnh từ Zalo/Ảnh...), khách chọn app ngân hàng/ví nào hỗ trợ nhận ảnh để tự quét mã QR trong app đó. Đây là API trình duyệt thật, không đi qua trang trung gian nào (đã bỏ hẳn cách cũ qua `dl.vietqr.io` vì bắt buộc chọn đúng ngân hàng theo mã chưa xác minh được và bạn báo là không hoạt động). Máy tính/trình duyệt không hỗ trợ chia sẻ sẽ tự báo và gợi ý dùng nút tải ảnh.
- Nút **"Tải ảnh mã QR"**: tải file ảnh QR về máy (hoặc mở ảnh để nhấn giữ lưu nếu trình duyệt chặn tải trực tiếp) — dùng khi muốn lưu lại, gửi cho người khác chuyển giúp, hoặc mở từ thư viện ảnh trong app ngân hàng để quét.
- Thông tin ngân hàng (tên NH, mã BIN VietQR, số tài khoản, tên chủ tài khoản) chỉnh tại **Cài đặt**. **Đã điền sẵn theo thông tin bạn cung cấp (Ngân hàng Hợp tác xã Việt Nam - Co-op Bank, mã BIN 970446) nhưng cần bạn xác minh lại chính xác** tại vietqr.io hoặc với ngân hàng trước khi dùng thật — mã BIN sai sẽ tạo QR không quét được hoặc chuyển nhầm nơi nhận.

## Giới hạn của bản demo (quan trọng)

- **Không có backend/database thật** — dữ liệu lưu trong `localStorage` của trình duyệt, mỗi thiết bị/trình duyệt là 1 kho dữ liệu riêng biệt, không đồng bộ giữa các máy.
- **Không có OTP** — chỉ có tài khoản do admin cấp (CCCD + mật khẩu tạm) + bắt buộc đổi mật khẩu lần đầu + khóa tạm sau nhiều lần đăng nhập sai, KHÔNG thay thế được lớp bảo mật OTP nếu triển khai thật.
- **"Chọn app ngân hàng để trả"** dùng Web Share API của trình duyệt — hiện đúng bảng chọn app trên điện thoại, nhưng việc app ngân hàng cụ thể có nhận & tự quét được ảnh chia sẻ hay không tùy vào từng app (đa số hỗ trợ "quét QR từ ảnh" trong mục chuyển khoản); nếu app không tự nhận diện được, khách vẫn mở được ảnh và quét thủ công như bình thường. Chưa kiểm thử được trên điện thoại thật vì môi trường phát triển không có Internet ra ngoài — mã QR để quét trực tiếp bằng camera vẫn luôn là phương án chắc chắn hoạt động nhất.
- **"Nhắn SMS báo lãi"** mở app nhắn tin có sẵn trên điện thoại quản trị viên (liên kết `sms:`) với nội dung soạn sẵn — quản trị viên vẫn phải tự bấm Gửi và tin nhắn tính phí theo SIM/gói cước của máy đó, KHÔNG phải hệ thống tự động gửi SMS hàng loạt qua tổng đài SMS Brandname.
- Mật khẩu được băm bằng `crypto.subtle` (SHA-256 + muối) ngay trong trình duyệt cho đúng nguyên tắc, nhưng vì không có server thật đứng sau nên đây **chỉ minh họa luồng**, chưa đạt chuẩn bảo mật để vận hành thật.

## Trước khi dùng thật (bắt buộc)

1. Thay lớp lưu trữ `js/state.js` bằng kết nối tới **database + backend thật** (vd: Supabase) — dữ liệu khách hàng/hợp đồng phải nằm trên server, không phải localStorage.
2. Thêm **OTP** gửi qua SMS thật (nhà cung cấp SMS Brandname) cho đăng nhập/thao tác nhạy cảm.
3. **Xác minh lại mã BIN ngân hàng + số tài khoản** tại Cài đặt trước khi dùng thật.
4. Rà soát tuân thủ **Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân** trước khi thu thập/lưu trữ CCCD của khách hàng thật.
5. Thực hiện **rà soát bảo mật (security review)** độc lập trước khi cho khách hàng thật sử dụng.
