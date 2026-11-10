// <Callout box variant label num dashed/>: box theo pixel gốc, tự đổi sang tọa độ màn hình
// theo camera hiện tại (cùng phép biến đổi với video). Viền bo 10, dày 5, vẽ dần (calloutDraw),
// nhãn 22px cố định khi zoom, nảy 0.8→1 ở góc trên trái box, lệch 12px (plan 2.5).
import React from "react";
import { measureText } from "@remotion/layout-utils";
import { CALLOUTS, boxToRect, type CalloutCue } from "../data";
import { C, DUR, EASE, FONT, FONT_FAMILY, H, PILL_POS, TYPE, VARIANT_COLOR, W, type Rect } from "../tokens";
import { srcRectToScreen, viewAt, type View } from "../timeline";
import { RichText, measurable, prog, springAt } from "./anim";

const STROKE = 5;
const PAD = 4; // nới box ra ngoài để viền không đè chữ trong box
const GAP = 12;
const LABEL_H = Math.round(TYPE.label.size * 1.2) + 16;
const NUM_D = 24;

type Side = "above-left" | "below-left" | "above-right" | "below-right" | "inside";

const labelWidth = (c: CalloutCue) =>
  Math.ceil(measureText({ text: measurable(c.label), fontFamily: FONT_FAMILY, fontSize: TYPE.label.size, fontWeight: "800" }).width) +
  28 + (c.num ? NUM_D + 8 : 0);

const padded = (r: Rect): Rect => ({ x1: r.x1 - PAD, y1: r.y1 - PAD, x2: r.x2 + PAD, y2: r.y2 + PAD });

const labelRect = (box: Rect, side: Side, w: number): Rect => {
  const left = side.endsWith("right") ? box.x2 - w : box.x1;
  const top = side.startsWith("above") ? box.y1 - GAP - LABEL_H : side.startsWith("below") ? box.y2 + GAP : box.y1 + 6;
  return { x1: left, y1: top, x2: left + w, y2: top + LABEL_H };
};

const hit = (a: Rect, b: Rect) => a.x1 < b.x2 && b.x1 < a.x2 && a.y1 < b.y2 && b.y1 < a.y2;
const PILL_ZONE: Rect = { x1: PILL_POS.x - 16, y1: PILL_POS.y - 16, x2: 560, y2: PILL_POS.y + 58 };
const SUB_ZONE: Rect = { x1: 260, y1: 944, x2: 1660, y2: 1056 };

/** Chọn phía đặt nhãn một lần cho mỗi khung khoanh (đo ở lúc khung vừa vẽ xong) để nhãn
 * không nhảy theo camera. Tính lười, khi font đã nạp (cần bề rộng nhãn thật). Không chỗ nào
 * thỏa mọi điều kiện thì đặt "inside" và QA sẽ báo. */
let placementCache: Map<CalloutCue, Side> | null = null;
const getPlacements = () => {
  if (placementCache) return placementCache;
  const m = new Map<CalloutCue, Side>();
  const placed: { c: CalloutCue; r: Rect }[] = [];
  for (const c of CALLOUTS) {
    const v = viewAt(c.t_in + DUR.calloutDraw + 0.05, EASE.camera);
    const box = padded(srcRectToScreen(v, boxToRect(c.box_src)));
    const others = CALLOUTS.filter((o) => o !== c && o.t_in < c.t_out && c.t_in < o.t_out)
      .map((o) => padded(srcRectToScreen(v, boxToRect(o.box_src))));
    const earlierLabels = placed.filter((p) => p.c.t_out > c.t_in && p.c.t_in < c.t_out).map((p) => p.r);
    const w = labelWidth(c);
    let chosen: Side = "inside";
    for (const side of ["above-left", "below-left", "above-right", "below-right"] as Side[]) {
      const r = labelRect(box, side, w);
      const inFrame = r.x1 >= 16 && r.x2 <= W - 16 && r.y1 >= 16 && r.y2 <= H - 16;
      if (!inFrame || hit(r, PILL_ZONE) || hit(r, SUB_ZONE)) continue;
      if (others.some((o) => hit(r, o)) || earlierLabels.some((o) => hit(r, o))) continue;
      chosen = side;
      placed.push({ c, r });
      break;
    }
    m.set(c, chosen);
  }
  placementCache = m;
  return m;
};

type Props = { cue: CalloutCue; view: View; t: number; index: number };

