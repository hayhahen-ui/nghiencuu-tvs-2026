/**
 * MSDS / SDS Chemical Safety Data Sheet Analyzer
 * Hỗ trợ nhận diện và chuẩn hóa Phiếu an toàn hóa chất (MSDS/SDS)
 * từ nhiều nhà sản xuất khác nhau theo chuẩn GHS 16 phần (UN GHS / TCVN / OSHA).
 */

import type { DocumentUnit, ResearchDocument } from "./research-documents";

export type GhsSectionKey =
  | "sec1_identification"
  | "sec2_hazards"
  | "sec3_composition"
  | "sec4_first_aid"
  | "sec5_fire_fighting"
  | "sec6_accidental_release"
  | "sec7_handling_storage"
  | "sec8_exposure_ppe"
  | "sec9_physical_chemical"
  | "sec10_stability_reactivity"
  | "sec11_toxicology"
  | "sec12_ecology"
  | "sec13_disposal"
  | "sec14_transport"
  | "sec15_regulatory"
  | "sec16_other";

export type GhsSectionMeta = {
  number: number;
  key: GhsSectionKey;
  titleVi: string;
  titleEn: string;
  found: boolean;
  locator?: string;
  snippet?: string;
};

export type ChemicalEntity = {
  name?: string;
  casNumbers: string[];
  unNumbers: string[];
  signalWord?: "DANGER" | "WARNING" | "NGUY HIỂM" | "CẢNH BÁO";
  hazardCodes: { code: string; descriptionVi: string; descriptionEn: string }[];
  precautionaryCodes: { code: string; descriptionVi: string; descriptionEn: string }[];
  physicalProperties: {
    appearance?: string;
    boilingPoint?: string;
    flashPoint?: string;
    meltingPoint?: string;
    pH?: string;
    density?: string;
    solubility?: string;
    vaporPressure?: string;
  };
  incompatibilities: string[];
  ppeRecommendations: string[];
  firstAidSummary: {
    inhalation?: string;
    skin?: string;
    eyes?: string;
    ingestion?: string;
  };
};

export type MsdsAnalysisResult = {
  isMsds: boolean;
  confidenceScore: number; // 0 - 100
  productName: string;
  sections: Record<GhsSectionKey, GhsSectionMeta>;
  chemical: ChemicalEntity;
  summaryText: string;
};

