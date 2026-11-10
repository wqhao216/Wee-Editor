// <ScreenCard segments camera masksBaked/>: phát hai_clean.mp4 theo edl.json (play có tốc độ,
// freeze), nhận lệnh camera punchIn/punchOut từ cues.json, mang theo khung khoanh, speedTag,
// freezeCue, jumpCut. Mỗi khung ra = đúng một khung gốc (Freeze + OffthreadVideo).
import React from "react";
import { Freeze, OffthreadVideo, staticFile } from "remotion";
import { CARD_GROUPS } from "../data";
import { CARD, CARD_RADIUS, CARD_SHADOW, EASE, FPS, SPRING, SRC_SIZE } from "../tokens";
import { cardInstances, lerp, segmentAt, speedLabel, viewAt, type CardInstance, type View } from "../timeline";
import { springAt, useT } from "./anim";
import { CalloutLayer } from "./Callout";
import { FreezeCue, JumpCut, SpeedTag } from "./CardFx";

export const VIDEO_SRC = "hai_clean.mp4";

const NORMAL: View = viewAt(-1, (x) => x);

const CardFrame: React.FC<{ inst: CardInstance; view: View; t: number; children?: React.ReactNode }> = ({ inst, view, t, children }) => {
  const s = springAt(t, inst.enterT, SPRING.card);
  const enterX = 120 * (1 - s);
  const enterScale = 0.96 + 0.04 * s;
  const enterOpacity = Math.min(1, s * 1.4);
  const c = view.container;
  const radius = lerp(CARD_RADIUS, 0, view.p);
  const vs = view.scale;
  return (
    <div
      style={{
        position: "absolute", inset: 0,
        translate: `${enterX + inst.x}px 0`,
        scale: String(enterScale * inst.scale),
        transformOrigin: `${(CARD.x1 + CARD.x2) / 2}px ${(CARD.y1 + CARD.y2) / 2}px`,
        opacity: enterOpacity * inst.opacity,
        filter: inst.blur > 0 ? `blur(${inst.blur}px)` : undefined,
      }}
    >
      <div
        data-qa="card"
        data-qa-src-frame={inst.srcFrame}
        data-qa-view={JSON.stringify({ c: view.container, s: view.src, k: view.scale })}
        style={{
          position: "absolute", left: c.x1, top: c.y1, width: c.x2 - c.x1, height: c.y2 - c.y1,
          borderRadius: radius, overflow: "hidden", background: "#fff",
          boxShadow: view.p < 1 ? CARD_SHADOW : undefined,
        }}
      >
        <JumpCut t={inst.main ? t : -99}>
          <div style={{ position: "absolute", left: -view.src.x1 * vs, top: -view.src.y1 * vs, width: SRC_SIZE.w * vs, height: SRC_SIZE.h * vs }}>
            {/* Khung gốc chọn bằng trimBefore, không bằng Freeze(frame=khung gốc): Freeze vượt độ dài
                composition (5100 khung) bị Remotion kẹp lại, sẽ hiện sai khung. */}
            <Freeze frame={0}>
              <OffthreadVideo src={staticFile(VIDEO_SRC)} trimBefore={inst.srcFrame} muted style={{ width: "100%", height: "100%" }} />
            </Freeze>
          </div>
        </JumpCut>
      </div>
      {children}
    </div>
  );
};

export const ScreenCard: React.FC = () => {
  const t = useT();
  const view = viewAt(t, EASE.camera);
  const { seg, scene, index } = segmentAt(t);
  return (
    <>
      {cardInstances(t).map((inst) => {
        const v = inst.main ? view : NORMAL;
        const group = CARD_GROUPS.find((g) => g.id === inst.group)!;
        const radius = lerp(CARD_RADIUS, 0, v.p);
        const inGroup = group.scenes.includes(scene.id);
        const label = inst.main && inGroup ? speedLabel(seg) : null;
        const prev = scene.segments[index - 1];
        const contFreeze =
          seg.type === "freeze" &&
          ((prev?.type === "freeze" && prev.src_at === seg.src_at) ||
            // B2 mở bằng dừng tiếp khung 24.4 của B1
            (index === 0 && segmentAt(seg.out_in - 1 / FPS).seg.type === "freeze"));
        return (
          <CardFrame key={inst.group} inst={inst} view={v} t={t}>
            {inst.main && inGroup && seg.type === "freeze" ? (
              <FreezeCue container={v.container} radius={radius} t={t} t_in={seg.out_in} t_out={seg.out_out} showChip={!contFreeze} />
            ) : null}
            {label && seg.type === "play" ? <SpeedTag label={label} container={v.container} t={t} t_in={seg.out_in} t_out={seg.out_out} /> : null}
            {inst.main ? <CalloutLayer view={v} t={t} scenes={group.scenes} /> : null}
          </CardFrame>
        );
      })}
    </>
  );
};
