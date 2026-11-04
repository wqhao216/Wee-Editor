import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, random, spring, staticFile, useCurrentFrame } from "remotion";
import { SCENE_TITLES } from "./edl";
import { Backdrop, SfxAt } from "./Shot";
import { C, FONT, FPS, H, W } from "./theme";

const B = 15; // frames per beat (120 BPM at 30 fps)
const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;
const outC = Easing.out(Easing.cubic);
const inC = Easing.in(Easing.cubic);

// A word that pops in on a given frame (spring scale + rise)
const Pop: React.FC<{ at: number; children: React.ReactNode; style?: React.CSSProperties; from?: number }> = ({ at, children, style, from = 0.4 }) => {
  const frame = useCurrentFrame();
  const s = spring({ frame: frame - at, fps: FPS, config: { damping: 12, stiffness: 180 } });
  return (
    <span style={{ display: "inline-block", opacity: Math.min(1, s * 2), transform: `translateY(${(1 - s) * 40}px) scale(${from + (1 - from) * s})`, ...style }}>
      {children}
    </span>
  );
};

// Falling petals, deterministic
export const Petals: React.FC<{ count?: number; seed?: string; opacity?: number }> = ({ count = 26, seed = "p", opacity = 1 }) => {
  const frame = useCurrentFrame();
  const colors = ["#F2B8C9", "#E98FAB", "#FFFFFF", "#F6D7A8", "#CFE0BC"];
  return (
    <AbsoluteFill style={{ pointerEvents: "none", opacity }}>
      {Array.from({ length: count }).map((_, i) => {
        const r = (k: string) => random(`${seed}-${i}-${k}`);
        const speed = 1.2 + r("s") * 2.2;
        const size = 18 + r("z") * 26;
        const x0 = r("x") * W;
        const y = ((r("y") * (H + 200) + frame * speed) % (H + 200)) - 100;
        const sway = Math.sin(frame / (18 + r("w") * 20) + r("p") * 6) * (30 + r("a") * 50);
        const rot = frame * (r("r") - 0.5) * 6 + r("o") * 360;
        return (
          <svg key={i} width={size} height={size} viewBox="0 0 20 20" style={{ position: "absolute", left: x0 + sway, top: y, transform: `rotate(${rot}deg)`, opacity: 0.55 + r("t") * 0.4 }}>
            <path d="M10 1 C16 6 16 14 10 19 C4 14 4 6 10 1 Z" fill={colors[i % colors.length]} />
          </svg>
        );
      })}
    </AbsoluteFill>
  );
};

const Mascot: React.FC<{ size: number }> = ({ size }) => (
  <div style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", background: "#F3E8D8", boxShadow: "0 18px 50px rgba(120,70,60,0.25)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
    <Img src={staticFile("mascot.png")} style={{ height: size * 0.92 }} />
  </div>
);

const Letters: React.FC<{ text: string; at: number; style: React.CSSProperties }> = ({ text, at, style }) => (
  <div style={style}>
    {text.split("").map((ch, i) => (
      <Pop key={i} at={at + i * 1.5} from={0.2}>{ch}</Pop>
    ))}
  </div>
);