// 16 GHS Standard Section Header Definitions
export const GHS_SECTIONS_DEF: { number: number; key: GhsSectionKey; titleVi: string; titleEn: string; patterns: RegExp[] }[] = [
  {
    number: 1,
    key: "sec1_identification",
    titleVi: "1. Nhận dạng hóa chất và thông tin nhà cung cấp",
    titleEn: "1. Chemical Product & Company Identification",
    patterns: [
      /(?:mục|phần|section)\s*(?:1|i)\b.*?(?:nhận dạng|identification|tên sản phẩm|thông tin sản phẩm|product identifier)/i,
      /\b1\.\s*(?:nhận dạng hóa chất|identification of the substance|chemical product and company)/i,
    ],
  },
  {
    number: 2,
    key: "sec2_hazards",
    titleVi: "2. Nhận dạng mối nguy hại (GHS)",
    titleEn: "2. Hazard(s) Identification",
    patterns: [
      /(?:mục|phần|section)\s*(?:2|ii)\b.*?(?:nguy hại|hazard|cảnh báo nguy cơ|classification of the substance)/i,
      /\b2\.\s*(?:nhận dạng mối nguy|hazards identification|hazard identification)/i,
    ],
  },
  {
    number: 3,
    key: "sec3_composition",
    titleVi: "3. Thành phần và thông tin về các chất (CAS)",
    titleEn: "3. Composition / Information on Ingredients",
    patterns: [
      /(?:mục|phần|section)\s*(?:3|iii)\b.*?(?:thành phần|composition|ingredients|thông tin về các chất|cas)/i,
      /\b3\.\s*(?:thành phần|composition \/ information on ingredients|ingredients)/i,
    ],
  },
  {
    number: 4,
    key: "sec4_first_aid",
    titleVi: "4. Biện pháp sơ cứu y tế",
    titleEn: "4. First-Aid Measures",
    patterns: [
      /(?:mục|phần|section)\s*(?:4|iv)\b.*?(?:sơ cứu|first[\s-]aid|cấp cứu y tế)/i,
      /\b4\.\s*(?:biện pháp sơ cứu|first-aid measures|first aid)/i,
    ],
  },
  {
    number: 5,
    key: "sec5_fire_fighting",
    titleVi: "5. Biện pháp chữa cháy và phòng hỏa hoạn",
    titleEn: "5. Fire-Fighting Measures",
    patterns: [
      /(?:mục|phần|section)\s*(?:5|v)\b.*?(?:chữa cháy|fire[\s-]fighting|hỏa hoạn)/i,
      /\b5\.\s*(?:biện pháp chữa cháy|fire-fighting measures|fire fighting)/i,
    ],
  },
  {
    number: 6,
    key: "sec6_accidental_release",
    titleVi: "6. Biện pháp ứng phó sự cố tràn đổ, rò rỉ",
    titleEn: "6. Accidental Release Measures",
    patterns: [
      /(?:mục|phần|section)\s*(?:6|vi)\b.*?(?:tràn đổ|rò rỉ|accidental release|sự cố tràn)/i,
      /\b6\.\s*(?:biện pháp phòng ngừa khi có sự cố tràn|accidental release measures)/i,
    ],
  },
  {
    number: 7,
    key: "sec7_handling_storage",
    titleVi: "7. Sử dụng và bảo quản an toàn",
    titleEn: "7. Handling and Storage",
    patterns: [
      /(?:mục|phần|section)\s*(?:7|vii)\b.*?(?:sử dụng và bảo quản|handling and storage|thao tác và tồn trữ)/i,
      /\b7\.\s*(?:sử dụng và bảo quản|handling and storage|bảo quản)/i,
    ],
  },
  {
    number: 8,
    key: "sec8_exposure_ppe",
    titleVi: "8. Kiểm soát phơi nhiễm và trang bị bảo hộ cá nhân (PPE)",
    titleEn: "8. Exposure Controls / Personal Protection",
    patterns: [
      /(?:mục|phần|section)\s*(?:8|viii)\b.*?(?:kiểm soát phơi nhiễm|bảo hộ cá nhân|exposure control|personal protection|ppe)/i,
      /\b8\.\s*(?:kiểm soát phơi nhiễm|exposure controls \/ personal protection)/i,
    ],
  },
  {
    number: 9,
    key: "sec9_physical_chemical",
    titleVi: "9. Tính chất lý hóa học",
    titleEn: "9. Physical and Chemical Properties",
    patterns: [
      /(?:mục|phần|section)\s*(?:9|ix)\b.*?(?:tính chất lý hóa|đặc tính vật lý|physical and chemical properties)/i,
      /\b9\.\s*(?:tính chất lý hóa|physical and chemical properties|đặc tính lý hóa)/i,
    ],
  },
  {
    number: 10,
    key: "sec10_stability_reactivity",
    titleVi: "10. Độ ổn định và khả năng phản ứng tương kỵ",
    titleEn: "10. Stability and Reactivity",
    patterns: [
      /(?:mục|phần|section)\s*(?:10|x)\b.*?(?:độ ổn định|tính ổn định|stability and reactivity|khả năng phản ứng)/i,
      /\b10\.\s*(?:tính ổn định và độ phản ứng|stability and reactivity|khả năng tương kỵ)/i,
    ],
  },
  {
    number: 11,
    key: "sec11_toxicology",
    titleVi: "11. Thông tin về độc tính (LD50 / LC50)",
    titleEn: "11. Toxicological Information",
    patterns: [
      /(?:mục|phần|section)\s*(?:11|xi)\b.*?(?:độc tính|toxicological|thông tin độc học|độc chất)/i,
      /\b11\.\s*(?:thông tin về độc tính|toxicological information|độc tính học)/i,
    ],
  },
  {
    number: 12,
    key: "sec12_ecology",
    titleVi: "12. Thông tin về tác động sinh thái và môi trường",
    titleEn: "12. Ecological Information",
    patterns: [
      /(?:mục|phần|section)\s*(?:12|xii)\b.*?(?:sinh thái|môi trường|ecological|ecotoxicity)/i,
      /\b12\.\s*(?:thông tin sinh thái|ecological information|tác động môi trường)/i,
    ],
  },
  {
    number: 13,
    key: "sec13_disposal",
    titleVi: "13. Biện pháp tiêu hủy và xử lý chất thải",
    titleEn: "13. Disposal Considerations",
    patterns: [
      /(?:mục|phần|section)\s*(?:13|xiii)\b.*?(?:tiêu hủy|thải bỏ|xử lý chất thải|disposal considerations|waste disposal)/i,
      /\b13\.\s*(?:biện pháp tiêu hủy|disposal considerations|xử lý chất thải)/i,
    ],
  },
  {
    number: 14,
    key: "sec14_transport",
    titleVi: "14. Thông tin vận chuyển và mã số UN",
    titleEn: "14. Transport Information",
    patterns: [
      /(?:mục|phần|section)\s*(?:14|xiv)\b.*?(?:vận chuyển|transport information|mã un|un number)/i,
      /\b14\.\s*(?:thông tin vận chuyển|transport information)/i,
    ],
  },
  {
    number: 15,
    key: "sec15_regulatory",
    titleVi: "15. Thông tin pháp luật và quy chuẩn",
    titleEn: "15. Regulatory Information",
    patterns: [
      /(?:mục|phần|section)\s*(?:15|xv)\b.*?(?:pháp luật|quy định|regulatory information|quy chuẩn)/i,
      /\b15\.\s*(?:thông tin quy định|regulatory information|luật hóa chất)/i,
    ],
  },
  {
    number: 16,
    key: "sec16_other",
    titleVi: "16. Thông tin khác và ghi chú bổ sung",
    titleEn: "16. Other Information",
    patterns: [
      /(?:mục|phần|section)\s*(?:16|xvi)\b.*?(?:thông tin khác|other information|ghi chú|tài liệu tham khảo)/i,
      /\b16\.\s*(?:thông tin khác|other information)/i,
    ],
  },
];

