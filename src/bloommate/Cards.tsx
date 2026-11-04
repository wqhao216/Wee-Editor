import { Video } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { Backdrop, SceneChip } from "./Shot";
import { C, FONT, FPS } from "./theme";

const fadeUp = (frame: number, at: number, dur = 10) => {
  const p = interpolate(frame, [at, at + dur], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
  return { opacity: p, transform: `translateY(${(1 - p) * 28}px)` };
};

const Mascot: React.FC<{ size: number }> = ({ size }) => (
  <div style={{ width: size, height: size, borderRadius: size / 2, overflow: "hidden", background: "#F3E8D8", boxShadow: "0 18px 50px rgba(120,70,60,0.25)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}>
    <Img src={staticFile("mascot.png")} style={{ height: size * 0.92 }} />
  </div>
);

// Mở đầu: nền là màn hình app làm mờ, hai thẻ chữ
export const Intro: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const split = Math.round(3.3 * fps);
  const out1 = interpolate(frame, [split - 8, split], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  const f2 = frame - split;
  const pop = spring({ frame: f2, fps, config: { damping: 14 } });
  const counter = Math.round(interpolate(frame, [6, 30], [0, 30], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) }));
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ filter: "blur(16px)", transform: `scale(${1.08 + frame / 2000})` }}>
        <Video src={staticFile("source.mp4")} trimBefore={0} playbackRate={0.24} muted style={{ width: "100%", height: "100%", objectFit: "cover" }} />
      </AbsoluteFill>
      <AbsoluteFill style={{ backgroundColor: "rgba(247,242,235,0.78)" }} />
      {frame < split ? (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: FONT, color: C.ink, opacity: out1 }}>
          <div style={{ fontSize: 44, fontWeight: 600, color: C.inkSoft, ...fadeUp(frame, 0) }}>Mỗi tháng, tiệm hoa nhỏ bỏ đi</div>
          <div style={{ fontSize: 210, fontWeight: 800, color: C.rose, letterSpacing: -6, lineHeight: 1.05, ...fadeUp(frame, 4) }}>
            10–{counter}%
          </div>
          <div style={{ fontSize: 56, fontWeight: 700, ...fadeUp(frame, 12) }}>tiền nhập hoa</div>
        </AbsoluteFill>
      ) : (
        <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: FONT, color: C.ink }}>
          <div style={{ transform: `scale(${0.6 + 0.4 * pop})`, opacity: pop }}>
            <Mascot size={230} />
          </div>
          <div style={{ fontSize: 120, fontWeight: 800, letterSpacing: -3, marginTop: 26, ...fadeUp(f2, 6) }}>BloomMate</div>
          <div style={{ fontSize: 46, fontWeight: 600, color: C.inkSoft, ...fadeUp(f2, 12) }}>Giảm hao hụt cho tiệm hoa nhỏ</div>
        </AbsoluteFill>
      )}
    </AbsoluteFill>
  );
};

// Trước cảnh studio: cho thấy ảnh gốc chụp tại tiệm
export const BeforeCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame, fps, config: { damping: 16 } });
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", flexDirection: "row", gap: 80, fontFamily: FONT }}>
        <div style={{ height: 820, borderRadius: 28, overflow: "hidden", boxShadow: "0 30px 80px rgba(60,40,30,0.22)", transform: `translateY(${(1 - p) * 60}px) rotate(${-2 + p * 0}deg)`, opacity: p }}>
          <Img src={staticFile("before.jpg")} style={{ height: 820 }} />
        </div>
        <div style={{ width: 800, color: C.ink }}>
          <div style={{ fontSize: 34, fontWeight: 700, color: C.rose, letterSpacing: 2, ...fadeUp(frame, 6) }}>ẢNH GỐC</div>
          <div style={{ fontSize: 72, fontWeight: 800, lineHeight: 1.1, marginTop: 10, ...fadeUp(frame, 10) }}>Chụp bó hoa vừa làm</div>
          <div style={{ fontSize: 40, fontWeight: 500, color: C.inkSoft, marginTop: 22, lineHeight: 1.35, ...fadeUp(frame, 18) }}>App tách nền, đổi nền và in tên bó lên ảnh.</div>
        </div>
      </AbsoluteFill>
      <SceneChip scene={4} frame={frame} />
    </AbsoluteFill>
  );
};

const FLOW = ["Kiểm tối", "Nhập hàng", "Làm combo", "Ảnh & caption", "Kho hoa", "Báo cáo"];

export const EndCard: React.FC = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const pop = spring({ frame: frame - 4, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill>
      <Backdrop />
      <AbsoluteFill style={{ justifyContent: "center", alignItems: "center", fontFamily: FONT, color: C.ink }}>
        <div style={{ transform: `scale(${0.6 + 0.4 * pop})`, opacity: pop }}>
          <Mascot size={210} />
        </div>
        <div style={{ fontSize: 112, fontWeight: 800, letterSpacing: -3, marginTop: 22, ...fadeUp(frame, 8) }}>BloomMate</div>
        <div style={{ fontSize: 50, fontWeight: 600, fontStyle: "italic", color: C.rose, marginTop: 4, ...fadeUp(frame, 14) }}>Bớt hoa héo, thêm tiền lời.</div>
        <div style={{ display: "flex", gap: 14, marginTop: 56, alignItems: "center" }}>
          {FLOW.map((s, i) => (
            <React.Fragment key={s}>
              <div style={{ fontSize: 28, fontWeight: 600, padding: "12px 22px", borderRadius: 999, backgroundColor: "#fff", boxShadow: "0 6px 18px rgba(60,40,30,0.10)", ...fadeUp(frame, 22 + i * 4, 8) }}>
                {s}
              </div>
              {i < FLOW.length - 1 ? <div style={{ width: 22, height: 3, borderRadius: 2, backgroundColor: C.rose, ...fadeUp(frame, 24 + i * 4, 8) }} /> : null}
            </React.Fragment>
          ))}
        </div>
        <div style={{ position: "absolute", bottom: 40, fontSize: 24, fontWeight: 500, color: C.inkSoft, ...fadeUp(frame, 40) }}>
          Demo MVP · dữ liệu mẫu
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
