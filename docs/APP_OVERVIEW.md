# DTS App — chức năng, cấu trúc và API của toàn bộ ứng dụng

Tài liệu dành cho thành viên tiếp nhận và phát triển app trên nhánh `feature/mobile-full-integration`. Mô tả dựa trên source nhánh tích hợp và contract backend mới, không giả định backend main cũ đã được cập nhật. Khi triển khai đọc thêm [kết nối VPS](VPS_BACKEND_CONNECTION.md).

## 1. Phạm vi và nguồn dữ liệu

App học lý thuyết GPLX sử dụng React Native, Expo SDK 57, Expo Router, TypeScript và NativeWind. Dữ liệu nghiệp vụ từ các backend DTS qua Gateway. Frontend web không cần chạy để mobile dùng API.

| Màn/chức năng | Nội dung | Service nguồn |
| --- | --- | --- |
| Tài khoản | Đăng nhập, đăng ký, quên/reset mật khẩu, xác thực email, đổi mật khẩu, đăng xuất | Identity |
| Chọn hạng | Danh mục hạng và hạng được xác nhận trong hồ sơ | Practice cung cấp danh mục; Identity lưu lựa chọn |
| Trang chủ | Số câu, tiến độ, đúng/sai và tám card chức năng | Practice; hồ sơ Identity |
| Đề ngẫu nhiên | Thông tin/chế độ, tạo bài, làm bài, tạm dừng/tiếp tục, nộp, kết quả/xem lại/làm lại | Practice |
| Thi theo bộ đề | Bộ đề đã phát hành theo hạng, trạng thái và các luồng thi thử | Practice |
| Ôn tập câu hỏi | Chương, cả bộ, tìm kiếm câu hỏi, học tiếp/ôn lại | Practice |
| Câu điểm liệt | Danh sách, overview, tiếp tục học và ôn phiên native | Practice |
| Các câu bị sai | Danh sách hiện tại, lọc nhóm, mở/trả lời/chấm, vuốt và chọn câu | Practice |
| Các biển báo | Tìm theo tên/mã, nhóm, phân trang, chi tiết, ảnh | Practice; URL ảnh qua Media |
| Mẹo ghi nhớ | Danh sách và nội dung mẹo từ server | Practice |
| Lịch sử | Ngẫu nhiên/bộ đề, thống kê, phân trang và mở bài làm gốc | Result; kết quả nguồn ở Practice |

Các bài thi mobile thuộc **Practice**, bao gồm chế độ mô phỏng thi thật. Lịch sử chỉ hiển thị `RANDOM_EXAM` và `PRESET_EXAM`. Nhánh này không triển khai luồng thi chính thức của Examination, quản trị, leaderboard hoặc analytics của bản web.

## 2. Kiến trúc và dữ liệu chuẩn

App chỉ cấu hình một public Gateway origin. Identity, Practice, Result và Media được gọi qua các path Gateway; ảnh có thể tải trực tiếp từ URL storage backend cấp. App không gọi DB, Redis, Kafka hoặc hostname/cổng nội bộ service.

| Thành phần | Vai trò |
| --- | --- |
| Gateway | Public API, route/xác thực/trace theo thiết kế backend |
| Identity | Token, hồ sơ, selected license, mật khẩu và mã xác thực |
| Practice | Ngân hàng/bank, câu hỏi/options, học/chấm/cursor, điểm liệt, câu sai, phiên thi thử/bộ đề, kết quả, biển báo và mẹo |
| Result | Lịch sử đã xử lý và liên kết kết quả nguồn |
| Media/object storage | Metadata, trạng thái ảnh và URL tải binary |
| Content Builder | Nguồn nội dung được backend sử dụng; app không gọi trực tiếp |
| Progress | Projection trong hệ thống; app hiện không dùng để lấy tiến độ chương |
| Examination | Thi chính thức của hệ thống; không phải nguồn thi thử mobile |

**Tiến độ trên Trang chủ và danh sách chương lấy trực tiếp Practice.** Không tự đổi nguồn sang Progress hoặc suy tiến độ từ lịch sử Result. API lỗi hiển thị lỗi; không tạo số 0, câu hỏi, bộ đề hay kết quả giả để thay dữ liệu server.