export const Callout: React.FC<Props> = ({ cue, view, t, index }) => {
  const color = VARIANT_COLOR[cue.variant];
  const box = padded(srcRectToScreen(view, boxToRect(cue.box_src)));
  const w = labelWidth(cue);
  const side = getPlacements().get(cue) ?? "inside";
  const lr = labelRect(box, side, w);
  const draw = prog(t, cue.t_in, DUR.calloutDraw, EASE.outCubic);
  const pop = springAt(t, cue.t_in + DUR.calloutDraw, { damping: 12, stiffness: 200 });
  const out = 1 - prog(t, cue.t_out - DUR.calloutOut, DUR.calloutOut);
  const bw = box.x2 - box.x1, bh = box.y2 - box.y1;
  const maskId = `callout-mask-${index}`;
  const rectProps = { x: box.x1, y: box.y1, width: bw, height: bh, rx: 10, ry: 10, fill: "none" };
  return (
    <div style={{ position: "absolute", inset: 0, opacity: out }}>
      <svg width={W} height={H} style={{ position: "absolute", left: 0, top: 0, overflow: "visible" }}>
        {cue.dashed ? (
          <>
            <mask id={maskId} maskUnits="userSpaceOnUse" x={0} y={0} width={W} height={H}>
              <rect {...rectProps} stroke="#fff" strokeWidth={STROKE + 4} pathLength={1} strokeDasharray={`${draw} 1`} />
            </mask>
            <rect {...rectProps} stroke={color} strokeWidth={STROKE} strokeDasharray="10 8" mask={`url(#${maskId})`} />
          </>
        ) : (
          <rect {...rectProps} stroke={color} strokeWidth={STROKE} pathLength={1} strokeDasharray={`${draw} 1`} strokeLinecap="round" />
        )}
      </svg>
      <div
        data-qa="callout-box"
        data-qa-text={cue.label}
        data-qa-src={JSON.stringify(cue.box_src)}
        style={{ position: "absolute", left: box.x1 + PAD, top: box.y1 + PAD, width: bw - 2 * PAD, height: bh - 2 * PAD, pointerEvents: "none" }}
      />
      <div
        data-qa="callout-label"
        data-qa-text={cue.label}
        data-qa-side={side}
        style={{
          position: "absolute", left: lr.x1, top: lr.y1, height: LABEL_H, boxSizing: "border-box",
          display: "flex", alignItems: "center", gap: 8, padding: "8px 14px", borderRadius: 10,
          background: color, color: "#fff", fontFamily: FONT, fontWeight: 800, fontSize: TYPE.label.size,
          lineHeight: 1.2, whiteSpace: "nowrap", textTransform: "uppercase",
          opacity: Math.min(1, pop * 2), scale: String(0.8 + 0.2 * pop),
          transformOrigin: side.startsWith("below") ? "left top" : "left bottom",
        }}
      >
        {cue.num ? (
          <span style={{ width: NUM_D, height: NUM_D, borderRadius: "50%", background: "#fff", color, display: "inline-flex", alignItems: "center", justifyContent: "center", fontSize: 15, flex: "none" }}>
            {cue.num}
          </span>
        ) : null}
        <span><RichText text={cue.label} /></span>
      </div>
    </div>
  );
};

/** Vùng màn hình (box + nhãn) của các khung khoanh đang hiện, để lớp khác (chip) né. */
export const activeCalloutRects = (t: number, view: View): Rect[] =>
  CALLOUTS.filter((c) => t >= c.t_in && t <= c.t_out).flatMap((c) => {
    const box = padded(srcRectToScreen(view, boxToRect(c.box_src)));
    const side = getPlacements().get(c) ?? "inside";
    return [box, labelRect(box, side, labelWidth(c))];
  });

/** Các khung khoanh đang hiện của card chính. */
export const CalloutLayer: React.FC<{ view: View; t: number; scenes: string[] }> = ({ view, t, scenes }) => (
  <>
    {CALLOUTS.map((c, i) =>
      scenes.includes(c.scene) && t >= c.t_in && t <= c.t_out ? <Callout key={i} cue={c} view={view} t={t} index={i} /> : null,
    )}
  </>
);

/** pulse: box sáng nhấp nháy 2 lần (2 × 300ms), dùng khi video đang chạy. */
export const Pulse: React.FC<{ box: Rect; view: View; t: number; t0: number; variant: keyof typeof VARIANT_COLOR }> = ({ box, view, t, t0, variant }) => {
  if (t < t0 || t > t0 + 2 * DUR.pulse) return null;
  const r = padded(srcRectToScreen(view, box));
  const k = ((t - t0) % DUR.pulse) / DUR.pulse;
  const a = Math.sin(Math.PI * k);
  return (
    <div style={{ position: "absolute", left: r.x1, top: r.y1, width: r.x2 - r.x1, height: r.y2 - r.y1, borderRadius: 10, border: `${STROKE}px solid ${VARIANT_COLOR[variant]}`, boxSizing: "border-box", opacity: a, boxShadow: `0 0 24px ${VARIANT_COLOR[variant]}` }} />
  );
};

/** clickRipple: vòng accent bán kính 0→34px, opacity 0.6→0, đúng chỗ chuột bấm (tọa độ gốc). */
export const ClickRipple: React.FC<{ x: number; y: number; view: View; t: number; t0: number }> = ({ x, y, view, t, t0 }) => {
  if (t < t0 || t > t0 + DUR.clickRipple) return null;
  const p = prog(t, t0, DUR.clickRipple, EASE.outCubic);
  const s = srcRectToScreen(view, { x1: x, y1: y, x2: x, y2: y });
  const r = 34 * p;
  return (
    <div style={{ position: "absolute", left: s.x1 - r, top: s.y1 - r, width: 2 * r, height: 2 * r, borderRadius: "50%", border: `4px solid ${C.accent}`, boxSizing: "border-box", opacity: 0.6 * (1 - p) }} />
  );
};
