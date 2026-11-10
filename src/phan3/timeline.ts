// Toán thuần của timeline Phần 3: không React, không DOM, kiểm thử được bằng Node.
// t = giây trên thành phẩm ("ra"); src = giây trong hai_clean.mp4 ("gốc").
import {
  CALLOUTS, CAMERA, CARD_GROUPS, EDL, FORBIDDEN, SPEED_LABELS, VO,
  type CameraCue, type Scene, type Segment,
} from "./data";
import { CARD, DUR, FPS, FULL, MAX_ZOOM, SRC_VIEW, SUBTITLE, W, H, type Rect } from "./tokens";

export const clamp01 = (x: number) => Math.max(0, Math.min(1, x));
export const lerp = (a: number, b: number, p: number) => a + (b - a) * p;
export const rectW = (r: Rect) => r.x2 - r.x1;
export const rectH = (r: Rect) => r.y2 - r.y1;
const EPS = 1e-6;

// ------------------------------------------------------------------ EDL

export const sceneAt = (t: number): Scene =>
  EDL.find((s) => t >= s.start - EPS && t < s.end - EPS) ?? EDL[EDL.length - 1];

export const segmentAt = (t: number): { scene: Scene; seg: Segment; index: number } => {
  const scene = sceneAt(t);
  const index = scene.segments.findIndex((g) => t >= g.out_in - EPS && t < g.out_out - EPS);
  const i = index < 0 ? scene.segments.length - 1 : index;
  return { scene, seg: scene.segments[i], index: i };
};

/** Giây gốc của một đoạn video tại t (tốc độ tính đúng từ src_in/src_out để đoạn kết đúng src_out). */
export const segSrcTime = (seg: Segment, t: number): number | null => {
  if (seg.type === "freeze") return seg.src_at;
  if (seg.type === "play") {
    const p = (t - seg.out_in) / (seg.out_out - seg.out_in);
    return seg.src_in + clamp01(p) * (seg.src_out - seg.src_in);
  }
  return null;
};

/** Khung gốc (chỉ số khung trong hai_clean.mp4). Khung play không bao giờ vượt quá src_out. */
export const segSrcFrame = (seg: Segment, t: number): number | null => {
  const s = segSrcTime(seg, t);
  if (s === null) return null;
  if (seg.type !== "play") return Math.round(s * FPS);
  const f = Math.floor(s * FPS + EPS);
  return Math.min(f, Math.ceil(seg.src_out * FPS - EPS) - 1);
};

export const isForbiddenSrc = (srcFrame: number) =>
  FORBIDDEN.some((f) => srcFrame / FPS >= f.src_from - EPS && srcFrame / FPS < f.src_to - EPS);

const videoSegs = (scenes: string[]) =>
  EDL.filter((s) => scenes.includes(s.id)).flatMap((s) => s.segments).filter((g) => g.type !== "mg");

const firstSrcFrame = (segs: Segment[]) => segSrcFrame(segs[0], segs[0].out_in)!;
const lastSrcFrame = (segs: Segment[]) => {
  const g = segs[segs.length - 1];
  return segSrcFrame(g, g.out_out - 1 / FPS)!;
};

// ------------------------------------------------------------------ Card

export type CardInstance = {
  group: string;
  srcFrame: number;
  main: boolean; // card chính (nhận camera, khung khoanh)
  x: number; opacity: number; scale: number; blur: number;
  enterT: number; // thời điểm bắt đầu cardIn (cho spring)
};

const lastPunchOutBefore = (T: number) =>
  Math.max(-Infinity, ...CAMERA.filter((c) => c.t_out <= T + EPS && c.t_out > T - 1).map((c) => c.t_out));
const lastCalloutOutBefore = (T: number) =>
  Math.max(-Infinity, ...CALLOUTS.filter((c) => c.t_out <= T + EPS && c.t_out > T - 1).map((c) => c.t_out));

/** Mốc bắt đầu cardSwap trước ranh giới T: không sớm hơn T − 0.5, và chừa DUR.swapGap sau
 * punchOut / khung khoanh tắt gần nhất (nhóm chốt 10/11). */
export const swapStart = (T: number) =>
  Math.max(T - 0.5, lastPunchOutBefore(T) + DUR.swapGap, lastCalloutOutBefore(T) + DUR.swapGap);