Zustand trong `features/session` giữ token/hồ sơ mới nhất trong bộ nhớ của phiên chạy. Source hiện không persist token, hạng, tiến độ, điểm hoặc câu sai bằng AsyncStorage. Mở lại tiến trình app cần đăng nhập lại; dữ liệu học bền vững được đọc lại từ backend. Dependency AsyncStorage tồn tại không đồng nghĩa đang được dùng để lưu nghiệp vụ.

## 3. Cấu trúc source và trách nhiệm

| Vị trí | Trách nhiệm |
| --- | --- |
| `src/app/` | Route Expo Router; `_layout.tsx` chứa Stack/điều hướng theo session; route gọi screen ở feature |
| `src/features/auth/` | Form/nền auth, validation tài khoản và adapter thao tác Identity |
| `src/features/account/` | Hồ sơ, xác thực email/đổi mật khẩu và chọn hạng |
| `src/features/home/` | Trang chủ và tổng quan học tập |
| `src/features/session/` | Store/service phiên, refresh dùng chung, scope người dùng/hạng, tài nguyên màn và lựa chọn hạng |
| `src/features/chapter-learning/` | Catalog, học/ôn chương/cả bộ/điểm liệt, tìm kiếm, ảnh, model/hook/screens |
| `src/features/wrong-questions/` | Danh sách/filter, trả lời trực tiếp, model, vuốt/picker và adapter phiên chấm native |
| `src/features/exams/` | Cấu hình/lobby, hai chế độ, phiên thi thử, kết quả, retry và xem đáp án |
| `src/features/history/` | History Result, kiểm tra nguồn và mở kết quả Practice, định dạng UI |
| `src/features/reference/` | Biển báo, tìm kiếm/phân nhóm/phân trang và mẹo |
| `src/features/shared/` | UI/icon/button/typography và bottom sheet/picker dùng chung |
| `src/lib/api/http.ts` | Gateway origin, fetch, timeout, envelope/plain và lỗi/trace |
| `src/global.css` | CSS đầu vào NativeWind |
| `assets/` | Nền auth, icon/splash/favicon/Android adaptive icon và iOS icon bundle đang dùng |
| `app.json`, Babel/Metro/Tailwind/TypeScript config | Cấu hình build/router/style; không phải file thừa vì không thấy import trong screen |
| `package.json`, `package-lock.json` | Scripts và dependency versions; cài theo lockfile |
| `.env.example` | Tên biến public; địa chỉ riêng nằm trong môi trường chạy hoặc `.env.local` |
| `docs/` | Tài liệu toàn app và tài liệu VPS |

Giữ `AGENTS.md`, `LICENSE`, `nativewind-env.d.ts` và cấu hình. Expo tự tạo `expo-env.d.ts`/`.expo` trong phát triển; các file này và dependencies được xử lý theo `.gitignore`. Test, patch, báo cáo, backup và công cụ riêng máy được lưu ngoài repo. Không xóa iOS icon bundle chỉ vì tên tài nguyên còn chữ Expo.

Khi bổ sung tính năng: entry ở `src/app`, UI ở feature, HTTP/DTO validation ở service, state thao tác ở model/hook. Không đặt helper thường vào `src/app` vì Router có thể coi là route. Dùng shared UI/bottom sheet để giữ thiết kế đồng nhất.

## 4. Routes

| Route | Màn/đích |
| --- | --- |
| `/` | Chuyển tới login, chọn hạng hoặc home theo hồ sơ đã xác nhận |
| `/login`, `/register`, `/forgot-password` | Tài khoản công khai |
| `/settings`, `/profile`, `/home` | Chọn/đổi hạng, hồ sơ, Trang chủ |
| `/chapters` | Danh sách chương/tổng bộ/điểm liệt và tìm câu hỏi |
| `/practice/[chapterId]` | Học/ôn chương; các đích `all`, `critical` dùng cùng màn; `mode=learn/review` |
| `/wrong-questions` | Danh sách câu sai và tabs |
| `/wrong-questions/[questionId]` | Trả lời lại; filter đi cùng route cho vuốt/picker |
| `/exams` | Thông tin và chế độ đề ngẫu nhiên |
| `/preset-exams`, `/preset-exams/[presetId]` | Danh sách bộ đề và thông tin bộ được chọn |
| `/practice/exam/[examId]` | Phiên thi thử đang làm/tạm dừng |
| `/practice/result/[examId]`, `/practice/result/[examId]/review` | Kết quả và xem từng câu |
| `/history`, `/history/[resultId]` | Lịch sử và bài làm nguồn |
| `/traffic-signs`, `/memory-tips` | Nội dung tham khảo |

