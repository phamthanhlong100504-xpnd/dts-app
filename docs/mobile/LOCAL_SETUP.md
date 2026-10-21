# Thiết lập DTS App cho thành viên phát triển

## 1. Dependencies

Dùng phiên bản Node tương thích Expo SDK57 và package-lock.json đã thống nhất của nhánh. Cài đúng dependencies đã khóa:

```sh
npm ci
```

Không nâng SDK hoặc native module chỉ để giải quyết lỗi mạng. Không đưa node_modules hoặc cấu hình riêng của máy vào Git.

## 2. Backend và cấu hình môi trường

Cần backend đúng contract trong TEAM_INTEGRATION.md: Gateway, Identity, Practice, Result; Media/storage nếu câu hỏi có ảnh. Dữ liệu bank/preset, schema và Kafka/outbox do backend quản lý. Không cần chạy frontend web để app gọi API.

Tạo `.env.local` không commit, dựa theo `.env.example`:

```dotenv
EXPO_PUBLIC_DTS_API_URL=https://api.example.com
```

Thay domain bằng Gateway thật. Nếu backend local, dùng IP Wi-Fi máy tính kèm port8888 mà điện thoại truy cập được; không dùng localhost của điện thoại. Giá trị là origin, không thêm /api. Không đưa credentials hoặc secret vào biến EXPO_PUBLIC.

## 3. Chạy app

```sh
npx expo start --go --lan --clear
```

Điện thoại cần kết nối được Metro và Gateway/URL ảnh. Khi đổi IP hoặc môi trường, cập nhật cấu hình và khởi động lại Metro. Tài khoản Expo không thay cho việc thông mạng.

Các route học dùng session thật và StudyHostProvider do auth/home của nhóm kết nối. Xem TEAM_INTEGRATION.md để nối handler đăng nhập và menu. Nhánh task không đưa màn đăng nhập/menu thử riêng vào sản phẩm. Muốn chạy toàn app cần ghép phần auth/home theo hợp đồng này; không thêm user/hạng/tiến độ giả để bỏ qua.

## 4. Kiểm tra source dùng chung

```sh
npx tsc --noEmit
npm run lint
npm run test:study
```

Tests trong repo kiểm tra contract, UI/model, scope/account và lifecycle bằng fixtures cô lập; không phụ thuộc đường dẫn Windows, tài khoản hoặc DB máy cá nhân. Khi ghép các task, chạy thêm kiểm tra API/màn hình thật với tài khoản được phép dùng trên môi trường đích.

## 5. Backend VPS

Xem VPS_BACKEND_CONNECTION.md để đổi Gateway origin, cấu hình storage/ảnh, dữ liệu/tài khoản và đóng gói lại app khi đổi môi trường.
