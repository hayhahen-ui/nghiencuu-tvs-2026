# Chạy và xử lý lỗi local

## Dùng ứng dụng

Từ gốc repository, chạy:

```bash
npm run local
```

Lệnh này build bản production rồi phục vụ ở `http://localhost:3005` trên loopback. Cấu hình AI vẫn đọc từ `.env.local`. Khi sửa mã, dừng server rồi chạy lại lệnh để dựng bản mới. Port 3005 được tách riêng hoàn toàn, không đụng độ với port 3000 cũ.

## Đăng nhập để dùng AI

Nếu cửa sổ workspace báo AI đã được cấu hình và hiện model đang dùng, không cần nhập API key lần nữa. Ô **Mật khẩu workspace** dùng giá trị `APP_PASSWORD` đã được cấp hoặc lưu trong `.env.local`, không dùng key `lrsk-...` của LarpRouter. Sau khi đăng nhập, ứng dụng chuyển thẳng sang Trợ lý nghiên cứu.

API key nằm ở máy chủ trong `AI_API_KEY`. Không đưa API key, mật khẩu workspace hoặc AUTH_SECRET vào Git. Trang trạng thái chỉ trả tên dịch vụ/model và các cờ sẵn sàng, không trả giá trị credential.

## Phát triển mã

```bash
npm run dev
```

Dev server cung cấp hot reload và React debugging. CSP cho phép `unsafe-eval` và WebSocket loopback trong development theo hướng dẫn của Next.js. Bản production không có các ngoại lệ debug này.

## `eval() is not supported in this environment`

React development sử dụng eval để dựng lại stack trace. Đây là lỗi cấu hình nếu CSP đang áp dụng quy tắc production cho development. `next.config.ts` đã tách hai môi trường; có test kiểm tra production không chứa `unsafe-eval`.

## Hydration diff có `bis_skin_checked`, `bis_register`, `__processed_*`

Các thuộc tính trong log người dùng cung cấp không xuất hiện trong mã ứng dụng hoặc HTML server trả về. Chúng được một tiện ích trình duyệt thêm vào DOM trước khi React hydrate. Bản production dùng để chạy ứng dụng không có development error overlay.

Khi cần debug với `npm run dev`, mở localhost trong một browser profile sạch hoặc cửa sổ ẩn danh không có extension được phép chạy, rồi tải lại trang. Chế độ ẩn danh vẫn có thể chạy tiện ích nếu người dùng đã cho phép tiện ích đó hoạt động trong Incognito. Không xóa dữ liệu dự án trong LocalStorage để xử lý cảnh báo này.

Không thêm `suppressHydrationWarning` đại trà, không tắt SSR toàn trang và không tự thay đổi thiết lập tiện ích của trình duyệt chỉ để che cảnh báo. Nếu lỗi vẫn xuất hiện trong profile sạch, kiểm tra diff mới để xác định sai khác do ứng dụng.

Nguồn: [Next.js CSP](https://nextjs.org/docs/app/guides/content-security-policy), [Next.js hydration errors](https://nextjs.org/docs/messages/react-hydration-error).
