# Research Agent · Nghiên cứu khoa học

Ứng dụng web tiếng Việt sử dụng toàn bộ **177 Scientific Agent Skills v2.72.0**. Xây bằng Next.js, TypeScript và React. Có cấu hình triển khai Vercel, CI và kiểm tra tính toàn vẹn của từng file nguồn.

[Triển khai trên Vercel](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fhayhahen-ui%2Fnghiencuu-tvs-2026) · [Báo cáo audit](docs/AUDIT.md) · [Hướng dẫn triển khai](docs/DEPLOY.md) · [Phạm vi chức năng](docs/FEATURES.md)

## Chạy ngay

Yêu cầu Node.js **22.x**, npm và kết nối Internet cho lần tải dữ liệu gốc đầu tiên.

```bash
npm ci
npm run catalog
npm run dev
```

Mở `http://localhost:3005`. Để dùng local như ứng dụng thông thường, chạy `npm run local` (tự build rồi mở server ở port 3005, không đụng cổng 3000 cũ). Xem [hướng dẫn local và lỗi CSP/hydration](docs/LOCAL.md).

Để kiểm tra production:

```bash
npm test
npm run build
npm run typecheck
npm start
```

Các chức năng thư viện, tìm bài báo, ghi chú, xuất dữ liệu, CSV và DNA không cần API key AI. Bạn có thể deploy bản này ngay. Trợ lý AI hiển thị trạng thái chưa kích hoạt đến khi có cấu hình.

## Chức năng

- Thư viện 177 kỹ năng: 12 nhóm thuộc 5 khối khoa học, bộ lọc liên ngành, tìm kiếm tiếng Việt có/không dấu, yêu thích, đọc Markdown và tải mã nguồn. Xem [nguyên tắc phân loại](docs/SCIENCE-TAXONOMY.md).
- Tra cứu bài báo thật từ Europe PMC: DOI, tác giả, tóm tắt, năm xuất bản và nguồn trích dẫn.
- Dự án: tạo/xóa, ghi chú tự lưu, gắn kỹ năng, lưu bài báo, nhập/xuất JSON, Markdown và BibTeX.
- Đồng bộ nhiều thiết bị qua Redis REST, có hợp nhất phiên bản và kiểm tra cập nhật đồng thời. Đây là **một workspace dùng chung mật khẩu**, chưa phải hệ thống nhiều tài khoản riêng biệt.
- Công cụ chạy trực tiếp trên trình duyệt: thống kê CSV và phân tích một trình tự DNA/FASTA.
- Trợ lý AI: Chat Completions tương thích OpenAI, chọn từng kỹ năng, toàn nhóm hoặc cả 177 kỹ năng làm ngữ cảnh, xuất hội thoại. AI không có công cụ thực thi mã hoặc tự duyệt web trong cuộc trò chuyện.
- Audit: danh mục **2.780 file** nguyên bản và SHA-256, xem/tải từng file, báo cáo kiểm tra và giới hạn đã biết.

## Cấu hình AI và lưu trữ

Sao chép `.env.example` thành `.env.local`, sau đó cấu hình các biến cần dùng:

| Biến | Mục đích |
| --- | --- |
| `AI_API_KEY` | API key ở phía server; không đưa vào client hoặc Git |
| `AI_BASE_URL` | Mặc định `https://api.openai.com/v1`; phải là HTTPS |
| `AI_MODEL` | Model được nhà cung cấp của bạn cấp quyền sử dụng |
| `AI_CONTEXT_MAX_CHARS` | Tùy chọn: ngân sách ký tự tài liệu kỹ năng, mặc định 180.000; mọi kỹ năng đã chọn đều được gửi, tài liệu dài được trích gọn |
| `APP_PASSWORD` | Mật khẩu cho workspace cá nhân |
| `AUTH_SECRET` | Chuỗi ngẫu nhiên ít nhất 32 ký tự để ký cookie |
| `UPSTASH_REDIS_REST_URL` | Tùy chọn: lưu dự án đám mây và hạn mức dùng chung |
| `UPSTASH_REDIS_REST_TOKEN` | Tùy chọn: quyền truy cập Redis REST phía server |
| `EXPERIENTIAL_API_KEY` | Tùy chọn: API key cho GPT-6 Luna Decisions thẩm định xác suất & an toàn |
| `EXPERIENTIAL_BASE_URL` | Tùy chọn: `https://api.experientiallabs.ai/v1` |

Chưa có key: để trống các biến AI. Thư viện vẫn hoạt động. Không dùng tiền tố `NEXT_PUBLIC_` cho thông tin bí mật. Đổi `AUTH_SECRET` sẽ vô hiệu hóa các phiên đăng nhập cũ.

## Toàn bộ nguồn gốc được bảo toàn

ZIP được kiểm tra có SHA-256 `1b1b0835a8efa5fb862be42f935bfbaf01c04bd489eb3f4960249591f8398a45` và comment chỉ đến commit `593377bb048752abb0152deab9fbb1083a6087df` của [K-Dense-AI/scientific-agent-skills](https://github.com/K-Dense-AI/scientific-agent-skills/tree/593377bb048752abb0152deab9fbb1083a6087df).

Repository này giữ mã ứng dụng, lock nguồn và manifest kiểm chứng. Khi build lần đầu, `scripts/ensure-upstream.mjs` tải đúng commit, đọc **toàn bộ 2.780 file**, xác minh từng hash rồi dựng `vendor/` và `public/library/`. File có nội dung khác sẽ làm build thất bại. Không sử dụng nhánh `main` đang thay đổi để lấy dữ liệu. Không loại bỏ script, fixture, tài liệu hay ảnh nào trong nguồn đã audit.

`vendor/` và tài nguyên dựng lại không được commit để tránh lặp hàng trăm MB dữ liệu trong Git. Bản gốc đầy đủ vẫn có ở workspace sau khi dựng. `npm test` đối chiếu cả bản vendor và bản public với manifest. Muốn xác minh lại tải mới:

```bash
node scripts/ensure-upstream.mjs --verify-download
```

Nếu có ZIP gốc tại máy, có thể tái tạo audit bằng Python 3.11+:

```bash
python scripts/audit_archive.py /duong-dan/scientific-agent-skills-main.zip
npm run catalog
```

## Giới hạn cần hiểu đúng

**177 kỹ năng là hướng dẫn, mã nguồn và ngữ cảnh cho AI; không đồng nghĩa 177 pipeline khoa học đã chạy trên Vercel.** Các kỹ năng phụ thuộc CUDA, MATLAB, Java, HPC, robot phòng thí nghiệm hoặc API bên thứ ba cần môi trường/cấu hình riêng. Không cài tất cả thư viện khoa học vào một Python environment vì có các yêu cầu phiên bản xung đột. Xem yêu cầu và bộ test riêng tại `vendor/scientific-agent-skills/tests/skill-requirements.toml`.

Audit đọc toàn bộ byte, parse/scans văn bản và kiểm tra cấu trúc nhị phân theo loại hỗ trợ. Không tuyên bố đã đọc hiểu thủ công từng dòng hoặc xác thực kết quả khoa học của tất cả thư viện. Báo cáo scanner sẵn có của upstream vẫn được giữ nguyên, bao gồm các phát hiện cần xem xét; xem `docs/AUDIT.md`.

## Giấy phép

Mã ứng dụng: MIT. Bộ kỹ năng: © 2025 K-Dense Inc., MIT. Các giấy phép fixture riêng được giữ nguyên. [Thông báo bên thứ ba](THIRD_PARTY_NOTICES.md).
