# Quỹ Tín Dụng Nhân Dân Bình Nguyên — Cổng khách hàng (BẢN DEMO)

⚠️ **Đây là bản demo/prototype giao diện, KHÔNG PHẢI hệ thống sẵn sàng vận hành thật.** Toàn bộ dữ liệu khách hàng trong bản demo này (tên, CCCD, khoản vay...) là **dữ liệu giả**, được sinh tự động, không liên quan đến bất kỳ khách hàng thật nào. **Tuyệt đối không nhập dữ liệu thật của khách hàng vào bản demo này** cho đến khi đã hoàn tất phần backend + bảo mật thật (xem mục "Trước khi dùng thật" bên dưới).

## Bản demo này minh họa gì

Một cổng thông tin cho quỹ tín dụng, gồm:

- **Phía khách hàng**: đăng nhập bằng **số CCCD hoặc số điện thoại** (khoảng trắng trong SĐT tự bỏ, gõ có dấu cách hay không đều đăng nhập được) + mật khẩu (admin cấp sẵn, bắt buộc đổi mật khẩu lần đầu) → xem hợp đồng vay của mình (dư nợ, ngày vay, ngày đến hạn, đã trả lãi đến ngày, lãi phát sinh đến hiện tại, hỗ trợ nhiều hợp đồng/người) → **Thanh toán**: chọn trả gốc (lãi tính cố định theo hợp đồng) hoặc trả lãi (mặc định lấy lãi phát sinh, có thể sửa — ô nhập tự có dấu chấm ngăn cách hàng nghìn khi gõ), tự tạo nội dung chuyển khoản + **mã QR VietQR** để quét chuyển tiền, **tải ảnh QR về máy**, hoặc bấm **"Chia sẻ ảnh QR"** để mở bảng chọn ứng dụng có sẵn trên điện thoại → gửi yêu cầu tư vấn / mở khoản vay mới.
- **Phía quản trị** (`/#/admin`): quản lý khách hàng (nhập **1 ô địa chỉ**, hệ thống tự tách Xóm/Thôn/Tỉnh) — **đọc trực tiếp file Excel sổ theo dõi vay đang dùng (`.xls` hoặc `.xlsx`)** tải lên, tự khớp đúng cột, tự cập nhật hồ sơ + tự cấp tài khoản Use cho khách hoàn toàn mới (xem mục "Hồ sơ khách hàng vs. tài khoản đăng nhập" bên dưới), không cần thư viện ngoài. Trang **Khách hàng & Hợp đồng**: tên khách hàng luôn hiện trọn 1 dòng riêng (không bị cắt bớt dù tên dài) kèm badge **Quá hạn N ngày**/**Gần đến hạn N ngày** ngay sau tên nếu có hợp đồng cần chú ý (kèm luôn số ngày cho dễ nhìn, lấy hợp đồng đáng chú ý nhất nếu khách có nhiều hợp đồng); mỗi khách chỉ 1 hợp đồng thì hiện gọn **Gốc (= dư nợ hiện tại) / Lãi** ngang hàng với thông tin khách, bấm vào là ra thẳng chi tiết hợp đồng; khách nhiều hợp đồng thì mỗi hợp đồng 1 dòng riêng (mã hợp đồng, trạng thái — **Quá hạn**/**Gần đến hạn** thay cho "Trong hạn" khi cần chú ý, Gốc/Lãi) — **bấm vào mới ra đầy đủ chi tiết** (số tiền vay ban đầu, dư nợ, ngày vay, ngày đến hạn, đã trả lãi đến ngày, lãi suất, lãi đến nay, SĐT) giống hệt màn hình khách hàng, kèm nút **nhắn SMS báo lãi cho khách** ngay tại đó — **dữ liệu hợp đồng chỉ đọc, không có ô sửa** (lấy từ Excel, muốn cập nhật thì nhập lại file mới). Có thể **lọc Thôn/Xóm chọn nhiều mục cùng lúc** (kèm nút "Chọn tất cả"/"Bỏ chọn tất cả" cho nhanh), lọc theo **Nợ quá hạn**/**Gần đến hạn** (chọn được cả 2 cùng lúc), và **sắp xếp theo Gốc/Lãi tăng dần-giảm dần**. Số điện thoại bấm vào **gọi luôn** (`tel:`). Trang **Tổng quan** có thêm ô đếm + danh sách **hợp đồng gần đến hạn**, tiêu đề tô màu kèm số lượng để dễ chú ý. Ngoài ra: xem/xử lý yêu cầu tư vấn, chỉnh banner + thông tin quỹ tín dụng + thông tin nhận thanh toán (QR).
- **Quản lý User**: 1 trang duy nhất quản lý **toàn bộ tài khoản trong hệ thống** — cả "Use" (khách hàng **đã có tài khoản đăng nhập**, hồ sơ Excel-only chưa cấp tài khoản không tính vào đây) lẫn "Quản trị viên" (toàn quyền hoặc chỉ xem) — chỉ quản trị viên toàn quyền vào được. Hiện số lượng Use/Quản trị viên đã tạo, lọc theo loại tài khoản, bấm vào 1 tài khoản để xem thông tin + cấp lại mật khẩu bất cứ lúc nào (**tự nhập mật khẩu cụ thể hoặc để trống cho tự sinh**). Nút **"Tạo User"** có mục chọn loại tài khoản: **Use** (chỉ cần **CCCD + mật khẩu** — không còn ô họ tên/SĐT/địa chỉ, vì nhập file Excel có CCCD này thì Use tự động đồng bộ lấy đúng thông tin; CCCD đã có tài khoản rồi sẽ báo trùng, dùng "Cấp lại mật khẩu" thay vì tạo lại) hoặc **Quản trị viên** (tên đăng nhập + mật khẩu tự đặt hoặc tự sinh + chọn vai trò Toàn quyền/Chỉ xem — chọn "Chỉ xem" sẽ hiện thêm mục **phân quyền theo Thôn/Xóm** ngay trong form, kèm nút "Chọn tất cả"/"Bỏ chọn tất cả", các Xóm hiển thị dạng nút bấm gọn đẹp). Nút **"Xóa Use"** trong trang này **chỉ gỡ tài khoản đăng nhập**, không đụng đến hồ sơ/hợp đồng (2 thứ độc lập — xem mục kế tiếp); muốn xóa hẳn cả hồ sơ/hợp đồng thì dùng nút "Xóa khách hàng" bên trang Khách hàng & Hợp đồng. Mọi loại User (khách hàng lẫn quản trị viên) đều có mục **"Đổi mật khẩu"** tự chọn bất cứ lúc nào (sidebar + bảng "Thêm" trên di động), không chỉ riêng lần đăng nhập đầu bắt buộc.
- **Menu gọn gàng trên điện thoại**: thanh menu dưới cùng chỉ hiện tối đa 3 mục chính + nút **"Thêm"** (gộp các trang ít dùng như Quản lý User/Cài đặt, **Đổi mật khẩu**, và Đăng xuất vào 1 bảng chọn) — tránh bị lệch/chồng chữ khi tài khoản toàn quyền có nhiều trang quản trị.
- **Đổi mật khẩu tự chọn**: mọi loại tài khoản (khách hàng lẫn quản trị viên/nhân viên) đều có mục **"Đổi mật khẩu"** dùng được bất cứ lúc nào (không chỉ bắt buộc ở lần đăng nhập đầu) — cần nhập đúng mật khẩu hiện tại để xác nhận trước khi đặt mật khẩu mới. Truy cập qua nút trong sidebar hoặc bảng "Thêm" trên di động.
- **Không tự cuộn lên đầu trang sau khi thao tác**: xóa/tạo/sửa... xong thì màn hình vẫn đứng đúng vị trí vừa thao tác — chỉ cuộn lên đầu khi thật sự chuyển sang trang khác.

## Tài khoản dùng thử

| Vai trò | Đăng nhập | Mật khẩu |
|---|---|---|
| Khách hàng | CCCD `079300012345` hoặc SĐT `0901 000 001` | `Demo@123` (bắt buộc đổi ngay lần đầu) |
| Quản trị viên (toàn quyền) | `admin` | `Admin@123` |
| Nhân viên (chỉ xem, giới hạn Thôn 1) | `nhanvien1` | `Staff@123` |

Màn đăng nhập/đổi mật khẩu khai báo đúng chuẩn `autocomplete` (`username`/`current-password`/`new-password`) để **trình duyệt tự đề nghị lưu và tự điền mật khẩu** cho lần đăng nhập sau — không tự lưu mật khẩu dạng chữ thường (plaintext) trong ứng dụng, giao việc ghi nhớ cho trình quản lý mật khẩu an toàn sẵn có của trình duyệt.

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

- **Đọc được cả file `.xls` (Excel 97-2003) lẫn `.xlsx`** — nhận diện đúng định dạng tự động, không cần chuyển đổi trước. Cả hai đều đọc **trực tiếp trong trình duyệt** (file .xlsx: giải nén ZIP + đọc XML; file .xls: tự phân tích cấu trúc OLE2 + BIFF8), không cần thư viện ngoài, không cần tải file lên server nào.
- **Chọn file xong bấm nút "Tải lên" mới thật sự xử lý** (không tự chạy ngay khi vừa chọn) — tránh xử lý nhầm khi chọn sai file. Nút hiện rõ tiến độ: "Đang đọc file..." rồi "Đang xử lý...", và khi xong hiện lại "Tải lên" kèm khung kết quả "✅ Đã nhập xong..." — biết chắc chắn lúc nào việc nhập đã hoàn tất.
- **Xử lý nhanh kể cả file lớn hàng trăm dòng**: toàn bộ việc lưu dữ liệu + vẽ lại màn hình chỉ chạy **1 lần duy nhất sau khi nhập xong cả file**, không chạy lặp lại theo từng dòng — file thử nghiệm 600 dòng nhập xong trong khoảng 1 giây.
- Ô ngày tháng đọc đúng cả khi Excel lưu dạng chữ `dd/mm/yyyy` lẫn dạng ngày thật (số serial).
- **Cột "Địa chỉ"**: chỉ cần 1 ô địa chỉ đầy đủ (vd: `Xóm 2, thôn Bình Bắc, xã Bình Sơn, tỉnh Quảng Ngãi`) — hệ thống **tự tách theo dấu phẩy** thành Xóm/Thôn/Tỉnh ngay khi nhập, không cần chia sẵn thành nhiều cột. Nhờ vậy quản trị viên lọc theo Thôn/Xóm và gán quyền cho nhân viên theo địa bàn được ngay.
- Dòng nào thiếu dữ liệu ở 1 vài cột vẫn nhập được — hệ thống tự tính/tự sinh: mã hợp đồng tự sinh nếu thiếu Số HĐTD, Số tiền giải ngân mặc định = Số dư, Ngày đáo hạn mặc định = Ngày nhận nợ + 1 năm, Lãi suất giữ nguyên giá trị cũ nếu hợp đồng đã có (bỏ trống ở dòng cập nhật sẽ không xóa lãi suất đang lưu), hoặc = 0 nếu là hợp đồng hoàn toàn mới và bỏ trống.
- Nhập lại đúng **Số HĐTD** đã có sẽ **cập nhật** hợp đồng đó (không tạo trùng) — vì vậy cách sửa dữ liệu hợp đồng là sửa trong Excel rồi nhập lại, quản trị viên không có ô sửa trực tiếp trên app (xem mục "Khách hàng & Hợp đồng" bên dưới).
- **Tải file lên = coi như thay hoàn toàn bằng dữ liệu mới (full-sync)**: hợp đồng nào đang có trong hệ thống mà **không còn xuất hiện** trong file vừa tải sẽ **tự động bị xóa**, và **tên/SĐT/địa chỉ của MỌI khách hàng khớp CCCD trong file đều được cập nhật ghi đè theo đúng dữ liệu mới nhất** (kể cả khách đã có sẵn hồ sơ/tài khoản Use — Excel là nguồn sự thật, lần đăng nhập sau Use sẽ tự thấy ngay thông tin mới vì dùng chung 1 hồ sơ). Khách hàng nào sau đó **không còn dư nợ nào** (hết hợp đồng, hoặc còn hợp đồng nhưng tổng dư nợ = 0) **và cũng chưa có tài khoản Use** thì hồ sơ cũng được **dọn luôn, không hiển thị ở Khách hàng & Hợp đồng nữa** (Use thì luôn giữ lại dù hết dư nợ — xem mục kế tiếp). Mục **"dán dữ liệu thủ công"** (copy từ Excel, dùng cho vài dòng lẻ) vẫn cập nhật hồ sơ/hợp đồng theo cùng nguyên tắc trên nhưng **không xóa hợp đồng nào khác** ngoài đúng những dòng vừa dán (không áp dụng full-sync) — an toàn khi chỉ muốn bổ sung/sửa nhanh vài dòng.
- **CCCD hoàn toàn mới** (chưa từng có trong hệ thống) → ngoài tạo hồ sơ còn **tự động cấp luôn tài khoản Use** (mật khẩu tự sinh ngẫu nhiên, hiện ra ngay sau khi nhập để gửi cho khách). **CCCD đã có sẵn** → chỉ cập nhật hồ sơ + hợp đồng, **không đụng đến tài khoản đăng nhập đã cấp** (mật khẩu vẫn giữ nguyên).

## Hồ sơ khách hàng vs. tài khoản đăng nhập (quan trọng)

Bản demo tách riêng 2 khái niệm, **độc lập với nhau theo cả 2 chiều**:
- **Hồ sơ khách hàng** (tên, CCCD, SĐT, địa chỉ, hợp đồng) — do **Excel quyết định**, luôn khớp đúng file mới nhất tải lên (full-sync, xem mục trên) — kể cả khách đã có sẵn hồ sơ/tài khoản cũng được cập nhật ghi đè theo dữ liệu mới nhất.
- **Tài khoản đăng nhập** (CCCD/SĐT + mật khẩu) — CCCD hoàn toàn mới thì Excel **tự cấp luôn**; hoặc admin **tự tạo tay** bất cứ lúc nào ở nút "Tạo User" cho khách đã có hồ sơ. Tạo xong là đăng nhập được ngay, không cần chờ hay làm thêm bước nào.

Việc dò hợp đồng theo CCCD diễn ra **mỗi lần hiển thị** (không lưu cứng liên kết theo thời điểm tạo tài khoản), nên:
- Hợp đồng nào tất toán (dư nợ về 0) thì khách **vẫn đăng nhập được, vẫn gửi yêu cầu tư vấn bình thường** — không bị khóa tài khoản (dù hồ sơ đó có thể không còn hiện trong danh sách Khách hàng & Hợp đồng nữa nếu tổng dư nợ về 0 và chưa có tài khoản Use — xem mục dưới).
- Nếu khách **vay lại** (admin nhập lại Excel với dư nợ mới cho đúng CCCD đó), lần đăng nhập tiếp theo tự động thấy ngay dư nợ mới — không cần admin làm gì thêm với tài khoản đã có.
- Hồ sơ chưa được cấp tài khoản thì khi thử đăng nhập sẽ báo rõ: "CCCD/SĐT này chưa được cấp tài khoản đăng nhập — liên hệ quỹ tín dụng để được tạo tài khoản."
- **Xóa Use** (ở trang Quản lý User) chỉ gỡ tài khoản đăng nhập — **không đụng đến hồ sơ/hợp đồng**, vẫn còn nguyên bên Khách hàng & Hợp đồng (trừ khi tổng dư nợ đã về 0, xem mục dưới), có thể "Tạo User" lại bất cứ lúc nào không mất dữ liệu.
- Khách hàng **không còn dư nợ nào** (hết hợp đồng, hoặc còn hợp đồng nhưng tổng dư nợ = 0 — kể cả khi file Excel mới nhất không còn CCCD đó nữa nên hợp đồng đã bị full-sync xóa) thì sẽ **không hiển thị trong mục Khách hàng & Hợp đồng nữa**. Nếu khách đó **chưa có tài khoản Use**, hồ sơ cũng bị xóa hẳn luôn (đỡ rác dữ liệu). Nếu **đã có tài khoản Use**, hồ sơ/tài khoản vẫn được **giữ nguyên phía sau** (khách vẫn đăng nhập được, vẫn quản lý được ở trang Quản lý User) — chỉ đơn giản là không còn hiện trong danh sách "đang vay" ở Khách hàng & Hợp đồng nữa vì không còn dư nợ nào để theo dõi. Việc dọn/lọc này áp dụng mỗi khi vào trang, cùng lúc với mỗi lần tải file Excel (full-sync) hoặc xóa hợp đồng thủ công.
- Tạo User cho 1 CCCD **đã có tài khoản rồi** sẽ báo lỗi trùng thay vì âm thầm ghi đè — muốn đặt mật khẩu mới thì dùng "Cấp lại mật khẩu".

## Quản lý User — quản lý mọi tài khoản ở 1 chỗ

Trang **Quản lý User** (`/#/admin/nhan-vien`, chỉ quản trị viên toàn quyền vào được) gộp chung quản lý 2 loại tài khoản:

- **Use** = tài khoản khách hàng **đã có thể đăng nhập** (chỉ xem được hợp đồng của chính mình). Hồ sơ nhập từ Excel nhưng chưa được cấp tài khoản KHÔNG tính là Use, không hiện ở đây — xem ở trang Khách hàng & Hợp đồng.
- **Quản trị viên** = tài khoản `super` (toàn quyền) hoặc `staff` (chỉ xem, giới hạn theo địa bàn).

Trang hiện **số lượng Use / Quản trị viên đã tạo**, có **ô tìm kiếm** (theo tên, CCCD, SĐT, tên đăng nhập) và lọc riêng từng loại, bấm vào 1 tài khoản để xem thông tin. Với "Use" chưa từng đăng nhập (hoặc đã đăng nhập nhưng chưa đổi mật khẩu): **mật khẩu hiện tại hiện thẳng ngay trong màn xem**, không cần bấm "Cấp lại mật khẩu" mới thấy — chỉ khi khách đã tự đổi mật khẩu riêng thì mới cần cấp lại (vì lúc đó hệ thống không còn biết mật khẩu cũ). Nút **"Tạo User"** có mục chọn loại tài khoản ngay đầu form:
- Chọn **Use** → chỉ cần **CCCD + mật khẩu** (tự đặt hoặc để trống cho tự sinh) — **không còn ô họ tên/SĐT/địa chỉ**: nhập file Excel có CCCD này thì Use tự động đồng bộ lấy đúng tên/SĐT/địa chỉ, không cần nhập tay. CCCD đã có tài khoản rồi sẽ **báo lỗi trùng** thay vì âm thầm ghi đè. Tạo xong đăng nhập được ngay và tự động thấy mọi hợp đồng khớp CCCD.
- Chọn **Quản trị viên** → tên đăng nhập + mật khẩu (tự đặt hoặc để trống cho tự sinh) + chọn vai trò **Toàn quyền** hoặc **Chỉ xem**. Chọn "Chỉ xem" hiện thêm mục **phân quyền theo Thôn/Xóm** ngay trong form, kèm nút **"Chọn tất cả"/"Bỏ chọn tất cả"** để thao tác nhanh:
  - Tích cả 1 **Thôn** → xem được mọi Xóm trong Thôn đó.
  - Bấm riêng từng **Xóm** (hiển thị dạng nút bấm/chip gọn đẹp, không cần tích cả Thôn chứa nó) → chỉ xem đúng (các) Xóm đó, phần còn lại của Thôn vẫn bị ẩn.

Nút **"Xóa Use"** ở màn chi tiết chỉ gỡ tài khoản đăng nhập, **không xóa hồ sơ/hợp đồng** của khách (2 thứ độc lập) — hợp đồng vẫn còn nguyên bên Khách hàng & Hợp đồng, admin có thể "Tạo User" lại bất cứ lúc nào.

Quản trị viên chỉ xem (`staff`) đăng nhập sẽ:
- Chỉ thấy khách hàng, hợp đồng, yêu cầu tư vấn thuộc Thôn/Xóm được gán (ở mọi trang: Tổng quan, Khách hàng & Hợp đồng, Yêu cầu tư vấn).
- Không thấy mục **Cài đặt** và **Quản lý User** (chỉ quản trị viên toàn quyền mới truy cập được, kể cả gõ thẳng địa chỉ cũng bị chuyển hướng ra ngoài).
- Không sửa/xóa được khách hàng, hợp đồng — chỉ xem.
- Danh sách khách hàng lọc thêm được theo Thôn/Xóm (**chọn được nhiều mục cùng lúc, kèm nút "Chọn tất cả"/"Bỏ chọn tất cả"**) và theo **Nợ quá hạn** / **Gần đến hạn** (chọn được cả 2 cùng lúc) để tra cứu nhanh.

## Khách hàng & Hợp đồng (quản trị viên) — dữ liệu chỉ đọc

Danh sách chính giữ **gọn**, chỉ đủ để lướt nhanh — tên khách hàng luôn hiện trọn 1 dòng riêng phía trên (không bị cắt bớt dù tên dài) kèm badge **Quá hạn** (đỏ) hoặc **Gần đến hạn** (vàng) ngay sau tên nếu có hợp đồng cần chú ý, thông tin/số tiền nằm ở dòng dưới. Đầu danh sách hiện thống kê dạng "N khách hàng · M hợp đồng":
- Khách chỉ có **1 hợp đồng**: dòng thông tin khách hiện thẳng **Gốc / Lãi** ngang hàng với CCCD/SĐT, không có dòng hợp đồng riêng — **bấm vào đúng ô Gốc/Lãi là ra thẳng chi tiết hợp đồng luôn**, không cần qua màn hình khách hàng trước. **"Gốc" ở đây là dư nợ hiện tại (số còn phải trả)**, không phải số tiền vay ban đầu — số tiền vay ban đầu chỉ hiện trong màn chi tiết hợp đồng.
- Khách có **nhiều hợp đồng**: mỗi hợp đồng 1 dòng gọn — "Hợp đồng: {mã}", trạng thái (**Quá hạn**/**Gần đến hạn**/Trong hạn/Đã tất toán — "Gần đến hạn" thay cho "Trong hạn" khi hợp đồng sắp tới ngày đến hạn), Gốc/Lãi bên phải, bấm vào ra chi tiết hợp đồng đó.
- Lọc theo **Nợ quá hạn** / **Gần đến hạn** (chip cạnh bộ lọc Thôn/Xóm, chọn được cả 2 cùng lúc — Thôn/Xóm cũng có nút "Chọn tất cả"/"Bỏ chọn tất cả" để thao tác nhanh), có thể **sắp xếp** theo Gốc hoặc Lãi, tăng dần/giảm dần (nút "Sắp xếp") — dùng để tìm nhanh khoản vay lớn nhất/nhỏ nhất hoặc khách cần nhắc trước.
- Danh sách **Xóm** trong bộ lọc/phân quyền sắp theo **thứ tự số tự nhiên** (01, 02, 03, 08, 8/1, 8/2, 09, 10...) thay vì so chuỗi ký tự (sẽ ra sai thứ tự kiểu 01, 09, 10, 8/1...). Chọn nhiều Xóm cùng lúc lọc đúng dữ liệu bất kể bấm chọn theo thứ tự nào.
- **Bấm vào mới ra đầy đủ chi tiết**: số tiền vay ban đầu, dư nợ hiện tại, lãi suất, ngày vay, ngày đến hạn, đã trả lãi đến ngày, lãi đến nay, số điện thoại (bấm gọi luôn), nút **"Nhắn SMS báo lãi cho khách"** (mở sẵn app nhắn tin trên điện thoại quản trị viên với nội dung lãi hiện tại, không cần dịch vụ SMS ngoài, không tốn phí phần mềm — dùng đúng SMS/data của máy quản trị viên), và **mã QR VietQR**: 2 ô **Gốc**/**Lãi** xếp cùng hàng — **Lãi tự điền sẵn "Lãi đến nay"**, **Gốc để trống**, cần thu thêm gốc thì tự gõ vào; số tiền trên QR luôn là **Gốc + Lãi cộng lại**, sửa ô nào cũng vẽ lại ảnh QR ngay. 2 nút **"Tải ảnh mã QR"**/**"Chia sẻ ảnh QR"** xếp cùng hàng ngay phía trên ảnh QR cho gọn, giống hệt cơ chế bên khách hàng — quản trị viên/nhân viên dùng để gửi nhanh mã QR cho khách (qua Zalo, tin nhắn...) để khách tự quét chuyển khoản, không cần khách tự vào hệ thống.
- **Không có ô nhập/nút "Sửa"** — toàn bộ dữ liệu hợp đồng lấy từ Excel, quản trị viên chỉ có nút xóa (dùng khi nhập nhầm); muốn sửa số liệu thì sửa trong file Excel rồi nhập lại (màn chi tiết không còn ghi chú dòng này nữa cho gọn, nhưng cách cập nhật vẫn vậy). Cột "Kỳ hạn (tháng)" đã bỏ hẳn khỏi hệ thống vì file thật không có và không cần.
- Nút **"Xóa"** ở đây là **"Xóa khách hàng"** — xóa cả hồ sơ lẫn hợp đồng (khác với "Xóa Use" bên trang Quản lý User, chỉ gỡ tài khoản đăng nhập).

