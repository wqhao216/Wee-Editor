// Dữ liệu dựng Phần 3. edl.json và cues.json là nguồn sự thật (docs/phan3).
// Chữ trên màn hình chép nguyên văn từ plan mục 7–8; scripts/phan3/check_strings.py
// đối chiếu từng chuỗi ở đây với file plan.
import edlJson from "../../docs/phan3/edl.json";
import cuesJson from "../../docs/phan3/cues.json";
import type { Rect, Variant } from "./tokens";

export type Segment =
  | { type: "mg"; out_in: number; out_out: number; dur: number }
  | { type: "play"; out_in: number; out_out: number; dur: number; src_in: number; src_out: number; speed: number }
  | { type: "freeze"; out_in: number; out_out: number; dur: number; src_at: number };

export type Scene = { id: string; name: string; start: number; end: number; dur: number; segments: Segment[] };

export type CalloutCue = {
  scene: string; t_in: number; t_out: number; variant: Variant; dashed: boolean;
  box_src: [number, number, number, number]; label: string; num: number | null; measured_on_src: number;
};
export type CameraCue = { t_in: number; t_out: number; roi_src: [number, number, number, number] };
export type VoCue = { t: number; text: string; syllables: number; est_end: number };

export const EDL = edlJson as unknown as Scene[];
export const CALLOUTS = (cuesJson.callouts as unknown as CalloutCue[]).slice().sort((a, b) => a.t_in - b.t_in);
export const CAMERA = cuesJson.camera as unknown as CameraCue[];
export const VO = cuesJson.vo as VoCue[];
export const FORBIDDEN = cuesJson.forbidden_src as { src_from: number; src_to: number; why: string }[];
export const TOTAL_SECONDS = EDL[EDL.length - 1].end;

export const boxToRect = (b: [number, number, number, number]): Rect => ({ x1: b[0], y1: b[1], x2: b[2], y2: b[3] });

// ---- Tiêu đề từng bước (plan mục 7). hl = cụm được tô (đúng một cụm mỗi tiêu đề).
export type HeadlineText = { q: string; a: string; hl: string; sub: string };
export const HEADLINES: Record<string, HeadlineText> = {
  B1: { q: "Bắt đầu từ đâu?", a: "Thành lập mới.", hl: "Thành lập mới.", sub: "Đăng nhập VNeID, rồi chọn đúng dòng đầu tiên." },
  B2: { q: "Ô tỉnh chọn sẵn?", a: "Đổi ngay.", hl: "Đổi", sub: "Không còn quận, huyện. Chọn thẳng phường, xã mới." },
  B3: { q: "Ngành chính?", a: "Chọn nút tròn.", hl: "nút tròn.", sub: "Ô vuông chỉ để chọn dòng. Không nhớ mã thì tra theo nhóm ngành." },
  B4: { q: "Đặt tên hộ?", a: "Chỉ gõ tên riêng.", hl: "tên riêng.", sub: "“HỘ KINH DOANH” đã có sẵn. Gõ xong, bấm Kiểm tra trùng tên." },
  B5: { q: "Thông tin chủ hộ?", a: "Đối chiếu rồi mới Lưu.", hl: "Đối chiếu", sub: "Thấy dòng “Khớp với CSDLQG về dân cư” là được." },
  B6: { q: "Phần thuế?", a: "Chỉ còn kê khai.", hl: "kê khai.", sub: "Nhận thông báo ở chỗ kinh doanh → chọn Giống địa chỉ trụ sở chính." },
  B7: { q: "Tự nộp cho mình?", a: "Chọn người ký.", hl: "người ký.", sub: "“Người được ủy quyền” chỉ dành cho người nộp hộ." },
  B8: { q: "Đủ 8 dấu tích?", a: "Chưa chắc xong.", hl: "xong.", sub: "Bấm Chuẩn bị, sửa hết dòng báo rồi mới tới bước nộp." },
};

// ---- Thẻ chương (MG giữa màn)
export type ChapterLine = { text: string; hl?: string };
export const CHAPTERS = {
  S00: { lines: [{ text: "Đăng ký hộ kinh doanh" }, { text: "trong 8 bước.", hl: "8 bước." }], sub: "Quay trên hệ thống thật" },
  B8: { lines: [{ text: "Đủ 8 dấu tích…" }] },
  R: { lines: [{ text: "Dấu tích = đã lưu.", hl: "đã lưu." }, { text: "Chuẩn bị = đã kiểm.", hl: "đã kiểm." }] },
} satisfies Record<string, { lines: ChapterLine[]; sub?: string }>;

