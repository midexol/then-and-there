"use client";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import { Wordmark } from "./brand";
import { Keepsake } from "./keepsakes";
import { HeroScene, SkylineStrip } from "./Scenery";
import { goHome } from "./SiteHeader";
import { ButtonLink } from "./ui";
import { copy } from "@/lib/copy";
import { DIAL_PLACES, dialKeepsakes, eraWindow } from "@/lib/dial";
import { BIRTH_DECADES, type BirthDecade } from "@/lib/types";

function useMedia(q: string) {
  const [m, setM] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(q);
    const on = () => setM(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, [q]);
  return m;
}

/** Rolls a number to its new value, unless the visitor prefers reduced motion. */
function useCountTo(target: number) {
  const [v, setV] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const start = from.current;
    if (reduce || start === target) {
      from.current = target;
      setV(target);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 700);
      const e = 1 - Math.pow(1 - k, 3);
      const n = Math.round(start + (target - start) * e);
      setV(n);
      from.current = n;
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target]);
  return v;
}

const PIN = "M74 162 C60 136 24 110 24 70 A50 50 0 1 1 124 70 C124 110 88 136 74 162 Z";

function DialClock({ decadeIndex, turns }: { decadeIndex: number; turns: number }) {
  const hour = -150 + decadeIndex * 50;
  return (
    <svg width="58" height="66" viewBox="0 0 148 168" aria-hidden className="shrink-0">
      <path d={PIN} fill="var(--indigo)" />
      <circle cx="74" cy="70" r="36" fill="var(--ground)" />
      {Array.from({ length: 12 }, (_, i) => (
        <circle key={i} cx={74 + 29 * Math.sin((i * Math.PI) / 6)} cy={70 - 29 * Math.cos((i * Math.PI) / 6)} r={i % 3 === 0 ? 2.6 : 1.4} fill="var(--indigo)" opacity=".55" />
      ))}
      <g className="hand" style={{ transformOrigin: "74px 70px", transform: `rotate(${hour}deg)` }}>
        <line x1="74" y1="70" x2="74" y2="52" stroke="var(--indigo)" strokeWidth="8" strokeLinecap="round" />
      </g>
      <g className="hand" style={{ transformOrigin: "74px 70px", transform: `rotate(${-360 * turns}deg)` }}>
        <line x1="74" y1="70" x2="74" y2="44" stroke="var(--indigo)" strokeWidth="5" strokeLinecap="round" />
      </g>
      <circle cx="74" cy="70" r="6" fill="var(--gold)" />
    </svg>
  );
}

// Card positions on a 540×540 table: [left, top, rotation, parallax depth]
const SPOTS: [number, number, number, number][] = [
  [8, 26, -7, 10],
  [330, 6, 9, 16],
  [6, 318, -3, 13],
  [244, 286, 6, 22],
];

function Chip({ on, onClick, children, dashed }: { on: boolean; onClick: () => void; children: React.ReactNode; dashed?: boolean }) {
  return (
    <button
      role="radio"
      aria-checked={on}
      onClick={onClick}
      className={`inline-flex min-h-11 shrink-0 items-center rounded-full border-2 px-4 text-[0.92rem] font-semibold transition-colors ${
        on ? "border-indigo bg-indigo text-on-indigo" : `${dashed ? "border-dashed font-normal text-ink-soft" : "text-ink"} border-line bg-card hover:border-indigo`
      }`}
    >
      {children}
    </button>
  );
}

const HERO_SCENE_H = "clamp(280px, 38.9vw, 900px)";

