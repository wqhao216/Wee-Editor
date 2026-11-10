// Lớp phụ trên video (plan 8): pulse, clickRipple, badgeCount ①…⑧, bộ đếm "8/8 ✓".
// Tọa độ gốc → màn hình theo camera hiện tại, như khung khoanh.
import React from "react";
import { BADGES, CLICKS, COUNTER, PULSES } from "../data";
import { C, DUR, FONT } from "../tokens";
import { srcToOut, srcToScreen, type View } from "../timeline";
import { RichText, prog, springAt } from "./anim";
import { ClickRipple, Pulse } from "./Callout";

const RIPPLES = CLICKS.map((c) => ({ ...c, out: srcToOut(c.src) })).filter((c) => c.out !== null);

export const VideoOverlays: React.FC<{ view: View; t: number; scenes: string[] }> = ({ view, t, scenes }) => (
  <>
    {PULSES.filter((p) => scenes.includes(p.scene)).map((p, i) => (
      <Pulse key={`p${i}`} box={{ x1: p.box[0], y1: p.box[1], x2: p.box[2], y2: p.box[3] }} view={view} t={t} t0={p.t} color={p.color} />
    ))}
    {RIPPLES.filter((r) => scenes.includes(r.out!.scene)).map((r, i) => (
      <ClickRipple key={`r${i}`} x={r.x} y={r.y} view={view} t={t} t0={r.out!.t} />
    ))}
    {scenes.includes(BADGES.scene) ? <BadgeCount view={view} t={t} /> : null}
  </>
);

/** badgeCount: huy hiệu tròn Ø28 (nền ink, số trắng) hiện lần lượt cách 80ms, mỗi cái 220ms. */
export const BadgeCount: React.FC<{ view: View; t: number }> = ({ view, t }) => {
  if (t < BADGES.t_in || t > BADGES.t_out) return null;
  const out = 1 - prog(t, BADGES.t_out - 0.2, 0.2);
  return (
    <>
      {BADGES.ys.map((y, i) => {
        const s = springAt(t, BADGES.t_in + i * DUR.badgeStagger, { damping: 13, stiffness: 260 });
        const p = srcToScreen(view, BADGES.x, y);
        return (
          <div
            key={i}
            data-qa="badge"
            style={{
              position: "absolute", left: p.x - 14, top: p.y - 14, width: 28, height: 28, borderRadius: "50%", background: C.ink,
              color: "#fff", fontFamily: FONT, fontWeight: 800, fontSize: 15, display: "flex", alignItems: "center", justifyContent: "center",
              scale: String(s), opacity: Math.min(1, s * 2) * out,
            }}
          >
            {i + 1}
          </div>
        );
      })}
    </>
  );
};

/** Bộ đếm lớn góc trên phải ở B8: "8/8 ✓" màu ok. */
export const Counter: React.FC<{ t: number }> = ({ t }) => {
  if (t < COUNTER.t_in || t > COUNTER.t_out) return null;
  const s = springAt(t, COUNTER.t_in, { damping: 12, stiffness: 200 });
  const o = Math.min(Math.min(1, s * 2), 1 - prog(t, COUNTER.t_out - 0.2, 0.2));
  return (
    <div
      data-qa="counter"
      data-qa-text={COUNTER.text}
      style={{
        position: "absolute", right: 96, top: 64, color: C.ok, fontFamily: FONT, fontWeight: 800, fontSize: 72, lineHeight: 1,
        background: "rgba(255,255,255,0.92)", padding: "10px 22px", borderRadius: 20, boxShadow: "0 10px 30px rgba(0,0,0,.12)",
        scale: String(0.8 + 0.2 * s), opacity: o, transformOrigin: "right top",
      }}
    >
      <RichText text={COUNTER.text} />
    </div>
  );
};