Nút **"Tạo tài khoản khách hàng"** ở trang này dùng khi cần cấp tài khoản đăng nhập cho 1 khách (có mục đặt mật khẩu, không có ô địa chỉ) — làm y hệt việc chọn "Use" ở trang **Quản lý User**, chỉ là lối tắt tại đây cho tiện. **Toàn bộ hồ sơ/hợp đồng nhập từ Excel đều hiện đầy đủ ở đây** dù đã được cấp tài khoản đăng nhập hay chưa — xem mục "Hồ sơ khách hàng vs. tài khoản đăng nhập" ở trên để biết cách 2 khái niệm này liên hệ với nhau.

## Trạng thái hợp đồng — tự tính theo dư nợ + ngày đến hạn

Vì file Excel thật không có cột trạng thái nào, hệ thống **không dựa vào trạng thái lưu sẵn** để xác định "Trong hạn/Quá hạn/Đã tất toán" nữa mà **tự tính lại mỗi lần hiển thị**, dựa trên đúng 2 dữ liệu luôn có sẵn:
- **Đã tất toán**: dư nợ (Số dư) ≤ 0.
- **Quá hạn**: còn dư nợ VÀ đã qua Ngày đáo hạn.
- **Trong hạn**: còn lại các trường hợp khác.

Nhờ vậy, hợp đồng nào import từ Excel mà đã qua ngày đến hạn sẽ luôn được tính đúng là quá hạn ngay khi nhập, không cần phải có sẵn cột "trạng thái" nào trong file.