export function Hero() {
  const L = copy.landing;
  return (
    <section id="top" aria-labelledby="hero" className="relative isolate overflow-hidden bg-[#0e1535] text-center">
      <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center px-5 pt-36 pb-6 md:pt-[12.5rem] md:pb-8">
        <h1 id="hero" className="rise text-[1.7rem] leading-[1.1] !text-white md:text-[2.4rem]">
          {L.headline}
        </h1>
        <p className="mt-4 max-w-[46ch] text-[1.1rem] text-white/90 md:text-[1.2rem]">{L.sub}</p>
        <div className="mt-7 flex flex-wrap items-center justify-center gap-3">
          <ButtonLink href="/new/" className="group min-h-14 !bg-[#f0b440] px-8 text-[1.05rem] !text-[#0e1535]">
            {L.start}
          </ButtonLink>
          <a href="#try" className="ghost-sweep">
            {L.tryLink}
          </a>
        </div>
        <p className="mt-3 max-w-[44ch] text-[0.9rem] text-white/80">{L.ctaNote}</p>
      </div>
      {/* The scene sits below the text and tucks its empty sky up behind it, so the landmarks never touch the words. */}
      <div className="relative" style={{ height: HERO_SCENE_H, marginTop: `calc(${HERO_SCENE_H} * -0.4)` }}>
        <HeroScene />
      </div>
    </section>
  );
}

