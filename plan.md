# Kế hoạch — Website đề kiểm tra Hóa 10

## Sản phẩm và phạm vi
Website giao đề kiểm tra học kỳ I môn Hóa học lớp 10 cho THPT Quang Trung, dùng bộ đề Word được cung cấp. Hệ thống có luồng học sinh (nhập họ tên/lớp, chọn một trong 25 đề, làm bài 30 phút, nộp và được chấm tự động) và khu vực giáo viên (đăng nhập bằng mật khẩu đã cấu hình bảo mật phía máy chủ, xem kết quả theo đề, phổ điểm và dữ liệu nộp mới). Chỉ đưa Phần I, Phần II và Phần III lên ứng dụng; loại bỏ toàn bộ Phần IV/tự luận. Ảnh đại diện là ảnh do giáo viên cung cấp.

## Kiến trúc triển khai
- **Frontend:** React + TypeScript trong `client/src`; giao diện ở trang Home/Teacher, dữ liệu câu hỏi chỉ chứa nội dung cần hiển thị, bộ đếm và trạng thái trả lời chạy trên client.
- **Backend:** Express trong `server/_core/index.ts`; API công khai chỉ trả nội dung câu hỏi, API bắt đầu/nộp bài ghi nhận thời điểm phía máy chủ và chấm ở phía máy chủ, API giáo viên xác minh bí mật qua `TEACHER_PASSWORD` rồi cấp token ngắn hạn cho API kết quả.
- **Dữ liệu:** `shared/examContent.ts` giữ phần I, Phần II và Phần III đã trích sạch cùng đường dẫn minh họa từ DOCX cho câu có Hình 1–6; các ảnh nằm trong `client/public/exam-images`. `server/answerKeys.ts` giữ đáp án và lời giải ngắn phía máy chủ, không gửi xuống trình duyệt. Bảng Drizzle `examAttempts` lưu mã lượt, họ tên, lớp, đề, giờ bắt đầu/nộp, câu trả lời và điểm; MySQL tiếp tục là nguồn dữ liệu chuẩn. Kết quả đã nộp được đồng bộ sang Google Sheets qua Apps Script bằng hàng đợi có trạng thái/retry, chỉ chạy phía máy chủ và định danh idempotent theo mã lượt thi.
- **Tính thời gian thực:** màn hình giáo viên làm mới dữ liệu định kỳ vài giây một lần, hiển thị thời điểm cập nhật gần nhất; kết quả xuất hiện ngay sau khi ghi thành công.
- **Thời lượng/điểm:** mỗi lượt được máy chủ đóng dấu lúc bắt đầu; bộ đếm 30 phút, tự nộp khi hết giờ và cho phép nút nộp chủ động. Chấm đáp án trắc nghiệm, đúng/sai từng ý theo biểu điểm ghi rõ trong Đề 07 hoặc chia đều điểm mệnh đề khi đề không chỉ định rubric, và câu trả lời ngắn qua các đáp án chấp nhận/chuẩn hóa số. Điểm tổng hiển thị trên thang 10, quy đổi theo các phần được giao; tự luận không tham gia.
- **Cấu trúc thư mục:** `client/src/pages` cho các màn hình học sinh/giáo viên (trong đó `Teacher.tsx` dựng phổ điểm và thao tác lớp); `client/src/components` cho header; `client/public/exam-images` cho hình câu hỏi; `shared` cho ngân hàng câu hỏi công khai; `server` cho API, chấm điểm, connector Sheets và đáp án riêng; `drizzle` cho schema/migration; `integrations/google-sheets/Code.gs` cho Apps Script gắn với bảng tính; `client/public/manus-routes.json` liệt kê các route trang.