// ---- Chip (plan mục 8). where: "underCard" | "leftBottom" | "flowNode3"
export type ChipCue = { t_in: number; t_out: number; text: string; variant: "default" | "muted" | "accent"; where: "underCard" | "leftBottom" | "flowNode3" };
export const CHIPS: ChipCue[] = [
  { t_in: 37.3, t_out: 39.6, text: "Nhớ dấu tích này nhé →", variant: "muted", where: "underCard" },
  { t_in: 40.0, t_out: 66.0, text: "Mã ngành trong video chỉ để minh họa", variant: "muted", where: "underCard" },
  { t_in: 100.5, t_out: 103.8, text: "Vốn: gõ số, hệ thống tự ghi bằng chữ", variant: "default", where: "leftBottom" },
  { t_in: 119.0, t_out: 121.9, text: "Bỏ thuế khoán từ 01/01/2026 · NQ 198/2025/QH15", variant: "default", where: "leftBottom" },
  { t_in: 165.2, t_out: 167.0, text: "Hợp lệ → có kết quả trong 03 ngày làm việc", variant: "accent", where: "flowNode3" },
];

// Thẻ chữ lớn ở B8 (plan 8: 2:30.4–2:33.2). Phần nằm trong {} tô màu accent.
export const BIG_CARD = { t_in: 150.4, t_out: 153.2, text: "{8} dấu tích · vẫn {1} lỗi" };

// FlowDiagram cuối B8 (plan 8: 2:44.0–2:47.0)
export const FLOW = {
  t_in: 164.0, t_out: 167.0, drawDur: 1.2,
  nodes: ["Người nộp", "Hệ thống đăng ký hộ kinh doanh", "Cơ quan đăng ký kinh doanh cấp xã", "Cơ quan thuế"],
};

// Nhãn speedTag do plan ghi rõ (mục 7–8), khóa theo src_in của đoạn play.
// Đoạn tua > 1.2× không có trong bảng này thì làm tròn 1 chữ số thập phân.
export const SPEED_LABELS: Record<string, string> = {
  "18": "×2.4", "28.5": "×5", "44.6": "×7", "108.4": "×1.4", "161.6": "×3", "204.2": "×2.4",
  "216": "×3.5", "263": "×4", "283": "×4", "291.6": "×4", "299.8": "×3.7", "325.8": "×2",
};

// Nhóm card: các cảnh dùng chung một card (B1→B2 không cardSwap, plan 8).
export const CARD_GROUPS: { id: string; scenes: string[]; enter: number; exit: number; exitKind: "swap" | "cut" | "shrink" }[] = [
  { id: "G1", scenes: ["B1", "B2"], enter: 6.2, exit: 40.0, exitKind: "swap" },
  { id: "G2", scenes: ["B3"], enter: 40.0, exit: 66.0, exitKind: "swap" },
  { id: "G3", scenes: ["B4"], enter: 66.0, exit: 78.0, exitKind: "swap" },
  { id: "G4", scenes: ["B5"], enter: 78.0, exit: 100.0, exitKind: "swap" },
  { id: "G5", scenes: ["B6"], enter: 100.0, exit: 122.0, exitKind: "swap" },
  { id: "G6", scenes: ["B7"], enter: 122.0, exit: 140.5, exitKind: "cut" },
  { id: "G7", scenes: ["B8"], enter: 143.0, exit: 164.0, exitKind: "shrink" },
];

// Chuyển chương (plan 8): S00→B1 0:04.4–0:05.0, B7→B8 2:20.0–2:21.0. Đổi layout ở giữa (lúc dải che kín).
export const WIPES = [
  { t_in: 4.4, t_out: 5.0 },
  { t_in: 140.0, t_out: 141.0 },
];

export const STEP_OF: Record<string, number> = { B1: 1, B2: 2, B3: 3, B4: 4, B5: 5, B6: 6, B7: 7, B8: 8 };

/** Mọi chuỗi chữ hiện trên màn (cho QA chính tả và độ phủ glyph). */
export const allOnScreenStrings = (): string[] => {
  const out: string[] = [];
  for (const h of Object.values(HEADLINES)) out.push(h.q, h.a, h.sub);
  for (const ch of Object.values(CHAPTERS)) {
    for (const l of ch.lines) out.push(l.text);
    if ("sub" in ch && ch.sub) out.push(ch.sub);
  }
  for (const c of CALLOUTS) out.push(c.label);
  for (const c of CHIPS) out.push(c.text);
  for (const v of VO) out.push(v.text);
  out.push(BIG_CARD.text.replace(/[{}]/g, ""), ...FLOW.nodes, ...Object.values(SPEED_LABELS));
  for (let i = 1; i <= 8; i++) out.push(`BƯỚC ${i}/8`);
  return out;
};