Route cũ `/practice/wrong` được giữ như redirect tới màn câu sai riêng; không phục hồi UI quản lý lượt ôn cũ. Params chỉ dùng điều hướng; service vẫn kiểm tra account, hạng, bank và ID. Title hoặc license trên route không xác nhận quyền sở hữu.

## 5. Luồng chức năng

### 5.1. Tài khoản và chọn hạng

Login/register nhận token, sau đó đọc `/users/me` và đối chiếu cùng user ID trước khi mở app. Nếu `selectedLicenseClass` chưa có thì vào chọn hạng, không tự mặc định A1. Danh mục từ Practice; PUT lựa chọn tới Identity, chỉ nhận khi server trả đúng code, rồi mở home. Đổi hạng làm đổi scope và tải lại dữ liệu đúng hạng.

Hồ sơ hiển thị tên, email, ngày sinh/số điện thoại nếu server cung cấp, lựa chọn hạng, xác thực email, đổi mật khẩu và logout. Nhánh này chưa có form sửa thông tin cá nhân. Mã reset gửi thẳng cùng mật khẩu mới tới reset-password; không verify để tiêu thụ OTP reset trước. Sau đổi mật khẩu thành công, xóa session local vì refresh token bị backend thu hồi. Logout vẫn xóa local khi mạng lỗi; trường hợp này không chứng minh đã revoke token ở server.

### 5.2. Học chương, cả bộ và câu điểm liệt

Ghép learning catalog với overview và saved answers đúng hạng/bank. Đúng/sai đếm từ verdict backend đã lưu, không tự chấm bằng khóa đáp án tải về. Dấu đã học không có verdict không được gán thành đúng/sai giả.

Học chương khôi phục answers và `resumeQuestionId`; ôn lại dùng review-session riêng. Cả bộ ghép các chương thực có câu; ghi answer/cursor vào đúng chương sở hữu. Ôn cả bộ giữ các review-session từng chương, không tạo API tổng hợp giả hoặc một exam thay cho học.

Điểm liệt dùng native list/overview/session của Practice. Chưa học hết dùng `CONTINUE`; khi đã hoàn tất, lần mở mới chọn `REVIEW` phù hợp. Reload giữ đúng ID phiên đang biết. Đáp án được POST và đọc lại phiên, nên làm lại đúng/sai phản ánh verdict server. Không thay luồng này bằng một danh sách tự lọc rồi chấm local.

Tìm kiếm ở danh sách chương tải câu từ catalog/chapter GET đúng hạng/bank rồi lọc nội dung trong bộ nhớ, có hỗ trợ chữ không dấu. Đây là chỉ mục trình bày của dữ liệu server, không phải endpoint search mới hoặc kho tiến độ local.

### 5.3. Câu sai

Đọc overview và danh sách câu sai hiện tại, kiểm tra tổng/ID. Tabs: tất cả; lý thuyết chương 1–4; biển báo chương 5; sa hình chương 6; điểm liệt theo `isCritical`. Mapping nhóm đang nằm ở adapter, phải kiểm tra lại nếu phân loại backend thay đổi.

Mở câu/hiện đáp án/bỏ qua/vuốt/picker chỉ đọc và đổi vị trí UI, không tự chấm hay bắt đầu/kết thúc lượt. Khi thực sự trả lời, adapter chuẩn bị/resume native wrong-session, POST đáp án, đọc lại grade và danh sách. Câu chỉ biến mất sau khi backend xác nhận không còn cần ôn. UI không hiển thị khối quản lý lượt đang dở, nhưng adapter phiên vẫn cần để chấm; không xóa vì tưởng không dùng.

### 5.4. Thi thử ngẫu nhiên và bộ đề

| Chế độ | UI và quy tắc |
| --- | --- |
| `EXAM` | Chấm sau nộp; lưu lựa chọn, không công bố đáp án/giải thích trong bài |
| `PRACTICE` | Chấm từng câu; nhấn Kiểm tra mới gửi và nhận chấm/giải thích |

Hai chế độ dùng cho cả hai loại đề. Số câu/thời gian/điểm đạt/critical count lấy config; danh sách/số bộ đề lấy API, không cố định A1 hay 20 đề. Card giữ màu từ `userStatus`; chữ trạng thái ẩn trên card nhưng accessibility vẫn có trạng thái.

