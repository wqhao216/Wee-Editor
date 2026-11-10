// <StepPill step total/>: pill "BƯỚC x/8" + 8 chấm Ø10 cách 10 (plan 2.2, 2.3, pillIn 2.5).
import React from "react";
import { C, FONT, PILL_POS, SPRING, TYPE } from "../tokens";
import { springAt } from "./anim";

// backing: 0..1, nền trắng mờ sau dãy chấm khi card phủ toàn khung (punchIn) để chấm không chìm vào ảnh.
type Props = { step: number; total?: number; t: number; tIn: number; opacity?: number; backing?: number };

export const StepPill: React.FC<Props> = ({ step, total = 8, t, tIn, opacity = 1, backing = 0 }) => {
  const s = springAt(t, tIn, SPRING.pill);
  return (
    <div data-qa="pill" style={{ position: "absolute", left: PILL_POS.x, top: PILL_POS.y, display: "flex", alignItems: "center", gap: 18, opacity }}>
      <div
        style={{
          background: C.panel, color: "#fff", fontFamily: FONT, fontWeight: TYPE.pill.weight, fontSize: TYPE.pill.size,
          lineHeight: 1.2, padding: "10px 20px", borderRadius: 999, textTransform: "uppercase", letterSpacing: 0.5,
          translate: `${-20 * (1 - s)}px 0`, opacity: Math.min(1, s * 1.5),
        }}
      >
        {`BƯỚC ${step}/${total}`}
      </div>
      <div style={{ display: "flex", gap: 10, padding: "8px 12px", margin: "-8px -12px", borderRadius: 999, background: `rgba(255,255,255,${0.92 * backing})`, boxShadow: backing > 0 ? `0 4px 14px rgba(0,0,0,${0.12 * backing})` : undefined }}>
        {Array.from({ length: total }, (_, i) => {
          const n = i + 1;
          const current = n === step;
          const past = n < step;
          const pop = current ? 0.6 + 0.4 * s : 1;
          return (
            <div
              key={n}
              style={{
                width: 10, height: 10, borderRadius: "50%", boxSizing: "border-box",
                background: past ? C.ink : current ? C.accent : "transparent",
                border: current ? `2px solid ${C.ink}` : past ? "none" : "2px solid #B9B6AC",
                scale: String(pop),
              }}
            />
          );
        })}
      </div>
    </div>
  );
};
