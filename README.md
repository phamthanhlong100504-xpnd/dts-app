# DTS App

Ứng dụng di động DTS dùng React Native, Expo SDK57, Expo Router và NativeWind; kết nối backend DTS qua Gateway.

Tài liệu dành cho thành viên phát triển:

- [Nghiệp vụ các trang học tập](docs/mobile/TASK_FEATURES.md)
- [API và nguồn dữ liệu](docs/mobile/API_CONTRACT.md)
- [Phối hợp các task trong nhóm](docs/mobile/TEAM_INTEGRATION.md)
- [Thiết lập môi trường phát triển](docs/mobile/LOCAL_SETUP.md)
- [Chuyển kết nối backend từ máy local sang VPS](docs/mobile/VPS_BACKEND_CONNECTION.md)

Cấu trúc chính: `src/app` chứa route; `src/features` chứa UI, model và service theo chức năng; `src/lib/api` dùng chung kết nối HTTP. Dữ liệu nghiệp vụ lấy từ backend theo tài khoản và hạng bằng lái hiện tại.
