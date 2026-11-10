// <Headline q a highlight sub/>: khối chữ trái x 96–720, tâm y ≈ 520 (plan 2.2, 2.3).
// Dòng hỏi 64px, dòng trả lời 76px; dòng nào tràn khối thì co dần, tối thiểu 56px;
// ở 56px vẫn tràn thì cho xuống dòng (QA sẽ báo).
import React from "react";
import { measureText } from "@remotion/layout-utils";
import { C, FONT, FONT_FAMILY, TEXT_BLOCK, TYPE } from "../tokens";
import { AnimatedWords, measurable, textOut, wordCount } from "./anim";

const BLOCK_W = TEXT_BLOCK.x2 - TEXT_BLOCK.x1;

export const fitLine = (text: string, nominal: number, min: number, maxW: number): { size: number; wrap: boolean } => {
  const m = (size: number) =>
    measureText({ text: measurable(text), fontFamily: FONT_FAMILY, fontSize: size, fontWeight: "800", letterSpacing: "-1px" }).width;
  if (m(nominal) <= maxW) return { size: nominal, wrap: false };
  for (let s = nominal - 1; s >= min; s--) if (m(s) <= maxW) return { size: s, wrap: false };
  return { size: min, wrap: true };
};

type Props = {
  q: string; a: string; hl: string; sub: string;
  t: number;
  tIn: number; // textIn dòng hỏi + trả lời
  subIn: number; // textIn sub
  aIn?: number; // textIn riêng cho dòng trả lời (nếu khác tIn)
  hlRedoAt?: number; // cụm highlight của dòng trả lời chạy lại textIn ở mốc này
  outAt: number | null; // textOut cả khối
  visibility: number; // 0..1 do camera (punchIn ẩn khối chữ)
  visBlur: number;
};

export const Headline: React.FC<Props> = ({ q, a, hl, sub, t, tIn, subIn, aIn, hlRedoAt, outAt, visibility, visBlur }) => {
  const fq = fitLine(q, TYPE.h1q.size, TYPE.h1min, BLOCK_W);
  const fa = fitLine(a, TYPE.h1a.size, TYPE.h1min, BLOCK_W);
  const line = (size: number, wrap: boolean): React.CSSProperties => ({
    fontFamily: FONT, fontWeight: 800, fontSize: size, lineHeight: TYPE.h1a.lineHeight,
    letterSpacing: -1, color: C.ink, whiteSpace: wrap ? "normal" : "nowrap",
  });
  const out = textOut(t, outAt);
  const aStart = aIn ?? tIn;
  const aOffset = aIn === undefined ? wordCount(q) : 0;
  return (
    <div
      data-qa="headline"
      style={{
        position: "absolute", left: TEXT_BLOCK.x1, top: TEXT_BLOCK.cy, width: BLOCK_W, translate: "0 -50%",
        opacity: out.opacity * visibility,
        filter: `blur(${Math.max(visBlur, out.blur)}px)`,
      }}
    >
      <div data-qa="headline-q" data-qa-text={q} data-qa-size={fq.size} style={line(fq.size, fq.wrap)}>
        <AnimatedWords text={q} start={tIn} t={t} />
      </div>
      <div data-qa="headline-a" data-qa-text={a} data-qa-size={fa.size} style={line(fa.size, fa.wrap)}>
        <AnimatedWords text={a} start={aStart} t={t} hl={hl} indexOffset={aOffset} hlRedoAt={hlRedoAt} />
      </div>
      <div
        data-qa="headline-sub"
        data-qa-text={sub}
        style={{
          marginTop: TEXT_BLOCK.subGap, maxWidth: TYPE.sub.maxWidth, fontFamily: FONT, fontWeight: TYPE.sub.weight,
          fontSize: TYPE.sub.size, lineHeight: TYPE.sub.lineHeight, color: C.muted,
        }}
      >
        <AnimatedWords text={sub} start={subIn} t={t} />
      </div>
    </div>
  );
};
