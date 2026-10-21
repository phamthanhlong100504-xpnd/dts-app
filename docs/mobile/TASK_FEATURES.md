# Chức năng và nghiệp vụ của task

## Danh sách chương và tìm kiếm

Tên chương, hạng, bankVersion và số câu đến từ catalog Practice. Progress/cursor/đáp án đã lưu đến từ API học chương của cùng Practice. Số đúng/sai dùng các verdict đã lưu, không tự chấm bằng key tải về. Phân biệt lỗi đọc với tiến độ 0; phản hồi thiếu hoặc khác bank/account/hạng bị từ chối.

Card toàn bộ mở phạm vi tất cả các chương của hạng. Các chapter rỗng trong overview là hợp lệ, không tạo thêm card giả. Card điểm liệt dùng native critical overview: số đã học/còn lại, không tự suy ra đúng/sai khi backend chưa có verdict.

Bắt đầu học / Tiếp tục học / Ôn tập lại dựa trên số đã học và tổng câu từ backend. Khi đã hoàn tất, ôn lại dùng đáp án của phiên ôn riêng; không xóa tích lũy. Search lập chỉ mục của cùng catalog/question GET trong bộ nhớ, đối chiếu các từ khóa có/không dấu; không lưu tiến độ vào thiết bị.

## Luyện tập câu

- Câu/choice/ảnh/key/giải thích từ server; số thứ tự chỉ để hiển thị.
- Chọn đáp án và Kiểm tra trong học chương chỉ cập nhật canonical sau ACK của POST. Hai lần chạm không tạo hai ghi song song.
- Cursor chỉ đổi sau ACK ở các luồng backend có cursor. Nếu mất ACK sau POST, yêu cầu GET đọc lại thay vì tự gửi POST lần nữa.
- Hiện đáp án không gửi bài hoặc tăng tiến độ. Đáp án đúng ưu tiên verdict đã lưu; không dùng key cũ để phủ nhận grade mới.
- Trả lời lại cho phép sửa draft, canonical chỉ thay sau một lần chấm server tiếp theo.
- Giải thích giữ nguyên nội dung; chỉ tách các mục đánh số để đọc dễ hơn. Ảnh giữ tỷ lệ.
- Ôn chương giữ đúng reviewSessionId qua retry. Toàn bộ câu hỏi tổ hợp theo các chương và session của từng chương; không tạo một loại session toàn bộ không có trên backend.
- Điểm liệt đọc/ghi native critical sessions, giữ learnedBeforeSession tách khỏi đáp án. Không gọi API chương để giả sửa progress của điểm liệt.

## Các câu đã sai

Danh sách là needsReview **hiện tại** từ native wrong API, không phải mọi câu từng trả lời sai. Lấy toàn bộ danh sách backend, không cắt ở 100 câu theo snapshot một lượt ôn cũ.

Tab: Tất cả; Lý thuyết chương 1–4; Biển báo chương 5; Sa hình chương 6; Điểm liệt theo cờ server. Mở câu trong đúng tab/hạng. Vuốt phải tới câu tiếp; vuốt trái về câu trước; đầu/cuối giữ nguyên, không đổi tab hay ghi cursor. Bỏ qua ở cuối vẫn trở về danh sách như trước.

Bấm đáp án chấm qua native wrong-review API. Sau POST, đọc lại canonical session và wrong list; chỉ loại câu khi GET xác nhận. Không tự giảm tổng bằng phép trừ local. Câu vừa được loại vẫn giữ để đọc phản hồi tới khi người dùng chuyển đi; không còn là đích vuốt tiếp theo. Khi pending/needsReload thì khóa chuyển và ghi tiếp. Các round cũ thiếu câu có thể cần finish/start mới trong adapter đã có; không xóa dữ liệu tích lũy.

## Lịch sử và Xem bài làm

Chỉ hai tab Ngẫu nhiên / Bộ đề có sẵn. Mọi GET đặt activityType và licenseClass ở server trước phân trang; không tải history chung rồi bỏ official ở app. Tổng lượt/đạt/chưa đạt từ metadata đếm server, không cộng riêng trang đang xem. Đổi tab/hạng trở về trang đầu. Lỗi không đổi thành danh sách rỗng giả.

Bấm card mở thẳng Xem bài làm bằng Result resultId. Xác minh owned detail, policy và source Practice hợp lệ rồi mới GET kết quả nguồn. Không dùng resultId làm examId; không gọi URL bất kỳ do response đưa vào. Có thể có độ trễ outbox/Kafka trước khi kết quả mới xuất hiện.

Card danh sách có đúng/chưa đúng: phần chưa đúng gồm sai và chưa làm vì list DTO không có số sai đã trả lời tách riêng. Trong Xem bài làm, ba số đúng/sai/chưa làm tách riêng theo nguồn; điểm là đúng/tổng, ví dụ 2/25. Tên đề, ngày, thời gian, đáp án, isCorrect, ảnh và giải thích lấy từ snapshot kết quả gốc; không chấm lại bài cũ bằng bank hiện tại. Màn xem chỉ đọc.
