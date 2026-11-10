// Helper hoạt ảnh dùng chung: thời gian theo giây, textIn từng chữ, glyph thay thế.
import React from "react";
import { spring, useCurrentFrame, useVideoConfig } from "remotion";
import { C, DUR, EASE } from "../tokens";
import { clamp01 } from "../timeline";

/** Giây hiện tại trên thành phẩm. */
export const useT = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return frame / fps;
};

export const prog = (t: number, start: number, dur: number, ease: (x: number) => number = (x) => x) =>
  ease(clamp01((t - start) / dur));

export const springAt = (t: number, start: number, config: { damping: number; stiffness: number }, fps = 30) =>
  t < start ? 0 : spring({ frame: (t - start) * fps, fps, config: { ...config, mass: 1 } });

/** Mờ dần cả khối (textOut): opacity 1→0, blur 0→10px, 250ms easeInCubic. */
export const textOut = (t: number, outAt: number | null): { opacity: number; blur: number } => {
  if (outAt === null || t < outAt) return { opacity: 1, blur: 0 };
  const p = prog(t, outAt, DUR.textOut, EASE.inCubic);
  return { opacity: 1 - p, blur: 10 * p };
};

// ---- Glyph thay thế: Be Vietnam Pro không có "→" (U+2192) và "✓" (U+2713).
// Vẽ bằng SVG theo màu chữ hiện tại; chuỗi gốc giữ nguyên trong dữ liệu.
const ArrowGlyph: React.FC = () => (
  <svg data-glyph="→" viewBox="0 0 24 24" style={{ width: "0.95em", height: "0.95em", verticalAlign: "-0.12em", margin: "0 0.02em" }}>
    <path d="M3 12h16M13 5.5l6.5 6.5-6.5 6.5" fill="none" stroke="currentColor" strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const CheckGlyph: React.FC = () => (
  <svg data-glyph="✓" viewBox="0 0 24 24" style={{ width: "0.9em", height: "0.9em", verticalAlign: "-0.1em" }}>
    <path d="M4 12.5l5 5L20 6.5" fill="none" stroke="currentColor" strokeWidth={3.2} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const RichText: React.FC<{ text: string }> = ({ text }) => {
  const parts = text.split(/([→✓])/);
  return (
    <>
      {parts.map((p, i) => (p === "→" ? <ArrowGlyph key={i} /> : p === "✓" ? <CheckGlyph key={i} /> : <React.Fragment key={i}>{p}</React.Fragment>))}
    </>
  );
};

/** Chuỗi dùng để đo bề rộng (glyph SVG ~ bề rộng chữ "M"). */
export const measurable = (text: string) => text.replace(/[→✓]/g, "M");

// ---- textIn từng chữ, có thể có một cụm highlight.
type WordsProps = {
  text: string;
  start: number; // giây bắt đầu textIn
  t: number;
  hl?: string;
  indexOffset?: number; // chỉ số chữ đầu (để nối nhịp giữa các dòng)
  hlColor?: string;
  hlStart?: number; // giây bắt đầu vạch highlight
};

export const wordCount = (text: string) => text.split(" ").length;

export const AnimatedWords: React.FC<WordsProps> = ({ text, start, t, hl, indexOffset = 0, hlColor = C.accent, hlStart }) => {
  const words = text.split(" ");
  let hlFrom = -1, hlTo = -1;
  if (hl) {
    const at = text.indexOf(hl);
    if (at >= 0) {
      let pos = 0;
      words.forEach((w, i) => {
        const a = pos, b = pos + w.length;
        if (b > at && a < at + hl.length) { if (hlFrom < 0) hlFrom = i; hlTo = i; }
        pos = b + 1;
      });
    }
  }
  const wordEl = (w: string, i: number) => {
    const p = prog(t, start + (indexOffset + i) * DUR.textInStagger, DUR.textInWord, EASE.outCubic);
    return (
      <span key={i} style={{ display: "inline-block", position: "relative", zIndex: 1, opacity: p, filter: `blur(${12 * (1 - p)}px)`, translate: `0 ${18 * (1 - p)}px` }}>
        <RichText text={w} />
      </span>
    );
  };
  const out: React.ReactNode[] = [];
  for (let i = 0; i < words.length; i++) {
    if (i === hlFrom) {
      const s = hlStart ?? start + (indexOffset + hlTo) * DUR.textInStagger + DUR.textInWord + DUR.highlightDelay;
      const bar = prog(t, s, DUR.highlight, EASE.outQuart);
      const group: React.ReactNode[] = [];
      for (let j = hlFrom; j <= hlTo; j++) {
        group.push(wordEl(words[j], j));
        if (j < hlTo) group.push(" ");
      }
      out.push(
        <span key={`hl${i}`} data-qa="highlight" style={{ position: "relative", display: "inline-block", isolation: "isolate" }}>
          <span style={{ position: "absolute", left: "-0.04em", right: "-0.04em", top: "55%", height: "38%", background: hlColor, transformOrigin: "left center", scale: `${bar} 1`, zIndex: 0 }} />
          {group}
        </span>,
      );
      i = hlTo;
    } else out.push(wordEl(words[i], i));
    if (i < words.length - 1) out.push(" ");
  }
  return <>{out}</>;
};
