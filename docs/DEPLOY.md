# Triển khai Vercel

## 1. Import repository

1. Đăng nhập Vercel, chọn **Add New → Project → Import Git Repository**.
2. Chọn `mrbit4578/agent-nghiencuu-2026`.
3. Root Directory: **gốc repository**, Framework: **Next.js**, Node.js: **22.x**.
4. Install Command: `npm ci`. Build Command: `npm run build`. Output Directory: giữ mặc định của Next.js.
5. Bấm Deploy. Bản không AI không yêu cầu bất kỳ secret nào.

`vercel.json` đã khai báo framework, lệnh cài đặt/build và thời hạn route AI. Mỗi push lên `main` sẽ được Vercel dựng lại nếu Git integration được kết nối. Lần build đầu tải khoảng 246 MB nguồn gốc đã khóa commit, kiểm tra 2.780 SHA-256 và tạo tài nguyên tĩnh. Cần cho phép truy cập `codeload.github.com` trong môi trường build.

## 2. Kích hoạt AI khi có API key

Trong **Settings → Environment Variables**, thêm các biến cho Production và Preview theo nhu cầu:

### Cấu hình với LarpRouter (Khuyên dùng)

```text
AI_API_KEY=lrsk-72c0d40de6a7bda8ed735ba74d6c8464151bf4ff51615b5de7e4d2f43a379365
AI_BASE_URL=https://larprouter.com/v1
AI_MODEL=deepseek-v4.1-flash
APP_PASSWORD=research-0f3b06373ede
AUTH_SECRET=442e81d936dc134156b62f63dcbd1fe98df9aebf9f1c1c9c9b73cd52a1369a52
```

> **Ghi chú về model LarpRouter:**
> - `deepseek-v4.1-flash` (Free tier, 1M context, 128k output) - mặc định
> - `glm-5.3-flash` (Free tier, 1M context, 128k output)
> - `gemini-3.8-flash-high`, `claude-opus-4-6`, `kimi-k2.6`, `kimi-k3` (Standard)
> Người dùng có thể linh hoạt chuyển đổi giữa các mô hình này trực tiếp trên giao diện Trợ lý nghiên cứu!

Sinh secret bằng:

```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Redeploy để môi trường mới có hiệu lực, rồi mở **Cấu hình workspace → Đăng nhập**. Key chỉ dùng ở server. Cookie phiên có HttpOnly, SameSite=Strict và Secure trong production, hết hạn sau tám giờ. APP_PASSWORD là quyền truy cập cùng một workspace, không tách dữ liệu nhiều người dùng.

## 3. Đồng bộ dự án và hạn mức bền vững

Tạo Redis tương thích Upstash REST và thêm:

```text
UPSTASH_REDIS_REST_URL=<REST endpoint>
UPSTASH_REDIS_REST_TOKEN=<REST token>
```

Sau redeploy, đăng nhập rồi chọn **Dự án của tôi → Đồng bộ đám mây**. Nút này đọc snapshot, hợp nhất theo id/thời điểm cập nhật và lưu bằng compare-and-swap nguyên tử. Cập nhật đồng thời gây HTTP 409, người dùng đồng bộ lại để hợp nhất. Không tự xóa bản local; việc xóa local không tự xóa bản cloud trong lần hợp nhất. Muốn xóa dữ liệu cloud hoàn toàn, quản trị viên xóa key `research:projects:v1` trong Redis sau khi sao lưu. Giới hạn snapshot là 4 MB.

Nếu không cấu hình Redis, dự án chỉ tự lưu trên trình duyệt; hạn mức API chỉ nằm trong bộ nhớ từng process, có thể reset khi instance thay đổi. Cấu hình Redis và/hoặc Vercel WAF để hạn chế chi phí trong môi trường public. Không sử dụng bộ đếm trong RAM làm giới hạn chi phí tuyệt đối.

## 4. Kiểm tra sau deploy

- Trang chủ hiển thị 177 kỹ năng và 2.780 file gốc.
- Thư viện: tìm `scanpy`, đọc SKILL.md, mở tài liệu references và tải script.
- Bài báo: tìm `CRISPR`, kiểm tra DOI mở đến nguồn thật.
- Dự án: tạo, ghi chú, reload, xuất/nhập JSON và lưu bài báo.
- Công cụ: CSV `group,value` với các giá trị 0,2,4 phải có mean=2 và sample SD=2.
- DNA `ATGCNN` phải có length=6, GC=50%, reverse-complement=`NNGCAT`.
- Chưa có AI key: route AI từ chối và UI hiển thị chưa kích hoạt.
- Có AI key: đăng nhập, chọn kỹ năng, gửi câu hỏi và xác minh đáp án với nguồn độc lập.
- Không chia sẻ mật khẩu workspace hoặc Redis credential trên GitHub.

## 5. Python chuyên sâu

Ứng dụng hiện không chạy tùy ý script Python từ trình duyệt. Dùng môi trường riêng theo kỹ năng. Kiểm thử upstream theo quy tắc **một process cho mỗi skill**:

```bash
cd vendor/scientific-agent-skills
uv run --with pytest python -m pytest tests/_meta -q
python tests/run_all.py --isolated scanpy qiskit
```

Pipeline GPU/HPC hoặc tương tác thiết bị cần triển khai executor riêng và tích hợp theo hợp đồng công việc có kiểm soát. Không đưa shell/python execution endpoint mở lên Internet. Đây là phần mở rộng chưa được triển khai trong ứng dụng này.

## Trạng thái và xử lý lỗi

- `/api/status` chỉ trả cờ trạng thái; không trả giá trị secret.
- `503` AI: thiếu cấu hình.
- `401`: chưa đăng nhập hoặc phiên hết hạn.
- `403`: Origin không khớp host hiện tại.
- `429`: hết hạn mức yêu cầu trong cửa sổ thời gian.
- `502`: AI/Europe PMC/Redis không phản hồi hoặc sai cấu hình.
- Build báo hash mismatch: dừng deploy, đối chiếu `upstream.lock.json` và manifest; không bỏ qua kiểm tra để lấy `main` mới nhất.

Thông số nền tảng có thể đổi; đối chiếu [Vercel Functions limits](https://vercel.com/docs/functions/limitations) và [Vercel function duration](https://vercel.com/docs/functions/configuring-functions/duration) với gói tài khoản đang dùng.
