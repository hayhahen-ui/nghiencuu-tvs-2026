/**
 * Medical Diagnostic & Clinical Imaging Analyzer
 * Phân tích và trích xuất cấu trúc phiếu kết quả chẩn đoán hình ảnh (Siêu âm, X-quang, CT, MRI, Xét nghiệm)
 * phục vụ nghiên cứu khoa học, đối chiếu dữ liệu cận lâm sàng và hỗ trợ quyết định y khoa.
 */

import type { DocumentUnit, ResearchDocument } from "./research-documents";

export type MedicalPatientInfo = {
  fullName?: string;
  birthYear?: string;
  age?: string;
  gender?: "Nam" | "Nữ" | "Chưa rõ";
  address?: string;
  facilityName?: string;
  doctorName?: string;
  examDate?: string;
  examRegion?: string;
};

export type OrganFinding = {
  organ: string;
  organVi: string;
  normal: boolean;
  measurements: string[];
  findings: string[];
  echogenicity?: string; // echo trống, echo dày, đồng nhất, hỗn hợp...
  rawText: string;
};

export type MedicalAnalysisResult = {
  isMedicalReport: boolean;
  confidenceScore: number; // 0 - 100
  reportType: "ultrasound" | "xray" | "ct_mri" | "lab_test" | "general_medical";
  patient: MedicalPatientInfo;
  findings: Record<string, OrganFinding>;
  conclusions: string[];
  summaryText: string;
  researchRecommendations: string[];
};

// Từ khóa phát hiện văn bản y tế / chẩn đoán hình ảnh
const MEDICAL_TRIGGERS = [
  /kết quả siêu âm/i,
  /phiếu siêu âm/i,
  /siêu âm (ổ bụng|tổng quát|màu|doppler|tim|tuyến giáp|mạch máu)/i,
  /chẩn đoán hình ảnh/i,
  /x-quang/i,
  /chụp cắt lớp/i,
  /ct scanner/i,
  /cộng hưởng từ/i,
  /mri/i,
  /phiếu kết quả xét nghiệm/i,
  /phòng khám/i,
  /bệnh viện/i,
  /bác s[ĩỹ]/i,
  /bệnh nhân|họ tên|năm sinh/i,
  /nang gan/i,
  /hemangioma/i,
  /tiền liệt tuyến/i,
  /phì đại tiền liệt/i,
  /vôi hóa/i,
  /echo trống|echo dày|echo kém|đồng nhất/i,
  /hạ phân thùy/i,
  /đường mật|túi mật/i,
  /thận (phải|trái)/i,
  /bàng quang/i,
];

