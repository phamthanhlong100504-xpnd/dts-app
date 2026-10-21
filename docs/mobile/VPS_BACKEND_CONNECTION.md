# DTS App: chuyển backend local sang VPS

## 1. Kết luận và phạm vi

App hiện gọi backend thật chạy trên máy phát triển qua Gateway, không cần backend phải lên VPS trước. Khi cùng phiên bản backend được triển khai lên VPS và giữ nguyên contract, phần học tập của app chủ yếu đổi **một cấu hình Gateway origin**. Không phải viết lại bốn trang, thay từng API endpoint hoặc đổi cấu trúc thư mục.

Đây là kế hoạch chuyển môi trường, chưa phải xác nhận VPS đã triển khai thành công. Domain/VPS/build profile thật của nhóm chưa được cung cấp. Các địa chỉ `api.example.com` trong tài liệu chỉ là ví dụ, phải thay bằng địa chỉ được người triển khai xác nhận.

## 2. Kết nối hiện tại và sau triển khai

| Thành phần | Hiện tại | Khi lên VPS |
| --- | --- | --- |
| App trên điện thoại | Bundle Expo Go từ máy phát triển | Vẫn có thể Expo Go để kiểm tra; sau đó build app riêng |
| Gateway | IP Wi-Fi máy tính, port8888 | Domain HTTPS Gateway công khai |
| Identity/Practice/Result/Media | Service chạy local | Service backend trong mạng VPS/container |
| PostgreSQL/Redis/Kafka | Hạ tầng local | Hạ tầng do người triển khai quản lý |
| Ảnh | Practice qua Gateway hoặc URL Media/MinIO | Gateway/CDN/object storage mà điện thoại truy cập được |
| Tiến độ/hồ sơ/lịch sử | DB backend local theo tài khoản | DB backend VPS theo tài khoản |

App chỉ cần biết Gateway và các URL ảnh hợp lệ do backend trả. Không cấu hình app trỏ riêng vào từng service, DB, Redis hoặc Kafka. Frontend web không cần chạy để mobile sử dụng API.

## 3. Cấu hình duy nhất đang dùng trong app

File `src/lib/api/http.ts` đọc:

```ts
process.env.EXPO_PUBLIC_DTS_API_URL
```

Giá trị phải là **origin**, ví dụ `https://api.example.com`, không có `/api`, `/api/v1`, query hoặc thông tin đăng nhập. Các service tự nối đường dẫn `/api/...`.

Không có fallback về VPS cũ. Thiếu cấu hình sẽ báo lỗi để tránh vô tình gửi dữ liệu sang sai môi trường. `.env.example` là mẫu chung; địa chỉ dùng riêng đặt ở môi trường chạy hoặc `.env.local` không commit.

### Xem bằng Expo Go với backend VPS

Dừng Metro đang chạy rồi dùng PowerShell:

```powershell
# Run from the cloned dts-app repository directory.
$env:EXPO_PUBLIC_DTS_API_URL = 'https://api.example.com'
npx expo start --go --lan --port 8090 --clear
```

Thay domain trước khi chạy. Điện thoại vẫn cần kết nối được Metro để tải bundle. Việc API đã lên VPS không tự đưa Metro local lên internet. Expo tunnel, nếu dùng, cũng không triển khai backend.

## 4. Build app phát hành khác Expo Go như thế nào?

`EXPO_PUBLIC_...` được Expo đưa vào JavaScript bundle khi đóng gói. Đổi biến trên VPS **không tự đổi** địa chỉ API trong app đã cài. Khi đổi origin, phải tạo bundle mới: khởi động lại Metro khi phát triển; build lại app hoặc phát hành EAS Update phù hợp nếu nhóm đã cấu hình hệ thống update tương thích.

Repo/task này không tự thiết lập EAS project, credentials ký app, channel, runtimeVersion hoặc pipeline phát hành. Người phụ trách build cần cấu hình `EXPO_PUBLIC_DTS_API_URL` trong đúng môi trường EAS Build/Update và xác nhận bundle đang dùng domain dự kiến. Không giả định EAS Update đã hoạt động chỉ vì app chạy được trong Expo Go.

