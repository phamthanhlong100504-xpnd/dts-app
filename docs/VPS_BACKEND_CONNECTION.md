# DTS App — kết nối backend trên VPS

Dành cho người triển khai backend và người phát hành app, để giữ các luồng trong [APP_OVERVIEW.md](APP_OVERVIEW.md) hoạt động như đã tích hợp. Đây không phải script cài VPS hoặc lệnh migration tự động.

## 1. App có phải sửa nhiều không?

Nếu VPS giữ cùng API contract, đầy đủ dữ liệu và trả URL ảnh mà điện thoại truy cập được, phần app chủ yếu đổi **public Gateway origin** rồi tạo/phát hành bundle phù hợp. Không cần viết lại màn hình chỉ vì đổi máy chủ.

Git không tự chuyển DB, bank, ảnh, token config hay lịch sử. Nếu server còn main cũ, khác DTO/path, thiếu migration/data hoặc trả URL localhost thì đổi origin chưa đủ.

| Tình huống | Xử lý |
| --- | --- |
| Cùng contract/data, đổi IP LAN sang domain VPS | Cấu hình EXPO_PUBLIC_DTS_API_URL; bundle/build phù hợp; test lại |
| Đổi VPS phía sau cùng domain API | Đổi DNS/reverse proxy/backend; app có thể giữ bundle nếu contract và ảnh tương thích |
| Ảnh trả localhost/IP cũ/hostname container | Sửa public endpoint/cách ký bên Media/storage |
| Thiếu câu hỏi/bộ đề/mẹo/biển báo/ảnh | Triển khai dữ liệu và xác minh mapping ID/bank |
| Chủ ý đổi DTO/path/nghiệp vụ | Cập nhật adapter/model/test liên quan, đánh giá client đã cài |
| Muốn nhớ login sau khi đóng app | Tính năng mới về lưu token an toàn; không bắt buộc do đổi VPS |

## 2. Giữ kiến trúc và nguồn dữ liệu

Mobile và web là hai client dùng Gateway/backend. Không cần web đang chạy hoặc nhúng code web để mobile hoạt động. Public domain tới Gateway/reverse proxy; URL nội bộ service, DB, Redis, Kafka và storage thuộc cấu hình server.

Identity giữ account/hạng, Practice giữ học/câu sai/điểm liệt/thi thử, Result giữ lịch sử, Media cấp ảnh. Tiến độ chương tiếp tục đọc **Practice**, không tự chuyển sang Progress khi lên VPS.

Không đưa DB password, JWT signing key, MinIO secret/access key hay broker URL vào JavaScript app. Quyền sở hữu xác định bằng token server, không cho client tự chọn userId để đọc/ghi account khác.

## 3. Cấu hình thật trong app

`src/lib/api/http.ts` đọc:

```text
EXPO_PUBLIC_DTS_API_URL=https://api.example.com
```

Thay domain ví dụ bằng public Gateway thật. Giá trị là origin; không thêm `/api`, `/api/v1`, query, credentials hoặc cổng nội bộ service. Adapter tự nối path. Thiếu cấu hình sẽ báo lỗi, không fallback VPS cũ hay mock.

`.env.example` là mẫu chung. Giá trị môi trường/máy đặt `.env.local` được ignore hoặc trong tiến trình start/build. Kiểm tra biến đang đặt ở terminal để tránh nó tiếp tục override bằng IP cũ.

### 3.1. Expo Go dùng API VPS

Dừng Metro đang chạy, tại thư mục repo dùng PowerShell:

```powershell
$env:EXPO_PUBLIC_DTS_API_URL = 'https://api.example.com'
npx expo start --go --lan --port 8090 --clear
```

Điện thoại vẫn cần tải bundle từ Metro. Nếu đặt `REACT_NATIVE_PACKAGER_HOSTNAME`, đó phải là IP hiện tại của máy Metro, khác domain API VPS. Hai điện thoại có thể dùng cùng QR khi cùng truy cập được Metro; tài khoản Expo không khắc phục được URL sai/firewall/LAN.

API VPS không tự đưa Metro hoặc storage local lên internet. Expo tunnel, nếu nhóm dùng, không triển khai backend/MinIO. Thiết bị ở mạng ngoài không tải được IP LAN của ảnh dù Gateway VPS trả JSON HTTP 200.

### 3.2. Bản app cài độc lập

