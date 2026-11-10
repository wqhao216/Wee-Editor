// 2.4 Nền: bg + 2 blob Ø1000 blur 140px, trôi hình sin biên độ 40px chu kỳ 12s, lệch pha.
import React from "react";
import { AbsoluteFill } from "remotion";
import { C } from "../tokens";
import { useT } from "./anim";

const Blob: React.FC<{ cx: number; cy: number; color: string; opacity: number; phase: number; t: number }> = ({ cx, cy, color, opacity, phase, t }) => {
  const a = (2 * Math.PI * t) / 12 + phase;
  const x = cx + 40 * Math.sin(a);
  const y = cy + 40 * Math.sin(a + Math.PI / 2);
  return (
    <div style={{ position: "absolute", left: x - 500, top: y - 500, width: 1000, height: 1000, borderRadius: "50%", background: color, opacity, filter: "blur(140px)" }} />
  );
};

export const Background: React.FC = () => {
  const t = useT();
  return (
    <AbsoluteFill style={{ background: C.bg, overflow: "hidden" }}>
      <Blob cx={420} cy={360} color={C.blob1} opacity={0.5} phase={0} t={t} />
      <Blob cx={1500} cy={760} color={C.blob2} opacity={0.45} phase={Math.PI * 0.7} t={t} />
    </AbsoluteFill>
  );
};
