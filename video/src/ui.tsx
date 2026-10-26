import React from "react";
import { Easing, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { BODY, C, DISPLAY } from "./theme";
import timeline from "./timeline.json";

const shots = timeline.shots as Record<string, { w: number; h: number }>;

export const ease = Easing.bezier(0.22, 1, 0.36, 1);

/** The clock-on-a-pin mark from the app. `back` winds the hands backwards. */
export const Logo = ({ size, back = 0 }: { size: number; back?: number }) => (
  <svg width={(size * 148) / 168} height={size} viewBox="0 0 148 168">
    <path d="M74 162 C60 136 24 110 24 70 A50 50 0 1 1 124 70 C124 110 88 136 74 162 Z" fill="#ffffff" />
    <circle cx="74" cy="70" r="34" fill={C.deeper} />
    <g transform={`rotate(${-back * 3} 74 70)`}>
      <line x1="74" y1="70" x2="74" y2="46" stroke="#ffffff" strokeWidth="9" strokeLinecap="round" />
    </g>
    <g transform={`rotate(${-back * 0.25 - 40} 74 70)`}>
      <line x1="74" y1="70" x2="74" y2="54" stroke="#ffffff" strokeWidth="10" strokeLinecap="round" />
    </g>
    <circle cx="74" cy="70" r="7" fill={C.gold} />
  </svg>
);

export const Backdrop = ({ children, glow = 0.5 }: { children: React.ReactNode; glow?: number }) => {
  const frame = useCurrentFrame();
  const drift = interpolate(frame, [0, 600], [0, -80], { extrapolateRight: "extend" });
  return (
    <div
      style={{
        position: "absolute",
        inset: 0,
        overflow: "hidden",
        background: `linear-gradient(135deg, ${C.deeper} 0%, ${C.deep} 45%, ${C.indigo} 130%)`,
        fontFamily: BODY,
      }}
    >
      {/* the app's dotted border motif, drifting very slowly */}
      <div
        style={{
          position: "absolute",
          inset: -40,
          opacity: 0.1,
          backgroundImage: `radial-gradient(circle, ${C.soft} 3px, transparent 3.5px)`,
          backgroundSize: "64px 64px",
          transform: `translate(${drift * 0.3}px, ${drift * 0.2}px)`,
        }}
      />
      <div
        style={{
          position: "absolute",
          width: 1100,
          height: 1100,
          right: -250,
          top: -200,
          borderRadius: "50%",
          background: `radial-gradient(circle, rgba(240,180,64,${0.16 * glow * 2}) 0%, transparent 62%)`,
        }}
      />
      {children}
    </div>
  );
};

/** Big headline and a quieter line, sliding up. Words wrapped in [[ ]] turn gold. */
export const Headline = ({ title, sub, delay = 0, width = 900, size = 92 }: { title: string; sub?: string; delay?: number; width?: number; size?: number }) => {
  const frame = useCurrentFrame();
  const p = (d: number) => interpolate(frame - delay - d, [0, 22], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const parts = title.split(/(\[\[.*?\]\])/g).filter(Boolean);
  return (
    <div style={{ width }}>
      <div style={{ fontFamily: DISPLAY, fontSize: size, lineHeight: 1.06, color: C.white, opacity: p(0), transform: `translateY(${(1 - p(0)) * 40}px)` }}>
        {parts.map((t, i) => (t.startsWith("[[") ? <span key={i} style={{ color: C.gold }}>{t.slice(2, -2)}</span> : <span key={i}>{t}</span>))}
      </div>
      {sub && (
        <div style={{ marginTop: 28, fontSize: 40, lineHeight: 1.3, color: C.soft, opacity: p(10), transform: `translateY(${(1 - p(10)) * 30}px)` }}>{sub}</div>
      )}
    </div>
  );
};

export const Pill = ({ children, delay = 0, gold = false }: { children: React.ReactNode; delay?: number; gold?: boolean }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 14, stiffness: 140 } });
  return (
    <span
      style={{
        display: "inline-block",
        padding: "12px 26px",
        borderRadius: 999,
        fontSize: 30,
        fontWeight: 700,
        background: gold ? C.gold : "rgba(255,255,255,0.1)",
        color: gold ? C.deeper : C.white,
        border: gold ? "none" : "2px solid rgba(175,192,245,0.45)",
        transform: `scale(${s})`,
        opacity: s,
        marginRight: 14,
        marginBottom: 14,
      }}
    >
      {children}
    </span>
  );
};