Bài đang làm và paused lấy từ server cùng ID, vị trí, số câu trả lời và thời gian còn. Tiếp tục dùng ID cũ; pause/resume/finish/retry là thao tác backend. Retry trả ID mới, không ghi đè lịch sử cũ. Countdown theo mốc server; backend quyết định timeout/chấm/đạt.

Kết quả tách đúng/sai/chưa trả lời theo DTO. Thời gian làm bài tính từ các mốc kết quả và deadline phiên đã xác nhận, xét phần pause; thiếu/mâu thuẫn mốc thì hiện `—`, không lấy thời lượng đề làm thời gian thực làm.

### 5.5. Lịch sử và nội dung tham khảo

History Result lọc `targetType=EXAM`, activity và license. Thống kê lấy Page metadata server, không đếm riêng trang đang thấy. Detail dùng `resultId` Result rồi xác nhận `PRACTICE_SESSION`, source ID và liên kết tới kết quả Practice. Hai ID không thay thế nhau. Điểm đúng/tổng lấy số câu thực tế, không quy cố định thang 10.

Biển báo search live theo `q` server, có debounce, nhóm và phân trang; không chỉ lọc trang đang tải. Đổi query/nhóm reset page. Detail theo sign ID và ảnh theo Media ID. Mẹo lấy nguyên nội dung server; chỉ định dạng các dấu `|` thành xuống dòng.

## 6. API mà app gọi qua Gateway

Path dưới đây là path public từ app, có thể khác controller sau Gateway rewrite. `{questionId}` là ID canonical, không phải số ô picker; các ID phiên/đề/result/media lấy đúng trường tương ứng. Không tự gửi `userId` thay cho quyền sở hữu từ token.

Identity và Practice dùng envelope có `data` khi trả dữ liệu. Riêng các lệnh Identity không trả dữ liệu (đăng xuất, đổi/reset mật khẩu, yêu cầu OTP và xác minh) có thể bỏ trường `data` khi giá trị là `null`; app chỉ chấp nhận dạng xác nhận này khi `success=true`, HTTP thành công và không có dữ liệu khác `null`. Login, register, refresh, hồ sơ và các API đọc vẫn bắt buộc có `data` theo hợp đồng. Result history và Media detail ở đây dùng **plain DTO**. Không unwrap/bọc thêm `data` ở các request plain.

### 6.1. Identity và danh mục hạng

| Method | Path | Đầu vào/chức năng |
| --- | --- | --- |
| POST | `/api/v1/auth/login` | `username`, `password`, `deviceInfo` |
| POST | `/api/v1/auth/register` | `username`, `email`, `password`, `fullName`, `birthOfDate`, `phoneNumber` |
| POST | `/api/v1/auth/refresh` | `refreshToken` |
| GET | `/api/v1/users/me` | Hồ sơ và selectedLicenseClass |
| PUT | `/api/v1/users/me/license` | `{ licenseClass }` |
| POST | `/api/v1/auth/forgot-password` | `{ identifier }` |
| POST | `/api/v1/auth/reset-password` | `{ identifier, code, newPassword }` |
| POST | `/api/v1/auth/resend-verification` | `{ identifier, type: 'REGISTER' }` |
| POST | `/api/v1/auth/verify` | `{ identifier, code, type: 'REGISTER' }` |
| POST | `/api/v1/auth/change-password` | `{ oldPassword, newPassword }` |
| POST | `/api/v1/auth/logout` | Bearer token |
| GET | `/api/practice/v1/exams/license-catalog` | Practice cung cấp code/title/description hạng |

Ngoại trừ dòng danh mục hạng thuộc Practice, các dòng còn lại thuộc Identity. Ngày sinh đăng ký dùng `yyyy-MM-dd` sau validation form.

### 6.2. Catalog, học và ôn — Practice

Các GET theo hạng gửi `licenseClass` trong query. Body dùng đúng field của adapter.