export const cardInstances = (t: number): CardInstance[] => {
  const out: CardInstance[] = [];
  CARD_GROUPS.forEach((g, gi) => {
    const segs = videoSegs(g.scenes);
    const prev = CARD_GROUPS[gi - 1];
    // Vào: card đầu nhóm vào bằng cardIn; nếu nhóm trước đổi bằng swap thì vào sớm, chồng 150ms.
    const swapIn = prev && prev.exitKind === "swap" && Math.abs(prev.exit - g.enter) < EPS;
    const enterT = swapIn ? swapStart(g.enter) + DUR.cardSwapOut - DUR.cardSwapOverlap : g.enter;
    // Ra
    const next = CARD_GROUPS[gi + 1];
    let exitT = g.exit;
    if (g.exitKind === "swap" && next) exitT = swapStart(g.exit);
    const exitEnd = g.exitKind === "swap" ? exitT + DUR.cardSwapOut : g.exitKind === "shrink" ? exitT + 0.5 : exitT;
    if (t < enterT - EPS || t >= exitEnd - EPS) return;

    // Khung gốc đang hiện
    let srcFrame: number;
    const { scene, seg } = segmentAt(t);
    if (g.scenes.includes(scene.id) && seg.type !== "mg") srcFrame = segSrcFrame(seg, t)!;
    else if (t < segs[0].out_in) srcFrame = firstSrcFrame(segs);
    else srcFrame = lastSrcFrame(segs);
    // Trong cùng nhóm nhưng ở đoạn mg (vd B1 5.0–6.2 hay B7 cuối): giữ khung gần nhất
    if (g.scenes.includes(scene.id) && seg.type === "mg") {
      srcFrame = t < segs[0].out_in ? firstSrcFrame(segs) : lastSrcFrame(segs);
    }

    let x = 0, opacity = 1, scale = 1, blur = 0;
    if (t >= exitT && g.exitKind === "swap") {
      const p = clamp01((t - exitT) / DUR.cardSwapOut);
      x = -60 * p; opacity = 1 - p; blur = 6 * p;
    } else if (t >= exitT && g.exitKind === "shrink") {
      const p = clamp01((t - exitT) / 0.5);
      scale = 1 - 0.4 * p; opacity = 1 - p;
    }
    out.push({ group: g.id, srcFrame, main: t >= g.enter - EPS && t < exitT, x, opacity, scale, blur, enterT });
  });
  return out;
};

// ------------------------------------------------------------------ Camera

/** ROI → vùng gốc 16:9, phóng tối đa 2.6× (ROI nhỏ thì nới), nằm trong SRC_VIEW. */
export const roiToSrcRect = (roi: [number, number, number, number]): Rect => {
  const aspect = W / H;
  let w = roi[2] - roi[0];
  let h = roi[3] - roi[1];
  const cx = (roi[0] + roi[2]) / 2;
  const cy = (roi[1] + roi[3]) / 2;
  if (w / h > aspect) h = w / aspect; else w = h * aspect;
  const minW = W / MAX_ZOOM;
  if (w < minW) { w = minW; h = w / aspect; }
  const maxW = rectW(SRC_VIEW), maxH = rectH(SRC_VIEW);
  if (w > maxW) { w = maxW; h = w / aspect; }
  if (h > maxH) { h = maxH; w = h * aspect; }
  let x1 = cx - w / 2, y1 = cy - h / 2;
  x1 = Math.min(Math.max(x1, SRC_VIEW.x1), SRC_VIEW.x2 - w);
  y1 = Math.min(Math.max(y1, SRC_VIEW.y1), SRC_VIEW.y2 - h);
  return { x1, y1, x2: x1 + w, y2: y1 + h };
};

export type View = { container: Rect; src: Rect; scale: number; p: number; cue: CameraCue | null };

/** Tiến độ punch (0 = card thường, 1 = toàn khung) có easing. */
export const punchProgress = (t: number, ease: (x: number) => number): { p: number; cue: CameraCue | null } => {
  for (const c of CAMERA) {
    if (t < c.t_in - EPS || t > c.t_out + EPS) continue;
    if (t < c.t_in + DUR.punchIn) return { p: ease(clamp01((t - c.t_in) / DUR.punchIn)), cue: c };
    if (t > c.t_out - DUR.punchOut) return { p: ease(clamp01((c.t_out - t) / DUR.punchOut)), cue: c };
    return { p: 1, cue: c };
  }
  return { p: 0, cue: null };
};

export const viewAt = (t: number, ease: (x: number) => number): View => {
  const { p, cue } = punchProgress(t, ease);
  const target = cue ? roiToSrcRect(cue.roi_src) : SRC_VIEW;
  const container: Rect = {
    x1: lerp(CARD.x1, FULL.x1, p), y1: lerp(CARD.y1, FULL.y1, p),
    x2: lerp(CARD.x2, FULL.x2, p), y2: lerp(CARD.y2, FULL.y2, p),
  };
  // Nội suy tâm và chiều rộng vùng gốc; chiều cao suy ra theo tỉ lệ container (không méo hình).
  const cx = lerp((SRC_VIEW.x1 + SRC_VIEW.x2) / 2, (target.x1 + target.x2) / 2, p);
  const cy = lerp((SRC_VIEW.y1 + SRC_VIEW.y2) / 2, (target.y1 + target.y2) / 2, p);
  const sw = lerp(rectW(SRC_VIEW), rectW(target), p);
  const scale = rectW(container) / sw;
  const sh = rectH(container) / scale;
  const src = { x1: cx - sw / 2, y1: cy - sh / 2, x2: cx + sw / 2, y2: cy + sh / 2 };
  return { container, src, scale, p, cue };
};

