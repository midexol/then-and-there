import { Composition } from "remotion";
import { Demo } from "./Demo";
import timeline from "./timeline.json";

const common = { fps: timeline.fps, width: 1920, height: 1080, durationInFrames: timeline.total } as const;

export const Root = () => (
  <>
    {/* With an energetic voiceover (Microsoft neural voice) and the soundtrack under it. */}
    <Composition id="Demo" component={Demo} {...common} defaultProps={{ voice: true }} />
    {/* Soundtrack and captions only, for recording your own voice over the same timings. */}
    <Composition id="DemoNoVoice" component={Demo} {...common} defaultProps={{ voice: false }} />
  </>
);
