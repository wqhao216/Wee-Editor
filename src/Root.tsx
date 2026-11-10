import { Composition } from "remotion";
import { HelloVideo } from "./HelloVideo";
import { Phan3 } from "./phan3/Phan3";

export const Root = () => (
  <>
    <Composition id="HelloVideo" component={HelloVideo} durationInFrames={90} fps={30} width={1080} height={1920} />
    <Composition id="Phan3" component={Phan3} durationInFrames={170 * 30} fps={30} width={1920} height={1080} />
  </>
);