// Common GHS Hazard Codes Dictionary
export const GHS_HAZARDS_DICT: Record<string, { vi: string; en: string }> = {
  H220: { vi: "Khí cực kỳ dễ cháy", en: "Extremely flammable gas" },
  H224: { vi: "Chất lỏng và hơi cực kỳ dễ cháy", en: "Extremely flammable liquid and vapour" },
  H225: { vi: "Chất lỏng và hơi rất dễ cháy", en: "Highly flammable liquid and vapour" },
  H226: { vi: "Chất lỏng và hơi dễ cháy", en: "Flammable liquid and vapour" },
  H228: { vi: "Chất rắn dễ cháy", en: "Flammable solid" },
  H240: { vi: "Nguy cơ nổ khi bị nung nóng", en: "Heating may cause an explosion" },
  H270: { vi: "Có thể gây cháy hoặc làm đám cháy bùng phát mạnh; chất oxy hóa", en: "May cause or intensify fire; oxidizer" },
  H280: { vi: "Chứa khí nén; có thể nổ nếu bị nung nóng", en: "Contains gas under pressure; may explode if heated" },
  H290: { vi: "Có thể ăn mòn kim loại", en: "May be corrosive to metals" },
  H300: { vi: "Gây tử vong nếu nuốt phải", en: "Fatal if swallowed" },
  H301: { vi: "Độc nếu nuốt phải", en: "Toxic if swallowed" },
  H302: { vi: "Có hại nếu nuốt phải", en: "Harmful if swallowed" },
  H304: { vi: "Có thể gây tử vong nếu nuốt phải và xâm nhập đường hô hấp", en: "May be fatal if swallowed and enters airways" },
  H310: { vi: "Gây tử vong khi tiếp xúc với da", en: "Fatal in contact with skin" },
  H311: { vi: "Độc khi tiếp xúc với da", en: "Toxic in contact with skin" },
  H312: { vi: "Có hại khi tiếp xúc với da", en: "Harmful in contact with skin" },
  H314: { vi: "Gây bỏng da nghiêm trọng và tổn thương mắt", en: "Causes severe skin burns and eye damage" },
  H315: { vi: "Gây kích ứng da", en: "Causes skin irritation" },
  H317: { vi: "Có thể gây dị ứng da", en: "May cause an allergic skin reaction" },
  H318: { vi: "Gây tổn thương mắt nghiêm trọng", en: "Causes serious eye damage" },
  H319: { vi: "Gây kích ứng mắt nghiêm trọng", en: "Causes serious eye irritation" },
  H330: { vi: "Gây tử vong nếu hít phải", en: "Fatal if inhaled" },
  H331: { vi: "Độc nếu hít phải", en: "Toxic if inhaled" },
  H332: { vi: "Có hại nếu hít phải", en: "Harmful if inhaled" },
  H335: { vi: "Có thể gây kích ứng đường hô hấp", en: "May cause respiratory irritation" },
  H336: { vi: "Có thể gây buồn ngủ hoặc chóng mặt", en: "May cause drowsiness or dizziness" },
  H340: { vi: "Có thể gây đột biến gen", en: "May cause genetic defects" },
  H350: { vi: "Có thể gây ung thư", en: "May cause cancer" },
  H360: { vi: "Có thể ảnh hưởng xấu đến khả năng sinh sản hoặc thai nhi", en: "May damage fertility or the unborn child" },
  H370: { vi: "Gây tổn thương các cơ quan", en: "Causes damage to organs" },
  H372: { vi: "Gây tổn thương các cơ quan do phơi nhiễm kéo dài hoặc lặp lại", en: "Causes damage to organs through prolonged or repeated exposure" },
  H400: { vi: "Rất độc đối với sinh vật thủy sinh", en: "Very toxic to aquatic life" },
  H410: { vi: "Rất độc đối với sinh vật thủy sinh với ảnh hưởng kéo dài", en: "Very toxic to aquatic life with long lasting effects" },
  H411: { vi: "Độc đối với sinh vật thủy sinh với ảnh hưởng kéo dài", en: "Toxic to aquatic life with long lasting effects" },
  H412: { vi: "Có hại đối với sinh vật thủy sinh với ảnh hưởng kéo dài", en: "Harmful to aquatic life with long lasting effects" },
};