## Ngôn ngữ thiết kế
- **Design Movement:** Editorial education dashboard pha giữa bảng thông báo trường học hiện đại và sổ tay phòng thí nghiệm.
- **Core Principles:** (1) rõ thứ bậc thông tin để học sinh tập trung; (2) màu sáng nhưng dịu, độ tương phản cao; (3) chữ lớn, khoảng cách thoáng; (4) trạng thái làm bài/nộp bài luôn dễ nhận biết.
- **Color Philosophy:** nền trắng kem và xanh rất nhạt gợi giấy sạch/phòng thí nghiệm; xanh teal đậm làm màu thương hiệu tin cậy; vàng chanh và san hô chỉ làm điểm nhấn cho đồng hồ, số câu và thông báo.
- **Layout Paradigm:** đầu trang kiểu masthead của trường với ảnh giáo viên ở trái và tên trường căn giữa; nội dung xếp theo luồng dọc ưu tiên thao tác, bảng đề lệch tầng thay vì bảng lưới dày; dashboard chia cột linh hoạt cho tổng quan và phổ điểm.
- **Signature Elements:** nhãn số đề hình viên thuốc màu; thanh tiến độ câu trả lời dạng dải; thẻ đồng hồ như nhãn thiết bị phòng thí nghiệm.
- **Interaction Philosophy:** thao tác rõ ràng một bước, nút đủ lớn, phản hồi tức thì; cảnh báo trước khi nộp chủ động, nhưng tự nộp khi hết giờ; không tiết lộ đáp án đúng cho học sinh trước khi nộp.
- **Animation:** chuyển trạng thái ngắn 160–220 ms cho mở đề, chọn phương án và toast; đồng hồ không nhấp nháy liên tục; chỉ đổi màu cảnh báo dưới 5 phút và giảm chuyển động nếu `prefers-reduced-motion`.
- **Typography System:** Be Vietnam Pro cho toàn bộ giao diện; tiêu đề dùng đậm 700–800, nội dung và lựa chọn tối thiểu 17–18 px trên desktop và dễ đọc ở màn hình nhỏ; con số đồng hồ dùng kiểu chữ tabular.
- **Brand Essence:** “Phòng thi Hóa học sáng rõ, gọn gàng cho học sinh lớp 10”; tính cách **đáng tin, tích cực, mạch lạc**.
- **Brand Voice:** hướng dẫn trực tiếp, bình tĩnh, thân thiện; ví dụ: “Chọn đề em muốn bắt đầu.” và “Hết giờ — bài làm đã được ghi nhận.”
- **Wordmark & Logo:** tiêu đề tên trường hai dòng căn giữa; biểu tượng bình tam giác tối giản nét teal đặt cùng nhãn thương hiệu phụ, không thay thế tên trường.
- **Signature Brand Color:** teal sâu `#117C78`, kết hợp xanh ngọc sáng `#BDEDE5`.

## Ràng buộc và quyết định
- Thời lượng trên website là đúng **30 phút** theo yêu cầu người dùng, không dùng thời lượng 50 phút in trong tài liệu nguồn.
- Nội dung tự luận/Phần IV bị loại bỏ hoàn toàn khỏi UI và API công khai.
- Mật khẩu giáo viên chỉ đọc ở máy chủ qua secret `TEACHER_PASSWORD`; không chèn vào bundle trình duyệt.
- Ảnh cá nhân dùng file giáo viên cung cấp và được đưa vào lưu trữ dự án.
- Cơ sở dữ liệu đã được bật trong cấu hình project; dữ liệu phát triển và xuất bản dùng cùng nguồn DB quản lý.
- Kết nối Apps Script nhắm đến spreadsheet `1NIsa8jCc7CZ8gfvICtamE8UXjTO5ACbuviljuYG02jQ`, tab `gid=1289778487`; chỉ append vào tab trống hoặc tab có đúng header dự kiến, không tự xóa/ghi đè nội dung cũ. Nếu cấu trúc tab không phù hợp, đồng bộ dừng với lỗi rõ ràng.
- Chỉ các lượt đã nộp được đưa lên Sheet; MySQL là nguồn chuẩn, trạng thái chờ/lỗi được retry; dữ liệu câu trả lời thô và đáp án chuẩn không được gửi sang Sheet. Kết quả lịch sử chỉ được đồng bộ theo thao tác giáo viên chủ động.
- Giáo viên mở Google Sheet và tải Excel `.xlsx` bằng chức năng Download của Google Sheets. Xóa dữ liệu chỉ theo tên một lớp chính xác và thực hiện ở cả MySQL/Sheet sau khi giáo viên nhập lại tên lớp; không xóa dữ liệu nào trong lúc thiết lập connector và không ảnh hưởng lớp khác.