export function TimeDial() {
  const [decade, setDecade] = useState<BirthDecade>("1940s");
  const [place, setPlace] = useState("mx");
  const [custom, setCustom] = useState("");
  const [turns, setTurns] = useState(0);
  const wide = useMedia("(min-width: 768px)");
  const table = useRef<HTMLDivElement>(null);
  const di = BIRTH_DECADES.indexOf(decade);
  const w = eraWindow(decade);
  const from = useCountTo(w.from);
  const to = useCountTo(w.to);
  const isCustom = place === "custom";
  const p = DIAL_PLACES.find((x) => x.key === place);
  const cards = dialKeepsakes(decade, place, custom);
  const scale = wide ? 1 : 0.62;
  const region = isCustom ? custom.trim() : (p?.region ?? "");
  const href = `/new/?decade=${decade}${region ? `&region=${encodeURIComponent(region)}` : ""}`;
  const where = isCustom ? custom.trim().split(",")[0] || "their home town" : p!.label;

  const pickDecade = (d: BirthDecade) => {
    if (d === decade) return;
    setDecade(d);
    setTurns((t) => t + 1);
  };
  const pickPlace = (k: string) => {
    if (k === place) return;
    setPlace(k);
    setTurns((t) => t + 1);
  };

  const onMove = (e: React.PointerEvent) => {
    if (e.pointerType !== "mouse" || !table.current) return;
    const r = table.current.getBoundingClientRect();
    table.current.style.setProperty("--mx", String(((e.clientX - r.left) / r.width - 0.5) * 2));
    table.current.style.setProperty("--my", String(((e.clientY - r.top) / r.height - 0.5) * 2));
  };

  return (
    <section className="relative mt-12 grid grid-cols-1 items-center gap-6 md:mt-16 md:grid-cols-[minmax(0,1fr)_540px] md:gap-8" aria-labelledby="try">
      <div className="relative z-10 min-w-0">
        <h2 id="try" className="text-[1.45rem] leading-[1.15] md:text-[1.9rem]">
          {copy.landing.tryTitle}
        </h2>
        <p className="mt-2 max-w-[48ch] text-[1.02rem] text-ink-soft">{copy.landing.tryIt}</p>

        <div className="mt-5">
          <div id="dl-dec" className="text-[0.85rem] font-semibold text-ink-soft">
            {copy.landing.bornIn}
          </div>
          <div role="radiogroup" aria-labelledby="dl-dec" className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {BIRTH_DECADES.map((d) => (
              <Chip key={d} on={d === decade} onClick={() => pickDecade(d)}>
                {d}
              </Chip>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <div id="dl-place" className="text-[0.85rem] font-semibold text-ink-soft">
            {copy.landing.grewUp}
          </div>
          <div role="radiogroup" aria-labelledby="dl-place" className="-mx-5 mt-2 flex gap-2 overflow-x-auto px-5 pb-1 md:mx-0 md:flex-wrap md:overflow-visible md:px-0">
            {DIAL_PLACES.map((x) => (
              <Chip key={x.key} on={place === x.key} onClick={() => pickPlace(x.key)}>
                {x.label}
              </Chip>
            ))}
            <Chip dashed on={isCustom} onClick={() => pickPlace("custom")}>
              {copy.landing.elsewhere}
            </Chip>
          </div>
          {isCustom && (
            <div className="rise mt-3">
              <label htmlFor="dl-city" className="sr-only">
                {copy.landing.elsewherePlaceholder}
              </label>
              <input
                id="dl-city"
                autoFocus
                value={custom}
                maxLength={80}
                onChange={(e) => setCustom(e.target.value)}
                placeholder={copy.landing.elsewherePlaceholder}
                className="w-full min-h-12 rounded-[10px] border-2 border-line bg-card px-4 text-[1rem] text-ink focus:border-indigo focus:outline-none md:max-w-sm"
              />
            </div>
          )}
        </div>

        <div className="mt-5 flex items-center gap-4 rounded-[18px] bg-cloth px-5 py-4" aria-live="polite">
          <DialClock decadeIndex={di} turns={turns} />
          <div>
            <div className="text-[0.82rem] text-ink-soft">{copy.landing.years}</div>
            <div className="display whitespace-nowrap text-[1.75rem] leading-none text-indigo min-[420px]:text-[2rem] md:text-[2.4rem]">
              {from}
              <span aria-hidden className="mx-2 inline-flex items-center align-middle text-gold md:mx-3">
                <span className="h-[2px] w-5 bg-current md:w-11" />
                <span className="h-3 w-3 rounded-full border-2 border-current" />
              </span>
              <span className="sr-only"> to </span>
              {to}
            </div>
          </div>
        </div>

        <div className="mt-5 hidden flex-wrap items-center gap-3 md:flex">
          <ButtonLink href={href} className="min-h-14 px-7 text-[1.05rem]">
            {copy.landing.cta}
          </ButtonLink>
          <a href="#examples" className="inline-flex min-h-12 items-center px-2 font-semibold text-indigo underline-offset-4 hover:underline">
            {copy.landing.example}
          </a>
        </div>
      </div>

      <figure className="relative z-10 mx-auto" style={{ width: 540 * scale }}>
        <div
          ref={table}
          onPointerMove={onMove}
          onPointerLeave={() => {
            table.current?.style.setProperty("--mx", "0");
            table.current?.style.setProperty("--my", "0");
          }}
          className="relative"
          style={{ width: 540 * scale, height: 540 * scale }}
          aria-hidden
        >
          <div className="absolute rounded-full bg-cloth" style={{ left: 30 * scale, top: 40 * scale, width: 480 * scale, height: 480 * scale }} />
          <div className="absolute rounded-full border-2 border-dashed border-indigo/15" style={{ left: 58 * scale, top: 68 * scale, width: 424 * scale, height: 424 * scale }} />
          {cards.map((k, i) => {
            const [l, t, r, depth] = SPOTS[i]!;
            return (
              <div key={`${decade}-${place}-${i}`} className="parallax absolute" style={{ left: l * scale, top: t * scale, ["--depth" as string]: depth } as CSSProperties}>
                <div className="deal" style={{ ["--r" as string]: `${r}deg`, animationDelay: `${i * 90}ms` } as CSSProperties}>
                  <div className="bob" style={{ animationDelay: `${-i * 1.6}s` }}>
                    <Keepsake k={k} scale={scale} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        <figcaption className="mt-2 text-center text-[0.85rem] text-ink-soft">
          {copy.landing.caption(decade, where)}
          <span className="sr-only">: {cards.map((c) => c.title).join(", ")}</span>
        </figcaption>
      </figure>
      <div className="relative z-10 flex flex-col items-stretch gap-2 md:hidden">
        <ButtonLink href={href} full className="min-h-14 text-[1.05rem]">
          {copy.landing.cta}
        </ButtonLink>
        <a href="#examples" className="inline-flex min-h-12 items-center justify-center font-semibold text-indigo underline-offset-4 hover:underline">
          {copy.landing.example}
        </a>
      </div>
    </section>
  );
}

/** Slow background motion: big resist-dye rings drifting behind the hero. */
export function Ambient() {
  const ring = (size: number, cls: string, style: CSSProperties) => (
    <svg width={size} height={size} viewBox="0 0 100 100" className={`absolute ${cls}`} style={style} aria-hidden>
      <circle cx="50" cy="50" r="44" fill="none" stroke="var(--indigo)" strokeWidth="1.2" strokeDasharray="1.5 4.5" strokeLinecap="round" />
      <circle cx="50" cy="50" r="32" fill="none" stroke="var(--indigo)" strokeWidth="2" />
      <circle cx="50" cy="50" r="12" fill="var(--indigo)" />
    </svg>
  );
  return (
    <div className="pointer-events-none absolute inset-x-0 top-0 hidden h-[2400px] overflow-hidden md:block" aria-hidden>
      <div className="absolute inset-0">
        {ring(300, "drift-a", { right: "-200px", top: "2150px" })}
        {ring(240, "drift-b", { left: "-190px", top: "2000px", animationDelay: "-30s" })}
      </div>
    </div>
  );
}

export function MovingBand() {
  return (
    <div
      aria-hidden
      className="band-anim h-[30px]"
      style={{
        backgroundImage:
          "radial-gradient(circle at 21px 15px, transparent 8px, color-mix(in srgb, var(--indigo) 60%, transparent) 8.5px, color-mix(in srgb, var(--indigo) 60%, transparent) 10px, transparent 10.5px), radial-gradient(circle at 21px 15px, color-mix(in srgb, var(--indigo) 65%, transparent) 3.5px, transparent 4px)",
        backgroundSize: "42px 30px, 42px 30px",
      }}
    />
  );
}

export function Landing() {
  const L = copy.landing;
  return (
    <>
      <TimeDial />

      <section aria-labelledby="how" id="how-it-works" className="mt-14 scroll-mt-24 md:mt-20">
        <h2 id="how" className="text-[1.3rem] md:text-[1.5rem]">
          {L.stepsTitle}
        </h2>
        <ol className="mt-5 grid gap-6 md:grid-cols-3">
          {L.steps.map((s, i) => (
            <li key={s.title} className="flex gap-4 md:flex-col md:gap-3">
              <span aria-hidden className="display flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo text-[1.2rem] text-on-indigo">
                {i + 1}
              </span>
              <span>
                <span className="block font-semibold text-ink">{s.title}</span>
                <span className="mt-1 block text-[0.95rem] text-ink-soft">{s.body}</span>
              </span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="why" className="mt-12 grid items-center gap-6 rounded-[22px] bg-cloth p-6 md:mt-16 md:grid-cols-[auto_1fr] md:gap-10 md:p-10">
        <div className="display text-[3.8rem] leading-none text-indigo md:text-[5.5rem]" aria-hidden>
          14
        </div>
        <div>
          <h2 id="why" className="text-[1.2rem] md:text-[1.45rem]">
            {L.whyTitle}
          </h2>
          <p className="mt-3 max-w-[72ch] text-[1.05rem] md:text-[1.15rem]">{L.whyBody}</p>
        </div>
      </section>
    </>
  );
}

export function ClosingCta() {
  const L = copy.landing;
  return (
    <section aria-labelledby="closing" className="mt-12 rounded-[22px] bg-indigo px-6 py-10 md:mt-16 text-center md:px-10 md:py-14">
      <h2 id="closing" className="!text-on-indigo text-[1.45rem] md:text-[1.9rem]">
        {L.closingTitle}
      </h2>
      <p className="mx-auto mt-3 max-w-[52ch] text-on-indigo/90">{L.closingBody}</p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/new/" className="group min-h-14 !bg-white px-7 text-[1.05rem] !text-indigo">
          {L.start}
        </ButtonLink>
        <a href="#examples" className="ghost-sweep">
          {L.example}
        </a>
      </div>
    </section>
  );
}

export function SiteFooter() {
  const L = copy.landing;
  const link = "inline-flex min-h-11 items-center text-[1rem] text-white/85 underline-offset-4 hover:text-white hover:underline";
  const head = "text-[0.8rem] font-semibold uppercase tracking-[0.14em] text-[#ffd37a]";
  return (
    <footer className="relative mt-24 bg-[#0e1535] text-white">
      <div className="pointer-events-none absolute inset-x-0 bottom-full -mb-px overflow-hidden">
        <SkylineStrip />
      </div>
      <div className="mx-auto w-full max-w-6xl px-5 pt-12 md:pt-16">
        <div className="grid gap-10 md:grid-cols-[1.5fr_1fr_1fr_1fr]">
          <div>
            <Link href="/" aria-label="Then & There home" onClick={goHome} className="inline-flex min-h-11 items-center gap-2">
              <svg width={30} height={34} viewBox="0 0 148 172" aria-hidden>
                <path d={PIN} fill="#ffffff" />
                <circle cx="74" cy="70" r="26" fill="#0e1535" />
                <circle cx="74" cy="70" r="12" fill="#f0b440" />
              </svg>
              <span className="display text-[1.6rem] leading-none !text-white">then &amp; there</span>
            </Link>
            <p className="mt-4 max-w-[34ch] text-[1.05rem] text-white/80">{L.footerTag}</p>
            <ButtonLink href="/new/" className="group mt-5 min-h-12 !bg-[#f0b440] px-6 !text-[#0e1535]">
              {L.start}
            </ButtonLink>
          </div>
          <nav aria-label="Plan" className="flex flex-col">
            <span className={head}>Plan</span>
            <Link href="/new/" className={link}>{L.start}</Link>
            <a href="#try" className={link}>{L.tryLink}</a>
            <a href="#examples" className={link}>{copy.home.examplesTitle}</a>
          </nav>
          <nav aria-label="Learn" className="flex flex-col">
            <span className={head}>Learn</span>
            <a href="#how-it-works" className={link}>{L.howLink}</a>
            <a href="#why" className={link}>{L.whyTitle}</a>
            <Link href="/about/" className={link}>Privacy and data</Link>
          </nav>
          <div className="flex flex-col">
            <span className={head}>Good to know</span>
            <p className="mt-2 max-w-[32ch] text-[0.95rem] text-white/75">{L.footerPrivacy}</p>
            <p className="mt-3 max-w-[32ch] text-[0.95rem] text-white/75">{L.footerBuilt}</p>
          </div>
        </div>
      </div>
      <div className="display pointer-events-none mt-10 select-none overflow-hidden whitespace-nowrap text-center leading-[0.8] !text-white/[0.08] md:mt-14" style={{ fontSize: "clamp(3.2rem, 15.5vw, 15rem)" }} aria-hidden>
        then &amp; there
      </div>
      <div className="border-t border-white/15">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1 px-5 py-5 text-[0.85rem] text-white/70 md:flex-row md:justify-between">
          <p>{copy.notMedical}</p>
          <p>Recommendations powered by Qloo · Open source (MIT)</p>
        </div>
      </div>
    </footer>
  );
}

export function PrivacyStrip() {
  const L = copy.landing;
  return (
    <section aria-labelledby="priv" className="mt-12 flex flex-col gap-4 border-l-4 border-gold pl-5 md:mt-16 md:flex-row md:items-center md:justify-between md:gap-10">
      <div>
        <h2 id="priv" className="text-[1.1rem] md:text-[1.3rem]">
          {L.privacyTitle}
        </h2>
        <p className="mt-1 max-w-[60ch] text-ink-soft">{L.privacyBody}</p>
      </div>
      <ButtonLink href="/about/" variant="secondary" className="shrink-0 self-start md:self-center">
        {L.privacyLink}
      </ButtonLink>
    </section>
  );
}
