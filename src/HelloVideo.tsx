import { AbsoluteFill, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";

// Video mẫu 3 giây, khổ dọc 1080x1920 (TikTok/Reels/Shorts)
export const HelloVideo = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 12 } });
  const opacity = interpolate(frame, [60, 90], [1, 0], { extrapolateLeft: "clamp" });
  return (
    <AbsoluteFill style={{ background: "linear-gradient(160deg,#1e1b4b,#7c3aed)", justifyContent: "center", alignItems: "center", opacity }}>
      <h1 style={{ color: "white", fontSize: 140, fontFamily: "sans-serif", transform: `scale(${scale})` }}>Video Studio</h1>
    </AbsoluteFill>
  );
};
