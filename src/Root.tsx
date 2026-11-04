import { Composition } from "remotion";
import { HelloVideo } from "./HelloVideo";

export const Root = () => (
  <Composition id="HelloVideo" component={HelloVideo} durationInFrames={90} fps={30} width={1080} height={1920} />
);
