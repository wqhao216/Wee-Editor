// <Subtitles srt/> (plan 2.7): đáy giữa, tâm y 1000, rộng tối đa 1400px, chữ ink trên pill
// trắng 0.92, bo 14, padding 10×18, tối đa 2 dòng ≤ 42 ký tự, tách ở dấu phẩy. Lớp trên cùng,
// không bị zoom. Thời gian theo lời đọc (cues.json vo = phan3_vo_draft.srt).
import React from "react";
import { C, FONT, SUBTITLE, TYPE } from "../tokens";
import { subtitlePages } from "../timeline";
import { RichText, prog, useT } from "./anim";

const PAGES = subtitlePages();

export const Subtitles: React.FC = () => {
  const t = useT();
  const page = PAGES.find((p) => t >= p.t_in && t < p.t_out);
  if (!page) return null;
  const o = Math.min(prog(t, page.t_in, 0.1), 1 - prog(t, page.t_out - 0.1, 0.1));
  return (
    <div
      data-qa="subtitle"
      data-qa-text={page.lines.join(" ")}
      data-qa-lines={page.lines.length}
      style={{
        position: "absolute", left: 960, top: SUBTITLE.cy, translate: "-50% -50%", maxWidth: SUBTITLE.maxWidth,
        background: "rgba(255,255,255,0.92)", borderRadius: 14, padding: "10px 18px", color: C.ink, opacity: o,
        fontFamily: FONT, fontWeight: TYPE.subtitle.weight, fontSize: TYPE.subtitle.size, lineHeight: TYPE.subtitle.lineHeight,
        textAlign: "center", whiteSpace: "nowrap",
      }}
    >
      {page.lines.map((l, i) => (
        <div key={i} data-qa="subtitle-line" data-qa-text={l}>
          <RichText text={l} />
        </div>
      ))}
    </div>
  );
};
