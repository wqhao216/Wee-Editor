// Ngôn ngữ thiết kế Phần 3 (plan mục 2). Một nguồn duy nhất cho màu, chữ, bố cục, easing.
import { Easing } from "remotion";

export const FPS = 30;
export const W = 1920;
export const H = 1080;

// 2.1 Bảng màu
export const C = {
  bg: "#F5F4EF",
  ink: "#111111",
  muted: "#5C5C5C",
  accent: "#FFE14D",
  blob1: "#FFE14D", // độ mờ 0.50
  blob2: "#BDEFD6", // độ mờ 0.45
  danger: "#E5484D",
  ok: "#16A34A",
  warn: "#F59E0B",
  panel: "#17171A",
  pixelTint: "#F3F6FA",
} as const;

export const CARD_SHADOW = "0 30px 80px rgba(0,0,0,.18)";

// 2.2 Chữ
export const FONT_FAMILY = "Be Vietnam Pro";
export const FONT = `"${FONT_FAMILY}"`;
export const TYPE = {
  h1q: { size: 64, weight: 800, lineHeight: 1.08, letterSpacing: -1 },
  h1a: { size: 76, weight: 800, lineHeight: 1.08, letterSpacing: -1 },
  h1min: 56,
  chapter: { size: 104, weight: 800, lineHeight: 1.08, letterSpacing: -1 },
  sub: { size: 28, weight: 500, lineHeight: 1.35, maxWidth: 600, maxLines: 2 },
  pill: { size: 22, weight: 700 },
  label: { size: 22, weight: 800 },
  chip: { size: 24, weight: 600 },
  subtitle: { size: 32, weight: 600, lineHeight: 1.3 },
} as const;

// 2.3 Bố cục
export type Rect = { x1: number; y1: number; x2: number; y2: number };
export const TEXT_BLOCK = { x1: 96, x2: 720, cy: 520, subGap: 28 };
export const PILL_POS = { x: 96, y: 80 };
export const CARD: Rect = { x1: 760, y1: 165, x2: 1856, y2: 916 };
export const CARD_RADIUS = 28;
export const FULL: Rect = { x1: 0, y1: 0, x2: W, y2: H };
// Vùng gốc hiển thị trong card (tỉ lệ 1.459, hệ số 0.8839). Cũng là giới hạn cho camera:
// trang x 370–1610, bỏ banner y < 150 và thanh trạng thái y > 1000.
export const SRC_VIEW: Rect = { x1: 370, y1: 150, x2: 1610, y2: 1000 };
export const SRC_SIZE = { w: 1972, h: 1080 };
export const MAX_ZOOM = 2.6;
export const SUBTITLE = { cy: 1000, maxWidth: 1400, maxChars: 42 };

// 2.5 Easing
export const EASE = {
  outCubic: Easing.out(Easing.cubic),
  inCubic: Easing.in(Easing.cubic),
  outQuart: Easing.out(Easing.poly(4)),
  camera: Easing.bezier(0.65, 0, 0.35, 1),
  inOutCubic: Easing.inOut(Easing.cubic),
};

// Thời lượng hiệu ứng (giây), đúng bảng 2.5
export const DUR = {
  textInWord: 0.42,
  textInStagger: 0.07,
  textOut: 0.25,
  highlight: 0.38,
  highlightDelay: 0.15,
  pillIn: 0.3,
  cardIn: 0.6,
  cardSwapOut: 0.35,
  cardSwapOverlap: 0.15,
  jumpCut: 0.12, // nhóm chốt: tối đa 120ms (plan 2.5 ghi 200ms), không SFX riêng
  swapGap: 0.12, // nhóm chốt: chừa 100–150ms giữa punchOut (hoặc khung khoanh tắt) và cardSwap
  punchIn: 0.65,
  punchOut: 0.55,
  punchOutTextIn: 0.2,
  calloutDraw: 0.35,
  calloutLabel: 0.2,
  calloutOut: 0.2,
  pulse: 0.3,
  clickRipple: 0.45,
  freezeFade: 0.2,
  freezeChip: 0.6,
  badge: 0.22,
  badgeStagger: 0.08,
  chipPop: 0.25,
};

export const SPRING = {
  pill: { damping: 16, stiffness: 180 },
  card: { damping: 18, stiffness: 120 },
};

export const VARIANT_COLOR = { ok: C.ok, danger: C.danger, warn: C.warn } as const;
export type Variant = keyof typeof VARIANT_COLOR;