// Common GHS Precautionary Codes Dictionary
export const GHS_PRECAUTIONS_DICT: Record<string, { vi: string; en: string }> = {
  P210: { vi: "Tránh xa nguồn nhiệt, bề mặt nóng, tia lửa, ngọn lửa trần. Không hút thuốc.", en: "Keep away from heat, hot surfaces, sparks, open flames. No smoking." },
  P233: { vi: "Đậy chặt nắp thùng chứa.", en: "Keep container tightly closed." },
  P240: { vi: "Tiếp đất thùng chứa và thiết bị tiếp nhận.", en: "Ground and bond container and receiving equipment." },
  P260: { vi: "Không hít bụi/khói/khí/sương/hơi/bụi xịt.", en: "Do not breathe dust/fume/gas/mist/vapours/spray." },
  P261: { vi: "Tránh hít bụi/khói/hơi/bụi xịt.", en: "Avoid breathing dust/fume/gas/mist/vapours/spray." },
  P264: { vi: "Rửa sạch tay thật kỹ sau khi tiếp xúc.", en: "Wash hands thoroughly after handling." },
  P270: { vi: "Không ăn, uống hoặc hút thuốc khi sử dụng sản phẩm này.", en: "Do not eat, drink or smoke when using this product." },
  P271: { vi: "Chỉ sử dụng ngoài trời hoặc ở nơi thông thoáng khí.", en: "Use only outdoors or in a well-ventilated area." },
  P273: { vi: "Tránh thải ra môi trường.", en: "Avoid release to the environment." },
  P280: { vi: "Mang găng tay bảo hộ/quần áo bảo hộ/kính bảo hộ/mặt nạ bảo hộ.", en: "Wear protective gloves/protective clothing/eye protection/face protection." },
  P301: { vi: "NẾU NUỐT PHẢI:", en: "IF SWALLOWED:" },
  P302: { vi: "NẾU TIẾP XÚC LÊN DA:", en: "IF ON SKIN:" },
  P304: { vi: "NẾU HÍT PHẢI:", en: "IF INHALED:" },
  P305: { vi: "NẾU TIẾP XÚC VỚI MẮT:", en: "IF IN EYES:" },
  P310: { vi: "Gọi ngay cho TRUNG TÂM CHỐNG ĐỘC hoặc bác sĩ.", en: "Immediately call a POISON CENTER or doctor/physician." },
  P312: { vi: "Gọi cho TRUNG TÂM CHỐNG ĐỘC hoặc bác sĩ nếu cảm thấy không khỏe.", en: "Call a POISON CENTER or doctor if you feel unwell." },
  P330: { vi: "Súc miệng.", en: "Rinse mouth." },
  P331: { vi: "KHÔNG gây nôn.", en: "Do NOT induce vomiting." },
  P338: { vi: "Tháo kính áp tròng nếu có và dễ thực hiện. Tiếp tục rửa.", en: "Remove contact lenses, if present and easy to do. Continue rinsing." },
  P351: { vi: "Rửa cẩn thận bằng nước trong vài phút.", en: "Rinse cautiously with water for several minutes." },
  P353: { vi: "Rửa sạch da bằng nước/vòi sen.", en: "Rinse skin with water [or shower]." },
  P403: { vi: "Bảo quản ở nơi thông thoáng.", en: "Store in a well-ventilated place." },
  P235: { vi: "Giữ mát.", en: "Keep cool." },
  P405: { vi: "Khóa cẩn thận.", en: "Store locked up." },
  P501: { vi: "Thải bỏ chất/thùng chứa theo quy định pháp luật địa phương/quốc gia.", en: "Dispose of contents/container in accordance with local/national regulations." },
};

