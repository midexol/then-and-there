"use client";
// "How it works" as a short film: a pinned stage that plays as the page scrolls. One progress value drives every beat,
// and the same skyline sits under all four, its sky turning from tonight to the morning of their youth.
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { KindIcon, Logo } from "./brand";
import { Keepsake } from "./keepsakes";
import { Landmarks } from "./Scenery";
import { copy } from "@/lib/copy";
import { dialKeepsakes } from "@/lib/dial";
import { EXAMPLES, eraFor, regionShort } from "@/lib/store";

const PLACE_KEYS = ["mx", "liv", "ibd"] as const;
const BASE = 540; // every visual is drawn on a 540×540 table and scaled to fit
const NOW = 2026;
// Card positions on the table: [left, top, rotation]
const SPOTS: [number, number, number][] = [
  [10, 30, -7],
  [300, 8, 8],
  [8, 316, -3],
  [250, 290, 6],
];

const clamp = (v: number, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const seg = (a: number, b: number, v: number) => clamp((v - a) / (b - a));
const ss = (a: number, b: number, v: number) => {
  const t = seg(a, b, v);
  return t * t * (3 - 2 * t);
};
const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);
const v = (n: number) => n.toFixed(4);

function StorySky() {
  return (
    <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1440 900" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <defs>
        <linearGradient id="st-night" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0e1535" />
          <stop offset="0.55" stopColor="#0b1130" />
          <stop offset="1" stopColor="#24336e" />
        </linearGradient>
        <linearGradient id="st-dawn" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#1b2659" />
          <stop offset="0.5" stopColor="#4b4a8c" />
          <stop offset="0.82" stopColor="#b77a5c" />
          <stop offset="1" stopColor="#f0b440" />
        </linearGradient>
        <radialGradient id="st-glow" cx="0.5" cy="0.5" r="0.5">
          <stop offset="0" stopColor="#ffd37a" stopOpacity="0.7" />
          <stop offset="1" stopColor="#ffd37a" stopOpacity="0" />
        </radialGradient>
      </defs>
      <rect width="1440" height="900" fill="url(#st-night)" />
      <rect className="st-dawn" width="1440" height="900" fill="url(#st-dawn)" />
      <g className="st-stars" fill="#ffffff">
        {[
          [120, 90], [260, 180], [400, 70], [560, 150], [700, 60], [860, 130], [1000, 80], [1150, 170], [1290, 100], [1380, 220], [80, 260], [640, 240], [1220, 300],
        ].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r={i % 3 ? 1.3 : 1.8} opacity="0.7" />
        ))}
      </g>
      <circle className="st-dawn" cx="720" cy="860" r="420" fill="url(#st-glow)" />
      <g transform="translate(0 430)">
        <Landmarks fill="#1a2459" />
        <path d="M0 430 Q180 410 360 428 T720 432 T1080 426 T1440 430 V470 H0 Z" fill="#1a2459" />
      </g>
      <path d="M0 880 Q360 860 720 874 T1440 868 V900 H0 Z" fill="#0e1535" />
    </svg>
  );
}