// Danh mục các cơ quan khảo sát thường quy trên siêu âm bụng tổng quát
const ORGAN_DEFINITIONS: { key: string; labelVi: string; aliases: RegExp[] }[] = [
  {
    key: "liver",
    labelVi: "Gan & Tĩnh mạch cửa",
    aliases: [/(?:^|\n|\b)(?:-?\s*GAN|Gan)\s*[:：]/i, /\bgan phải\b/i, /\bnhu mô gan\b/i, /\bhạ phân thùy/i],
  },
  {
    key: "gallbladder",
    labelVi: "Hệ Thống Mật & Túi mật",
    aliases: [/(?:^|\n|\b)(?:-?\s*MẬT|Túi mật|Mật)\s*[:：]/i, /\bđường mật\b/i, /\bống mật chủ\b/i],
  },
  {
    key: "pancreas",
    labelVi: "Tụy & Ống Wirsung",
    aliases: [/(?:^|\n|\b)(?:-?\s*TỤY|Tụy)\s*[:：]/i, /\bống wirsung\b/i],
  },
  {
    key: "spleen",
    labelVi: "Lách & Tĩnh mạch lách",
    aliases: [/(?:^|\n|\b)(?:-?\s*LÁCH|Lách)\s*[:：]/i, /\btĩnh mạch lách\b/i],
  },
  {
    key: "kidneys",
    labelVi: "Thận & Niệu quản",
    aliases: [/(?:^|\n|\b)(?:-?\s*THẬN|Thận)\s*[:：]/i, /\bthận phải\b/i, /\bthận trái\b/i, /\bphân âm tủy vỏ\b/i],
  },
  {
    key: "bladder",
    labelVi: "Bàng quang & Tiết niệu dưới",
    aliases: [/(?:^|\n|\b)(?:-?\s*BÀNG QUANG|Bàng quang)\s*[:：]/i],
  },
  {
    key: "prostate",
    labelVi: "Tiền Liệt Tuyến",
    aliases: [/(?:^|\n|\b)(?:-?\s*TIỀN LIỆT TUYẾN|Tiền liệt tuyến)\s*[:：]/i, /\bphì đại tiền liệt\b/i, /\bvôi hóa tiền liệt\b/i],
  },
  {
    key: "stomach_digestive",
    labelVi: "Dạ dày & Ống tiêu hóa",
    aliases: [/(?:^|\n|\b)(?:-?\s*DẠ DÀY|Dạ dày)\s*[:：]/i, /\bdạ dày chướng hơi\b/i, /\bhố chậu phải\b/i, /\bruột thừa\b/i],
  },
  {
    key: "peritoneal_fluid",
    labelVi: "Dịch ổ bụng & Phúc mạc",
    aliases: [/(?:^|\n|\b)(?:-?\s*DỊCH Ổ BỤNG|Dịch ổ bụng)\s*[:：]/i, /\bkhông có dịch ổ bụng\b/i],
  },
  {
    key: "vessels",
    labelVi: "Động Mạch Chủ & Mạch Máu Lớn",
    aliases: [/(?:^|\n|\b)(?:-?\s*ĐỘNG MẠCH CHỦ|ĐM chủ|Mạch máu)\s*[:：]/i],
  },
];

/**
 * Trích xuất kích thước đo đạc (mm, cm, gram)
 * Vd: "14.3 x 13.6 mm", "18.3 x 13.4 mm", "d=8 mm", "kt=41x39x45=37.11 gram"
 */
