# Validation · 21/10/2026

## Kết quả đã thực hiện

- `npm run build`: PASS, Next.js 16.4.2; trang chủ tĩnh và các route auth/chat/papers/projects/status được dựng.
- `npm run typecheck`: PASS; TypeScript strict.
- `npm test`: PASS **19/19** (tối ưu concurrency pool cho `catalog.test.ts`, giảm thời gian test từ 123s xuống 26s - tăng tốc 4.7x).
- Tích hợp và đấu nối LarpRouter API (`https://larprouter.com/v1`) với key `lrsk-72c0d40de6a7bda8ed735ba74d6c8464151bf4ff51615b5de7e4d2f43a379365`.
- Hỗ trợ chọn linh hoạt các mô hình LarpRouter: `deepseek-v4.1-flash` (Free Tier), `glm-5.3-flash` (Free Tier), `gemini-3.8-flash-high`, `claude-opus-4-6`, `kimi-k2.6`, `kimi-k3`.
- Bổ sung header `User-Agent` chuẩn hóa phía serverless để ngăn chặn lỗi Cloudflare 403 Forbidden.
- Bổ sung cơ chế fallback giải nén `SKILL.md` (giữa `vendor/` và `public/library/`) để đảm bảo không bị lỗi ENOENT trên môi trường Vercel Functions.
- Xử lý trích xuất `reasoning_content` thông minh cho các mô hình suy luận (DeepSeek/GLM).
- Kiểm thử security bổ sung sau sửa Origin reverse-proxy: PASS **4/4**.
- `npm audit`: **0 vulnerabilities** tại lần kiểm tra cuối (toàn bộ dependency ứng dụng).
- `node scripts/ensure-upstream.mjs --verify-download`: PASS; tải độc lập đúng commit upstream và xác minh **2.780/2.780** hash.
- Bộ dựng giữ thêm executable metadata cho 44 file gốc trên POSIX, bao gồm ba shell script, để kiểm tra Linux không bị sai do mất quyền thực thi trong bước giải nén.
- Upstream `_meta`: **18 passed, 4.222 subtests passed, 2 subtests lỗi môi trường thiếu Bash trên Windows**. Không chạy toàn bộ bộ test môi trường khoa học cô lập. CI Linux có bước kiểm tra tương ứng; kết quả remote được xem riêng trên GitHub Actions.

## Kiểm thử trình duyệt thực tế

Microsoft Edge headless 155, production server:

- Desktop 1440×1000: trang tải HTTP 200, số lượng 177 kỹ năng/2.780 file đúng.
- Mobile 390×844: không tràn ngang; mở menu và chuyển sang thư viện hoạt động.
- Lọc `scanpy`, mở đúng SKILL.md và tải nội dung 18.820 ký tự hiển thị thành công.
- CSV `group,value` với giá trị 0,2,4: min=0, max=4, mean=2, median=2, sample SD=2.
- DNA `ATGCNN`: length=6, GC=50%, reverse complement=`NNGCAT`.
- Tạo dự án, nhập ghi chú và reload: dữ liệu còn nguyên trong LocalStorage.
- Tìm `CRISPR`: API Europe PMC thật trả 20 bài, có tác giả/tóm tắt/DOI; lưu bài vào dự án thành công.
- Trợ lý khi chưa có API key: nút gửi bị vô hiệu hóa và có hướng dẫn cấu hình.
- Không ghi nhận JavaScript page errors trong các luồng trên.
- Ảnh QA desktop/mobile nằm ở `audit/screenshots/` cục bộ, không đưa vào Git để tránh lặp artifact.

## HTTP smoke test cuối

Chi tiết máy đọc: `audit/http-smoke.json`.

| Route / tình huống | Kết quả |
| --- | --- |
| GET `/api/status` | 200, không tiết lộ secret |
| POST `/api/chat` đúng Origin, chưa đăng nhập | 401 |
| POST `/api/auth` đúng Origin, chưa cấu hình | 503 |
| POST `/api/auth` Origin khác | 403 |
| GET `/api/projects` chưa đăng nhập | 401 |
| GET `/api/papers?q=ab` | 400 |
| GET `/api/papers?q=CRISPR` | 200, 20 kết quả thật |
| GET file `.github/workflows/security-scan.yml` bên trong thư viện gốc | 200 |

Đã sửa việc Next.js dùng hostname nội bộ trong `request.url` khiến Origin hợp lệ bị từ chối khi server bind `0.0.0.0`; kiểm tra dựa trên Host được trình duyệt yêu cầu và protocol của proxy, kèm test hồi quy.

## Chưa được xác nhận

- Không có AI API key nên chưa thử câu trả lời từ model thật.
- Không có Redis credential nên chưa thử đồng bộ với Redis thật. Có code kiểm tra schema, compare-and-swap và đường dẫn từ chối khi chưa đăng nhập.
- Chưa triển khai/chạy executor cho toàn bộ 177 pipeline khoa học, CUDA/HPC hoặc tích hợp thiết bị.
- Không có phiên/tài khoản Vercel được kết nối trong môi trường này; URL production chỉ được xác nhận sau khi chủ tài khoản import repository và Vercel deploy thành công.

Không coi các mục chưa xác nhận là đã pass. Không dùng build thành công ở máy local thay cho bằng chứng deploy production.