## Cách tính lãi

Lãi phát sinh = Số dư × số ngày × lãi suất năm ÷ 365, **làm tròn đến hàng nghìn gần nhất** (VD: 81.500 → 82.000; 81.350 → 81.000). Số ngày tính lãi = số ngày từ "Thu lãi đến ngày" tới hôm nay như bình thường, **trừ trường hợp đặc biệt** "Thu lãi đến ngày" = ngày giải ngân + 1 ngày (quy ước thu lãi ngày đầu ngay lúc giải ngân) thì **cộng thêm 1 ngày** so với cách tính thường (VD: giải ngân 17/08, thu lãi đến ngày 18/08, hôm nay 19/08 → bình thường ra 1 ngày, cộng thêm 1 ngày đặc biệt = 2 ngày tính lãi).

## Tổng quan quản trị

4 ô thống kê đầu trang xếp đều 1 hàng cân đối — đã bỏ ô "Yêu cầu mới" khỏi hàng này (trước đây có 5 ô nên bị lệch, ô cuối rơi xuống hàng riêng):
- **Tổng khách hàng**, **Tổng dư nợ** — số liệu thuần, không bấm vào đâu được. **Tổng khách hàng chỉ đếm khách còn dư nợ > 0**, đúng bằng số khách thực sự hiện ra ở trang **Khách hàng & Hợp đồng** (trang đó cũng ẩn khách hết dư nợ), để 2 nơi luôn khớp nhau, không bị lệch số.
- **Hợp đồng quá hạn**, **Gần đến hạn** (cả quản trị viên và nhân viên đều thấy, nhân viên chỉ tính hợp đồng thuộc Thôn/Xóm được gán) — mỗi ô gộp sẵn **số lượng + tổng số tiền** ngay trong ô (dòng "Tổng cộng" nhỏ bên dưới số lượng) để không cần mở gì thêm cũng biết ngay tình hình. "Gần đến hạn" tính các hợp đồng còn tối đa 15 ngày nữa tới hạn (chưa quá hạn). **Bấm thẳng vào ô** ra danh sách đầy đủ của đúng nhóm đó (chỉ hợp đồng quá hạn, hoặc chỉ hợp đồng gần đến hạn — không lẫn lộn với nhau hay hợp đồng khác), có dòng tổng cộng ở đầu danh sách, mỗi dòng hiện thẳng **số tiền** (tô màu đỏ/vàng theo nhóm) thay vì nhãn trạng thái hay "Còn N ngày", bấm vào 1 dòng mở thẳng chi tiết hợp đồng luôn. Không còn 2 bảng xem trước riêng bên dưới nữa (đã gộp hết vào chính ô thống kê).

