# Module video mô phỏng trên DTS Mobile

## 1. Phạm vi và nguồn dữ liệu

Module thuộc nhánh `feature/mobile-simulation-integration`, bổ sung trên luồng lý thuyết đã chốt tại commit `82777d3`. Các API, dữ liệu và cách chấm lý thuyết giữ nguyên. Trang chủ nối thêm `SimulationHomeCard`, chuyển hạng vào card tiến độ theo UI v4. Từ v6, màn Lịch sử có thêm lựa chọn mô phỏng và dùng card trình bày chung; phần mở xem lại lý thuyết vẫn dùng service/route cũ. Bảng chọn hạng từ icon cài đặt bỏ nút Đóng, giữ chọn hạng qua Identity như cũ. Các sửa tương thích SDK 58 đã thực hiện trước đó được giữ nguyên.

Tên chương, thứ tự và nội dung tình huống, ngân hàng, tiến độ, bộ đề, chính sách chấm, điểm, trạng thái đạt và lời giải đều từ backend. App không lưu tiến độ/điểm nghiệp vụ vào AsyncStorage/Zustand; chỉ giữ ảnh chụp phản hồi đã xác nhận trong bộ nhớ của phiên. Đăng xuất hoặc thay hạng bằng làm mất hiệu lực các phản hồi của phạm vi cũ.

Card xuất hiện theo `simulationEnabled` của API danh mục hạng bằng. Backend hiện không bật cho A1, A, B1; không dùng tên hạng được gõ cứng trong component để tự suy đoán quyền. Khi `simulationEnabled=true` nhưng `simulationReady=false`, app báo nội dung chưa sẵn sàng. Các màn kết quả/xem lại không yêu cầu ngân hàng hiện hành sẵn sàng vì dùng snapshot của bài đã hoàn thành.

## 2. Các màn và thao tác

| Màn | Nội dung và thao tác |
| --- | --- |
| Trang chủ | Card “Tình huống mô phỏng giao thông”, số lượng từ Practice nếu đã đọc được, màu vàng xanh nhạt, kích thước bằng các card lý thuyết; giữ nguyên tám card lý thuyết |
| Danh sách mô phỏng | Tổng quan và tiến độ từ Practice; mở/thu chương; danh sách tình huống theo thứ tự, app tự đọc đủ các trang API (tối đa 12 mục mỗi request) khi mở chương; mỗi tình huống là một card riêng; nút THI THỬ |
| Ôn tình huống | Tiêu đề từ ngân hàng; bắt đầu/tiếp tục lượt đã có; phản ứng đầu tiên tại thời điểm thực của video; hoàn thành rồi xem điểm, gợi ý, card kết quả và các khoảng chấm; luyện lại tạo lượt mới có chủ đích |
| Chọn hình thức thi | Hai lựa chọn Thi thử ngẫu nhiên / Thi thử bộ đề; hiển thị bài đang làm nếu backend trả về |
| Bộ đề / chuẩn bị thi | Danh sách và phiên bản bộ đề công bố; thông tin số tình huống, tổng điểm, mức đạt từ backend; bắt đầu khi không có bài đang dở, hoặc về sảnh để tiếp tục bài hiện tại |
| Làm bài mô phỏng | Phát lần lượt, nút phản ứng, bỏ qua phần mở đầu nếu được phép, Tiếp theo sau xác nhận phản ứng; danh sách chỉ ghi thứ tự, không lộ tên tình huống hay đáp án |
| Kết quả | Điểm, đạt/chưa đạt và điểm từng tình huống từ bài đã nộp; chọn tình huống để xem lại |
| Xem lại | Snapshot tình huống, điểm và lời giải của đúng bài; video có thể phát/dừng/tua; chỉ đọc, không gửi chấm lại và không ghi tiến độ học |
| Lịch sử làm bài | Hai hàng tab: Lý thuyết / Mô phỏng rồi Ngẫu nhiên / Bộ đề có sẵn; Result trả danh sách và tổng, Practice trả kết quả/bài làm/video gốc |

Giao diện dùng màu xanh, nền trắng, viền và chữ theo phong cách app hiện tại. Không sao chép màu cam của ảnh tham khảo. Vùng phát dùng tỷ lệ 16:9, không kéo méo video; phần nội dung bên dưới cuộn riêng. Phóng to/thu nhỏ giữ cùng player và cùng lượt phát, không khởi tạo lại bài. Phóng to hiện nằm trong app theo cấu hình dọc sẵn có; không đổi thiết lập xoay màn hình toàn app.

