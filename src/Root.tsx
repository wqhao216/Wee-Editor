import { Composition } from "remotion";
import { HelloVideo } from "./HelloVideo";
import { BloomMateDemo, TOTAL_FRAMES } from "./bloommate/BloomMateDemo";
import { FPS, H, W } from "./bloommate/theme";

export const Root = () => (
  <>
    <Composition id="BloomMateDemo" component={BloomMateDemo} durationInFrames={TOTAL_FRAMES} fps={FPS} width={W} height={H} />
    <Composition id="HelloVideo" component={HelloVideo} durationInFrames={90} fps={30} width={1080} height={1920} />
  </>
);