**Quay lại đúng màn hình trước đó**: từ danh sách này (hoặc từ chi tiết khách hàng ở trang Khách hàng & Hợp đồng) bấm vào 1 dòng để mở chi tiết hợp đồng sẽ mở **chồng lên trên** màn đang xem chứ không đóng nó lại — đóng chi tiết hợp đồng là quay ngay về đúng danh sách/màn hình đang xem trước đó, không phải bị đẩy hết ra ngoài cùng rồi phải bấm lại từ đầu.

Mục **"Yêu cầu mới nhất"** hiện dưới 4 ô thống kê, hiển thị trực quan: mỗi yêu cầu có ảnh đại diện màu theo tên khách, loại yêu cầu + thời gian gửi, và huy hiệu màu theo trạng thái (Mới/Đang xử lý/Đã liên hệ) — cùng kiểu danh sách dùng ở Khách hàng & Hợp đồng và Quản lý User cho nhất quán.

## Thanh toán bằng mã QR (VietQR)

Ở trang chi tiết hợp đồng, khách hàng bấm **Thanh toán**:
- **Trả gốc**: nhập số tiền gốc muốn trả (ô nhập tự hiện dấu chấm ngăn cách hàng nghìn khi gõ, vd `1.500.000`); tiền lãi tự lấy đúng theo "Lãi đến nay" của hợp đồng (không sửa được).
- **Trả lãi**: mặc định lấy đúng "Lãi đến nay", khách có thể sửa lại số tiền (cùng kiểu ô nhập có dấu chấm).
- Nội dung chuyển khoản tự sinh theo mẫu: `HỌ TÊN THANH TOAN GOC/LAI HDTD MÃ_HỢP_ĐỒNG` (bỏ dấu, viết hoa, không kèm số tiền trong nội dung vì số tiền đã có ở dòng riêng và trong mã QR).
- Nút **"Chia sẻ ảnh QR"**: dùng Web Share API chuẩn của trình duyệt (`navigator.share`) để mở bảng chọn ứng dụng có sẵn trên điện thoại (giống khi chia sẻ ảnh từ Zalo/Ảnh...), gửi ảnh QR sang app khác (lưu lại, nhờ người khác chuyển giúp...). **Lưu ý quan trọng đã xác nhận qua thực tế:** đây chỉ là chia sẻ ảnh — hầu hết app ngân hàng KHÔNG tự mở đúng màn hình chuyển khoản kèm sẵn số tiền/nội dung chỉ từ việc nhận ảnh chia sẻ (khác với việc quét QR trực tiếp bằng camera trong app); khách vẫn cần tự vào app đó bấm "Quét QR từ ảnh" (nếu app có tính năng này) hoặc quét trực tiếp bằng camera như trên. Đã bỏ hẳn cách cũ qua `dl.vietqr.io` (bắt buộc chọn đúng ngân hàng theo mã chưa xác minh được, thực tế không hoạt động).
- Hiển thị mã **QR VietQR** (dùng dịch vụ ảnh công khai `img.vietqr.io`, cần Internet khi khách hàng dùng thật — trong môi trường phát triển không có mạng nên không xem trước được ảnh QR, nhưng sẽ hiển thị bình thường khi deploy thật). **Quét trực tiếp bằng camera trong app ngân hàng là cách chắc chắn hoạt động nhất** — số tiền và nội dung tự điền sẵn.
- Nút **"Tải ảnh mã QR"** (đứng cuối, kiểu phụ): tải file ảnh QR về máy (hoặc mở ảnh để nhấn giữ lưu nếu trình duyệt chặn tải trực tiếp) — dùng khi muốn lưu lại, gửi cho người khác chuyển giúp, hoặc mở từ thư viện ảnh trong app ngân hàng để quét.
- Thông tin ngân hàng (tên NH, mã BIN VietQR, số tài khoản, tên chủ tài khoản) chỉnh tại **Cài đặt**. **Đã điền sẵn theo thông tin bạn cung cấp (Ngân hàng Hợp tác xã Việt Nam - Co-op Bank, mã BIN 970446) nhưng cần bạn xác minh lại chính xác** tại vietqr.io hoặc với ngân hàng trước khi dùng thật — mã BIN sai sẽ tạo QR không quét được hoặc chuyển nhầm nơi nhận.