## 3. Luồng phát và chấm điểm

1. Đọc đúng tài khoản, hạng bằng và ngân hàng. Mở màn ôn không tự tạo lượt mới. Lượt gần nhất được đọc lại từ Practice.
2. Khi người dùng bắt đầu luyện, tạo lượt bằng UUID `eventId`, hoặc xin lại quyền phát của lượt còn dở. Thi thử tạo session với `Idempotency-Key` và phiên bản bộ đề đã chọn.
3. Video tải xong và được đặt tại checkpoint backend cho phép, app gửi START. Chỉ phát sau khi START được xác nhận.
4. Heartbeat và phản ứng dùng `player.currentTime` thực, quy đổi thành mili giây nguyên. Không dùng thời gian chạy của JavaScript để tính điểm hoặc giả vị trí video.
5. Phản ứng đầu tiên được backend xác nhận; chống bấm liên tiếp. App không cho dừng/tua hay mở native fullscreen có thanh điều khiển trong lượt đang được chấm. Về nền, mất mạng hoặc lỗi phát sẽ đưa vào luồng khôi phục.
6. Ôn tập tiếp tục từ checkpoint đã xác nhận. Bài thi phát lại tình huống đang dở từ đầu theo chính sách backend, giữ phản ứng đã ghi nhận. Không tự tạo bài khác để che lỗi.
7. Hoàn thành bình thường chỉ khi có sự kiện kết thúc video thực; điểm chỉ đọc sau xác nhận hoàn thành. Với thi thử, sau khi Practice xác nhận đủ tình huống và trạng thái READY_TO_SUBMIT, app tự gọi bước SUBMIT riêng qua coordinator hiện có rồi mở kết quả khi server xác nhận COMPLETED. Không giả hoàn thành bằng thời gian app hoặc tính điểm trên máy.

### Cụm điều khiển trên mobile (UI v2)

Màn ôn dùng ba icon: tình huống trước, bắt đầu/tiếp tục/luyện lại ở giữa, tình huống tiếp. Không lặp các nút chữ này ở cuối trang. Nút phản ứng có nhãn SPACE; nút bỏ qua 10 giây đầu nằm trên video và chỉ hiện khi backend cho phép. Tiêu đề đầy đủ và gợi ý ở bên dưới video, dùng cỡ chữ 18 tương ứng nội dung câu hỏi/giải thích bên lý thuyết. Gợi ý vẫn ẩn trong lượt đang phát theo chính sách backend.

Icon giữa thay chức năng theo trạng thái: chuẩn bị lượt rồi phát, tải lại sau lỗi, hoặc luyện lại sau kết quả. Khi video đang được chấm, icon này không cho tạm dừng. Trong bài thi, icon bên trái là rời bài (không giả chức năng quay lại tình huống cũ); bên phải chỉ chuyển tiếp khi có xác nhận phản ứng từ backend. Xem lại chỉ đọc có thể phát/tạm dừng và chuyển video bằng các icon.

Card/chữ/nút dùng style object trực tiếp như các màn lý thuyết hiện tại, tránh callback style bị mất hình thức trong cấu hình NativeWind đang dùng. Sảnh thi chỉ có hai card lựa chọn; màn chuẩn bị có hai phần Thông tin bài thi và Cách làm bài, nút bắt đầu ở cuối màn; bộ đề dùng lưới ba cột tương tự lý thuyết. Không đổi layout, font hay source của các màn lý thuyết.

### Tinh chỉnh giao diện UI v3

Card Trang chủ có tên theo số tình huống Practice trả về và dòng phụ “Luyện phản xạ giao thông”, cùng phân cấp chữ với các card lý thuyết. Nút ở cuối danh sách chương có nhãn “THI THỬ” từ UI v4.

Card Bài đang làm chỉ xuất hiện ở sảnh Thi thử mô phỏng: nền xanh nhạt, thanh tiến độ từ server, hai nút Tiếp tục / Hủy bài cùng một hàng. Không lặp card ở danh sách bộ đề hay màn chuẩn bị đề. Khi đã có bài đang dở, màn chuẩn bị dẫn về sảnh thay vì cho tạo bài thứ hai. Xóa câu thông báo màu vàng về bộ đề chưa thể bắt đầu, giữ nguyên kiểm tra khả dụng và trạng thái khóa nút bắt đầu.