export const srcToScreen = (v: View, x: number, y: number) => ({
  x: v.container.x1 + (x - v.src.x1) * v.scale,
  y: v.container.y1 + (y - v.src.y1) * v.scale,
});

export const srcRectToScreen = (v: View, r: Rect): Rect => {
  const a = srcToScreen(v, r.x1, r.y1), b = srcToScreen(v, r.x2, r.y2);
  return { x1: a.x, y1: a.y, x2: b.x, y2: b.y };
};

// ------------------------------------------------------------------ Speed / jump cut / freeze

export const speedLabel = (seg: Segment): string | null => {
  if (seg.type !== "play") return null;
  const speed = (seg.src_out - seg.src_in) / (seg.out_out - seg.out_in);
  if (speed <= 1.2 + EPS) return null;
  return SPEED_LABELS[String(seg.src_in)] ?? `×${String(Math.round(speed * 10) / 10)}`;
};

/** Ranh giới jumpCut: hai đoạn video liền nhau trong cùng cảnh nhưng giây gốc không liền. */
export const jumpCuts = (): number[] => {
  const out: number[] = [];
  for (const s of EDL) {
    for (let i = 1; i < s.segments.length; i++) {
      const a = s.segments[i - 1], b = s.segments[i];
      if (a.type === "mg" || b.type === "mg") continue;
      const aEnd = a.type === "play" ? a.src_out : a.src_at;
      const bStart = b.type === "play" ? b.src_in : b.src_at;
      if (Math.abs(bStart - aEnd) > 0.35) out.push(b.out_in);
    }
  }
  return out;
};

// ------------------------------------------------------------------ Phụ đề

export type SubtitlePage = { t_in: number; t_out: number; lines: string[] };

const splitCandidates = (text: string) => {
  // Điểm tách ưu tiên: ngay sau dấu câu (plan 2.7 "tách ở dấu phẩy"); dự phòng: khoảng trắng.
  const punct: number[] = [], spaces: number[] = [];
  for (let i = 0; i < text.length; i++) {
    if (text[i] !== " ") continue;
    if (/[,.:;?!]/.test(text[i - 1] ?? "")) punct.push(i); else spaces.push(i);
  }
  return { punct, spaces };
};

const bestSplit = (text: string, idx: number[], max: number) => {
  let best: [string, string] | null = null, bestScore = Infinity;
  for (const i of idx) {
    const a = text.slice(0, i).trim(), b = text.slice(i + 1).trim();
    if (a.length > max || b.length > max) continue;
    const score = Math.abs(a.length - b.length);
    if (score < bestScore) { bestScore = score; best = [a, b]; }
  }
  return best;
};

/** Chia một câu thành các trang ≤ 2 dòng, mỗi dòng ≤ 42 ký tự. Không đổi chữ. */
export const toPages = (text: string, max = SUBTITLE.maxChars): string[][] => {
  if (text.length <= max) return [[text]];
  const { punct, spaces } = splitCandidates(text);
  const two = bestSplit(text, punct, max) ?? bestSplit(text, spaces, max);
  if (two) return [two];
  // Quá dài cho 2 dòng: tách trang ở cuối câu gần giữa nhất (rồi tới dấu phẩy, rồi khoảng trắng).
  const sentence = punct.filter((i) => /[.:;?!]/.test(text[i - 1]));
  const pool = sentence.length ? sentence : punct.length ? punct : spaces;
  const cut = pool.reduce((a, b) => (Math.abs(b - text.length / 2) < Math.abs(a - text.length / 2) ? b : a));
  return [...toPages(text.slice(0, cut).trim(), max), ...toPages(text.slice(cut + 1).trim(), max)];
};

export const subtitlePages = (): SubtitlePage[] => {
  const out: SubtitlePage[] = [];
  for (const v of VO) {
    const pages = toPages(v.text);
    const total = pages.reduce((n, p) => n + p.join(" ").length, 0);
    let t = v.t;
    for (const p of pages) {
      const d = ((v.est_end - v.t) * p.join(" ").length) / total;
      out.push({ t_in: t, t_out: t + d, lines: p });
      t += d;
    }
  }
  return out;
};

// ------------------------------------------------------------------ Gốc → ra

/** Giây ra mà khung gốc `src` được phát (đoạn play chứa nó). null nếu khung đó không được phát. */
export const srcToOut = (src: number): { t: number; scene: string } | null => {
  for (const s of EDL) {
    for (const g of s.segments) {
      if (g.type !== "play" || src < g.src_in - EPS || src >= g.src_out - EPS) continue;
      return { t: g.out_in + ((src - g.src_in) / (g.src_out - g.src_in)) * (g.out_out - g.out_in), scene: s.id };
    }
  }
  return null;
};
