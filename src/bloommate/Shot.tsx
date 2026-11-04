import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Easing, interpolate, staticFile, useCurrentFrame } from "remotion";
import { Cam, Rect, cameraAt, clampCam, toScreen } from "./camera";
import { C, CARD_H, CARD_W, FONT, FPS, H, W } from "./theme";

export type Callout = { from: number; to: number; rect: Rect; label?: string; place?: "above" | "below" | "left" | "right" };
export type Caption = { from: number; to: number; text: string };
export type ShotDef = {
  id: string;
  scene: number; // 0 = mở đầu, 1..6 = các bước
  start: number; // giây trên bản quay
  end: number;
  rate: number;
  cam: Cam[]; // t theo giây trên bản quay
  callouts?: Callout[];
  captions?: Caption[];
  bigStat?: { from: number; to: number };
};

export const shotFrames = (s: ShotDef) => Math.round(((s.end - s.start) / s.rate) * FPS);

// mức hiện của một lớp chữ theo khung thời gian trên bản quay, có fade vào/ra 0.3s (theo thời gian thực)
function visibility(t: number, from: number, to: number, rate: number) {
  const fade = 0.3 * rate;
  return interpolate(t, [from, from + fade, to - fade, to], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}

export const Shot: React.FC<{ shot: ShotDef; first?: boolean }> = ({ shot, first }) => {
  const frame = useCurrentFrame();
  const t = shot.start + (frame / FPS) * shot.rate;
  const cam = clampCam(cameraAt(shot.cam, t));
  const card = toScreen(cam, [0, 0, 1, 1]);
  const radius = interpolate(cam.z, [1, 1.12], [22, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: C.cream }}>
      <Backdrop />
      <div
        style={{
          position: "absolute",
          left: card.left,
          top: card.top,
          width: card.width,
          height: card.height,
          borderRadius: radius,
          overflow: "hidden",
          boxShadow: "0 30px 80px rgba(60,40,30,0.18), 0 6px 18px rgba(60,40,30,0.10)",
          backgroundColor: "#fff",
        }}
      >
        <Video
          src={staticFile("source.mp4")}
          trimBefore={Math.round(shot.start * FPS)}
          trimAfter={Math.round(shot.end * FPS) + 2}
          playbackRate={shot.rate}
          muted
          style={{ width: "100%", height: "100%", objectFit: "fill" }}
        />
      </div>
      {shot.callouts?.map((c, i) => (
        <Spotlight key={i} id={`${shot.id}-${i}`} c={c} cam={cam} vis={visibility(t, c.from, c.to, shot.rate)} />
      ))}
      {shot.bigStat ? <BigStat vis={visibility(t, shot.bigStat.from, shot.bigStat.to, shot.rate)} /> : null}
      {shot.captions?.map((c, i) => (
        <CaptionBar key={i} text={c.text} vis={visibility(t, c.from, c.to, shot.rate)} />
      ))}
      <SceneChip scene={shot.scene} frame={first ? frame : 999} />
      {shot.scene === 6 ? <Disclaimer /> : null}
    </AbsoluteFill>
  );
};

export const Backdrop: React.FC = () => (
  <AbsoluteFill
    style={{
      background: `radial-gradient(1200px 700px at 15% 10%, ${C.roseSoft} 0%, rgba(244,215,224,0) 60%),
        radial-gradient(1000px 700px at 90% 95%, ${C.sageSoft} 0%, rgba(227,237,216,0) 60%), ${C.cream}`,
    }}
  />
);

const Spotlight: React.FC<{ id: string; c: Callout; cam: { z: number; x: number; y: number }; vis: number }> = ({ id, c, cam, vis }) => {
  if (vis <= 0) return null;
  const pad = 14;
  const r = toScreen(cam, c.rect);
  const x = r.left - pad, y = r.top - pad, w = r.width + pad * 2, h = r.height + pad * 2;
  const grow = interpolate(vis, [0, 1], [1.06, 1]);
  const place = c.place ?? (y > 190 ? "above" : "below");
  const labelStyle: React.CSSProperties = { position: "absolute", opacity: vis, transform: `translateY(${(1 - vis) * 12}px)` };
  if (place === "above") Object.assign(labelStyle, { left: x, top: y - 78 });
  if (place === "below") Object.assign(labelStyle, { left: x, top: y + h + 18 });
  if (place === "right") Object.assign(labelStyle, { left: x + w + 22, top: y + h / 2 - 32 });
  if (place === "left") Object.assign(labelStyle, { right: W - x + 22, top: y + h / 2 - 32 });
  return (
    <AbsoluteFill>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <mask id={`hole-${id}`}>
            <rect width={W} height={H} fill="white" />
            <rect x={x} y={y} width={w} height={h} rx={16} fill="black" />
          </mask>
        </defs>
        <rect width={W} height={H} fill={`rgba(30,20,16,${0.45 * vis})`} mask={`url(#hole-${id})`} />
        <rect
          x={x} y={y} width={w} height={h} rx={16} fill="none"
          stroke={C.rose} strokeWidth={4} opacity={vis}
          transform={`translate(${x + w / 2} ${y + h / 2}) scale(${grow}) translate(${-(x + w / 2)} ${-(y + h / 2)})`}
        />
      </svg>
      {c.label ? (
        <div style={labelStyle}>
          <div
            style={{
              fontFamily: FONT, fontWeight: 700, fontSize: 34, color: "#fff", backgroundColor: C.ink,
              padding: "12px 24px", borderRadius: 999, whiteSpace: "nowrap",
              boxShadow: "0 10px 30px rgba(0,0,0,0.25)", display: "flex", alignItems: "center", gap: 14,
            }}
          >
            <span style={{ width: 12, height: 12, borderRadius: 6, backgroundColor: C.roseSoft, display: "inline-block" }} />
            {c.label}
          </div>
        </div>
      ) : null}
    </AbsoluteFill>
  );
};