Bỏ dòng đếm tình huống/đã hoàn thành phía trên video. Thanh ba icon cao 50, nền trắng xám nhẹ, icon nhỏ hơn; vùng chạm vẫn đủ 44. Thanh SPACE giữ chiều cao và cơ chế phản ứng hiện tại. Không sửa API, snapshot, coordinator, các màn lý thuyết hoặc cấu hình app.

### Tinh chỉnh giao diện và nộp bài UI v4

Trang chủ bỏ dòng “600 câu GPLX Hạng B” (áp dụng cho mọi hạng, không gõ cứng số câu). Hạng đã xác nhận hiển thị ở tiêu đề “Tiến độ học tập B”. Card tiến độ cách header khoảng 6 DIP; khoảng cách thực phụ thuộc mật độ màn hình, không dùng đơn vị cm cố định. Tám card và các phép đọc/đếm lý thuyết giữ nguyên.

Từ UI v5, Bỏ qua 10s nằm phía trái video, cách lề trái 20 DIP và cách đáy 38 DIP (xấp xỉ bố cục 0,5 cm / 1 cm theo yêu cầu), nền trong và chữ trắng; không có icon trước nhãn. Hai nút Tiếp tục / Hủy bài ở card Bài đang làm chỉ có chữ, giữ cùng hàng và giữ xác nhận trước khi hủy. SPACE chỉ còn chữ, vẫn khóa sau phản ứng đã xác nhận. Thanh ba icon và vùng chạm giữ như UI v3.

Sau hoàn thành và ở màn xem lại, thứ tự nội dung là Tình huống → Gợi ý → Kết quả tình huống → Khoảng chấm điểm. Card kết quả dùng icon, hàng điểm cỡ chữ 17 màu đen và thời điểm phản ứng từ backend; phân biệt rõ 0 điểm, phản ứng ở 0 ms và chưa phản ứng. Kết quả bài thi dùng card xanh dương nhạt cho cả đạt/chưa đạt, trạng thái vẫn đúng phản hồi. Bỏ các tiêu đề đếm/chương dư ở màn xem lại. Danh sách trong bài thi dùng icon hoàn thành/đang xem, không hiển thị tiêu đề “Danh sách tình huống”; không cho nhảy tùy ý qua trình tự backend.

`simulation-auto-submit.ts` chỉ nối vòng đời màn hình: đợi GET phiên hiện tại trước khi quan sát; chỉ nộp khi đủ vị trí hoàn thành, không busy và trạng thái READY_TO_SUBMIT. Mỗi lần focus chỉ thử tự động một lần. Khi rời màn hình, hủy quan sát trước khi dispose coordinator; không cho phản hồi muộn điều hướng màn đã đóng. Nếu request đã tới server thì app không thể hủy tác động đó; quay lại đọc trạng thái thật. Coordinator giữ UUID của SUBMIT, đọc đối soát khi mất ACK, và nút Thử lại dùng đúng cơ chế cũ. Không lặp gửi vô hạn, không tạo phiên khác và không hiển thị card yêu cầu bấm Nộp bài nữa. Chỉ mở kết quả từ trạng thái COMPLETED đã xác nhận.

Lỗi tải/phản ứng/nộp bài chỉ còn chữ gọn và thao tác phục hồi, không có card nền cam/đỏ nhạt. Không che mất thông báo cần thiết và không giả nội dung tải thành công. Mục sửa UI này không thay source/config repo backend/web, package hay contract.

### Lịch sử lý thuyết và mô phỏng (v6)

Màn `/history` có hai hàng tab cùng phong cách, hàng chọn module ở trên hàng hình thức thi. Mặc định là Lý thuyết / Ngẫu nhiên. Đổi module/hình thức/hạng remount danh sách về trang đầu, loại bỏ phản hồi cũ bằng scope của session. Hạng chưa được bật mô phỏng có thông tin phù hợp, không gọi Result simulation bằng hạng không hỗ trợ và không giả số 0.