Có thể giữ API domain ổn định trong những lần chuyển máy chủ sau: app tiếp tục gọi cùng domain, người triển khai thay hạ tầng phía sau. Đây là lựa chọn triển khai, không cần thêm logic nghiệp vụ mobile.

Các biến `EXPO_PUBLIC_` nằm trong app và có thể bị đọc. Chỉ đặt địa chỉ công khai/flag phù hợp; không đặt password DB, JWT signing key, secret MinIO, token quản trị hoặc tài khoản người dùng vào đó.

## 5. Điều kiện để không phải sửa lại các màn hình

Người triển khai phải đưa đúng code/contract đã bàn giao lên VPS, gồm Identity profile/selectedLicenseClass, Practice learning/critical/wrong/exam results, Result history và Media metadata. Xem bảng commit backend tại TEAM_INTEGRATION.md; không lấy backend main cũ chỉ vì mobile đã merge main.

Phải giữ:

- HTTP method/path, envelope hoặc plain DTO, tên trường và kiểu ID.
- Ownership từ người dùng xác thực; hạng/bank/version theo backend.
- Cursor/grade/answer/session semantics và phân trang.
- Result history chỉ trả đúng dữ liệu được phép xem; app hiển thị random/preset.
- Token/refresh và route Gateway tương thích với các adapters hiện có.

App đọc tiến độ chương trực tiếp Practice theo quyết định hiện tại. Không tự chuyển sang Progress chỉ vì triển khai lên VPS. Nếu backend chủ động đổi contract thì cần đánh giá và sửa adapter liên quan; đó là thay đổi API, không phải hệ quả bắt buộc của chuyển máy chủ.

## 6. Gateway, HTTPS và mạng nội bộ VPS

Người triển khai cấu hình reverse proxy/TLS và Gateway route tới đúng hostname/port nội bộ. `localhost` bên trong container là chính container đó, không phải máy Windows trước đây. Những service URL nội bộ thuộc cấu hình Gateway/backend, không đưa vào app.

Public Gateway nên dùng HTTPS với chứng chỉ hợp lệ cho domain; không thêm code bỏ kiểm tra chứng chỉ để chữa kết nối. Không cần công khai mọi port service hoặc DB ra điện thoại. Native Expo Go/app gọi HTTP không dùng cùng cơ chế CORS của trình duyệt; nếu kiểm tra Expo web thì phải xét thêm CORS phía server.

Việc đổi môi trường không đổi kiến trúc hiện tại: mobile/web là client; Gateway định tuyến/xác thực theo thiết kế hiện có; các service giữ nghiệp vụ; outbox/Kafka chuyển dữ liệu; DB là nguồn lưu bền. Nhóm có thể triển khai các service chung VPS hoặc tách máy mà vẫn giữ contract client.

## 7. Ảnh: điểm dễ bị quên khi API đã chạy

`question-image-service.ts` có hai luồng:

1. Đường dẫn `/question-images/...` được ghép về Gateway hiện cấu hình. VPS phải phục vụ đúng đường dẫn đó và có dữ liệu ảnh tương ứng.
2. Media trả URL ảnh hoặc signed URL. Điện thoại tải URL đó trực tiếp, không gắn Bearer token vào URL storage.

Backend không được trả `localhost:9000`, `127.0.0.1`, hostname MinIO/container nội bộ hoặc IP Wi-Fi cũ. Cần cấu hình origin công khai cho storage và cách ký URL tương ứng. App giữ nguyên signed URL; không thay hostname sau khi ký vì có thể làm chữ ký hết hợp lệ.

Khi chuyển dữ liệu, phải chuyển cả file/object và mapping/media IDs, không chỉ bảng câu hỏi. Câu hỏi có ảnh trên máy local không chứng minh object trên VPS đã tồn tại. Đồng hồ hệ thống và hạn URL cũng phải phù hợp. Không sửa UI sang ảnh giả khi storage lỗi.

## 8. Dữ liệu và tài khoản không tự chuyển theo Git