// ---------- INTRO (16 beats) ----------
export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const phaseB = 8 * B;
  const outA = interpolate(frame, [phaseB - 6, phaseB], [1, 0], clamp);
  const zoomA = interpolate(frame, [phaseB - 6, phaseB], [1, 1.25], { ...clamp, easing: inC });
  const counter = Math.round(interpolate(frame, [4 * B, 4 * B + 12], [10, 30], { ...clamp, easing: outC }));
  const slam = spring({ frame: frame - 4 * B, fps: FPS, config: { damping: 9, stiffness: 200 } });
  const shake = frame >= 4 * B && frame < 4 * B + 8 ? Math.sin(frame * 3.1) * (8 - (frame - 4 * B)) : 0;
  const flash = interpolate(frame, [phaseB, phaseB + 8], [0.9, 0], clamp);
  const fB = frame - phaseB;
  const mascot = spring({ frame: fB, fps: FPS, config: { damping: 10, stiffness: 150 } });
  const breathe = 1 + 0.015 * Math.sin((frame / B) * Math.PI);
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: "blur(16px)", transform: `scale(${1.08 + frame / 1800})` }}>
        <Video src={staticFile("source.mp4")} trimBefore={0} playbackRate={0.2} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "rgba(247,242,235,0.8)" }} />
      <Petals seed="intro" opacity={interpolate(frame, [0, 20], [0, 1], clamp)} />
      {frame < phaseB ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: FONT, color: C.ink, opacity: outA, transform: `scale(${zoomA})` }}>
          <div style={{ fontSize: 58, fontWeight: 700, color: C.inkSoft, display: "flex", gap: 16 }}>
            <Pop at={0}>Small</Pop><Pop at={4}>flower</Pop><Pop at={8}>shops</Pop>
            <Pop at={2 * B} style={{ color: C.ink }}>throw</Pop><Pop at={2 * B + 4} style={{ color: C.ink }}>away</Pop>
          </div>
          <div style={{ fontSize: 230, fontWeight: 800, color: C.rose, letterSpacing: -7, lineHeight: 1.05, opacity: frame >= 4 * B ? 1 : 0, transform: `scale(${2.2 - 1.2 * slam}) translateX(${shake}px)` }}>
            10–{counter}%
          </div>
          <div style={{ fontSize: 60, fontWeight: 700, display: "flex", gap: 16 }}>
            <Pop at={6 * B}>of</Pop><Pop at={6 * B + 3}>the</Pop><Pop at={6 * B + 6}>flowers</Pop><Pop at={6 * B + 9}>they</Pop><Pop at={6 * B + 12}>buy.</Pop>
          </div>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: FONT, color: C.ink, transform: `scale(${breathe})` }}>
          <div style={{ fontSize: 40, fontWeight: 700, color: C.rose, letterSpacing: 6, marginBottom: 14 }}>
            <Pop at={phaseB}>MEET</Pop>
          </div>
          <div style={{ transform: `scale(${0.3 + 0.7 * mascot}) rotate(${(1 - mascot) * -25}deg)`, opacity: Math.min(1, mascot * 2) }}>
            <Mascot size={230} />
          </div>
          <Letters text="BloomMate" at={phaseB + 6} style={{ fontSize: 130, fontWeight: 800, letterSpacing: -3, marginTop: 20 }} />
          <div style={{ fontSize: 46, fontWeight: 600, color: C.inkSoft, display: "flex", gap: 14 }}>
            {"Less waste for small flower shops".split(" ").map((w, i) => (
              <Pop key={i} at={phaseB + 2 * B + i * 3}>{w}</Pop>
            ))}
          </div>
        </AbsoluteFill>
      )}
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: frame >= phaseB ? flash : 0 }} />
      <SfxAt at={4 * B} sfx={{ name: "impact-soft-heavy-000", vol: 0.8 }} />
    </AbsoluteFill>
  );
};

// ---------- SCENE TITLE (2 beats + 8 frames of wipe on each side) ----------
export const TITLE_PAD = 8;
export const SceneTitle: React.FC<{ scene: number }> = ({ scene }) => {
  const frame = useCurrentFrame();
  const info = SCENE_TITLES[scene]!;
  const total = 2 * B + 2 * TITLE_PAD;
  const inP = interpolate(frame, [0, TITLE_PAD], [0, 1], { ...clamp, easing: outC });
  const outP = interpolate(frame, [total - TITLE_PAD, total], [0, 1], { ...clamp, easing: inC });
  const panelX = interpolate(inP, [0, 1], [-1.6, 0]) + outP * 1.6; // in widths
  const stripeX = interpolate(interpolate(frame, [2, TITLE_PAD + 2], [0, 1], { ...clamp, easing: outC }), [0, 1], [-1.6, 0]) + outP * 1.6;
  const txt = spring({ frame: frame - 5, fps: FPS, config: { damping: 13, stiffness: 170 } });
  const txtOut = interpolate(frame, [total - TITLE_PAD - 4, total - 2], [0, 1], { ...clamp, easing: inC });
  const num = String(scene).padStart(2, "0");
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <div style={{ position: "absolute", top: -100, bottom: -100, left: "-20%", width: "140%", backgroundColor: C.cream, transform: `translateX(${stripeX * 100}%) skewX(-12deg)` }} />
      <div style={{ position: "absolute", top: -100, bottom: -100, left: "-20%", width: "140%", backgroundColor: info.color, transform: `translateX(${panelX * 100}%) skewX(-12deg)` }} />
      <AbsoluteFill style={{ justifyContent: "center", paddingLeft: 170, fontFamily: FONT, color: "#fff", opacity: Math.min(inP * 2, 1) * (1 - txtOut), transform: `translateX(${(1 - txt) * 120 - txtOut * 160}px)` }}>
        <div style={{ position: "absolute", right: 120, top: 120, fontSize: 420, fontWeight: 800, color: "transparent", WebkitTextStroke: "4px rgba(255,255,255,0.35)", lineHeight: 1 }}>{num}</div>
        <div style={{ fontSize: 34, fontWeight: 700, letterSpacing: 6, opacity: 0.85 }}>STEP {scene} OF 6</div>
        <div style={{ fontSize: 140, fontWeight: 800, letterSpacing: -3, lineHeight: 1.05, marginTop: 6 }}>{info.name}</div>
        <div style={{ fontSize: 48, fontWeight: 600, opacity: 0.9, marginTop: 14 }}>{info.sub}</div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// ---------- ORIGINAL PHOTO card (4 beats) ----------
export const BeforeCard: React.FC = () => {
  const frame = useCurrentFrame();
  const p = spring({ frame, fps: FPS, config: { damping: 14, stiffness: 150 } });
  const scan = interpolate(frame, [20, 52], [0, 1], { ...clamp, easing: Easing.inOut(Easing.quad) });
  const photoH = 820;
  return (
    <AbsoluteFill>
      <Backdrop />
      <Petals seed="before" count={14} opacity={0.6} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 90, fontFamily: FONT }}>
        <div style={{ position: "relative", height: photoH, borderRadius: 28, overflow: "hidden", boxShadow: "0 30px 80px rgba(60,40,30,0.22)", transform: `translateY(${(1 - p) * 120}px) rotate(${(1 - p) * -8 - 2}deg)`, opacity: Math.min(1, p * 2) }}>
          <Img src={staticFile("before.jpg")} style={{ height: photoH, display: "block" }} />
          {scan > 0 && scan < 1 ? (
            <div style={{ position: "absolute", left: 0, right: 0, top: scan * photoH - 3, height: 6, background: C.rose, boxShadow: `0 0 30px 12px ${C.roseSoft}` }} />
          ) : null}
          <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: scan * photoH, backgroundColor: "rgba(201,86,122,0.10)" }} />
        </div>
        <div style={{ width: 760, color: C.ink }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: C.rose, letterSpacing: 4 }}><Pop at={4}>ORIGINAL PHOTO</Pop></div>
          <div style={{ fontSize: 80, fontWeight: 800, lineHeight: 1.1, marginTop: 10 }}><Pop at={8}>Snap the bouquet</Pop></div>
          <div style={{ fontSize: 40, fontWeight: 500, color: C.inkSoft, marginTop: 22, lineHeight: 1.35 }}>
            <Pop at={16}>The app removes the background, restyles it and adds the name.</Pop>
          </div>
        </div>
      </AbsoluteFill>
      <SfxAt at={20} sfx={{ name: "power-up-1", vol: 0.45 }} />
    </AbsoluteFill>
  );
};

