import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import timeline from "./timeline.json";
import { BODY, C, DISPLAY, loadFonts } from "./theme";
import { Backdrop, Headline, Logo, Phone, Pill, Slides, Tap, ease, phoneWidth } from "./ui";

loadFonts();

const W = 1920;
const H = 1080;
const PHONE_H = 940;
const PHONE_TOP = (H - PHONE_H) / 2;
const PHONE_RIGHT = 150;
const TEXT_LEFT = 140;

const scene = (id: string) => timeline.scenes.find((s) => s.id === id)!;

/** Fades a scene in and out so the cuts feel soft. */
const Fade = ({ dur, children }: { dur: number; children: React.ReactNode }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [0, 10, dur - 10, dur], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity: o }}>{children}</AbsoluteFill>;
};

/** A phone that slides in from the right and settles. */
const PhoneIn = ({ children, delay = 4 }: { children: React.ReactNode; delay?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 16, stiffness: 90 } });
  return (
    <div style={{ position: "absolute", right: PHONE_RIGHT, top: PHONE_TOP, transform: `translateX(${(1 - s) * 260}px) rotate(${(1 - s) * 4}deg)`, opacity: s }}>
      {children}
    </div>
  );
};

const TextCol = ({ children }: { children: React.ReactNode }) => (
  <div style={{ position: "absolute", left: TEXT_LEFT, top: 0, bottom: 0, width: 900, display: "flex", flexDirection: "column", justifyContent: "center" }}>{children}</div>
);

const Hook = ({ dur }: { dur: number }) => {
  const frame = useCurrentFrame();
  const back = interpolate(frame, [0, dur], [0, 150], { easing: ease });
  const s = spring({ frame, fps: timeline.fps, config: { damping: 14, stiffness: 80 } });
  return (
    <Fade dur={dur}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ transform: `scale(${0.7 + 0.3 * s})`, opacity: s, marginBottom: 40 }}>
          <Logo size={260} back={back} />
        </div>
        <Headline title="Where do you even [[start]]?" sub="A really good half hour with someone you love." width={1500} size={112} delay={10} />
      </div>
    </Fade>
  );
};

const Setup = ({ dur }: { dur: number }) => (
  <Fade dur={dur}>
    <TextCol>
      <Headline title="Three things [[she loved]]." sub="Roughly when she was born, and where she grew up." />
      <div style={{ marginTop: 44 }}>
        {["1940s", "Mexico City", "Pedro Infante", "bolero", "tamales"].map((t, i) => (
          <Pill key={t} delay={40 + i * 9} gold={i < 2}>
            {t}
          </Pill>
        ))}
      </div>
    </TextCol>
    <PhoneIn>
      <Slides list={["landing", "examples"]} frames={dur} height={PHONE_H} />
    </PhoneIn>
  </Fade>
);

const BUILD_FRAMES = Array.from({ length: 17 }, (_, i) => `build-${String(i).padStart(2, "0")}`);

const Build = ({ dur }: { dur: number }) => (
  <Fade dur={dur}>
    <TextCol>
      <Headline title="Qloo finds [[her world]]." sub="Songs, places, tastes and films from her teenage years." />
      <div style={{ marginTop: 40, fontSize: 28, color: C.soft, opacity: 0.8 }}>A real build from the live app, sped up.</div>
    </TextCol>
    <PhoneIn>
      <Slides list={BUILD_FRAMES} frames={dur - 10} height={PHONE_H} fade={3} />
    </PhoneIn>
  </Fade>
);

