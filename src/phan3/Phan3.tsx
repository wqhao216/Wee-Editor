// Composition Phần 3 (1920×1080, 30 fps, 170s). Chặng 2: hệ thống thiết kế + khung dựng theo
// edl.json/cues.json để render style frame. Chi tiết còn lại (ripple, pulse, badge, âm thanh)
// ghép ở chặng 3.
import React from "react";
import { AbsoluteFill, getInputProps } from "remotion";
import { B8_ANSWER_REDO, CAMERA, CHAPTERS, HEADLINES, STEP_OF, WIPES } from "./data";
import { DUR, EASE } from "./tokens";
import { prog, useT } from "./components/anim";
import { Background } from "./components/Background";
import { AccentCover, ChapterCard, ChapterWipe } from "./components/Chapter";
import { BigCard, ChipLayer } from "./components/Chip";
import { FlowDiagram } from "./components/FlowDiagram";
import { Headline } from "./components/Headline";
import { QaProbe } from "./components/QaProbe";
import { Counter } from "./components/Overlays";
import { ScreenCard } from "./components/ScreenCard";
import { StepPill } from "./components/StepPill";
import { Subtitles } from "./components/Subtitles";
import { punchProgress, sceneAt } from "./timeline";
import { FontGate } from "./fonts";

const S00_TO_B1 = (WIPES[0].t_in + WIPES[0].t_out) / 2; // đổi layout lúc dải che kín
const B7_TO_B8 = (WIPES[1].t_in + WIPES[1].t_out) / 2;
const B8_LAYOUT = 143.0;
const FLOW_AT = 164.0;
const R_AT = 167.0;

/** Khối chữ trái ẩn khi punchIn (textOut 250ms), hiện lại 200ms cuối punchOut. */
const textVisibility = (t: number) => {
  for (const c of CAMERA) {
    if (t < c.t_in || t > c.t_out) continue;
    if (t < c.t_in + DUR.textOut) return 1 - prog(t, c.t_in, DUR.textOut, EASE.inCubic);
    if (t > c.t_out - DUR.punchOutTextIn) return prog(t, c.t_out - DUR.punchOutTextIn, DUR.punchOutTextIn);
    return 0;
  }
  return 1;
};

const stepScene = (t: number) => {
  const scene = sceneAt(t);
  if (!HEADLINES[scene.id] || t < S00_TO_B1 || (t >= B7_TO_B8 && t < B8_LAYOUT) || t >= R_AT) return null;
  return { scene, tIn: scene.id === "B8" ? B8_LAYOUT : scene.start };
};

/** Khối chữ trái (dưới card: card nở ra che khi punchIn). */
const HeadlineLayer: React.FC = () => {
  const t = useT();
  const s = stepScene(t);
  if (!s) return null;
  const h = HEADLINES[s.scene.id];
  const outAt = s.scene.id === "B8" ? FLOW_AT : s.scene.end - DUR.textOut;
  const vis = textVisibility(t);
  return <Headline q={h.q} a={h.a} hl={h.hl} sub={h.sub} t={t} tIn={s.tIn} subIn={s.tIn + 0.8} outAt={outAt} visibility={vis} visBlur={10 * (1 - vis)} hlRedoAt={s.scene.id === "B8" ? B8_ANSWER_REDO : undefined} />;
};

/** Pill bước: trên card, giữ nguyên khi punchIn (plan 2.5). */
const PillLayer: React.FC = () => {
  const t = useT();
  const s = stepScene(t);
  if (!s) return null;
  return <StepPill step={STEP_OF[s.scene.id]} t={t} tIn={s.tIn} backing={punchProgress(t, EASE.camera).p} />;
};

const ChapterLayer: React.FC = () => {
  const t = useT();
  if (t < S00_TO_B1) {
    return <ChapterCard lines={CHAPTERS.S00.lines} sub={CHAPTERS.S00.sub} t={t} tIn={0.3} subIn={1.6} dotsIn={1.8} />;
  }
  if (t >= B7_TO_B8 && t < B8_LAYOUT) {
    return <ChapterCard lines={CHAPTERS.B8.lines} t={t} tIn={141.0} outAt={B8_LAYOUT - DUR.textOut} />;
  }
  if (t >= R_AT) {
    return (
      <>
        <AccentCover t={t} t_in={R_AT} fadeAt={169.6} />
        <ChapterCard lines={CHAPTERS.R.lines} size={92} t={t} tIn={R_AT + 0.1} lineDelays={[0, 0.5]} hlColor="#FFFFFF" outAt={169.6} />
      </>
    );
  }
  return null;
};

const CounterLayer: React.FC = () => <Counter t={useT()} />;

const Wipes: React.FC = () => {
  const t = useT();
  return <>{WIPES.map((w, i) => <ChapterWipe key={i} t={t} t_in={w.t_in} t_out={w.t_out} />)}</>;
};

export const Phan3: React.FC = () => {
  const qa = Boolean((getInputProps() as { qa?: boolean }).qa);
  return (
    <AbsoluteFill>
      <FontGate>
        <Background />
        <HeadlineLayer />
        <ScreenCard />
        <ChipLayer />
        <BigCard />
        <PillLayer />
        <CounterLayer />
        <FlowDiagram />
        <ChapterLayer />
        <Wipes />
        <Subtitles />
        {qa ? <QaProbe /> : null}
      </FontGate>
    </AbsoluteFill>
  );
};
