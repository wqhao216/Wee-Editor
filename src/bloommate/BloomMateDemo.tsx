import { Audio } from "@remotion/media";
import { TransitionSeries, linearTiming } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import React from "react";
import { AbsoluteFill, interpolate, staticFile, useVideoConfig } from "remotion";
import { BeforeCard, EndCard, Intro } from "./Cards";
import { SHOTS } from "./edl";
import { Shot, shotFrames } from "./Shot";
import { FPS } from "./theme";

const INTRO = Math.round(6.5 * FPS);
const BEFORE = Math.round(2.6 * FPS);
const END = Math.round(6 * FPS);
const T_SCENE = 12; // chuyển bước: hoà tan 0.4s
const T_CUT = 3; // trong cùng bước: hoà tan rất ngắn cho mượt

type Item = { key: string; frames: number; el: React.ReactNode; scene: number };

function buildItems(): Item[] {
  const items: Item[] = [{ key: "intro", frames: INTRO, el: <Intro />, scene: 0 }];
  let lastScene = 0;
  for (const s of SHOTS) {
    if (s.id === "4b-studio") items.push({ key: "before", frames: BEFORE, el: <BeforeCard />, scene: 4 });
    const first = s.scene !== lastScene && !(s.scene === 4);
    items.push({ key: s.id, frames: shotFrames(s), el: <Shot shot={s} first={first} />, scene: s.scene });
    lastScene = s.scene;
  }
  items.push({ key: "end", frames: END, el: <EndCard />, scene: 7 });
  return items;
}

const ITEMS = buildItems();

export const TOTAL_FRAMES = ITEMS.reduce((sum, it, i) => {
  const t = i === 0 ? 0 : ITEMS[i - 1].scene === it.scene ? T_CUT : T_SCENE;
  return sum + it.frames - t;
}, 0);

const Music: React.FC = () => {
  const { durationInFrames } = useVideoConfig();
  return (
    <Audio
      src={staticFile("music.mp3")}
      volume={(f) =>
        0.6 * interpolate(f, [0, 20, durationInFrames - 75, durationInFrames - 5], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
      }
    />
  );
};

export const BloomMateDemo: React.FC = () => (
  <AbsoluteFill style={{ backgroundColor: "#F7F2EB" }}>
    <TransitionSeries>
      {ITEMS.map((it, i) => (
        <React.Fragment key={it.key}>
          {i > 0 ? (
            <TransitionSeries.Transition
              presentation={fade()}
              timing={linearTiming({ durationInFrames: ITEMS[i - 1].scene === it.scene ? T_CUT : T_SCENE })}
            />
          ) : null}
          <TransitionSeries.Sequence name={it.key} durationInFrames={it.frames}>
            {it.el}
          </TransitionSeries.Sequence>
        </React.Fragment>
      ))}
    </TransitionSeries>
    <Music />
  </AbsoluteFill>
);
