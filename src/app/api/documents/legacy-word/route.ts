import WordExtractor from "word-extractor";
import { authenticated, quota, sameOrigin } from "@/lib/security";
import { MAX_DOCUMENT_CHARS, splitDocumentText } from "@/lib/research-documents";
export const runtime = "nodejs";
export const maxDuration = 30;
export async function POST(request: Request) {
  if (!sameOrigin(request)) return Response.json({ error: "Nguồn yêu cầu không hợp lệ." }, { status: 403 });
  if (!(await authenticated())) return Response.json({ error: "Đăng nhập workspace để đọc Word DOC cũ, hoặc lưu lại file thành DOCX để đọc tại trình duyệt." }, { status: 401 });
  if (!(await quota("legacy-doc", 40, 3600))) return Response.json({ error: "Đã đạt hạn mức đọc DOC, hãy thử lại sau." }, { status: 429 });
  const reader = request.body?.getReader();
  if (!reader) return Response.json({ error: "Thiếu file Word." }, { status: 400 });
  try {
    const buffers: Uint8Array[] = [];
    let size = 0;
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 3_500_000) {
        await reader.cancel();
        return Response.json({ error: "DOC cũ hỗ trợ tối đa 3,5 MB. Hãy lưu thành DOCX để đọc file lớn hơn tại trình duyệt." }, { status: 413 });
      }
      buffers.push(value);
    }
    const bytes = Buffer.concat(buffers);
    if (!bytes.subarray(0, 8).equals(Buffer.from("d0cf11e0a1b11ae1", "hex")))
      return Response.json({ error: "Định dạng DOC không hợp lệ. Hãy lưu lại thành DOCX." }, { status: 400 });
    const document = await new WordExtractor().extract(bytes);
    const sections = [
      ["Nội dung chính", document.getBody()],
      ["Đầu trang", document.getHeaders({ includeFooters: false })],
      ["Chân trang", document.getFooters()],
      ["Chú thích chân trang", document.getFootnotes()],
      ["Chú thích cuối tài liệu", document.getEndnotes()],
      ["Bình luận", document.getAnnotations()],
      ["Hộp văn bản", document.getTextboxes()],
    ].filter(([, text]) => text.trim());
    if (!sections.length || sections.reduce((n, [, text]) => n + text.length, 0) > MAX_DOCUMENT_CHARS)
      return Response.json({ error: "Không có văn bản đọc được hoặc nội dung DOC quá lớn. Hãy chuyển sang DOCX/PDF." }, { status: 422 });
    return Response.json({
      units: sections.flatMap(([label, text]) => splitDocumentText(text, label)), unitCount: sections.length,
      warnings: ["DOC cũ được đọc trên máy chủ ứng dụng, không lưu bản gốc tại máy chủ. Ảnh nhúng và biểu đồ chưa OCR; hãy xuất PDF nếu cần đọc chữ trong ảnh. Phân trang Word có thể thay đổi nên nguồn trích dẫn theo phần."],
    }, { headers: { "Cache-Control": "no-store" } });
  } catch {
    return Response.json({ error: "Không đọc được DOC hoặc file có mật khẩu. Hãy mở bằng Word và lưu một bản DOCX/PDF không mã hóa." }, { status: 422 });
  } finally { reader.releaseLock(); }
}