`simulation-history-service.ts` đọc plain DTO từ Result, không dùng adapter Page lý thuyết cho mô phỏng. Lịch sử mô phỏng chỉ gồm bài đã nộp `SIM_RANDOM_EXAM` / `SIM_PRESET_EXAM`; không đưa lượt luyện từng tình huống hoặc bài đang dở vào danh sách này. Điểm và đạt/chưa đạt do backend xác nhận, không quy điểm mô phỏng thành số câu đúng. Từ v7, card lý thuyết khôi phục nguyên component/CSS trước v6: số đúng và số chưa đúng (gồm chưa trả lời), thời gian và ngày. Card mô phỏng dùng viền, bố cục, cỡ chữ và khoảng cách tương tự card lý thuyết cũ, có tên bài, hạng, trạng thái, điểm/tổng điểm và ngày hoàn thành; bỏ dòng thời gian làm bài và icon đồng hồ. Hai module có component card riêng, phần tab/bảng tổng vẫn dùng chung.

Phân trang và các GET đếm Đạt/Chưa đạt gắn cùng `sourceWatermark` + `asOf` mà Result xác nhận. Refresh kéo xuống trở lại trang đầu và đọc mốc mới. Khi đồng bộ chưa đầy đủ thì tổng là `null`, app hiện “—” và thông tin đang cập nhật; không biến dữ liệu thiếu thành lịch sử rỗng thành công. Danh sách được kiểm tra hạng, activity, số lượng, thứ tự, ID trùng và source reference. Snapshot ngân hàng cũ vẫn được phép xem; không gắn lịch sử vào ngân hàng hiện hành.

Card mô phỏng dùng `sourceType=SIMULATION_SESSION` và session ID đã đối chiếu để mở `/simulations/exams/results/{sessionId}?from=history`. Không mở trực tiếp URL do server gửi. Trang này có tiêu đề Xem bài làm, kết quả tổng và điểm từng tình huống; bấm tình huống mở màn video/gợi ý/kết quả chỉ đọc. Khi vào từ lịch sử, không có nút tạo/luyện bài mới ở cuối trang; nút quay lại trở về lịch sử (hoặc màn trước). Luồng kết quả sau khi thi bình thường giữ nguyên hai nút cũ. Kết quả và replay vẫn được kiểm tra quyền sở hữu bởi Practice; không tạo lượt học/thi hoặc ghi chấm khi xem lịch sử.

Bảng chọn hạng giữ bố cục giữa màn hình, bỏ nút Đóng. Chạm nền ngoài, vuốt xuống ở tiêu đề, thao tác thoát hỗ trợ tiếp cận hoặc chọn bằng xong đều đóng được. Không dùng cử chỉ vùng danh sách để ghi lựa chọn; lựa chọn bằng vẫn phải được Identity xác nhận.

### Bỏ qua 10 giây đầu và Tiếp theo

Dùng protocol `video-shortcuts-v1`, bật trước START. “Bỏ qua 10 giây đầu” là chuyển tới **mốc 00:10**, không phải cộng 10 giây ở vị trí bất kỳ. Nút chỉ khả dụng khi backend cho phép và chưa phản ứng. App dừng/quarantine player cũ, chờ xác nhận nonce/checkpoint mới, đặt video đúng vị trí rồi START lại. Thời điểm phản ứng sau bỏ qua vẫn là vị trí tuyệt đối, ví dụ 17.432 giây gửi 17432 ms.

Trong bài thi, Tiếp theo chỉ bật sau phản ứng được xác nhận cùng `reactionAcknowledgement`. App gửi `advance-after-reaction`; backend chốt tình huống và trả tình huống kế tiếp. Không giả video đã chạy hết và không tự tính điểm. Mất xác nhận thì giữ nguyên UUID/nội dung yêu cầu khi thử lại. Ôn tập không gọi API advance của bài thi; các nút tình huống trước/tiếp trong ôn là điều hướng, không tự hoàn thành lượt.

## 4. API và service

Tất cả API nghiệp vụ đi qua `EXPO_PUBLIC_DTS_API_URL` (Gateway), dùng Bearer của Identity và cơ chế refresh sẵn có. Không đổi HTTP hoặc session service của lý thuyết. Trong bảng, `S=/api/practice/v1/simulations`, `E=/api/practice/v1/simulation-exams`.