Expo đưa giá trị EXPO_PUBLIC vào JavaScript bundle khi đóng gói; biến public không chứa secret. Đổi biến trên VPS không đổi origin trong app đã cài. Cần bundle mới qua build mới hoặc Update tương thích nếu nhóm đã thiết lập EAS Update.

Repo hiện chưa có `eas.json` hoặc cấu hình EAS Update hoàn chỉnh. Người phát hành thiết lập EAS project, application ID, ký app, môi trường và phân phối trước; không giả định đã có OTA chỉ vì Expo Go chạy được.

Với EAS, cấu hình biến cho đúng môi trường Build/Update, không chỉ `.env.local` cá nhân. Nếu dùng Update đã thiết lập, phát hành tới runtime/channel phù hợp; đổi native cần build tương ứng. Bản cài phát hành không cần Metro. Gói dọn source không tự tạo các cấu hình phát hành đó.

Tham khảo: [Expo environment variables](https://docs.expo.dev/guides/environment-variables/), [EAS environment usage](https://docs.expo.dev/eas/environment-variables/usage/), [SDK 57](https://docs.expo.dev/versions/v57.0.0/).

## 4. Backend phải đáp ứng gì?

Deploy commit/tag được review chứa các contract ở APP_OVERVIEW, không mặc định chọn main cũ. Merge app không đồng nghĩa backend đã merge/deploy.

| Thành phần | Điều kiện |
| --- | --- |
| Gateway | Route Identity/Practice/Result/Media đúng path; forward Authorization và trace/lỗi JSON |
| Identity | Login/register/profile/refresh/selected license, đổi/reset mật khẩu, verification; token config tương thích |
| Practice | Catalog/overview/answers/cursor/review; native critical/wrong; config/random/preset/pause/resume/result/retry; signs/tips |
| Result | History plain Page/detail, ownership/source link và projection kết quả |
| Media/storage | READY IMAGE metadata, public URL/TLS hợp lệ và đủ object |
| Hạ tầng phụ thuộc | Schema/DB, Redis, outbox/Kafka/consumer và nguồn nội dung mà các backend cần |

Hostname nội bộ phải đúng trong môi trường server. Localhost trong container là container đó, không mặc định host VPS hoặc service bên cạnh. Không cần công khai mọi cổng service/DB/Kafka cho điện thoại.

## 5. Schema, dữ liệu và sự kiện

Người triển khai chuẩn bị backup/migration/rollback riêng cho từng service; dùng migration/runner đúng repo và kiểm tra dữ liệu trước. Không seed/reset DB chỉ để màn hình có dữ liệu.

Cần xác minh danh mục hạng, bankVersion, chương/câu/options/critical flags và mapping IDs; exam config và bộ đề đã phát hành theo hạng; biển báo/nhóm/mẹo; metadata media **cùng** object/bucket; tài khoản/hạng/tiến độ/câu sai/phiên/kết quả nếu cần giữ dữ liệu cũ.

Outbox, Kafka và consumer Result phải chạy đúng topic/group/event schema; không trộn môi trường local với production. History có thể đến sau source result do projection. Nếu nộp xong xem được kết quả Practice mà Result chưa có history, kiểm tra pipeline; không tạo history giả trên app.

Giữ canonical questionId, sessionId, resultId, mediaId và bank mapping khi chuyển dữ liệu. Tạo bank mới cần phương án xử lý dữ liệu cũ của backend. App sẽ từ chối trộn account/hạng/bank/phiên không tương thích.

## 6. Ảnh — JSON 200 chưa đủ

| Nguồn | Yêu cầu |
| --- | --- |
| `/question-images/...` | Gateway/proxy phục vụ đúng file/path; app ghép theo origin hiện cấu hình |
| Public imageUrl | File, HTTPS/certificate và quyền đọc phù hợp |
| mediaFileId | Media detail plain trả đúng ID/READY/IMAGE/url |
| Presigned URL | Public endpoint được dùng lúc ký, giữ nguyên host/path/query và hạn |

Không trả localhost:9000, 127.0.0.1, ::1, minio, dts-media hoặc IP Wi-Fi cũ cho bản production. Không replace hostname sau khi ký vì có thể sai signature; sửa public endpoint/signing ở backend. Endpoint nội bộ storage có thể tách riêng.

Cấu hình Media đã tích hợp dùng `MINIO_ENDPOINT` cho client cấp URL/ký và `MINIO_INTERNAL_ENDPOINT` cho truy cập nội bộ. Đối chiếu với source Media thực tế được deploy. Nếu đổi endpoint, khởi động lại đúng tiến trình Media theo deployment đã có, giữ nguyên DB/credentials/profile môi trường.

Nếu storage qua proxy, kiểm tra Host khi ký, path/bucket/query, forwarding, Content-Type, clock và expiry. Điện thoại tải binary trực tiếp không gắn Bearer Identity vào storage. Không chữa ảnh bằng cách nhúng secret, tắt certificate validation hoặc public toàn bộ bucket.

## 7. HTTPS, mạng và phiên

Public Gateway/ảnh dùng HTTPS certificate hợp lệ; kiểm tra từ điện thoại/mạng người dùng thật, không chỉ VPS/PC. Proxy phải giữ path, method, body và Authorization cho request ghi. Native app không áp dụng CORS như trình duyệt; Expo web và DTS web vẫn cần CORS/origin riêng đúng cấu hình.

Token môi trường cũ có thể không hợp lệ trên Identity mới; logout/login để nhận profile/token đúng môi trường. Đổi signing key hoặc policy cần kế hoạch tương thích. Không dùng chung secret tùy tiện chỉ để token local dùng được.

Session hiện ở bộ nhớ, đóng/mở tiến trình app cần login lại, nhưng tiến độ đọc lại backend. Đổi account/hạng bỏ scope cũ. Không mang cache học account cũ hoặc môi trường cũ sang phiên mới.

## 8. Kiểm tra trước bàn giao bản trỏ VPS

Dùng account/dữ liệu kiểm thử đã thống nhất; trả lời, nộp, đổi mật khẩu, OTP và retry có tác động thực.

| Nhóm | Cần đạt |
| --- | --- |
| Account/token | Login/refresh/profile cùng ID; đổi account không rò dữ liệu |
| Hạng | Chưa chọn vào settings; lưu Identity; home/catalog đổi đúng |
| Auth/email | Đăng ký/OTP/reset/change password đúng môi trường và lifecycle session |
| Chương/cả bộ | Số câu/tên/tiến độ, answer/cursor/resume/review đúng backend và dữ liệu web cùng account/hạng |
| Điểm liệt | Chưa học hết và đã học hết mở lại đều đúng; verdict đúng/sai đổi theo server |
| Câu sai | Đúng tabs; grade thật; đúng thì bỏ sau xác nhận; vuốt/picker không chấm giả |
| Random/preset | Config thật; cả EXAM/PRACTICE; pause/thoát/tiếp tục đúng ID |
| Kết quả | Nộp/hết giờ/đúng/sai/chưa làm/ảnh/giải thích; retry ID mới |
| History | Hai activity, ownership, phân trang, mở đúng source Practice |
| Reference | Search tên/mã/nhóm/page/detail/ảnh; tips không là mock local |
| Thiết bị | Ảnh truy cập từ điện thoại; safe area, màn nhỏ, keyboard, nội dung dài và picker không bị cắt |

Mock tests/model/view, TypeScript, lint và export bundle kiểm tra source; không chứng minh VPS đã có schema/data/object đúng. Hoàn thành runtime checks trên deployment thật sau khi phát hành bundle đúng origin.

## 9. Khoanh vùng khi có lỗi

| Biểu hiện | Kiểm tra |
| --- | --- |
| Còn IP cũ | Biến lúc start/build, terminal override, .env.local và bundle đang cài |
| Network/certificate | DNS/TLS/firewall/proxy và kết nối từ điện thoại |
| 401/403 | Refresh/token/role/ownership, Gateway auth, Identity keys/profile |
| 404/HTML | Prefix/rewrite/version deploy/proxy |
| DTO/hạng/bank lệch | Commit/schema/data/adapter; không bỏ validation |
| Ảnh lỗi dù JSON 200 | Public URL, signature, object/bucket/media mapping, TLS/expiry |
| Kết quả có nhưng history chưa có | Practice outbox và Result consumer/projection |
| Tiến độ lệch | Practice overview/answers đúng account/hạng/bank; không thay bằng Progress |

Ghi nhận HTTP/errorCode/trace ID và SHA deployment; không log công khai password/token/OTP/signed URL còn hiệu lực.

## 10. Thông tin bàn giao môi trường

Ghi public Gateway/media domains, tag/SHA backend, schema/bank/data version, app build/version và môi trường Build/Update. Khi giữ contract và hoàn tất kiểm tra runtime, app/web có thể tiếp tục các luồng trên backend mới. Rollback backend phải xét tương thích client đã phát hành, không chỉ đổi code server đơn lẻ.