function extractMeasurements(text: string): string[] {
  const measurements: string[] = [];
  const regexes = [
    /\b(?:kt|kt\s*max|d|kích thước)?\s*[#=:]?\s*(\d+(?:[.,]\d+)?\s*(?:x\s*\d+(?:[.,]\d+)?)+(?:\s*(?:x\s*\d+(?:[.,]\d+)?))?\s*(?:mm|cm|gram|g)?)\b/gi,
    /\b(?:d|đường kính)\s*[=:#]?\s*(\d+(?:[.,]\d+)?\s*(?:mm|cm))\b/gi,
    /\b(\d+(?:[.,]\d+)?\s*(?:gram|gr|g))\b/gi,
    /\b(\d+(?:[.,]\d+)?\s*mm)\b/gi,
  ];

  for (const re of regexes) {
    let match;
    while ((match = re.exec(text)) !== null) {
      const val = match[1] || match[0];
      const trimmed = val.trim();
      if (trimmed.length > 1 && !measurements.includes(trimmed)) {
        measurements.push(trimmed);
      }
    }
  }
  return measurements;
}

/**
 * Trích xuất thông tin hành chính của bệnh nhân từ văn bản OCR
 */
function extractPatientInfo(fullText: string): MedicalPatientInfo {
  const info: MedicalPatientInfo = {};

  // Tên bệnh nhân
  const nameMatch =
    fullText.match(/(?:Họ\s*tên|Họ\s*và\s*tên|Bệnh\s*nhân)\s*[:：]\s*([^\r\n,\t]{2,40}?)(?:\s{2,}|\s*(?:Năm\s*sinh|NS|Sinh\s*năm|Tuổi|Giới|Địa\s*chỉ|\r?\n|$))/i) ||
    fullText.match(/(?:Họ\s*tên|Họ\s*và\s*tên|Bệnh\s*nhân)\s*[:：]\s*([^\r\n]{2,35})/i);
  if (nameMatch) {
    info.fullName = nameMatch[1].trim();
  }

  // Năm sinh / Tuổi
  const birthMatch = fullText.match(/(?:Năm\s*sinh|NS|Sinh\s*năm)\s*[:：]?\s*(\d{4})/i) || fullText.match(/(?:Tuổi)\s*[:：]?\s*(\d{1,3})/i);
  if (birthMatch) {
    info.birthYear = birthMatch[1].trim();
  }

  // Giới tính
  if (/\b(?:Giới\s*tính|Giới)\s*[:：]?\s*Nam\b/i.test(fullText) || /\bNam\b/.test(fullText.slice(0, 500))) {
    info.gender = "Nam";
  } else if (/\b(?:Giới\s*tính|Giới)\s*[:：]?\s*Nữ\b/i.test(fullText)) {
    info.gender = "Nữ";
  } else {
    info.gender = "Chưa rõ";
  }

  // Cơ sở khám bệnh
  const facilityMatch = fullText.match(/(PHÒNG\s*KHÁM[^\n\r]+|BỆNH\s*VIỆN[^\n\r]+)/i);
  if (facilityMatch) {
    info.facilityName = facilityMatch[1].trim();
  }

  // Bác sĩ khám / siêu âm
  const doctorMatch = fullText.match(/(?:BS|BÁC\s*S[ĨỸ]|Bác\s*s[ĩỹ]\s*chuyên\s*khoa)\s*[:.]?\s*([A-ZÀ-Ỹa-zà-ỹ\s]{3,35})(?:\r?\n|$)/i);
  if (doctorMatch) {
    info.doctorName = doctorMatch[1].trim();
  }

  // Vùng siêu âm / Khảo sát
  const regionMatch = fullText.match(/(?:Vùng\s*Siêu\s*Âm|Vùng\s*khảo\s*sát|Chỉ\s*định)\s*[:：]\s*([^\r\n]+)/i);
  if (regionMatch) {
    info.examRegion = regionMatch[1].trim();
  }

  // Ngày khám
  const dateMatch = fullText.match(/(?:Ngày\s*(\d{1,2})\s*tháng\s*(\d{1,2})\s*năm\s*(\d{4}))/i) ||
    fullText.match(/(\d{1,2}[/-]\d{1,2}[/-]\d{4})/);
  if (dateMatch) {
    info.examDate = dateMatch[0].trim();
  }

  return info;
}

/**
 * Trích xuất phần kết luận chẩn đoán hình ảnh
 */
function extractConclusions(fullText: string): string[] {
  const conclusions: string[] = [];
  const conclusionIndex = fullText.search(/(?:KẾT\s*LUẬN|CHẨN\s*ĐOÁN|ĐỀ\s*NGHỊ)\s*[:：]?/i);
  if (conclusionIndex === -1) {
    // Thử tìm các từ khóa chẩn đoán trực tiếp
    const directHits = [
      "Nang gan", "Hemangioma gan", "U máu gan", "Phì đại tiền liệt tuyến",
      "Vôi hóa tiền liệt tuyến", "Sỏi thận", "Gan nhiễm mỡ", "Dạ dày chướng hơi",
      "Sỏi túi mật", "Polyp túi mật"
    ];
    for (const hit of directHits) {
      if (new RegExp(hit, "i").test(fullText)) {
        conclusions.push(hit);
      }
    }
    return conclusions;
  }

  const conclusionText = fullText.slice(conclusionIndex);
  const lines = conclusionText.split(/\r?\n/).slice(1, 10); // Lấy tối đa 10 dòng sau chữ KẾT LUẬN

  for (const line of lines) {
    const clean = line.replace(/^[-\s*•+]+/, "").trim();
    if (!clean) continue;
    if (/(?:BÁC\s*S[ĨỸ]|NGÀY|ĐỀ\s*NGHỊ|KÝ\s*TÊN)/i.test(clean) && !/đề nghị/i.test(line)) {
      break;
    }
    // Tách nếu có dấu chấm phẩy
    const subParts = clean.split(/[;；]/).map((p) => p.trim()).filter(Boolean);
    for (const part of subParts) {
      if (part.length > 3 && !conclusions.includes(part)) {
        conclusions.push(part);
      }
    }
  }

  return conclusions;
}

/**
 * Phân tích đối chiếu các bệnh học phát hiện được cho nghiên cứu
 */
function generateResearchRecommendations(conclusions: string[], text: string): string[] {
  const recommendations: string[] = [];
  const combined = (conclusions.join(" ") + " " + text).toLowerCase();

  if (/nang gan/i.test(combined)) {
    recommendations.push(
      "**Nang gan đơn thuần (Simple Hepatic Cyst):** Cấu trúc echo trống, thành mỏng, tăng âm phía sau đặc trưng. Về mặt lâm sàng & nghiên cứu dịch tễ, hầu hết nang gan dưới 5cm là lành tính (bẩm sinh hoặc thoái hóa), không có nguy cơ ác tính hóa, khuyến cáo theo dõi định kỳ siêu âm 6–12 tháng để đánh giá tốc độ thay đổi kích thước."
    );
  }

  if (/hemangioma|u máu gan/i.test(combined)) {
    recommendations.push(
      "**U máu gan (Hepatic Hemangioma):** Cấu trúc echo dày, bờ rõ đều, không có dòng chảy mạch máu bất thường bên trong hay viền halo ác tính. Đây là u lành tính dạng mạch phổ biến nhất ở gan (tỷ lệ 0.4–20% dân số). Khuyến nghị đối chiếu theo dõi siêu âm hoặc chụp CT/MRI có thuốc cản quang (với động học ngấm thuốc thì động mạch ngoại vi dạng nốt và lấp đầy dần ở thì muộn) nếu kích thước tiến triển nhanh hoặc >5cm."
    );
  }

  if (/tiền liệt tuyến.*(?:phì đại|bph|gram)/i.test(combined) || /37\.\d+\s*gram/i.test(combined)) {
    recommendations.push(
      "**Phì đại lành tính tiền liệt tuyến / tuyến tiền liệt (Benign Prostatic Hyperplasia - BPH):** Trọng lượng ước tính trên 30–37g vượt ngưỡng giải phẫu bình thường (15–20g). Về mặt nghiên cứu y khoa, cần đối chiếu với điểm số đánh giá triệu chứng đường tiểu dưới IPSS (International Prostate Symptom Score) và xét nghiệm chỉ điểm sinh học PSA (Prostate-Specific Antigen) huyết thanh để phân biệt tổn thương lành tính và nguy cơ ác tính."
    );
  }

  if (/vôi hóa.*tiền liệt/i.test(combined)) {
    recommendations.push(
      "**Nốt vôi hóa tiền liệt tuyến / tuyến tiền liệt (Prostatic Calcification):** Thường là lắng đọng thể sỏi tiền liệt (corpora amylacea) hoặc di chứng sau viêm tuyến tiền liệt lành tính mạn tính, không có giá trị tiên lượng ung thư nhưng có thể liên quan đến hội chứng đau vùng chậu hoặc viêm tiết niệu tái phát."
    );
  }

  if (/sỏi thận|echo dày.*bóng lưng/i.test(combined)) {
    recommendations.push(
      "**Sỏi thận (Nephrolithiasis):** Cấu trúc echo dày kèm bóng lưng âm đặc trưng. Cần lưu ý tình trạng đài bể thận không ứ nước (không tắc nghẽn cấp). Khuyến nghị nghiên cứu thành phần nước tiểu (pH, canxi, axit uric, oxalat) và theo dõi nguy cơ sỏi di chuyển xuống niệu quản gây cơn đau quặn thận."
    );
  }

  if (/dạ dày chướng hơi/i.test(combined)) {
    recommendations.push(
      "**Dạ dày chướng hơi:** Có thể hạn chế một phần cửa sổ âm học khảo sát thân-đuôi tụy và thùy gan trái; nên hướng dẫn bệnh nhân nhịn ăn hoặc chuẩn bị kỹ trước các lần thăm khám siêu âm kiểm tra sau."
    );
  }

  return recommendations;
}

/**
 * Phân tích toàn diện tài liệu/ảnh chẩn đoán y tế
 */
export function analyzeMedicalReport(doc: ResearchDocument): MedicalAnalysisResult {
  const fullText = doc.units.map((u) => u.text).join("\n\n");
  const name = doc.name;

  let triggerCount = 0;
  for (const re of MEDICAL_TRIGGERS) {
    if (re.test(fullText) || re.test(name)) triggerCount++;
  }

  const isMedicalReport = triggerCount >= 2 || /siêu âm|x-quang|chẩn đoán|kết quả/i.test(name);
  const confidenceScore = Math.min(100, triggerCount * 12 + (isMedicalReport ? 30 : 0));

  const patient = extractPatientInfo(fullText);
  const conclusions = extractConclusions(fullText);

  // Phân tích từng cơ quan
  const findings: Record<string, OrganFinding> = {};
  for (const def of ORGAN_DEFINITIONS) {
    let matched = false;
    let snippet = "";
    const measurements: string[] = [];

    for (const re of def.aliases) {
      const match = fullText.match(new RegExp(re.source + "[^\\n\\r]{1,300}", "i"));
      if (match) {
        matched = true;
        snippet += match[0] + " ";
        measurements.push(...extractMeasurements(match[0]));
      }
    }

    if (matched || measurements.length > 0) {
      const isNormal = /bình thường|không to|không dãn|không sỏi|đồng nhất|không u|thành không dày/i.test(snippet) &&
        !/nang|hemangioma|vôi hóa|sỏi|chướng hơi|ứ nước/i.test(snippet);

      findings[def.key] = {
        organ: def.key,
        organVi: def.labelVi,
        normal: isNormal,
        measurements: [...new Set(measurements)],
        findings: snippet.trim().split(/[;.]/).map((s) => s.trim()).filter((s) => s.length > 3),
        rawText: snippet.trim(),
      };
    }
  }

  const researchRecommendations = generateResearchRecommendations(conclusions, fullText);

  // Soạn thảo tóm tắt chuẩn hóa cho AI context
  const lines: string[] = [];
  lines.push(`LOẠI TÀI LIỆU: Báo cáo Chẩn đoán Hình ảnh Y tế (Siêu âm / Cận lâm sàng)`);
  if (patient.facilityName) lines.push(`Cơ sở khám: ${patient.facilityName}`);
  if (patient.fullName) lines.push(`Bệnh nhân: ${patient.fullName} (${patient.gender || "Chưa rõ"}, ${patient.birthYear ? `Năm sinh: ${patient.birthYear}` : ""})`);
  if (patient.examRegion) lines.push(`Vùng khảo sát: ${patient.examRegion}`);
  if (patient.doctorName) lines.push(`Bác sĩ thực hiện: ${patient.doctorName}`);
  if (patient.examDate) lines.push(`Thời gian: ${patient.examDate}`);

  if (conclusions.length > 0) {
    lines.push(`\nKẾT LUẬN HÌNH ẢNH HỌC:\n` + conclusions.map((c) => `- ${c}`).join("\n"));
  }

  lines.push(`\nTHÔNG SỐ ĐO ĐẠC & CƠ QUAN KHẢO SÁT CHÍNH:`);
  for (const [, f] of Object.entries(findings)) {
    const meas = f.measurements.length ? ` [Đo đạc: ${f.measurements.join(", ")}]` : "";
    lines.push(`- ${f.organVi}:${meas} ${f.rawText || (f.normal ? "Bình thường" : "Có ghi nhận tổn thương")}`);
  }

  if (researchRecommendations.length > 0) {
    lines.push(`\nĐỐI CHIẾU HỌC THUẬT & HƯỚNG NGHIÊN CỨU LÂM SÀNG:`);
    lines.push(...researchRecommendations);
  }

  lines.push(`\nLƯU Ý: Phân tích phục vụ mục đích nghiên cứu khoa học và đối chiếu cận lâm sàng; không thay thế chẩn đoán hoặc chỉ định trực tiếp từ Bác sĩ chuyên khoa y tế.`);

  return {
    isMedicalReport,
    confidenceScore,
    reportType: "ultrasound",
    patient,
    findings,
    conclusions,
    summaryText: lines.join("\n"),
    researchRecommendations,
  };
}
