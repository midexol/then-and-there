"use client";
// Keepsakes: one physical-feeling object per kind of item, drawn in code (no images, no real logos).
// They keep their own paper/ink colours in dark mode, like real objects would.
import type { CSSProperties, ReactNode } from "react";
import type { ItemKind, SessionItem } from "@/lib/types";

const INK = "#1B1D24";
const INDIGO = "#24336E";
const NIGHT = "#121A3D";
const PAPER = "#FBF6EA";
const GOLD = "#D9981C";
const SOFT = "#565B6B";
const serif: CSSProperties = { fontFamily: "var(--font-display)", fontWeight: 400 };
const PIN = "M74 162 C60 136 24 110 24 70 A50 50 0 1 1 124 70 C124 110 88 136 74 162 Z";

/** Shrinks a fixed-size drawing without re-laying it out. */
function Scaled({ w, h, scale, children }: { w: number; h: number; scale: number; children: ReactNode }) {
  return (
    <div style={{ width: w * scale, height: h * scale, position: "relative", flexShrink: 0 }}>
      <div style={{ width: w, height: h, transform: `scale(${scale})`, transformOrigin: "top left", position: "absolute", left: 0, top: 0 }}>{children}</div>
    </div>
  );
}

const fit = (text: string, big: number, small: number, limit: number) => (text.length > limit ? small : big);
const shadow = "0 18px 30px -16px rgba(18,26,61,.45), 0 2px 4px rgba(18,26,61,.12)";

export function Sleeve({ title, sub, scale = 1 }: { title: string; sub: string; scale?: number }) {
  return (
    <Scaled w={290} h={226} scale={scale}>
      <div className="keepsake-sleeve" style={{ position: "relative", width: 290, height: 226 }}>
        <div className="keepsake-record" style={{ position: "absolute", left: 92, top: 16, width: 194, height: 194, borderRadius: "50%", background: `repeating-radial-gradient(circle at center, ${NIGHT} 0 3px, #1C2550 3px 5px)`, boxShadow: "0 10px 20px -10px rgba(0,0,0,.5)" }}>
          <div className="keepsake-spin" style={{ position: "absolute", inset: 0, borderRadius: "50%", background: "conic-gradient(from 20deg, transparent 0 40deg, rgba(255,255,255,.10) 55deg, transparent 75deg 220deg, rgba(255,255,255,.07) 235deg, transparent 255deg)" }} />
          <div style={{ position: "absolute", left: "50%", top: "50%", width: 60, height: 60, margin: "-30px 0 0 -30px", borderRadius: "50%", background: GOLD }} />
          <div style={{ position: "absolute", left: "50%", top: "50%", width: 8, height: 8, margin: "-4px 0 0 -4px", borderRadius: "50%", background: NIGHT }} />
        </div>
        <div style={{ position: "absolute", left: 0, top: 3, width: 220, height: 220, borderRadius: 6, background: INDIGO, overflow: "hidden", color: "#F3F4F0", boxShadow: shadow }}>
          <div style={{ position: "absolute", inset: 0, background: "radial-gradient(circle at 14px 14px, rgba(228,232,243,.15) 5px, transparent 5.5px) 0 0/28px 28px" }} />
          <div style={{ position: "absolute", left: 16, right: 16, bottom: 16 }}>
            <div style={{ fontSize: 12, opacity: 0.8 }}>{sub}</div>
            <div style={{ ...serif, fontSize: fit(title, 27, 21, 16), lineHeight: 1.05 }}>{title}</div>
          </div>
        </div>
      </div>
    </Scaled>
  );
}