const Plan = ({ dur }: { dur: number }) => {
  const frame = useCurrentFrame();
  const scroll = interpolate(frame, [24, dur - 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <Fade dur={dur}>
      <TextCol>
        <Headline title="Eight items. Every one [[from Qloo]]." sub="Each with a reason why, and a question to start talking." />
        <div style={{ marginTop: 44 }}>
          <Pill gold delay={50}>
            From Qloo
          </Pill>
          <Pill delay={62}>Why this?</Pill>
          <Pill delay={74}>Suggested question</Pill>
        </div>
      </TextCol>
      <PhoneIn>
        <Phone shot="plan-full" height={PHONE_H} scroll={scroll} scrollTo={0.5} />
      </PhoneIn>
    </Fade>
  );
};

const STAGE_SHOTS = ["stage-1", "stage-1-answered", "stage-2", "stage-2-answered", "stage-3", "stage-3-answered", "stage-4", "stage-4-answered"];
// where the answer button sits on each screen (fraction across the screen): Yes, A little, Yes, Yes
const ANSWER_X = [0.19, 0.5, 0.19, 0.19];

const Stage = ({ dur }: { dur: number }) => {
  const each = dur / STAGE_SHOTS.length;
  const bezel = PHONE_H * 0.018;
  const innerH = PHONE_H - bezel * 2;
  const innerW = (innerH * 390) / 844;
  const left = W - PHONE_RIGHT - phoneWidth(PHONE_H) + bezel + (phoneWidth(PHONE_H) - bezel * 2 - innerW) / 2;
  return (
    <Fade dur={dur}>
      <TextCol>
        <Headline title="Then you sit [[together]]." sub="One item at a time, full screen, at her pace." />
        <div style={{ marginTop: 44 }}>
          <Pill delay={50}>Yes</Pill>
          <Pill delay={60}>A little</Pill>
          <Pill delay={70}>Not really</Pill>
        </div>
      </TextCol>
      <PhoneIn>
        <Slides list={STAGE_SHOTS} frames={dur} height={PHONE_H} fade={4} />
      </PhoneIn>
      {ANSWER_X.map((x, k) => (
        <Tap key={k} x={left + x * innerW} y={PHONE_TOP + bezel + 0.805 * innerH} at={Math.round(each * (2 * k + 1) - 6)} />
      ))}
    </Fade>
  );
};

const Review = ({ dur }: { dur: number }) => {
  const frame = useCurrentFrame();
  const scroll = interpolate(frame, [30, dur - 14], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <Fade dur={dur}>
      <TextCol>
        <Headline title="What sparked shapes [[next time]]." sub="Pedro Infante sparked, so we lean right in." />
      </TextCol>
      <PhoneIn>
        <Phone shot="review-full" height={PHONE_H} scroll={scroll} scrollTo={0.4} />
      </PhoneIn>
    </Fade>
  );
};

const World = ({ dur }: { dur: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const H2 = 640;
  const people = [
    { shot: "plan-top", label: "Mexico City", sub: "born in the 1940s" },
    { shot: "plan-ken-top", label: "Liverpool", sub: "born in the 1940s" },
    { shot: "plan-adunni-top", label: "Ibadan", sub: "born in the 1950s" },
  ];
  const gap = 150;
  const total = people.length * phoneWidth(H2) + (people.length - 1) * gap;
  return (
    <Fade dur={dur}>
      <div style={{ position: "absolute", top: 70, left: 0, right: 0, display: "flex", justifyContent: "center", textAlign: "center" }}>
        <Headline title="[[Anywhere]] in the world." width={1500} size={96} />
      </div>
      <div style={{ position: "absolute", top: 250, left: (W - total) / 2, display: "flex", gap }}>
        {people.map((p, i) => {
          const s = spring({ frame: frame - (14 + i * 14), fps, config: { damping: 15, stiffness: 90 } });
          return (
            <div key={p.shot} style={{ width: phoneWidth(H2), opacity: s, transform: `translateY(${(1 - s) * 90}px)`, textAlign: "center" }}>
              <Phone shot={p.shot} height={H2} />
              <div style={{ marginTop: 26, fontFamily: DISPLAY, fontSize: 44, color: C.white }}>{p.label}</div>
              <div style={{ fontSize: 28, color: C.soft }}>{p.sub}</div>
            </div>
          );
        })}
      </div>
    </Fade>
  );
};

const Close = ({ dur }: { dur: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame, fps, config: { damping: 14, stiffness: 80 } });
  const rise = (d: number) => interpolate(frame - d, [0, 20], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return (
    <Fade dur={dur}>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 36, transform: `scale(${0.8 + 0.2 * s})`, opacity: s }}>
          <Logo size={200} />
          <div style={{ fontFamily: DISPLAY, fontSize: 168, color: C.white, lineHeight: 1 }}>then &amp; there</div>
        </div>
        <div style={{ marginTop: 40, fontSize: 52, color: C.gold, opacity: rise(18), transform: `translateY(${(1 - rise(18)) * 24}px)` }}>Bring back the world they grew up in.</div>
        <div style={{ marginTop: 56, opacity: rise(34) }}>
          <Pill gold>Powered by Qloo</Pill>
          <Pill>then-and-there-lime.vercel.app</Pill>
          <Pill>Open source · MIT</Pill>
        </div>
        <div style={{ marginTop: 36, fontFamily: BODY, fontSize: 26, color: C.soft, opacity: rise(46) * 0.8 }}>An activity planner for caregivers. Not medical care.</div>
      </div>
    </Fade>
  );
};

const SCENES: Record<string, React.FC<{ dur: number }>> = { hook: Hook, setup: Setup, build: Build, plan: Plan, stage: Stage, review: Review, world: World, close: Close };

export const Demo = ({ voice }: { voice: boolean }) => {
  const total = timeline.total;
  const musicVolume = (f: number) => {
    const base = voice ? 0.3 : 0.8;
    const fadeIn = interpolate(f, [0, 36], [0, 1], { extrapolateRight: "clamp" });
    const fadeOut = interpolate(f, [total - 90, total], [1, 0], { extrapolateLeft: "clamp" });
    return base * fadeIn * fadeOut;
  };
  return (
    <AbsoluteFill>
      <Backdrop glow={0.55}>
        {timeline.scenes.map((s) => {
          const Comp = SCENES[s.id];
          return (
            <Sequence key={s.id} from={s.from} durationInFrames={s.dur}>
              <Comp dur={s.dur} />
            </Sequence>
          );
        })}
      </Backdrop>
      <Audio src={staticFile("audio/music.wav")} volume={musicVolume} />
      {voice &&
        timeline.scenes.map((s) => (
          <Sequence key={`vo-${s.id}`} from={s.voStart} durationInFrames={Math.ceil(s.voSeconds * timeline.fps) + 6}>
            <Audio src={staticFile(`audio/vo-${s.id}.mp3`)} volume={1} />
          </Sequence>
        ))}
    </AbsoluteFill>
  );
};