| Method | Path | Mục đích/body |
| --- | --- | --- |
| GET | `/api/practice/v1/questions/learning-catalog` | Catalog hạng/bank/chương/số câu |
| GET | `/api/practice/v1/learning/chapters` | Overview/trạng thái/cursor |
| GET | `/api/practice/v1/questions/chapter/{chapterId}` | Câu, labels/options, ảnh và tham chiếu |
| GET | `/api/practice/v1/learning/chapters/{chapterId}/answers` | Verdict học đã lưu |
| POST | `/api/practice/v1/learning/chapters/{chapterId}/answers` | `{ licenseClass, questionId, selectedAnswer }` |
| PUT | `/api/practice/v1/learning/chapters/{chapterId}/cursor` | `{ licenseClass, questionId }` |
| POST | `/api/practice/v1/learning/chapters/{chapterId}/review-sessions` | `{ licenseClass }` |
| GET | `/api/practice/v1/learning/chapters/{chapterId}/review-sessions/{sessionId}` | Đọc review đúng ID |
| POST | `/api/practice/v1/learning/chapters/{chapterId}/review-sessions/{sessionId}/answers` | `{ questionId, selectedAnswer }` |
| PUT | `/api/practice/v1/learning/chapters/{chapterId}/review-sessions/{sessionId}/cursor` | `{ currentQuestionId }` |
| POST | `/api/practice/v1/learning/chapters/{chapterId}/review-sessions/{sessionId}/finish` | Hoàn tất review |
| GET | `/api/practice/v1/questions/critical` | Danh sách điểm liệt |
| GET | `/api/practice/v1/questions/critical/overview` | Tổng/đã học |
| POST | `/api/practice/v1/questions/critical/sessions` | `{ licenseClass, mode: CONTINUE/REVIEW, restart: false }` |
| GET | `/api/practice/v1/questions/critical/sessions/{sessionId}` | Phiên điểm liệt |
| POST | `/api/practice/v1/questions/critical/answers` | `{ licenseClass, sessionId, questionId, selectedAnswer }` |
| PUT | `/api/practice/v1/questions/critical/sessions/{sessionId}/cursor` | `{ questionId }` |
| GET | `/api/practice/v1/questions/wrong/overview` | Số câu sai cần ôn |
| GET | `/api/practice/v1/questions/wrong` | Danh sách hiện tại theo hạng |
| POST | `/api/practice/v1/wrong-questions/sessions` | `{ licenseClass }` |
| GET | `/api/practice/v1/wrong-questions/sessions/{sessionId}` | Phiên/answers server |
| POST | `/api/practice/v1/wrong-questions/sessions/{sessionId}/answers` | `{ questionId, selectedAnswer }` |
| PUT | `/api/practice/v1/wrong-questions/sessions/{sessionId}/cursor` | `{ questionId }`; adapter phiên, không phải thao tác vuốt trực tiếp |
| POST | `/api/practice/v1/wrong-questions/sessions/{sessionId}/finish` | Đóng phiên cũ khi cần chuẩn bị phiên chấm đúng tập câu mới |

Kết thúc học thường là đọc lại tiến độ; không tự tạo exam hoặc ghi aggregate Progress. Cả bộ vẫn dùng các API chương tương ứng, không có endpoint all giả.

### 6.3. Thi thử — Practice

| Method | Path | Mục đích/body |
| --- | --- | --- |
| GET | `/api/practice/v1/exams/config?examType={license}` | Cấu hình thi |
| GET | `/api/practice/v1/exams/active?examType={license}` | Bài in progress/paused |
| GET | `/api/practice/v1/exams/presets?licenseClass={license}` | Bộ đề và latestAttempt |
| POST | `/api/practice/v1/exams` | `{ examType, mode }` |
| POST | `/api/practice/v1/exams/presets/{presetId}/sessions` | `{ mode }` |
| GET | `/api/practice/v1/exams/{examId}` | Snapshot phiên |
| POST | `/api/practice/v1/exams/{examId}/answers` | `{ questionId: string, selectedAnswer }` |
| PUT | `/api/practice/v1/exams/{examId}/cursor` | `{ currentQuestionId }` |
| POST | `/api/practice/v1/exams/{examId}/pause` | `{ currentQuestionId }` |
| POST | `/api/practice/v1/exams/{examId}/resume` | Tiếp tục ID cũ |
| POST | `/api/practice/v1/exams/{examId}/finish` | Nộp/chấm |
| GET | `/api/practice/v1/exams/{examId}/result` | Kết quả/câu trả lời |
| POST | `/api/practice/v1/exams/{examId}/retry` | Tạo bài làm lại mới |

### 6.4. Lịch sử, nội dung và ảnh