// CAS Checksum validation
export function isValidCasNumber(cas: string): boolean {
  const parts = cas.split("-");
  if (parts.length !== 3) return false;
  const digits = (parts[0] + parts[1]).split("").map(Number);
  const checkDigit = Number(parts[2]);
  if (isNaN(checkDigit) || digits.some(isNaN)) return false;
  let sum = 0;
  for (let i = 0; i < digits.length; i++) {
    sum += digits[digits.length - 1 - i] * (i + 1);
  }
  return sum % 10 === checkDigit;
}

// Well-known chemical database for instant friendly resolution
const COMMON_CHEMICALS: Record<string, string> = {
  "64-17-5": "Ethanol (Cồn tuyệt đối / Ethyl alcohol)",
  "67-56-1": "Methanol (Cồn công nghiệp methyl)",
  "67-63-0": "Isopropanol (IPA / 2-Propanol)",
  "67-64-1": "Acetone (Dimethyl ketone)",
  "7664-93-9": "Axit Sulfuric (H2SO4)",
  "7647-01-0": "Axit Clohydric (HCl / Hydrochloric acid)",
  "7697-37-2": "Axit Nitric (HNO3)",
  "1310-73-2": "Natri Hydroxit (NaOH / Xút ăn da)",
  "1310-58-3": "Kali Hydroxit (KOH)",
  "7722-84-1": "Hydro Peroxit (H2O2 / Nước oxy già)",
  "108-88-3": "Toluen (Methylbenzene)",
  "1330-20-7": "Xylen (Dimethylbenzene)",
  "71-43-2": "Benzen (Benzene)",
  "78-93-3": "Methyl Ethyl Ketone (MEK)",
  "141-78-6": "Ethyl Acetate",
  "110-54-3": "n-Hexane",
  "7681-52-9": "Natri Hypoclorit (Nước Javel / NaOCl)",
  "7783-06-4": "Hydro Sulfua (H2S)",
  "7664-41-7": "Amoniac (NH3)",
};

/**
 * Phân tích chuyên sâu tài liệu xem có phải là MSDS/SDS hóa chất không,
 * trích xuất 16 phần GHS, CAS, UN, H/P code, lý hóa tính và trang bị bảo hộ.
 */
