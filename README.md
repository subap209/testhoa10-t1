# Kết nối Google Sheets cho website Hóa 10

Bridge này ghi kết quả vào đúng spreadsheet và worksheet được giáo viên cung cấp:

- Spreadsheet ID: `1NIsa8jCc7CZ8gfvICtamE8UXjTO5ACbuviljuYG02jQ`
- Worksheet ID (`gid`): `1289778487`
- Worksheet URL: <https://docs.google.com/spreadsheets/d/1NIsa8jCc7CZ8gfvICtamE8UXjTO5ACbuviljuYG02jQ/edit?gid=1289778487#gid=1289778487>

Bridge chỉ thêm header khi tab hoàn toàn trống. Nếu tab đã có nội dung nhưng hàng đầu hoặc số cột không khớp, script từ chối ghi/xóa và không tự chỉnh sửa cấu trúc. Kết quả chỉ chứa mã lượt, họ tên, lớp, đề, thời gian và điểm; không gửi câu trả lời thô hoặc đáp án chuẩn.

## Cài Apps Script

1. Mở spreadsheet ở liên kết trên bằng tài khoản Google có quyền chỉnh sửa.
2. Chọn **Extensions → Apps Script**.
3. Thay nội dung `Code.gs` bằng tệp `integrations/google-sheets/Code.gs` trong repository rồi lưu.
4. (Khuyến nghị) Trong **Project Settings**, bật hiển thị `appsscript.json`; thay manifest bằng tệp `integrations/google-sheets/appsscript.json` để giới hạn quyền OAuth ở Google Sheets, rồi lưu.
5. Trong **Project Settings → Script Properties**, thêm property:
   - **Property:** `SYNC_SECRET`
   - **Value:** một chuỗi ngẫu nhiên dài tối thiểu 32 ký tự. Giữ bí mật này để nhập cùng giá trị vào cấu hình website ở bước sau; không gửi secret qua chat.
6. Chọn **Deploy → New deployment → Web app**:
   - **Execute as:** tài khoản của bạn.
   - **Who has access:** Anyone. Website gọi Apps Script từ máy chủ, không đăng nhập Google; endpoint được xác thực bằng secret dài ở trên. Không công khai secret hoặc đặt secret ở trình duyệt.
7. Bấm **Deploy**, hoàn thành bước cấp quyền Google Sheets, rồi sao chép URL kết thúc bằng `/exec`.
8. Gửi URL `/exec` cho người đang cấu hình website. Không gửi giá trị `SYNC_SECRET` trong chat; nhập giá trị đó vào biểu mẫu secret an toàn khi được yêu cầu.

Nếu chính sách Google Workspace của trường không cho phép Web app có quyền truy cập **Anyone**, hãy dừng và hỏi quản trị viên về một phương án tích hợp được phép; không nới lỏng chính sách hoặc công khai quyền truy cập bảng tính để né hạn chế.

Script chỉ đọc/ghi tab có `gid=1289778487` trong spreadsheet ID đã khai báo. Nó không tạo/xóa spreadsheet hay worksheet. Ghi kết quả dùng mã lượt thi làm khóa idempotent để retry không tạo dòng trùng. Xóa lớp sẽ giữ lại header và mọi dòng thuộc lớp khác.

## Tải Excel

Khi website đã báo kết nối thành công, bấm **Mở Google Sheet** trong khu vực giáo viên. Trong Google Sheets chọn **File → Download → Microsoft Excel (.xlsx)**. Tệp tải xuống chứa các kết quả đang có trong sheet.

> Hãy tải bản sao Excel trước khi giáo viên xác nhận xóa dữ liệu của một lớp.