| Method | Path | Service/định dạng |
| --- | --- | --- |
| GET | `/api/result/v1/results/me/history` | Result plain Page; targetType/activityType/licenseClass/page/size/sort; adapter hỗ trợ result/from |
| GET | `/api/result/v1/results/me/history/{resultId}` | Result plain detail/ownership/source linkage |
| GET | `/api/practice/v1/exams/{sourceId}/result` | Practice; bài làm gốc |
| GET | `/api/practice/v1/traffic-signs` | Practice; page, size=20, group, q |
| GET | `/api/practice/v1/traffic-signs/{signId}` | Practice; chi tiết |
| GET | `/api/practice/v1/memory-tips` | Practice; danh sách mẹo |
| GET | `/api/v1/media/{mediaId}` | Media plain; mediaId/status=READY/mediaType=IMAGE/url |
| GET | URL ảnh được backend cấp | Gateway `/question-images/...` hoặc public storage; không gắn Bearer vào signed URL |

## 7. Quy tắc phối hợp khi sửa

Scope gắn account, session version, license, bank và ID. Đổi account/hạng phải bỏ response đến muộn và remount UI scope. Refresh 401 dùng một request dùng chung rồi thử lại với token server, không lặp vô hạn. Giữ lỗi API thật, không fallback mock hoặc dữ liệu tài khoản trước.

Khóa double tap khi gửi. Nếu mất ACK/timeout sau POST có thể đã commit, đọc lại server trước thao tác tiếp, không tự replay POST. Điều này khác với refresh request bị server từ chối 401. Đáp án đúng/sai phải do grade server xác nhận; option labels và IDs đến từ Practice.

Signed URL giữ nguyên host/path/query. Chỉ đường ảnh `/question-images/...` được rebase về Gateway theo adapter. URL nội bộ phải sửa ở cấu hình backend, không sửa hostname sau khi ký trên app. Không thay ảnh lỗi bằng ảnh câu khác.

Giữ DTO validation; không bỏ kiểm tra hạng/bank/ID để che contract lỗi. Khi đổi schema hay phân nhóm, cập nhật adapter và bộ test ngoài repo; khi thêm UI dùng cùng shared components và quy tắc công bố đáp án theo mode.

## 8. Chạy phát triển và kiểm tra

Cần Node tương thích Expo SDK 57 và dependencies theo lockfile (`npm ci` khi mới clone/cần cài). Backend phải chạy contract cập nhật ở mục 9. Tại thư mục repo, ví dụ PowerShell:

```powershell
$env:EXPO_PUBLIC_DTS_API_URL = 'http://<IP-LAN-may-Gateway>:8888'
$env:REACT_NATIVE_PACKAGER_HOSTNAME = '<IP-LAN-may-Metro>'
npx expo start --go --lan --port 8090 --clear
```

Thay placeholder trước khi chạy. Điện thoại phải truy cập được Metro, Gateway và URL ảnh; localhost là chính điện thoại. Đổi Wi-Fi cần cập nhật IP phù hợp của Metro/Gateway và public Media nếu cũng đổi; dùng QR mới và reload app.

```powershell
npx tsc --noEmit
npm run lint
```

Expo sinh `.expo/types`; lần đầu chưa nhận routes thì chạy Expo cho đúng source rồi kiểm tra lại. Không tắt typed routes hoặc dùng `as any` để che route thiếu. Test/runner được bàn giao ngoài repo theo yêu cầu; chạy với RepositoryRoot của app, không đưa vào bundle. Test mock/typecheck/lint/export không thay thế kiểm tra API thật và thiết bị trên deployment mới.

## 9. Mốc backend tương thích

Các mốc này đã dùng để tích hợp; không khẳng định đã merge main hoặc deploy VPS. Deployment chọn SHA/tag được review chứa contract tương đương và ghi nhận SHA thực tế.

| Repo | Nhánh và SHA tham chiếu |
| --- | --- |
| Identity | `feature/content-builder-chapter-permissions` — `e49bba0a66b693d5ee1698457fed27f03019f04a` |
| Practice | `feature/2026-license-practice-exams` — `6373cc8627649ff6bfe0cd2fc5d736f26aaea802` |
| Result | `fix/result-persistence-and-kafka-retry` — `c8286287308fa4e0bb0f0536753be1a2778f62b7` |
| Gateway | `chore/backend-service-integration` — `0e96e9fba28f305c15f642243cc9607200aa6a32` |
| Media | `feature/traffic-sign-media` — `496505d8882ef6b1e5426ca91650b00e3e48ddbe` |

Không đổi sang backend main cũ chỉ vì app đã merge main. Backend thay contract có chủ ý cần đánh giá adapter; chuyển máy chủ đơn thuần không bắt buộc viết lại giao diện.