## Giới hạn của bản demo (quan trọng)

- **Không có backend/database thật** — dữ liệu lưu trong `localStorage` của trình duyệt, mỗi thiết bị/trình duyệt là 1 kho dữ liệu riêng biệt, không đồng bộ giữa các máy.
- **Không có OTP** — chỉ có tài khoản do admin cấp (CCCD + mật khẩu tạm) + bắt buộc đổi mật khẩu lần đầu + khóa tạm sau nhiều lần đăng nhập sai, KHÔNG thay thế được lớp bảo mật OTP nếu triển khai thật.
- **"Chia sẻ ảnh QR"** dùng Web Share API của trình duyệt — hiện đúng bảng chọn app trên điện thoại, nhưng **KHÔNG tự mở app ngân hàng kèm sẵn số tiền/nội dung** như bạn mong muốn (đã xác nhận qua thực tế dùng thử) — chỉ chia sẻ được ảnh, app nhận được vẫn cần tự quét QR từ ảnh đó. Quét trực tiếp bằng camera trong app ngân hàng (từ ảnh QR hiển thị sẵn trên trang) vẫn là phương án chắc chắn hoạt động nhất và tự điền sẵn số tiền/nội dung.
- **"Nhắn SMS báo lãi"** mở app nhắn tin có sẵn trên điện thoại quản trị viên (liên kết `sms:`) với nội dung soạn sẵn — quản trị viên vẫn phải tự bấm Gửi và tin nhắn tính phí theo SIM/gói cước của máy đó, KHÔNG phải hệ thống tự động gửi SMS hàng loạt qua tổng đài SMS Brandname.
- Mật khẩu được băm bằng `crypto.subtle` (SHA-256 + muối) ngay trong trình duyệt cho đúng nguyên tắc, nhưng vì không có server thật đứng sau nên đây **chỉ minh họa luồng**, chưa đạt chuẩn bảo mật để vận hành thật.

## Trước khi dùng thật (bắt buộc)

1. Thay lớp lưu trữ `js/state.js` bằng kết nối tới **database + backend thật** (vd: Supabase) — dữ liệu khách hàng/hợp đồng phải nằm trên server, không phải localStorage.
2. Thêm **OTP** gửi qua SMS thật (nhà cung cấp SMS Brandname) cho đăng nhập/thao tác nhạy cảm.
3. **Xác minh lại mã BIN ngân hàng + số tài khoản** tại Cài đặt trước khi dùng thật.
4. Rà soát tuân thủ **Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân** trước khi thu thập/lưu trữ CCCD của khách hàng thật.
5. Thực hiện **rà soát bảo mật (security review)** độc lập trước khi cho khách hàng thật sử dụng.
