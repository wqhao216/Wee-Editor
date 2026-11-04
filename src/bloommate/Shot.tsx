import { Audio, Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Easing, Sequence, interpolate, spring, staticFile, useCurrentFrame } from "remotion";
import { Cam, Rect, cameraAt, clampCam, toScreen } from "./camera";
import { C, FONT, FPS, H, W } from "./theme";

export type Sfx = { name: string; vol: number };
export type Callout = { from: number; to: number; rect: Rect; label?: string; place?: "above" | "below" | "left" | "right"; sfx?: Sfx };
export type Caption = { from: number; to: number; text: string };
export type ShotDef = {
  id: string;
  scene: number;
  start: number; // seconds in the source recording
  end: number;
  beats: number; // length on screen, in music beats
  rate: number; // derived: (end - start) / seconds on screen
  cam: Cam[];
  callouts?: Callout[];
  captions?: Caption[];
  bigStat?: { from: number; to: number };
};

const SCENE_NAMES = ["", "EVENING CHECK", "RESTOCK", "COMBOS", "PHOTO & CAPTION", "STOCK", "REPORT"];

// Fade window measured in source seconds, but the fade itself lasts ~0.2 s on screen
function vis(t: number, from: number, to: number, rate: number) {
  const fade = 0.2 * rate;
  return interpolate(t, [from, from + fade, to - fade, to], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
    easing: Easing.out(Easing.cubic),
  });
}
// frames on screen since a source time
const framesSince = (t: number, from: number, rate: number) => ((t - from) / rate) * FPS;