Push/merge code không chuyển DB, Kafka state, ảnh hoặc dữ liệu người học từ máy local lên VPS. Vì vậy kết nối VPS thành công nhưng thấy ít câu, không có tiến độ hoặc lịch sử không nhất thiết là UI bị hỏng.

Người triển khai cần quyết định rõ: dùng dữ liệu hiện có trên VPS, import nội dung chuẩn hay di chuyển dữ liệu đã được cho phép. Không chép DB dev ghi đè production. Migration, backup, kiểm tra schema/checksum, import bank/preset và chuyển object phải theo tài liệu backend đã bàn giao.

Tài khoản trên VPS có thể khác local. Cùng username không đảm bảo cùng UUID/password/hạng/tiến độ. Sau đổi môi trường hãy thoát session cũ và đăng nhập lại vào backend đích; không dùng token local để chứng minh tài khoản VPS đã hợp lệ. Không copy tiến độ từ Zustand/AsyncStorage để bù dữ liệu thiếu.

Result history phụ thuộc dữ liệu nguồn và outbox/Kafka/consumer. Bài mới đã nộp ở Practice nhưng chưa xuất hiện trong Result cần kiểm tra pipeline backend, không append lịch sử giả ở mobile.

## 9. Kiểm tra sau khi VPS sẵn sàng

Người triển khai cung cấp domain Gateway thật, backend revisions, trạng thái schema/bank/media và tài khoản test được phép dùng. Kiểm tra API đọc bằng tài khoản test: hồ sơ/hạng Identity, chương/cả bộ/critical Practice, danh sách câu sai, hai loại lịch sử/source result và ảnh.



Đảm bảo Metro/bundle cũng trỏ đúng môi trường. Cần dữ liệu test có sẵn cho những tính năng muốn xác nhận. Không dùng dữ liệu giả để che lỗi triển khai; API trả rỗng khi chưa có dữ liệu không chứng minh chức năng đã được kiểm tra đầy đủ.

Sau đó kiểm tra app thật với cấu hình VPS: đăng nhập, chọn/đổi hạng, chương/critical, trả lời câu và reload, câu sai được bỏ sau grade đúng, hai tab lịch sử, review và ảnh. Các thao tác ghi phải dùng tài khoản test đã thống nhất. Báo cáo đọc API không thay thế kiểm tra ghi hoặc hành vi bản release.

## 10. Phân công và mức sửa dự kiến

| Người phụ trách | Công việc |
| --- | --- |
| Backend/triển khai | Đúng revisions, schema/data, Gateway routes, TLS, storage công khai, Kafka/outbox và backup |
| Mobile task này | Đổi Gateway env, xác minh adapters/ảnh/scope đúng trên VPS |
| Auth/home của app | Kết nối session/profile/hạng thật; bỏ dữ liệu mẫu và store nghiệp vụ cũ |
| Thi thử của app | Dùng Practice mới; để backend đẩy Result history |
| Build/release | Đúng EAS environment hoặc bundle build, signing, distribution và cấu hình update nếu dùng |

**Mức sửa mobile dự kiến nhỏ nếu contract giữ nguyên:** đổi env và tạo lại bundle. Không thể cam kết chỉ đổi một dòng là toàn hệ thống chạy nếu VPS chưa có schema/dữ liệu/ảnh hoặc đang deploy API cũ. Các việc hạ tầng đó phải xử lý ở backend/triển khai trước khi quy lỗi cho UI.

## 11. Tài liệu tham chiếu

- [Expo: Environment variables](https://docs.expo.dev/guides/environment-variables/)
- [Expo: EAS environment usage](https://docs.expo.dev/eas/environment-variables/usage/)
- [Backend và tích hợp nhóm](TEAM_INTEGRATION.md)
- [API task học tập](API_CONTRACT.md)
- [Thiết lập local](LOCAL_SETUP.md)

Tài liệu bổ sung ngày 21/10/2026. Source bàn giao không chứa công cụ thao tác máy cá nhân; hướng dẫn áp dụng cho môi trường phát triển và triển khai của nhóm.
