// <Chip text variant/> (plan 2.2: Be Vietnam Pro 600 24px, nền trắng, viền 1px rgba(0,0,0,.08),
// bóng nhẹ) + chipPop (nảy 0.9→1 kèm opacity, 250ms spring). <BigCard/>: thẻ chữ lớn ở B8.
import React from "react";
import { measureText } from "@remotion/layout-utils";
import { BIG_CARD, CHIPS, type ChipCue } from "../data";
import { C, CARD, DUR, EASE, FONT, FONT_FAMILY, TEXT_BLOCK, TYPE, type Rect } from "../tokens";
import { viewAt } from "../timeline";
import { RichText, measurable, prog, springAt, useT } from "./anim";
import { activeCalloutRects } from "./Callout";

const VARIANT: Record<ChipCue["variant"], React.CSSProperties> = {
  default: { background: "#fff", color: C.ink },
  muted: { background: "#fff", color: C.muted },
  accent: { background: C.accent, color: C.ink },
};

export const Chip: React.FC<{ text: string; variant?: ChipCue["variant"]; t: number; t_in: number; t_out: number; style?: React.CSSProperties }> = ({ text, variant = "default", t, t_in, t_out, style }) => {
  if (t < t_in || t > t_out) return null;
  const s = springAt(t, t_in, { damping: 14, stiffness: 220 });
  const o = Math.min(prog(t, t_in, DUR.chipPop), 1 - prog(t, t_out - 0.2, 0.2));
  return (
    <div
      data-qa="chip"
      data-qa-text={text}
      style={{
        position: "absolute", ...VARIANT[variant], fontFamily: FONT, fontWeight: TYPE.chip.weight, fontSize: TYPE.chip.size,
        lineHeight: 1.25, padding: "9px 18px", borderRadius: 14, border: "1px solid rgba(0,0,0,.08)",
        boxShadow: "0 6px 18px rgba(0,0,0,.08)", whiteSpace: "nowrap", opacity: o, scale: String(0.9 + 0.1 * s),
        transformOrigin: "left center", ...style,
      }}
    >
      <RichText text={text} />
    </div>
  );
};

const CHIP_H = 49;
const chipWidth = (text: string) =>
  Math.ceil(measureText({ text: measurable(text), fontFamily: FONT_FAMILY, fontSize: TYPE.chip.size, fontWeight: "600" }).width) + 38;
const overlaps = (a: Rect, b: Rect) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;

/** Vị trí chip: chỗ plan ghi trước ("dưới card" vắt qua mép dưới card, hoặc "trái dưới" ở đáy khối
 * chữ); khi card phủ toàn khung mà chỗ đó đè khung khoanh/nhãn đang hiện thì dời sang chỗ trống kế. */
const chipPosition = (cue: ChipCue, t: number): { r: Rect; right: boolean } => {
  const w = chipWidth(cue.text);
  const at = (x: number, y: number): Rect => ({ x1: x, y1: y, x2: x + w, y2: y + CHIP_H });
  const first = cue.where === "underCard" ? at(CARD.x1 + 24, CARD.y2 - 23) : at(TEXT_BLOCK.x1, 846);
  const view = viewAt(t, EASE.camera);
  if (view.p === 0) return { r: first, right: false };
  const busy = activeCalloutRects(t, view);
  const candidates = [
    { r: first, right: false }, { r: at(1920 - 96 - w, 846), right: true },
    { r: at(1920 - 96 - w, 180), right: true }, { r: at(TEXT_BLOCK.x1, 180), right: false },
  ];
  return candidates.find((c) => !busy.some((b) => overlaps(c.r, b))) ?? candidates[0];
};

/** Các chip theo thời gian (trừ chip của FlowDiagram, do FlowDiagram tự đặt). */
export const ChipLayer: React.FC = () => {
  const t = useT();
  return (
    <>
      {CHIPS.filter((c) => c.where !== "flowNode3" && t >= c.t_in && t <= c.t_out).map((c, i) => {
        const { r, right } = chipPosition(c, t);
        // chip bên phải neo theo right: 96 (không phụ thuộc bề rộng ước lượng)
        const pos = right ? { right: 96, top: r.y1, transformOrigin: "right center" } : { left: r.x1, top: r.y1 };
        return <Chip key={i} text={c.text} variant={c.variant} t={t} t_in={c.t_in} t_out={c.t_out} style={pos} />;
      })}
    </>
  );
};

/** Thẻ chữ lớn giữa đáy, trên phụ đề: nền panel, chữ trắng, phần trong {} màu accent. */
export const BigCard: React.FC = () => {
  const t = useT();
  if (t < BIG_CARD.t_in || t > BIG_CARD.t_out) return null;
  const s = springAt(t, BIG_CARD.t_in, { damping: 14, stiffness: 200 });
  const o = Math.min(prog(t, BIG_CARD.t_in, 0.2), 1 - prog(t, BIG_CARD.t_out - 0.2, 0.2));
  const parts = BIG_CARD.text.split(/(\{[^}]*\})/).filter(Boolean);
  return (
    <div
      data-qa="bigcard"
      data-qa-text={BIG_CARD.text.replace(/[{}]/g, "")}
      style={{
        position: "absolute", left: 960, top: 862, translate: "-50% -50%", scale: String(0.9 + 0.1 * s), opacity: o,
        background: C.panel, color: "#fff", fontFamily: FONT, fontWeight: 800, fontSize: 46, lineHeight: 1.1,
        padding: "16px 32px", borderRadius: 18, whiteSpace: "nowrap", boxShadow: "0 18px 50px rgba(0,0,0,.25)",
      }}
    >
      {parts.map((p, i) => (p.startsWith("{") ? <span key={i} style={{ color: C.accent }}>{p.slice(1, -1)}</span> : <span key={i}>{p}</span>))}
    </div>
  );
};