| Nhóm chức năng | API qua Gateway | Service chịu trách nhiệm |
| --- | --- | --- |
| Tài khoản / hạng bằng | `/api/v1/users/me`, `/api/practice/v1/exams/license-catalog` | Identity xác nhận hồ sơ; Practice trả capability |
| Tổng quan / chương | `GET S/overview`, `GET S/chapters/{chapterId}/scenarios` | Practice; dữ liệu công bố từ Content Builder |
| Chi tiết / lượt ôn | `GET S/scenarios/{id}`, `POST S/attempts`, `GET S/attempts/{id}` | Practice |
| Phát / ghi nhận ôn | `GET .../playback`, `POST .../start`, `POST .../heartbeat`, `PUT .../response`, `POST .../complete`, `POST .../interrupt` | Practice kiểm tra continuity, chấm và lưu |
| Xem lại ôn | `GET S/attempts/{id}/result`, `GET .../replay` | Practice + Media cấp quyền phát chỉ đọc |
| Chuẩn bị / bộ đề | `GET E/preparation`, `GET E/presets`, `GET E/presets/{presetSetId}` | Practice đọc bộ đề công bố từ Content Builder |
| Bài thi | `POST E/sessions`, `GET E/sessions/active`, `GET E/sessions/{id}` | Practice |
| Phát / phản ứng bài thi | `GET .../current/playback`, `POST .../current/start`, `POST .../current/heartbeat`, `POST .../current/restart`, `PUT .../reaction`, `POST .../complete-current` | Practice |
| Nộp / hủy / xem lại bài thi | `POST .../submit`, `POST .../cancel`, `GET .../result`, `GET .../review`, `GET .../review/{position}/playback` | Practice lưu bài và snapshot; Media cấp URL video |
| Thao tác rút ngắn | `GET .../shortcuts`; `POST .../shortcuts/enable`, `.../skip-intro`, `.../advance-after-reaction` | Practice; advance chỉ dành cho session thi |
| Lịch sử mô phỏng | `GET /api/result/v1/results/me/history/simulations` với licenseClass, activityType, page/size/sort và watermark/asOf | Result plain DTO; source result/review ở Practice |
| Tổng hợp phía hệ thống | Sự kiện từ Practice | Progress / Result xử lý theo backend đã triển khai; app không tự ghi thay |

Các route mock exam thuộc Practice, không dùng service Examination của thi chính thức lý thuyết. App không gọi trực tiếp cơ sở dữ liệu, Content Builder, Kafka hay các API quản trị media.

## 5. Cấu trúc code

- `src/app/simulations/`: các route mỏng cho danh sách, ôn tập, sảnh, bộ đề, làm bài, kết quả, xem lại.
- `src/features/simulations/components/`: giao diện React Native, player Expo Video, card Trang chủ.
- `src/features/simulations/domain/`: adapter DTO và kiểm tra scope/bank/policy/receipt; coordinator tuần tự của bài thi. Tham chiếu hợp đồng từ nhánh web mới, không đưa DOM/web UI vào app.
- `simulation-learning-controller.ts`: điều phối lượt ôn và khôi phục.
- `simulation-auto-submit.ts`: nộp tự động khi phiên đã đủ điều kiện, gắn với focus/blur của màn thi.
- `simulation-history-service.ts`, `components/simulation-history-list.tsx`: adapter Result và danh sách mô phỏng.
- `../history/components/history-presentation.tsx`: tab, bảng tổng, card, phân trang dùng chung; service/review lý thuyết vẫn độc lập.
- `simulation-context.ts`, `simulation-api.ts`: nối session/refresh hiện tại, kiểm tra quyền sở hữu trước và sau phản hồi.
- `simulation-native-video.ts`, `simulation-media-clock.ts`: biên native player và kiểm tra vị trí thực.
- Tests, scripts cài đặt/bản vá và báo cáo máy local nằm ngoài repo.

Phụ thuộc mới: `expo-video`, `expo-crypto` theo SDK 58 và `zod@3.25.76`. Expo Go SDK 58 có hai module Expo này. Expo CLI thêm plugin `expo-video` nếu cần; không đổi orientation, scheme, bundle id hay các thiết lập lý thuyết. Không chép một package-lock được dựng ở máy khác đè lên bản đã nâng SDK thành công.

## 6. Backend tham chiếu

