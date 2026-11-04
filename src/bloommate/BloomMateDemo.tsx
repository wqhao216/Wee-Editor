import { Audio } from "@remotion/media";
import React from "react";
import { AbsoluteFill, Sequence, interpolate, staticFile, useVideoConfig } from "remotion";
import { BeforeCard, EndCard, Intro, SceneTitle, TITLE_PAD } from "./Cards";
import { SEG_STARTS, TIMELINE, TOTAL_BEATS } from "./edl";
import { Shot } from "./Shot";


const B = 15; // frames per beat
export const TOTAL_FRAMES = TOTAL_BEATS * B;

const Music: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <Audio
      src={staticFile("music.mp3")}
      volume={(f) => 0.8 * interpolate(f, [durationInFrames - 20, durationInFrames], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })}
    />
  );
};

export const BloomMateDemo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#F7F2EB" }}>
    {/* Base layer: intro, shots, cards. Every segment starts on a beat. */}
    {TIMELINE.map((seg, i) => {
      if (seg.kind === "title") return null;
      const from = SEG_STARTS[i] * B;
      const dur = seg.beats * B;
      const el =
        seg.kind === "intro" ? <Intro /> :
        seg.kind === "before" ? <BeforeCard /> :
        seg.kind === "end" ? <EndCard /> :
        <Shot shot={seg.shot} />;
      return (
        <Sequence key={i} from={from} durationInFrames={dur} name={seg.kind === "shot" ? seg.shot.id : seg.kind}>
          {el}
        </Sequence>
      );
    })}
    {/* Top layer: scene title wipes, overlapping the cut on both sides */}
    {TIMELINE.map((seg, i) =>
      seg.kind === "title" ? (
        <Sequence key={`t${i}`} from={SEG_STARTS[i] * B - TITLE_PAD} durationInFrames={seg.beats * B + 2 * TITLE_PAD} name={`title ${seg.scene}`}>
          <SceneTitle scene={seg.scene} />
        </Sequence>
      ) : null,
    )}
    <Music />
  </AbsoluteFill>
);

