# DTS App

Ứng dụng mobile học lý thuyết GPLX bằng React Native, Expo SDK 57, Expo Router, TypeScript và NativeWind. Nhánh `feature/mobile-full-integration` tích hợp toàn bộ luồng tài khoản, chọn hạng, Trang chủ, thi thử ngẫu nhiên/bộ đề, học theo chương/cả bộ/điểm liệt, câu sai, lịch sử, biển báo và mẹo ghi nhớ.

- [Chức năng, cấu trúc source, luồng và API từng service](docs/APP_OVERVIEW.md)
- [Kết nối backend trên VPS và phát hành app](docs/VPS_BACKEND_CONNECTION.md)

## Chạy phát triển

```bash
npm ci
```

Cấu hình `EXPO_PUBLIC_DTS_API_URL` trong `.env.local` theo `.env.example`, trỏ tới public Gateway origin mà điện thoại truy cập được. Ví dụ `https://api.example.com`, không thêm `/api`. Backend local dùng IP LAN của máy chạy Gateway; không dùng localhost trên điện thoại.

```bash
npm start -- --go --lan
```

Dùng backend có contract đã cập nhật như tài liệu; backend main cũ có thể chưa có đủ API.

## Kiểm tra source

```bash
npx tsc --noEmit
npm run lint
```

Expo sinh typed routes khi khởi động; chạy Expo trước nếu máy mới chưa có `.expo/types`. Test, công cụ riêng máy, log và backup được giữ ngoài repo; không tham gia bundle. Dữ liệu nghiệp vụ lấy backend, không lưu tiến độ hoặc điểm tự tạo trên thiết bị.