function ProfileCard({ i }: { i: number }) {
  const ex = EXAMPLES[i]!;
  const S = copy.landing.story;
  const kind = (k: string) => (k === "music" ? "song" : k === "food" ? "taste" : "place");
  return (
    <div className="absolute left-[60px] top-[70px] w-[420px] rounded-[22px] bg-[#f3f4f0] p-7 text-[#24336e] shadow-[0_30px_60px_-30px_rgba(0,0,0,.6)]">
      <div className="display text-[2rem] leading-tight">{ex.nickname}</div>
      <div className="mt-1 flex items-center gap-2 text-[0.85rem] text-[#3b4d9a]">
        <svg width="14" height="14" viewBox="0 0 24 24" aria-hidden>
          <rect x="5" y="10" width="14" height="10" rx="2" fill="currentColor" />
          <path d="M8 10 V7 a4 4 0 0 1 8 0 V10" fill="none" stroke="currentColor" strokeWidth="2" />
        </svg>
        {S.onDevice}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-[14px] bg-[#e4e8f3] px-4 py-3">
          <div className="text-[0.8rem] text-[#3b4d9a]">{S.bornIn}</div>
          <div className="display text-[1.4rem]">{ex.birthDecade}</div>
        </div>
        <div className="rounded-[14px] bg-[#e4e8f3] px-4 py-3">
          <div className="text-[0.8rem] text-[#3b4d9a]">{S.grewUp}</div>
          <div className="display text-[1.4rem]">{regionShort(ex.region)}</div>
        </div>
      </div>
      <div className="mt-5 text-[0.85rem] text-[#3b4d9a]">{S.loved}</div>
      <ul className="mt-2 flex flex-col gap-2">
        {ex.anchors.map((a, n) => (
          <li key={a.text} className="st-chip flex items-center gap-3 rounded-full border-2 border-[#24336e] py-1.5 pl-1.5 pr-4" style={{ ["--c" as string]: `var(--c${n})` } as CSSProperties}>
            <KindIcon kind={kind(a.kind) as "song"} size={34} />
            <span className="font-semibold">{a.text}</span>
            <span className="st-check ml-auto flex items-center gap-1 text-[0.8rem] text-[#2f7a55]">
              <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden>
                <path d="M5 12.5 l4.5 4.5 L19 7.5" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {S.matched}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ClockBeat({ i, yearRef }: { i: number; yearRef: React.RefObject<HTMLSpanElement | null> }) {
  const S = copy.landing.story;
  const w = eraFor(EXAMPLES[i]!.birthDecade);
  // Timeline from 1920 to today, 440 units wide
  const x = (y: number) => 50 + ((y - 1920) / (NOW - 1920)) * 440;
  const bump = Array.from({ length: 61 }, (_, k) => {
    const yr = 1920 + (k / 60) * (NOW - 1920);
    const h = 62 * Math.exp(-Math.pow((yr - (w.peak + 3)) / 6.5, 2));
    return `${k ? "L" : "M"}${x(yr).toFixed(1)} ${(480 - h).toFixed(1)}`;
  }).join(" ");
  return (
    <div className="absolute inset-0">
      <div className="absolute left-1/2 top-[10px] -translate-x-1/2">
        <svg width="210" height="238" viewBox="0 0 148 168" aria-hidden>
          <path d="M74 162 C60 136 24 110 24 70 A50 50 0 1 1 124 70 C124 110 88 136 74 162 Z" fill="#f3f4f0" />
          <circle cx="74" cy="70" r="38" fill="#0e1535" />
          {Array.from({ length: 12 }, (_, k) => (
            <circle key={k} cx={74 + 31 * Math.sin((k * Math.PI) / 6)} cy={70 - 31 * Math.cos((k * Math.PI) / 6)} r={k % 3 === 0 ? 2.6 : 1.4} fill="#afc0f5" />
          ))}
          <g className="st-hour">
            <line x1="74" y1="70" x2="74" y2="52" stroke="#f3f4f0" strokeWidth="7" strokeLinecap="round" />
          </g>
          <g className="st-minute">
            <line x1="74" y1="70" x2="74" y2="42" stroke="#f3f4f0" strokeWidth="4.5" strokeLinecap="round" />
          </g>
          <circle cx="74" cy="70" r="6" fill="#f0b440" />
        </svg>
      </div>
      <div className="absolute inset-x-0 top-[240px] text-center">
        <span ref={yearRef} className="display text-[4.4rem] leading-none text-white" style={{ fontVariantNumeric: "tabular-nums" }}>
          {NOW}
        </span>
        <div className="st-window mt-1 text-[1rem] text-[#ffd37a]">{S.looking(w.from, w.to)}</div>
      </div>
      <svg className="absolute left-0 top-[0px]" width={BASE} height={BASE} viewBox={`0 0 ${BASE} ${BASE}`} aria-hidden>
        <line x1="50" y1="480" x2="490" y2="480" stroke="#afc0f5" strokeOpacity="0.5" strokeWidth="2" />
        {[1920, 1940, 1960, 1980, 2000, 2020].map((y) => (
          <g key={y}>
            <line x1={x(y)} y1="480" x2={x(y)} y2="488" stroke="#afc0f5" strokeOpacity="0.6" strokeWidth="2" />
            <text x={x(y)} y="508" textAnchor="middle" fontSize="14" fill="#afc0f5" style={{ fontFamily: "var(--font-body)" }}>
              {y}
            </text>
          </g>
        ))}
        <g className="st-bump">
          <rect x={x(w.from)} y="418" width={x(w.to) - x(w.from)} height="62" fill="#f0b440" fillOpacity="0.14" />
          <path d={bump} fill="none" stroke="#f0b440" strokeWidth="3" strokeLinecap="round" />
          <line x1={x(w.peak)} y1="480" x2={x(w.peak)} y2="408" stroke="#ffd37a" strokeWidth="1.5" strokeDasharray="3 4" />
          <circle cx={x(w.peak)} cy="480" r="6" fill="#f0b440" />
          <text x={x(w.peak)} y="398" textAnchor="middle" fontSize="15" fill="#ffd37a" style={{ fontFamily: "var(--font-body)" }}>
            {S.age14}
          </text>
        </g>
        <circle className="st-now" cx={x(NOW)} cy="480" r="5" fill="#ffffff" />
        <text x={x(NOW)} y="462" textAnchor="end" fontSize="14" fill="#ffffff" fillOpacity="0.8" style={{ fontFamily: "var(--font-body)" }}>
          {S.today}
        </text>
      </svg>
    </div>
  );
}

function Table({ i, canvasRef }: { i: number; canvasRef: React.RefObject<HTMLCanvasElement | null> }) {
  const S = copy.landing.story;
  const ex = EXAMPLES[i]!;
  const cards = dialKeepsakes(ex.birthDecade, PLACE_KEYS[i]!);
  return (
    <div className="absolute inset-0">
      <div className="absolute left-[30px] top-[30px] h-[480px] w-[480px] rounded-full border-2 border-dashed border-[#afc0f5]/25" />
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      {cards.map((k, n) => {
        const [l, t, r] = SPOTS[n]!;
        return (
          <div key={`${i}-${n}`} className="st-card absolute" style={{ left: l, top: t, ["--d" as string]: `var(--d${n})`, ["--r" as string]: `${r}deg` } as CSSProperties}>
            <Keepsake k={k} />
          </div>
        );
      })}
      <p className="absolute inset-x-0 -bottom-2 text-center text-[0.95rem] text-white/85 [text-shadow:0_1px_8px_rgba(14,21,53,.9)]">{S.illustrative}</p>
    </div>
  );
}

function StagePhone({ i }: { i: number }) {
  const S = copy.landing.story;
  const ex = EXAMPLES[i]!;
  const w = eraFor(ex.birthDecade);
  const song = dialKeepsakes(ex.birthDecade, PLACE_KEYS[i]!)[0]!;
  return (
    <div className="absolute left-1/2 top-[6px] h-[528px] w-[300px] -translate-x-1/2 overflow-hidden rounded-[40px] border-[10px] border-[#05081a] bg-[#121a3d] shadow-[0_40px_80px_-30px_rgba(0,0,0,.8)]">
      <div
        className="h-[22px] opacity-70"
        style={{
          backgroundImage:
            "radial-gradient(circle at 16px 11px, transparent 5px, #afc0f5 5.5px, #afc0f5 7px, transparent 7.5px), radial-gradient(circle at 16px 11px, #afc0f5 2.5px, transparent 3px)",
          backgroundSize: "32px 22px",
        }}
      />
      <div className="flex flex-col items-center px-6 pt-10 text-center">
        <KindIcon kind="song" size={46} />
        <div className="mt-4 text-[0.95rem] text-[#a9b0c8]">{S.stageKind(w.peak)}</div>
        <div className="display mt-2 text-[2rem] leading-[1.1] text-[#f3f4f0]">{song.title}</div>
        <div className="st-thread mt-3 h-[3px] w-[120px] rounded-full bg-[#f0b440]" />
        <p className="mt-5 text-[1.02rem] leading-snug text-[#eef0f7]">“{S.stagePrompt}”</p>
      </div>
      <div className="absolute inset-x-5 bottom-6">
        <div className="mb-2 text-center text-[0.9rem] text-[#a9b0c8]">{S.spark}</div>
        <div className="grid grid-cols-3 gap-2">
          <span className="relative flex h-[60px] items-center justify-center overflow-hidden rounded-[14px] border-2 border-[#f0b440] text-[0.95rem] font-semibold">
            <span className="st-yes-on absolute inset-0 bg-[#f0b440]" />
            <span className="st-yes-off relative text-[#f3f4f0]">{S.yes}</span>
            <span className="st-yes-on absolute inset-0 flex items-center justify-center text-[#0e1535]">{S.yes}</span>
          </span>
          <span className="flex h-[60px] items-center justify-center rounded-[14px] border-2 border-[#2e3a6e] text-[0.9rem] text-[#eef0f7]">{S.little}</span>
          <span className="flex h-[60px] items-center justify-center rounded-[14px] border-2 border-[#2e3a6e] text-center text-[0.85rem] leading-tight text-[#eef0f7]">{S.notReally}</span>
        </div>
      </div>
    </div>
  );
}

type Dot = { sx: number; sy: number; tx: number; ty: number; d: number; sw: number; ring: boolean };

export function ScrollStory() {
  const S = copy.landing.story;
  const [person, setPerson] = useState(0);
  const [scale, setScale] = useState(0.6);
  const section = useRef<HTMLElement>(null);
  const stage = useRef<HTMLDivElement>(null);
  const box = useRef<HTMLDivElement>(null);
  const yearRef = useRef<HTMLSpanElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fromYear = useRef(eraFor(EXAMPLES[0]!.birthDecade).from);
  fromYear.current = eraFor(EXAMPLES[person]!.birthDecade).from;

  // Fit the 540×540 visuals into whatever room the layout leaves.
  useEffect(() => {
    const el = box.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => {
      const { width, height } = e!.contentRect;
      setScale(Math.max(0.3, Math.min(1.05, width / BASE, height / BASE)));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // The one clock: section scroll progress, eased toward its target each frame.
  useEffect(() => {
    const sec = section.current;
    const st = stage.current;
    if (!sec || !st) return;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let target = 0;
    let p = 0;
    let raf = 0;
    let last = -1;
    let lastYear = -1;
    const r = (n: number) => {
      let s = (n * 9301 + 49297) % 233280;
      return () => ((s = (s * 9301 + 49297) % 233280), s / 233280);
    };
    const rnd = r(7);
    const dots: Dot[] = Array.from({ length: 90 }, (_, k) => {
      const card = k % 4;
      const [l, t] = SPOTS[card]!;
      return {
        sx: 270 + (rnd() - 0.5) * 40,
        sy: 200 + (rnd() - 0.5) * 40,
        tx: l + 60 + rnd() * 170,
        ty: t + 40 + rnd() * 120,
        d: rnd() * 0.35,
        sw: (rnd() - 0.5) * 260,
        ring: rnd() < 0.35,
      };
    });

    const read = () => {
      const rect = sec.getBoundingClientRect();
      target = clamp(-rect.top / Math.max(1, rect.height - window.innerHeight));
    };

    const draw = (l3: number) => {
      const c = canvasRef.current;
      if (!c) return;
      const ctx = c.getContext("2d");
      if (!ctx) return;
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const W = c.clientWidth;
      if (c.width !== Math.round(W * dpr)) {
        c.width = Math.round(W * dpr);
        c.height = Math.round(c.clientHeight * dpr);
      }
      ctx.setTransform((dpr * W) / BASE, 0, 0, (dpr * W) / BASE, 0, 0);
      ctx.clearRect(0, 0, BASE, BASE);
      if (reduce || l3 <= 0 || l3 >= 1) return;
      for (const q of dots) {
        const k = easeOut(clamp((l3 - q.d) / 0.55));
        if (k <= 0) continue;
        const a = Math.sin(Math.PI * k);
        let x = q.sx + (q.tx - q.sx) * k;
        let y = q.sy + (q.ty - q.sy) * k;
        const dx = q.tx - q.sx;
        const dy = q.ty - q.sy;
        const L = Math.hypot(dx, dy) || 1;
        const sw = Math.sin(Math.PI * k) * q.sw * 0.4;
        x += (-dy / L) * sw;
        y += (dx / L) * sw;
        ctx.globalAlpha = a;
        if (q.ring) {
          ctx.strokeStyle = "#afc0f5";
          ctx.lineWidth = 1.6;
          ctx.beginPath();
          ctx.arc(x, y, 5, 0, Math.PI * 2);
          ctx.stroke();
          ctx.fillStyle = "#afc0f5";
          ctx.beginPath();
          ctx.arc(x, y, 1.8, 0, Math.PI * 2);
          ctx.fill();
        } else {
          ctx.fillStyle = "#f0b440";
          ctx.beginPath();
          ctx.arc(x, y, 2.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
      ctx.globalAlpha = 1;
    };

    const frame = () => {
      p += (target - p) * (reduce ? 1 : 0.14);
      if (Math.abs(target - p) < 0.0005) p = target;
      if (p !== last) {
        last = p;
        const o1 = 1 - ss(0.2, 0.26, p);
        const o2 = ss(0.2, 0.26, p) * (1 - ss(0.46, 0.52, p));
        const o3 = ss(0.46, 0.52, p) * (1 - ss(0.72, 0.78, p));
        const o4 = ss(0.72, 0.78, p);
        const l1 = seg(0.02, 0.18, p);
        const l2 = seg(0.27, 0.45, p);
        const l3 = seg(0.53, 0.71, p);
        const l4 = seg(0.79, 0.95, p);
        const dawn = ss(0.26, 0.46, p) * (1 - 0.35 * ss(0.79, 0.95, p));
        const set = (k: string, n: number) => st.style.setProperty(k, v(n));
        set("--o1", o1);
        set("--o2", o2);
        set("--o3", o3);
        set("--o4", o4);
        set("--dawn", dawn);
        for (let n = 0; n < 3; n++) set(`--c${n}`, ss(n * 0.25, n * 0.25 + 0.35, l1));
        set("--l2", l2);
        set("--min", -720 * easeOut(l2));
        set("--hr", -60 - 60 * easeOut(l2));
        for (let n = 0; n < 4; n++) set(`--d${n}`, ss(0.25 + n * 0.12, 0.6 + n * 0.12, l3));
        set("--yes", ss(0.35, 0.7, l4));
        const step = o4 > 0.5 ? 3 : o3 > 0.5 ? 2 : o2 > 0.5 ? 1 : 0;
        st.dataset.step = String(step);
        draw(l3);
        const yr = Math.round(NOW + (fromYear.current - NOW) * easeOut(l2));
        if (yr !== lastYear && yearRef.current) {
          lastYear = yr;
          yearRef.current.textContent = String(yr);
        }
      }
      raf = requestAnimationFrame(frame);
    };

    read();
    window.addEventListener("scroll", read, { passive: true });
    window.addEventListener("resize", read);
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("scroll", read);
      window.removeEventListener("resize", read);
    };
  }, []);

  // A new person: redraw the year straight away.
  useEffect(() => {
    const st = stage.current;
    if (!st || !yearRef.current) return;
    const l2 = parseFloat(st.style.getPropertyValue("--l2") || "0");
    yearRef.current.textContent = String(Math.round(NOW + (fromYear.current - NOW) * easeOut(l2)));
  }, [person]);

  const visual = (n: number) => ({ opacity: `var(--o${n})` }) as CSSProperties;

  return (
    <section ref={section} id="how-it-works" aria-labelledby="story-title" className="story relative bg-[#0e1535] text-white">
      {/* Jump targets for the menu, placed where each beat plays. */}
      <span id="why" aria-hidden className="absolute left-0" style={{ top: "calc(0.38 * (100% - 100svh))" }} />
      <div ref={stage} className="story-stage sticky top-0 h-[100svh] overflow-hidden" data-step="0">
        <StorySky />

        <div className="relative z-10 mx-auto grid h-full w-full max-w-6xl grid-cols-[minmax(0,1fr)] grid-rows-[auto_minmax(0,1fr)] gap-4 px-5 pb-12 pt-[92px] md:grid-cols-[minmax(0,420px)_minmax(0,1fr)] md:grid-rows-1 md:items-center md:gap-10 md:pb-20 md:pt-[96px]">
          <div className="relative min-w-0">
            <h2 id="story-title" className="text-[1rem] !text-[#ffd37a] md:text-[1.1rem]">
              {S.title}
            </h2>
            <div className="relative mt-1 min-h-[11rem] md:mt-2 md:min-h-[17rem]">
              {S.beats.map((b, n) => (
                <div key={b.title} className="story-cap absolute inset-x-0 top-0" style={{ opacity: `var(--o${n + 1})`, ["--k" as string]: `var(--o${n + 1})` } as CSSProperties}>
                  <div className="hidden items-center gap-3 md:flex">
                    <span aria-hidden className="display flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#f0b440] text-[1.1rem] !text-[#0e1535]">
                      {n + 1}
                    </span>
                    <span className="text-[0.9rem] text-white/70">{S.step(n + 1)}</span>
                  </div>
                  <h3 className="display text-[1.6rem] leading-[1.1] text-white md:mt-3 md:text-[2.6rem]">
                    <span className="text-[#ffd37a] md:hidden">{n + 1}. </span>
                    {b.title}
                  </h3>
                  <p className="mt-2 max-w-[40ch] text-[0.95rem] leading-[1.5] text-white/85 md:mt-3 md:text-[1.1rem] md:leading-[1.6]">{b.body}</p>
                </div>
              ))}
            </div>
            <div className="mt-2 hidden md:block">
              <PersonSwitch person={person} setPerson={setPerson} />
            </div>
          </div>

          <div className="flex min-h-0 flex-col gap-3 md:h-full md:self-stretch">
            <div ref={box} className="relative min-h-0 flex-1" aria-hidden>
              <div className="absolute left-1/2 top-1/2" style={{ width: BASE, height: BASE, transform: `translate(-50%, -50%) scale(${scale})` }}>
                <div className="story-vis absolute inset-0" style={visual(1)}>
                  <ProfileCard i={person} />
                </div>
                <div className="story-vis absolute inset-0" style={visual(2)}>
                  <ClockBeat i={person} yearRef={yearRef} />
                </div>
                <div className="story-vis absolute inset-0" style={visual(3)}>
                  <Table i={person} canvasRef={canvasRef} />
                </div>
                <div className="story-vis absolute inset-0" style={visual(4)}>
                  <StagePhone i={person} />
                </div>
              </div>
            </div>
            <div className="md:hidden">
              <PersonSwitch person={person} setPerson={setPerson} />
            </div>
          </div>
        </div>
      </div>
      {/* The night meets the page: a low hill in the page's own colour closes the film. */}
      <svg className="pointer-events-none absolute inset-x-0 bottom-0 z-20 block h-[48px] w-full md:h-[72px]" viewBox="0 0 1440 72" preserveAspectRatio="none" aria-hidden>
        <path d="M0 72 V40 Q240 6 520 30 T1040 24 T1440 34 V72 Z" fill="var(--ground)" />
      </svg>
    </section>
  );
}

function PersonSwitch({ person, setPerson }: { person: number; setPerson: (n: number) => void }) {
  const S = copy.landing.story;
  return (
    <div>
      <div id="story-follow" className="hidden text-[0.85rem] text-white/70 md:block">
        {S.follow}
      </div>
      <div role="radiogroup" aria-labelledby="story-follow" className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
        {EXAMPLES.map((ex, n) => (
          <button
            key={ex.nickname}
            role="radio"
            aria-checked={person === n}
            onClick={() => setPerson(n)}
            className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-full border-2 px-3 text-[0.9rem] font-semibold transition-colors ${
              person === n ? "border-[#f0b440] bg-[#f0b440] text-[#0e1535]" : "border-white/35 text-white hover:border-white"
            }`}
          >
            <Logo size={18} fixedLight={person !== n} />
            {ex.nickname}
            <span className={`hidden font-normal sm:inline ${person === n ? "text-[#0e1535]/75" : "text-white/65"}`}>· {regionShort(ex.region)}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