/** A phone showing one screenshot, or a tall one scrolling. `scroll` is 0 to 1, `scrollTo` how much of the page it reaches. */
export const Phone = ({
  shot,
  height,
  scroll = 0,
  scrollTo = 1,
  opacity = 1,
}: {
  shot: string;
  height: number;
  scroll?: number;
  scrollTo?: number;
  opacity?: number;
}) => {
  const bezel = height * 0.018;
  const innerH = height - bezel * 2;
  const innerW = (innerH * 390) / 844;
  const s = shots[shot];
  const imgH = (innerW * s.h) / s.w;
  const travel = Math.max(0, imgH - innerH) * scrollTo;
  return (
    <div
      style={{
        width: innerW + bezel * 2,
        height,
        borderRadius: height * 0.06,
        background: "#05081a",
        padding: bezel,
        opacity,
        boxShadow: "0 40px 90px rgba(0,0,0,0.55), 0 0 0 2px rgba(175,192,245,0.18)",
        position: "relative",
      }}
    >
      <div style={{ width: innerW, height: innerH, borderRadius: height * 0.046, overflow: "hidden", background: "#fff", position: "relative" }}>
        <Img src={staticFile(`shots/${shot}.png`)} style={{ width: innerW, height: imgH, transform: `translateY(${-travel * scroll}px)`, display: "block" }} />
      </div>
    </div>
  );
};

export const phoneWidth = (height: number) => (height * 0.964 * 390) / 844 + height * 0.036;

/** Crossfades through a list of screenshots, each held for an equal share of `frames`. */
export const Slides = ({ list, frames, height, fade = 8 }: { list: string[]; frames: number; height: number; fade?: number }) => {
  const frame = useCurrentFrame();
  const each = frames / list.length;
  return (
    <div style={{ position: "relative", width: phoneWidth(height), height }}>
      {list.map((name, i) => {
        const start = i * each;
        const a = interpolate(frame, [start - fade, start, start + each - fade, start + each], [i === 0 ? 1 : 0, 1, 1, i === list.length - 1 ? 1 : 0], {
          extrapolateLeft: "clamp",
          extrapolateRight: "clamp",
        });
        return (
          <div key={name} style={{ position: "absolute", inset: 0, opacity: a }}>
            <Phone shot={name} height={height} />
          </div>
        );
      })}
    </div>
  );
};

export const Tap = ({ x, y, at }: { x: number; y: number; at: number }) => {
  const frame = useCurrentFrame();
  const t = frame - at;
  if (t < 0 || t > 24) return null;
  const r = interpolate(t, [0, 24], [10, 90]);
  const o = interpolate(t, [0, 24], [0.9, 0]);
  return <div style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `6px solid ${C.gold}`, opacity: o }} />;
};

export const Tag = ({ children, x, y, delay = 0 }: { children: React.ReactNode; x: number; y: number; delay?: number }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: frame - delay, fps, config: { damping: 15, stiffness: 120 } });
  return (
    <div style={{ position: "absolute", left: x, top: y, transform: `scale(${s})`, opacity: s, transformOrigin: "left center", display: "flex", alignItems: "center", gap: 14 }}>
      <div style={{ width: 70, height: 4, background: C.gold }} />
      <div style={{ fontSize: 32, fontWeight: 700, color: C.deeper, background: C.gold, padding: "10px 22px", borderRadius: 14 }}>{children}</div>
    </div>
  );
};