export function Ticket({ title, sub, year, scale = 1 }: { title: string; sub: string; year?: number; scale?: number }) {
  const mask =
    "radial-gradient(circle at 0 50%, transparent 11px, #000 11.5px) left/51% 100% no-repeat, radial-gradient(circle at 100% 50%, transparent 11px, #000 11.5px) right/51% 100% no-repeat";
  return (
    <Scaled w={286} h={132} scale={scale}>
      <div style={{ filter: "drop-shadow(0 14px 14px rgba(18,26,61,.22)) drop-shadow(0 2px 2px rgba(18,26,61,.12))" }}>
        <div style={{ width: 286, height: 132, background: PAPER, borderRadius: 8, display: "flex", color: INK, WebkitMask: mask, mask }}>
          <div style={{ width: 76, borderRight: "2px dashed #CBD1E2", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
            <div style={{ fontSize: 11, color: SOFT }}>No.</div>
            <div style={{ ...serif, fontSize: 23, color: INDIGO }}>{year ?? "—"}</div>
          </div>
          <div style={{ flex: 1, padding: "14px 18px 14px 16px", display: "flex", flexDirection: "column", justifyContent: "center", gap: 3, minWidth: 0 }}>
            <div style={{ fontSize: 12, color: SOFT }}>Film · Admit one</div>
            <div style={{ ...serif, fontSize: fit(title, 28, 20, 14), lineHeight: 1.05, color: NIGHT, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{title}</div>
            {sub && <div style={{ fontSize: 12, color: "#9A5B00", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{sub}</div>}
          </div>
        </div>
      </div>
    </Scaled>
  );
}

function Scene({ variant }: { variant: number }) {
  // Three generic scenes in indigo and gold: water, a tower, hills. Never a real photo.
  return (
    <svg width="124" height="158" viewBox="0 0 124 158" aria-hidden>
      <defs>
        <linearGradient id={`sky${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#AFC0F5" />
          <stop offset="1" stopColor="#E4E8F3" />
        </linearGradient>
      </defs>
      <rect width="124" height="158" fill={`url(#sky${variant})`} />
      <circle className="keepsake-sun" cx="94" cy="36" r="11" fill="#F0B440" />
      {variant === 0 && (
        <>
          <path d="M0 94 Q31 84 62 94 T124 94 V158 H0 Z" fill="#2E3F85" />
          <path d="M0 112 Q31 104 62 112 T124 112 V158 H0 Z" fill={INDIGO} />
          <path className="keepsake-boat" d="M24 100 h44 l-6 8 h-32 Z" fill={GOLD} />
          <path className="keepsake-boat" d="M30 100 v-12 h32 v12" fill="none" stroke="#F3F4F0" strokeWidth="2" />
        </>
      )}
      {variant === 1 && (
        <>
          <rect x="0" y="104" width="124" height="54" fill={INDIGO} />
          <rect x="50" y="34" width="22" height="72" fill="#2E3F85" />
          <rect x="55" y="24" width="12" height="12" fill={GOLD} />
          <rect x="18" y="72" width="26" height="34" fill="#3A4785" />
          <rect x="80" y="62" width="28" height="44" fill="#3A4785" />
          {[0, 1, 2, 3].map((r) => (
            <rect key={r} x="56" y={44 + r * 14} width="10" height="5" fill="#F0B440" opacity=".7" />
          ))}
        </>
      )}
      {variant === 2 && (
        <>
          <path d="M0 110 Q30 70 62 98 Q90 70 124 92 V158 H0 Z" fill="#2E3F85" />
          <path d="M0 128 Q40 108 80 124 T124 120 V158 H0 Z" fill={INDIGO} />
          <path d="M36 92 v-18 l10 -8 l10 8 v18 Z" fill="#F3F4F0" opacity=".9" />
        </>
      )}
    </svg>
  );
}

const hash = (s: string) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7);

export function Postcard({ title, sub, scale = 1 }: { title: string; sub: string; scale?: number }) {
  return (
    <Scaled w={276} h={180} scale={scale}>
      <div style={{ width: 276, height: 180, background: "#fff", borderRadius: 6, padding: 10, boxSizing: "border-box", display: "flex", gap: 10, boxShadow: shadow, color: INK }}>
        <div style={{ width: 124, borderRadius: 4, overflow: "hidden" }}>
          <Scene variant={hash(title) % 3} />
        </div>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between", minWidth: 0 }}>
          <div style={{ alignSelf: "flex-end", width: 38, height: 46, border: `2px dashed ${GOLD}`, borderRadius: 3, display: "flex", alignItems: "center", justifyContent: "center" }}>
            <svg width="18" height="20" viewBox="0 0 148 168" aria-hidden>
              <path d={PIN} fill={INDIGO} />
            </svg>
          </div>
          <div>
            <div style={{ fontSize: 11, color: SOFT }}>{sub}</div>
            <div style={{ ...serif, fontSize: fit(title, 22, 17, 14), lineHeight: 1.1, color: INDIGO, overflow: "hidden", display: "-webkit-box", WebkitLineClamp: 2, WebkitBoxOrient: "vertical" }}>{title}</div>
            <div style={{ height: 1, background: "#CBD1E2", marginTop: 8 }} />
            <div style={{ height: 1, background: "#CBD1E2", marginTop: 10 }} />
          </div>
        </div>
      </div>
    </Scaled>
  );
}

export function TinLabel({ title, sub, scale = 1 }: { title: string; sub: string; scale?: number }) {
  return (
    <Scaled w={196} h={196} scale={scale}>
      <div style={{ width: 196, height: 196, borderRadius: "50%", background: PAPER, border: `9px solid ${GOLD}`, boxSizing: "border-box", display: "flex", alignItems: "center", justifyContent: "center", boxShadow: shadow }}>
        <div className="keepsake-ring" style={{ width: 142, height: 142, borderRadius: "50%", border: "2px dotted rgba(36,51,110,.38)", display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", textAlign: "center", color: INDIGO, gap: 4, padding: 10, boxSizing: "border-box" }}>
          <div style={{ fontSize: 11, color: "#9A5B00" }}>A taste</div>
          <div style={{ ...serif, fontSize: fit(title, 23, 17, 12), lineHeight: 1.05 }}>{title}</div>
          <div style={{ fontSize: 10, color: SOFT }}>{sub}</div>
        </div>
      </div>
    </Scaled>
  );
}

export type KeepsakeData = { kind: "song" | "film" | "place" | "taste"; title: string; sub: string; year?: number };

export function Keepsake({ k, scale = 1 }: { k: KeepsakeData; scale?: number }) {
  switch (k.kind) {
    case "song":
      return <Sleeve title={k.title} sub={k.sub} scale={scale} />;
    case "film":
      return <Ticket title={k.title} sub={k.sub} year={k.year} scale={scale} />;
    case "place":
      return <Postcard title={k.title} sub={k.sub} scale={scale} />;
    case "taste":
      return <TinLabel title={k.title} sub={k.sub} scale={scale} />;
  }
}

const KIND: Record<ItemKind, KeepsakeData["kind"]> = { song: "song", closing_song: "song", film: "film", place: "place", taste: "taste" };

/** A session item as a keepsake. Brand names appear only as text in our own type. */
export function itemKeepsake(it: SessionItem, region: string): KeepsakeData {
  const kind = KIND[it.kind];
  const sub =
    kind === "song" ? `Music · ${region}` : kind === "film" ? (it.subtitle && !/^Film/.test(it.subtitle) ? it.subtitle : "") : kind === "place" ? `A place · ${region}` : region;
  return { kind, title: it.title, sub, year: it.year };
}
