// <FlowDiagram/>: sơ đồ ngang 4 nút bo tròn ở cuối B8 (plan 8, 2:44.0–2:47.0).
// Đường nối vẽ dần trong 1.2s, mỗi nút pop khi đường chạm tới; chip accent dưới nút 3.
import React from "react";
import { CHIPS, FLOW, FLOW_TIMING } from "../data";
import { C, FONT } from "../tokens";
import { prog, springAt, useT } from "./anim";
import { Chip } from "./Chip";

const NODE_W = 330, NODE_H = 150, Y = 470, GAP = (1728 - 4 * NODE_W) / 3;
const DRAW_START = FLOW_TIMING.drawStart;

export const FlowDiagram: React.FC = () => {
  const t = useT();
  if (t < FLOW.t_in || t > FLOW.t_out) return null;
  const seg = FLOW_TIMING.seg;
  const xs = FLOW.nodes.map((_, i) => 96 + i * (NODE_W + GAP));
  const chip = CHIPS.find((c) => c.where === "flowNode3");
  const o = 1 - prog(t, FLOW.t_out - 0.25, 0.25);
  return (
    <div data-qa="flow" style={{ position: "absolute", inset: 0, opacity: o }}>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {xs.slice(0, -1).map((x, i) => {
          const p = prog(t, DRAW_START + i * seg, seg);
          const x1 = x + NODE_W + 8, x2 = xs[i + 1] - 14, y = Y + NODE_H / 2;
          const xe = x1 + (x2 - x1) * p;
          return (
            <g key={i}>
              <line x1={x1} y1={y} x2={xe} y2={y} stroke={C.ink} strokeWidth={4} strokeLinecap="round" />
              {p >= 1 ? <path d={`M${x2 - 12} ${y - 10} L${x2} ${y} L${x2 - 12} ${y + 10}`} fill="none" stroke={C.ink} strokeWidth={4} strokeLinecap="round" strokeLinejoin="round" /> : null}
            </g>
          );
        })}
      </svg>
      {FLOW.nodes.map((n, i) => {
        const s = springAt(t, DRAW_START + i * seg, { damping: 12, stiffness: 200 });
        return (
          <div
            key={i}
            data-qa="flow-node"
            data-qa-text={n}
            style={{
              position: "absolute", left: xs[i], top: Y, width: NODE_W, height: NODE_H, boxSizing: "border-box", padding: "0 22px",
              display: "flex", alignItems: "center", justifyContent: "center", textAlign: "center", borderRadius: 28,
              background: i === 1 ? C.panel : "#fff", color: i === 1 ? "#fff" : C.ink, border: "1px solid rgba(0,0,0,.08)",
              boxShadow: "0 14px 40px rgba(0,0,0,.10)", fontFamily: FONT, fontWeight: 700, fontSize: 28, lineHeight: 1.2,
              scale: String(0.6 + 0.4 * s), opacity: Math.min(1, s * 2),
            }}
          >
            {n}
          </div>
        );
      })}
      {chip ? <Chip text={chip.text} variant={chip.variant} t={t} t_in={chip.t_in} t_out={chip.t_out} style={{ left: xs[2] + NODE_W / 2, top: Y + NODE_H + 28, translate: "-50% 0", transformOrigin: "center top" }} /> : null}
    </div>
  );
};
