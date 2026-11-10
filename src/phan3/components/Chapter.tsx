// <ChapterCard lines highlight bg/> (chữ lớn giữa màn: S00, đầu B8, R) và <ChapterWipe/>.
import React from "react";
import type { ChapterLine } from "../data";
import { C, DUR, EASE, FONT, H, TYPE, W } from "../tokens";
import { AnimatedWords, prog, springAt, textOut, wordCount } from "./anim";

type Props = {
  lines: ChapterLine[];
  t: number;
  tIn: number;
  size?: number;
  lineDelays?: number[]; // trễ riêng từng dòng (R: dòng 2 trễ 0.5s)
  sub?: string;
  subIn?: number;
  dotsIn?: number; // S00: 8 chấm hiện lần lượt dưới sub
  outAt?: number | null;
  hlColor?: string;
};

export const ChapterCard: React.FC<Props> = ({ lines, t, tIn, size = TYPE.chapter.size, lineDelays, sub, subIn, dotsIn, outAt = null, hlColor = C.accent }) => {
  const out = textOut(t, outAt);
  let offset = 0;
  return (
    <div
      data-qa="chapter"
      style={{
        position: "absolute", left: 0, top: 0, width: W, height: H, display: "flex", flexDirection: "column",
        alignItems: "center", justifyContent: "center", opacity: out.opacity, filter: out.blur ? `blur(${out.blur}px)` : undefined,
      }}
    >
      {lines.map((l, i) => {
        const start = tIn + (lineDelays?.[i] ?? 0);
        const off = lineDelays ? 0 : offset;
        offset += wordCount(l.text);
        return (
          <div
            key={i}
            data-qa="chapter-line"
            data-qa-text={l.text}
            style={{ fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: TYPE.chapter.lineHeight, letterSpacing: -1, color: C.ink, whiteSpace: "nowrap", textAlign: "center" }}
          >
            <AnimatedWords text={l.text} start={start} t={t} hl={l.hl} indexOffset={off} hlColor={hlColor} />
          </div>
        );
      })}
      {sub && subIn !== undefined ? (
        <div data-qa="chapter-sub" data-qa-text={sub} style={{ marginTop: 28, fontFamily: FONT, fontWeight: TYPE.sub.weight, fontSize: TYPE.sub.size, color: C.muted }}>
          <AnimatedWords text={sub} start={subIn} t={t} />
        </div>
      ) : null}
      {dotsIn !== undefined ? (
        <div style={{ marginTop: 26, display: "flex", gap: 10 }}>
          {Array.from({ length: 8 }, (_, i) => {
            const s = springAt(t, dotsIn + i * DUR.badgeStagger, { damping: 12, stiffness: 220 });
            return <div key={i} style={{ width: 10, height: 10, borderRadius: "50%", border: `2px solid ${C.ink}`, boxSizing: "border-box", scale: String(s), opacity: Math.min(1, s * 2) }} />;
          })}
        </div>
      ) : null}
    </div>
  );
};

/** chapterWipe: dải accent chéo −28°, rộng 140% khung, quét trái dưới → phải trên.
 * Nửa đầu dải đi vào và che kín ở giữa khoảng; nửa sau đi ra. */
export const ChapterWipe: React.FC<{ t: number; t_in: number; t_out: number }> = ({ t, t_in, t_out }) => {
  if (t < t_in || t > t_out) return null;
  const mid = (t_in + t_out) / 2;
  const thick = 1.4 * W;
  const ang = (-28 * Math.PI) / 180;
  const dx = Math.cos(ang), dy = Math.sin(ang); // hướng quét: sang phải, lên trên
  const reach = Math.abs((W / 2) * dx) + Math.abs((H / 2) * dy) + thick / 2;
  const off = t < mid
    ? -reach * (1 - prog(t, t_in, mid - t_in, EASE.inOutCubic))
    : reach * prog(t, mid, t_out - mid, EASE.inOutCubic);
  return (
    <div style={{ position: "absolute", inset: 0, overflow: "hidden", pointerEvents: "none" }}>
      <div
        style={{
          position: "absolute", left: W / 2 - thick / 2 + off * dx, top: H / 2 - 2500 + off * dy, width: thick, height: 5000,
          background: C.accent, rotate: "-28deg",
        }}
      />
    </div>
  );
};

/** Phủ nền accent (R): wipe 300ms từ trái sang, rồi fade về bg 400ms. */
export const AccentCover: React.FC<{ t: number; t_in: number; fadeAt: number }> = ({ t, t_in, fadeAt }) => {
  if (t < t_in) return null;
  const p = prog(t, t_in, 0.3, EASE.outCubic);
  const fade = prog(t, fadeAt, 0.4);
  return <div style={{ position: "absolute", inset: 0, background: C.accent, clipPath: `inset(0 ${100 - 100 * p}% 0 0)`, opacity: 1 - fade }} />;
};