export const CaptionBar: React.FC<{ text: string; vis: number }> = ({ text, vis }) => {
  if (vis <= 0) return null;
  return (
    <div
      style={{
        position: "absolute", left: 0, right: 0, bottom: 56, display: "flex", justifyContent: "center",
        opacity: vis, transform: `translateY(${(1 - vis) * 24}px)`,
      }}
    >
      <div
        style={{
          fontFamily: FONT, fontWeight: 700, fontSize: 46, color: C.ink, backgroundColor: "rgba(255,255,255,0.96)",
          padding: "20px 40px 20px 32px", borderRadius: 22, boxShadow: "0 16px 50px rgba(60,40,30,0.22)",
          display: "flex", alignItems: "center", gap: 22, maxWidth: 1500,
        }}
      >
        <span style={{ width: 8, alignSelf: "stretch", borderRadius: 4, backgroundColor: C.rose }} />
        {text}
      </div>
    </div>
  );
};

const BigStat: React.FC<{ vis: number }> = ({ vis }) => {
  if (vis <= 0) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", backgroundColor: `rgba(30,20,16,${0.35 * vis})` }}>
      <div
        style={{
          fontFamily: FONT, backgroundColor: "#fff", borderRadius: 36, padding: "48px 72px 52px",
          boxShadow: "0 30px 90px rgba(0,0,0,0.3)", opacity: vis, transform: `scale(${0.94 + 0.06 * vis})`, textAlign: "center",
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 600, color: C.inkSoft, marginBottom: 18 }}>Tiền hoa bỏ trung bình mỗi ngày</div>
        <div style={{ display: "flex", alignItems: "center", gap: 40, justifyContent: "center" }}>
          <div>
            <div style={{ fontSize: 92, fontWeight: 800, color: C.red, letterSpacing: -2 }}>96.000₫</div>
            <div style={{ fontSize: 28, fontWeight: 500, color: C.inkSoft }}>trước khi dùng app</div>
          </div>
          <svg width="90" height="60" viewBox="0 0 90 60">
            <path d="M5 30 H75 M55 10 L78 30 L55 50" stroke={C.ink} strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div style={{ fontSize: 92, fontWeight: 800, color: C.green, letterSpacing: -2 }}>79.300₫</div>
            <div style={{ fontSize: 28, fontWeight: 500, color: C.inkSoft }}>25 ngày gần đây</div>
          </div>
        </div>
      </div>
    </AbsoluteFill>
  );
};

const STEP_NAMES = ["", "KIỂM TỐI", "NHẬP HÀNG", "LÀM COMBO", "ẢNH & CAPTION", "KHO HOA", "BÁO CÁO"];

// Nhãn bước ở góc trên trái + thanh tiến trình 6 bước. Ở cảnh đầu mỗi bước, nhãn bật lớn rồi thu về.
export const SceneChip: React.FC<{ scene: number; frame: number }> = ({ scene, frame }) => {
  if (scene < 1) return null;
  const pop = interpolate(frame, [0, 8, 34, 46], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.inOut(Easing.cubic) });
  const appear = interpolate(frame, [0, 8], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return (
    <div style={{ position: "absolute", left: 40, top: 26, display: "flex", alignItems: "center", gap: 18, transformOrigin: "left top", transform: `scale(${1 + 0.35 * pop})`, opacity: frame === 999 ? 1 : appear }}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, letterSpacing: 1.5, color: "#fff", backgroundColor: C.ink, padding: "10px 22px", borderRadius: 999, boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
        <span style={{ color: C.roseSoft }}>{scene}</span>&nbsp;·&nbsp;{STEP_NAMES[scene]}
      </div>
      <div style={{ display: "flex", gap: 6, padding: "8px 10px", borderRadius: 999, backgroundColor: "rgba(255,255,255,0.85)" }}>
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div key={i} style={{ width: i === scene ? 30 : 10, height: 10, borderRadius: 5, backgroundColor: i <= scene ? C.rose : "#D9CFC5" }} />
        ))}
      </div>
    </div>
  );
};

const Disclaimer: React.FC = () => (
  <div style={{ position: "absolute", right: 36, bottom: 24, fontFamily: FONT, fontWeight: 500, fontSize: 22, color: C.inkSoft, backgroundColor: "rgba(255,255,255,0.9)", padding: "8px 16px", borderRadius: 10 }}>
    Số liệu mẫu minh hoạ, không phải kết quả pilot
  </div>
);