export function analyzeMsds(doc: ResearchDocument): MsdsAnalysisResult {
  const fullText = doc.units.map((u) => u.text).join("\n\n");
  const lowerText = fullText.toLowerCase();

  // 1. Phân tích tín hiệu nhận diện MSDS
  let msdsSignalCount = 0;
  if (/safety data sheet|material safety data sheet|bản chỉ dẫn an toàn|phiếu an toàn hóa chất|phiếu dữ liệu an toàn|\bmsds\b|\bsds\b/i.test(fullText)) {
    msdsSignalCount += 4;
  }
  if (/\bghs\b|ghs0[1-9]|pictogram|từ cảnh báo|signal word/i.test(fullText)) msdsSignalCount += 2;
  if (/\bcas\s*(?:no\.?|number|đăng ký)?[:\s]*\b[1-9][0-9]{1,6}-\d{2}-\d\b/i.test(fullText)) msdsSignalCount += 3;
  if (/\bun\s*(?:no\.?|number|số)?[:\s]*\b[0-9]{4}\b/i.test(fullText)) msdsSignalCount += 2;
  if (/\bh[2-4][0-9]{2}\b/i.test(fullText) && /\bp[1-5][0-9]{2}\b/i.test(fullText)) msdsSignalCount += 3;

  // 2. Tìm 16 phần GHS
  const sections: Record<GhsSectionKey, GhsSectionMeta> = {} as any;
  let sectionsFoundCount = 0;

  for (const def of GHS_SECTIONS_DEF) {
    let found = false;
    let foundLocator: string | undefined;
    let snippet: string | undefined;

    for (const unit of doc.units) {
      for (const pattern of def.patterns) {
        if (pattern.test(unit.text)) {
          found = true;
          foundLocator = unit.locator;
          // Lấy trích đoạn 350 ký tự đầu của mục này
          const match = unit.text.match(pattern);
          if (match && match.index !== undefined) {
            snippet = unit.text.slice(match.index, match.index + 350).trim();
          } else {
            snippet = unit.text.slice(0, 300).trim();
          }
          break;
        }
      }
      if (found) break;
    }

    if (found) sectionsFoundCount++;

    sections[def.key] = {
      number: def.number,
      key: def.key,
      titleVi: def.titleVi,
      titleEn: def.titleEn,
      found,
      locator: foundLocator,
      snippet,
    };
  }

  const isMsds = msdsSignalCount >= 4 || sectionsFoundCount >= 3;
  const confidenceScore = Math.min(100, Math.round((msdsSignalCount * 12) + (sectionsFoundCount * 4)));

  // 3. Trích xuất Tên sản phẩm / Hóa chất
  let productName = doc.name.replace(/\.[a-z0-9]+$/i, "");
  const nameMatch = fullText.match(/(?:tên sản phẩm|tên thương mại|product name|chemical name|trade name)[:\s]+([^\n\r]{2,80})/i);
  if (nameMatch && nameMatch[1]?.trim()) {
    productName = nameMatch[1].trim();
  }

  // 4. Trích xuất CAS Numbers
  const casRawMatches = fullText.match(/\b([1-9][0-9]{1,6}-\d{2}-\d)\b/g) || [];
  const validCas = [...new Set(casRawMatches)].filter((cas) => {
    // Ưu tiên các mã CAS có trong bảng hóa chất phổ biến hoặc vượt qua kiểm tra checksum
    return COMMON_CHEMICALS[cas] !== undefined || isValidCasNumber(cas);
  });

  // Nếu tìm thấy CAS nổi tiếng mà productName chưa rõ, bổ sung thêm
  if (validCas.length > 0 && COMMON_CHEMICALS[validCas[0]]) {
    const chemicalDesc = COMMON_CHEMICALS[validCas[0]];
    if (!productName.toLowerCase().includes(chemicalDesc.split(" ")[0].toLowerCase())) {
      productName += ` (${chemicalDesc})`;
    }
  }

  // 5. Trích xuất UN Number
  const unMatches = fullText.match(/\bUN\s*([0-9]{4})\b/gi) || [];
  const unNumbers = [...new Set(unMatches.map((m) => m.toUpperCase().replace(/\s+/, " ")))];

  // 6. Signal Word
  let signalWord: ChemicalEntity["signalWord"] = undefined;
  if (/\b(?:danger|nguy hiểm)\b/i.test(fullText)) {
    signalWord = /nguy hiểm/i.test(fullText) ? "NGUY HIỂM" : "DANGER";
  } else if (/\b(?:warning|cảnh báo)\b/i.test(fullText)) {
    signalWord = /cảnh báo/i.test(fullText) ? "CẢNH BÁO" : "WARNING";
  }

  // 7. Mã H (Hazard Statements)
  const hRaw = fullText.match(/\b(H[2-4][0-9]{2}[a-zA-Z]?)\b/g) || [];
  const uniqueH = [...new Set(hRaw.map((h) => h.toUpperCase()))];
  const hazardCodes = uniqueH.map((code) => {
    const lookup = GHS_HAZARDS_DICT[code.slice(0, 4)] || {
      vi: "Cảnh báo nguy hại theo chuẩn GHS",
      en: "GHS Hazard Statement",
    };
    return {
      code,
      descriptionVi: lookup.vi,
      descriptionEn: lookup.en,
    };
  });

  // 8. Mã P (Precautionary Statements)
  const pRaw = fullText.match(/\b(P[1-5][0-9]{2}[a-zA-Z]?)\b/g) || [];
  const uniqueP = [...new Set(pRaw.map((p) => p.toUpperCase()))];
  const precautionaryCodes = uniqueP.map((code) => {
    const lookup = GHS_PRECAUTIONS_DICT[code.slice(0, 4)] || {
      vi: "Biện pháp phòng ngừa an toàn",
      en: "Precautionary Statement",
    };
    return {
      code,
      descriptionVi: lookup.vi,
      descriptionEn: lookup.en,
    };
  });

  // 9. Tính chất lý hóa (Physical Properties)
  const physicalProperties: ChemicalEntity["physicalProperties"] = {};
  const bpMatch = fullText.match(/(?:điểm sôi|nhiệt độ sôi|boiling point)[:\s]+([^\n\r,;]{2,40})/i);
  if (bpMatch) physicalProperties.boilingPoint = bpMatch[1].trim();

  const fpMatch = fullText.match(/(?:điểm chớp cháy|flash point)[:\s]+([^\n\r,;]{2,40})/i);
  if (fpMatch) physicalProperties.flashPoint = fpMatch[1].trim();

  const mpMatch = fullText.match(/(?:điểm nóng chảy|nhiệt độ nóng chảy|melting point)[:\s]+([^\n\r,;]{2,40})/i);
  if (mpMatch) physicalProperties.meltingPoint = mpMatch[1].trim();

  const phMatch = fullText.match(/(?:độ\s*ph|giá trị\s*ph|\bph\b)[:\s]+([0-9.,]+(?:\s*-\s*[0-9.,]+)?)/i);
  if (phMatch) physicalProperties.pH = phMatch[1].trim();

  const densityMatch = fullText.match(/(?:tỷ trọng|khối lượng riêng|density|specific gravity)[:\s]+([^\n\r,;]{2,40})/i);
  if (densityMatch) physicalProperties.density = densityMatch[1].trim();

  const solMatch = fullText.match(/(?:độ tan|khả năng hòa tan|solubility)[:\s]+([^\n\r,;]{2,60})/i);
  if (solMatch) physicalProperties.solubility = solMatch[1].trim();

  // 10. Incompatibilities & Reactivity
  const incompatibilities: string[] = [];
  const incompPatterns = [
    /(?:vật liệu không tương thích|chất tương kỵ|incompatible materials|tránh tiếp xúc với)[:\s]+([^\n\r.]{5,150})/gi,
  ];
  for (const pattern of incompPatterns) {
    let match;
    while ((match = pattern.exec(fullText)) !== null) {
      if (match[1]?.trim()) incompatibilities.push(match[1].trim());
    }
  }

  // 11. PPE Recommendations
  const ppeRecommendations: string[] = [];
  if (/kính bảo hộ|kính chắn|eye protection|safety glasses|safety goggles/i.test(fullText)) {
    ppeRecommendations.push("Bảo vệ mắt: Đeo kính bảo hộ hóa chất / mặt nạ bảo hộ.");
  }
  if (/găng tay|protective gloves|nitrile|butyl rubber|cao su/i.test(fullText)) {
    ppeRecommendations.push("Bảo vệ tay: Mang găng tay chống hóa chất chuyên dụng (Nitrile / Neoprene / Butyl).");
  }
  if (/mặt nạ phòng độc|respiratory protection|khẩu trang hoạt tính|bình khí thở|respirator/i.test(fullText)) {
    ppeRecommendations.push("Bảo vệ hô hấp: Trang bị mặt nạ phòng độc / khẩu trang lọc hơi hữu cơ, axit khi nồng độ cao.");
  }
  if (/quần áo bảo hộ|protective clothing|áo choàng chống hóa chất/i.test(fullText)) {
    ppeRecommendations.push("Bảo vệ thân thể: Mặc quần áo bảo hộ lao động chống văng bắn hóa chất.");
  }

  // 12. First Aid Summary
  const firstAidSummary: ChemicalEntity["firstAidSummary"] = {};
  const eyeFaMatch = fullText.match(/(?:tiếp xúc với mắt|vào mắt|eye contact)[:\s]+([^\n\r.]{10,180})/i);
  if (eyeFaMatch) firstAidSummary.eyes = eyeFaMatch[1].trim();

  const skinFaMatch = fullText.match(/(?:tiếp xúc với da|vào da|skin contact)[:\s]+([^\n\r.]{10,180})/i);
  if (skinFaMatch) firstAidSummary.skin = skinFaMatch[1].trim();

  const inhFaMatch = fullText.match(/(?:hít phải|đường hô hấp|inhalation)[:\s]+([^\n\r.]{10,180})/i);
  if (inhFaMatch) firstAidSummary.inhalation = inhFaMatch[1].trim();

  const ingFaMatch = fullText.match(/(?:nuốt phải|đường tiêu hóa|ingestion)[:\s]+([^\n\r.]{10,180})/i);
  if (ingFaMatch) firstAidSummary.ingestion = ingFaMatch[1].trim();

  // 13. Build Executive Summary Text
  const summaryLines: string[] = [];
  summaryLines.push(`📋 PHIẾU AN TOÀN HÓA CHẤT (GHS SDS): ${productName}`);
  if (validCas.length) summaryLines.push(`• Số CAS: ${validCas.join(", ")}`);
  if (unNumbers.length) summaryLines.push(`• Mã UN: ${unNumbers.join(", ")}`);
  if (signalWord) summaryLines.push(`• Mức cảnh báo: ${signalWord}`);
  if (hazardCodes.length) {
    summaryLines.push(`• Mã nguy hại (H-codes): ${hazardCodes.map((h) => `${h.code} (${h.descriptionVi})`).slice(0, 4).join("; ")}`);
  }
  if (precautionaryCodes.length) {
    summaryLines.push(`• Mã phòng ngừa (P-codes): ${precautionaryCodes.map((p) => `${p.code} (${p.descriptionVi})`).slice(0, 4).join("; ")}`);
  }
  if (physicalProperties.flashPoint || physicalProperties.boilingPoint) {
    summaryLines.push(`• Điểm sôi: ${physicalProperties.boilingPoint || "N/A"} | Điểm chớp cháy: ${physicalProperties.flashPoint || "N/A"} | Tỷ trọng: ${physicalProperties.density || "N/A"}`);
  }
  if (incompatibilities.length) {
    summaryLines.push(`• Chất tương kỵ / Tránh tiếp xúc: ${incompatibilities.slice(0, 2).join("; ")}`);
  }
  if (ppeRecommendations.length) {
    summaryLines.push(`• Trang bị bảo hộ (PPE): ${ppeRecommendations.join(" ")}`);
  }

  return {
    isMsds,
    confidenceScore,
    productName,
    sections,
    chemical: {
      name: productName,
      casNumbers: validCas,
      unNumbers,
      signalWord,
      hazardCodes,
      precautionaryCodes,
      physicalProperties,
      incompatibilities,
      ppeRecommendations,
      firstAidSummary,
    },
    summaryText: summaryLines.join("\n"),
  };
}