// ---------- END CARD (16 beats) ----------
const FLOW = ["Evening check", "Restock", "Combos", "Photo & caption", "Stock", "Report"];

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const mascot = spring({ frame, fps: FPS, config: { damping: 10, stiffness: 150 } });
  const flash = interpolate(frame, [0, 8], [0.8, 0], clamp);
  const fadeOut = interpolate(frame, [16 * B - 14, 16 * B], [1, 0], clamp);
  const breathe = 1 + 0.012 * Math.sin((frame / B) * Math.PI);
  const words1 = ["Less", "Flower", "Power,"];
  const words2 = ["More", "Flower", "Hours"];
  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Backdrop />
      <Petals seed="end" count={30} />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: FONT, color: C.ink, transform: `scale(${breathe})` }}>
        <div style={{ transform: `scale(${0.3 + 0.7 * mascot}) rotate(${(1 - mascot) * 25}deg)`, opacity: Math.min(1, mascot * 2) }}>
          <Mascot size={200} />
        </div>
        <Letters text="BloomMate" at={4} style={{ fontSize: 120, fontWeight: 800, letterSpacing: -3, marginTop: 16 }} />
        <div style={{ fontSize: 66, fontWeight: 800, fontStyle: "italic", marginTop: 6, display: "flex", gap: 20 }}>
          {words1.map((w, i) => (
            <Pop key={w + i} at={2 * B + i * B} style={{ color: C.inkSoft }}>{w}</Pop>
          ))}
          {words2.map((w, i) => (
            <Pop key={w + i} at={5 * B + i * B} style={{ color: C.rose }}>{w}</Pop>
          ))}
        </div>
        <div style={{ display: "flex", gap: 12, marginTop: 54, alignItems: "center" }}>
          {FLOW.map((s, i) => (
            <React.Fragment key={s}>
              <Pop at={8 * B + i * 3}>
                <span style={{ display: "inline-block", fontSize: 28, fontWeight: 600, padding: "12px 22px", borderRadius: 999, backgroundColor: "#fff", boxShadow: "0 6px 18px rgba(60,40,30,0.10)" }}>{s}</span>
              </Pop>
              {i < FLOW.length - 1 ? <Pop at={8 * B + i * 3 + 2}><span style={{ display: "inline-block", width: 20, height: 3, borderRadius: 2, backgroundColor: C.rose }} /></Pop> : null}
            </React.Fragment>
          ))}
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", bottom: 40, left: 0, right: 0, textAlign: "center", fontFamily: FONT, fontSize: 24, fontWeight: 500, color: C.inkSoft }}>
        <Pop at={10 * B}>MVP demo · sample data</Pop>
      </div>
      <AbsoluteFill style={{ backgroundColor: "#fff", opacity: flash }} />
      <SfxAt at={7 * B} sfx={{ name: "jingles-steel-13", vol: 0.4 }} />
    </AbsoluteFill>
  );
};