| Repo | Nhánh | Commit đã đọc |
| --- | --- | --- |
| dts-practice | feat/simulation-practice | e0b0f5aafa3efb45534891c0cc6659692c8f4d31 |
| dts-gateway | feat/simulation-api-integration | 0e96e9fba28f305c15f642243cc9607200aa6a32 |
| dts-content-builder | feat/simulation-content-management | 5e4002ae81112e3247b0c3bd5e491a0d162937b2 |
| dts-media | feat/simulation-media-access | 2f44357359bb23141ffffac802e9beb79bbb9cd4 |
| dts-identity | feat/simulation-permissions | 7eeb623970938285ddfe37960e31cf08dfeecd07 |
| dts-progress | feat/simulation-progress | e41c022f1f2cb8a7b913779f06ab782d67add571 |
| dts-result | feat/simulation-results | 219652a5a34c2ce014cd9653e81478c06427c6b8 |
| dts-system-fontend | feature/video-simulation-backend-integration | 39be54ce9fa468c0f52eb32cb8f6e974df57cda9 |

Việc code đang nằm trên main hay nhánh tính năng không quyết định API lúc app chạy: tiến trình backend đang chạy mới quyết định contract và dữ liệu. Không tự chuyển backend về main cũ. Khi backend thay đổi contract phải đối chiếu lại trước khi dùng.

## 7. Chạy local, media và chuyển VPS

App chỉ cần Gateway origin đúng. Trên điện thoại phải dùng IPv4 Wi-Fi hiện tại của máy tính, không dùng localhost của máy tính. Metro và backend là hai kết nối riêng; Expo tunnel chỉ giải quyết tải app, không tự công khai Gateway/MinIO.

URL video là URL đã ký. **Không đổi hostname, đường dẫn hoặc query trên app và không gắn Identity Authorization vào request tải video.** Nếu Media trả `http://localhost:9000/...`, điện thoại không thể dùng; module báo rõ vấn đề địa chỉ. Cần người vận hành cấu hình Media/MinIO để **ký ngay bằng địa chỉ điện thoại truy cập được**. Backend Media đang có `MINIO_ENDPOINT` và `MINIO_INTERNAL_ENDPOINT`; kiểm tra đúng cấu hình của tiến trình đang chạy. Cấu hình này có thể ảnh hưởng URL media dùng chung cả web, nên không thay tự động bằng bản vá app.

Khi lên VPS, giữ nguyên contract/capability/published snapshots/quyền và các service mới tương ứng; đổi `EXPO_PUBLIC_DTS_API_URL` sang Gateway HTTPS. Đảm bảo URL video ký bằng domain HTTPS công khai, proxy hỗ trợ Range, video/mp4, chứng chỉ hợp lệ và thời gian máy chủ đồng bộ. Endpoint nội bộ MinIO vẫn có thể dùng mạng container, nhưng URL cấp cho điện thoại phải công khai. Không chuyển bucket private thành public để chữa lỗi. Nếu API không đổi thì không phải viết lại các màn/chấm điểm; cần tạo lại bundle/build app để nhận biến môi trường mới. Kiểm tra lại bằng điện thoại ngoài Wi-Fi nội bộ.

## 8. Kiểm tra trước khi chốt

Bộ kiểm tra ngoài repo gồm TypeScript, ESLint và regression cho source thực với transport/player UUID được thay thế ở biên kiểm tra. Bao phủ scope, signed URL, chống lộ đáp án đang thi, zero score, bấm trùng, mất ACK, nonce cũ, checkpoint 10 giây, proof chuyển tiếp, hoàn thành rồi nộp tự động bằng lệnh SUBMIT riêng, khôi phục mất ACK, chống gửi trùng khi có nhiều cập nhật, rời màn trong lúc tải và replay chỉ đọc.

Checker API thật chỉ đăng nhập/đọc/đăng xuất. Nó không tự tạo lượt, chọn hạng, phản ứng, chấm bài hoặc hủy bài. Nếu tài khoản chưa có bài hoàn thành thì phần replay/video được đánh dấu thiếu mẫu, không coi đã kiểm tra. Kết quả test mock/TypeScript không thay thế kiểm tra native video trên iPhone.

Trên điện thoại cần kiểm tra: A1/A không có card; B có card; mở/thu chương và xem hết phân trang; bắt đầu/ghi phản ứng/chờ video kết thúc; luyện lại; bỏ qua 10 giây rồi ghi phản ứng; đưa app về nền rồi khôi phục; thi ngẫu nhiên và bộ đề, Tiếp theo sau phản ứng, tự động nộp sau tình huống cuối và xem lại; thử mạng gián đoạn khi nộp rồi Thử lại; đổi hạng/đăng xuất không lộ bài tài khoản cũ. Chạy lại một lượt ôn chương, thi lý thuyết và lịch sử đã chốt để xác nhận phần nối Trang chủ không gây ảnh hưởng.
