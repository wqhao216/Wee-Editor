// <SpeedTag/>, <FreezeCue/>, <JumpCut/> (plan 2.5). Đặt theo khung card hiện tại (container).
import React from "react";
import { C, DUR, EASE, FONT, type Rect } from "../tokens";
import { jumpCuts } from "../timeline";
import { prog } from "./anim";

const TAG_H = 44;

/** speedTag: chip "×3" góc trên phải card, nền panel, chữ accent; suốt đoạn tua > 1.2×. */
export const SpeedTag: React.FC<{ label: string; container: Rect; t: number; t_in: number; t_out: number }> = ({ label, container, t, t_in, t_out }) => {
  const o = Math.min(prog(t, t_in, 0.15), 1 - prog(t, t_out - 0.15, 0.15));
  return (
    <div
      data-qa="speedtag"
      data-qa-text={label}
      style={{
        position: "absolute", right: 1920 - container.x2 + 20, top: container.y1 + 20, height: TAG_H, boxSizing: "border-box",
        padding: "0 16px", display: "flex", alignItems: "center", borderRadius: 12, background: C.panel, color: C.accent,
        fontFamily: FONT, fontWeight: 800, fontSize: 24, opacity: o,
      }}
    >
      {label}
    </div>
  );
};

/** freezeCue: lúc dừng hình, card tối nhẹ (đen 0.08) + chip tạm dừng 0.6s. Biểu tượng vẽ bằng CSS
 * (font không có "⏸"). */
export const FreezeCue: React.FC<{ container: Rect; radius: number; t: number; t_in: number; t_out: number; showChip: boolean }> = ({ container, radius, t, t_in, t_out, showChip }) => {
  const dim = Math.min(prog(t, t_in, DUR.freezeFade, EASE.outCubic), 1 - prog(t, t_out - DUR.freezeFade, DUR.freezeFade));
  const chip = showChip ? Math.min(prog(t, t_in, DUR.freezeFade), 1 - prog(t, t_in + DUR.freezeChip - DUR.freezeFade, DUR.freezeFade)) : 0;
  return (
    <>
      <div style={{ position: "absolute", left: container.x1, top: container.y1, width: container.x2 - container.x1, height: container.y2 - container.y1, borderRadius: radius, background: "#000", opacity: 0.08 * dim }} />
      {chip > 0 ? (
        <div data-qa="freezecue" style={{ position: "absolute", right: 1920 - container.x2 + 20, top: container.y1 + 20, width: TAG_H, height: TAG_H, borderRadius: 12, background: C.panel, display: "flex", alignItems: "center", justifyContent: "center", gap: 6, opacity: chip }}>
          <span style={{ width: 6, height: 18, borderRadius: 2, background: C.accent }} />
          <span style={{ width: 6, height: 18, borderRadius: 2, background: C.accent }} />
        </div>
      ) : null}
    </>
  );
};

const JUMP_TIMES = jumpCuts();

/** jumpCut: nối hai đoạn gốc không liền nhau trong cùng card, blur 0→8→0px trong 200ms. */
export const jumpCutBlur = (t: number) => {
  for (const T of JUMP_TIMES) {
    const d = Math.abs(t - T);
    if (d < DUR.jumpCut / 2) return 8 * (1 - d / (DUR.jumpCut / 2));
  }
  return 0;
};

export const JumpCut: React.FC<{ t: number; children: React.ReactNode }> = ({ t, children }) => {
  const b = jumpCutBlur(t);
  return <div style={{ position: "absolute", inset: 0, filter: b > 0 ? `blur(${b}px)` : undefined }}>{children}</div>;
};