export const Shot: React.FC<{ shot: ShotDef }> = ({ shot }) => {
  const frame = useCurrentFrame();
  const t = shot.start + (frame / FPS) * shot.rate;
  const base = clampCam(cameraAt(shot.cam, t));
  // "punch-in" on every cut: starts 4% bigger and settles, gives the edit a beat-driven kick
  const punch = 1 + 0.045 * (1 - Easing.out(Easing.cubic)(Math.min(1, frame / 9)));
  const cam = clampCam({ ...base, z: base.z * punch });
  const card = toScreen(cam, [0, 0, 1, 1]);
  const radius = interpolate(cam.z, [1, 1.12], [22, 0], { extrapolateRight: "clamp" });

  return (
    <AbsoluteFill style={{ backgroundColor: C.cream }}>
      <Backdrop />
      <div
        style={{
          position: "absolute", left: card.left, top: card.top, width: card.width, height: card.height,
          borderRadius: radius, overflow: "hidden", backgroundColor: "#fff",
          boxShadow: "0 30px 80px rgba(60,40,30,0.18), 0 6px 18px rgba(60,40,30,0.10)",
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
        <Spotlight key={i} id={`${shot.id}-${i}`} c={c} cam={cam} v={vis(t, c.from, c.to, shot.rate)} age={framesSince(t, c.from, shot.rate)} />
      ))}
      {shot.bigStat ? <BigStat v={vis(t, shot.bigStat.from, shot.bigStat.to, shot.rate)} age={framesSince(t, shot.bigStat.from, shot.rate)} /> : null}
      {shot.captions?.map((c, i) => (
        <CaptionBar key={i} text={c.text} v={vis(t, c.from, c.to, shot.rate)} age={framesSince(t, c.from, shot.rate)} />
      ))}
      <SceneChip scene={shot.scene} />
      {shot.scene === 6 ? <Disclaimer /> : null}
      {shot.callouts?.map((c, i) =>
        c.sfx ? <SfxAt key={`sfx${i}`} at={Math.max(0, Math.round(((c.from - shot.start) / shot.rate) * FPS) + 4)} sfx={c.sfx} /> : null,
      )}
      {shot.bigStat ? <BigStatSfx at={Math.max(0, Math.round(((shot.bigStat.from - shot.start) / shot.rate) * FPS))} /> : null}
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

const Spotlight: React.FC<{ id: string; c: Callout; cam: { z: number; x: number; y: number }; v: number; age: number }> = ({ id, c, cam, v, age }) => {
  if (v <= 0) return null;
  const pad = 14;
  const r = toScreen(cam, c.rect);
  const x = r.left - pad, y = r.top - pad, w = r.width + pad * 2, h = r.height + pad * 2;
  const perim = 2 * (w + h);
  const draw = Easing.inOut(Easing.cubic)(Math.min(1, Math.max(0, age / 12))); // ring draws itself in 0.4 s
  const pop = spring({ frame: age - 4, fps: FPS, config: { damping: 11, stiffness: 160 } });
  const place = c.place ?? (y > 190 ? "above" : "below");
  const labelStyle: React.CSSProperties = { position: "absolute", opacity: v * Math.min(1, pop * 1.5), transform: `scale(${0.6 + 0.4 * pop})` };
  if (place === "above") Object.assign(labelStyle, { left: x, top: y - 80, transformOrigin: "left bottom" });
  if (place === "below") Object.assign(labelStyle, { left: x, top: y + h + 18, transformOrigin: "left top" });
  if (place === "right") Object.assign(labelStyle, { left: x + w + 22, top: y + h / 2 - 32, transformOrigin: "left center" });
  if (place === "left") Object.assign(labelStyle, { right: W - x + 22, top: y + h / 2 - 32, transformOrigin: "right center" });
  return (
    <AbsoluteFill>
      <svg width={W} height={H} style={{ position: "absolute", inset: 0 }}>
        <defs>
          <mask id={`hole-${id}`}>
            <rect width={W} height={H} fill="white" />
            <rect x={x} y={y} width={w} height={h} rx={16} fill="black" />
          </mask>
        </defs>
        <rect width={W} height={H} fill={`rgba(30,20,16,${0.5 * v})`} mask={`url(#hole-${id})`} />
        <rect x={x} y={y} width={w} height={h} rx={16} fill="none" stroke={C.rose} strokeWidth={5} opacity={v}
          strokeDasharray={perim} strokeDashoffset={perim * (1 - draw)} />
      </svg>
      {c.label ? (
        <div style={labelStyle}>
          <div
            style={{
              fontFamily: FONT, fontWeight: 700, fontSize: 34, color: "#fff", backgroundColor: C.ink,
              padding: "12px 26px", borderRadius: 999, whiteSpace: "nowrap",
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

export const CaptionBar: React.FC<{ text: string; v: number; age: number }> = ({ text, v, age }) => {
  if (v <= 0) return null;
  const s = spring({ frame: age, fps: FPS, config: { damping: 14, stiffness: 170 } });
  // text revealed by a sliding mask: snappy, commercial "type-on" feel
  const reveal = Easing.out(Easing.cubic)(Math.min(1, Math.max(0, (age - 2) / 10)));
  return (
    <div style={{ position: "absolute", left: 0, right: 0, bottom: 56, display: "flex", justifyContent: "center", opacity: v, transform: `translateY(${(1 - s) * 40}px)` }}>
      <div
        style={{
          fontFamily: FONT, fontWeight: 700, fontSize: 46, color: C.ink, backgroundColor: "rgba(255,255,255,0.97)",
          padding: "20px 40px 20px 32px", borderRadius: 22, boxShadow: "0 16px 50px rgba(60,40,30,0.22)",
          display: "flex", alignItems: "center", gap: 22, maxWidth: 1600,
        }}
      >
        <span style={{ width: 8, alignSelf: "stretch", borderRadius: 4, backgroundColor: C.rose, transform: `scaleY(${s})` }} />
        <span style={{ clipPath: `inset(0 ${100 - reveal * 100}% 0 0)`, whiteSpace: "nowrap" }}>{text}</span>
      </div>
    </div>
  );
};

const fmt = (n: number) => Math.round(n).toLocaleString("en-US");

const BigStat: React.FC<{ v: number; age: number }> = ({ v, age }) => {
  if (v <= 0) return null;
  const s = spring({ frame: age, fps: FPS, config: { damping: 13 } });
  const count = interpolate(age, [10, 34], [96000, 79300], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  const arrow = interpolate(age, [6, 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const drop = Math.round(((96000 - count) / 96000) * 100);
  const badge = spring({ frame: age - 34, fps: FPS, config: { damping: 10, stiffness: 180 } });
  return (
    <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", backgroundColor: `rgba(30,20,16,${0.4 * v})` }}>
      <div
        style={{
          fontFamily: FONT, backgroundColor: "#fff", borderRadius: 36, padding: "44px 76px 50px",
          boxShadow: "0 30px 90px rgba(0,0,0,0.3)", opacity: v, transform: `scale(${0.8 + 0.2 * s})`, textAlign: "center",
        }}
      >
        <div style={{ fontSize: 34, fontWeight: 600, color: C.inkSoft, marginBottom: 18 }}>Average flower waste per day</div>
        <div style={{ display: "flex", alignItems: "center", gap: 40, justifyContent: "center" }}>
          <div>
            <div style={{ fontSize: 92, fontWeight: 800, color: C.red, letterSpacing: -2 }}>96,000 ₫</div>
            <div style={{ fontSize: 28, fontWeight: 500, color: C.inkSoft }}>before the app</div>
          </div>
          <svg width="90" height="60" viewBox="0 0 90 60" style={{ opacity: arrow, transform: `translateX(${(arrow - 1) * 30}px)` }}>
            <path d="M5 30 H75 M55 10 L78 30 L55 50" stroke={C.ink} strokeWidth="8" fill="none" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <div>
            <div style={{ fontSize: 92, fontWeight: 800, color: C.green, letterSpacing: -2, fontVariantNumeric: "tabular-nums" }}>{fmt(count)} ₫</div>
            <div style={{ fontSize: 28, fontWeight: 500, color: C.inkSoft }}>last 25 days</div>
          </div>
        </div>
        <div style={{ marginTop: 22, display: "inline-block", fontSize: 30, fontWeight: 800, color: "#fff", backgroundColor: C.green, padding: "8px 22px", borderRadius: 999, opacity: badge, transform: `scale(${0.6 + 0.4 * badge})` }}>
          −{drop}% per day
        </div>
      </div>
    </AbsoluteFill>
  );
};

// Step label + 6-step progress bar, top left
export const SceneChip: React.FC<{ scene: number }> = ({ scene }) => {
  if (scene < 1) return null;
  return (
    <div style={{ position: "absolute", left: 40, top: 26, display: "flex", alignItems: "center", gap: 18 }}>
      <div style={{ fontFamily: FONT, fontWeight: 800, fontSize: 26, letterSpacing: 1.5, color: "#fff", backgroundColor: C.ink, padding: "10px 22px", borderRadius: 999, boxShadow: "0 8px 24px rgba(0,0,0,0.18)" }}>
        <span style={{ color: C.roseSoft }}>{scene}</span>&nbsp;·&nbsp;{SCENE_NAMES[scene]}
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
  <div style={{ position: "absolute", right: 36, top: 30, fontFamily: FONT, fontWeight: 500, fontSize: 22, color: C.inkSoft, backgroundColor: "rgba(255,255,255,0.9)", padding: "8px 16px", borderRadius: 10 }}>
    Sample data for illustration, not pilot results
  </div>
);


// One-shot sound effect placed at a frame of the current sequence
export const SfxAt: React.FC<{ at: number; sfx: Sfx }> = ({ at, sfx }) => (
  <Sequence from={at} layout="none" name={`sfx ${sfx.name}`}>
    <Audio src={staticFile(`sfx/${sfx.name}.mp3`)} volume={sfx.vol} />
  </Sequence>
);

// Counter ticks while 96,000 counts down to 79,300, then a success chime when the count lands
const BigStatSfx: React.FC<{ at: number }> = ({ at }) => (
  <>
    {Array.from({ length: 8 }).map((_, i) => (
      <SfxAt key={i} at={at + 10 + i * 3} sfx={{ name: "tick-001", vol: 0.8 - i * 0.03 }} />
    ))}
    <SfxAt at={at + 34} sfx={{ name: "success-chime", vol: 0.6 }} />
  </>
);
