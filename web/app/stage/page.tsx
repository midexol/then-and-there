"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { IndigoBand, Logo } from "@/components/brand";
import { Keepsake, itemKeepsake } from "@/components/keepsakes";
import { useOnline } from "@/components/ItemCard";
import { copy } from "@/lib/copy";
import { regionShort, updateRun, useHydrated, useProfile } from "@/lib/store";
import type { Response } from "@/lib/types";

function useWakeLock() {
  useEffect(() => {
    let lock: { release: () => Promise<void> } | null = null;
    const nav = navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<{ release: () => Promise<void> }> } };
    const get = () => nav.wakeLock?.request("screen").then((l) => (lock = l)).catch(() => {});
    get();
    const onVis = () => document.visibilityState === "visible" && get();
    document.addEventListener("visibilitychange", onVis);
    return () => {
      document.removeEventListener("visibilitychange", onVis);
      lock?.release().catch(() => {});
    };
  }, []);
}

const TIPS_KEY = "then-and-there:tips-seen";
const tipsSeen = () => {
  try {
    return localStorage.getItem(TIPS_KEY) === "1";
  } catch {
    return false;
  }
};

function Tips({ onDone }: { onDone: () => void }) {
  const t = copy.tips;
  return (
    <div className="flex min-h-dvh flex-col bg-indigo-deep text-[#F3F4F0]">
      <IndigoBand height={26} tone="dark" />
      <main className="rise mx-auto flex w-full max-w-xl flex-1 flex-col justify-center px-6 py-10">
        <h1 className="display text-[2.2rem] leading-tight text-[#F3F4F0]">{t.title}</h1>
        <p className="mt-2 text-[1rem] text-[#B8C0DC]">{t.sub}</p>
        <ol className="mt-8 flex flex-col gap-6">
          {t.items.map((it, n) => (
            <li key={it.title} className="flex gap-4">
              <span aria-hidden className="display flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-[#24336E] text-[1.2rem] text-[#F0B440]">
                {n + 1}
              </span>
              <span>
                <span className="block text-[1.15rem] font-bold">{it.title}</span>
                <span className="mt-1 block text-[1rem] leading-relaxed text-[#E4E8F3]">{it.body}</span>
              </span>
            </li>
          ))}
        </ol>
        <button onClick={onDone} className="mt-10 min-h-[72px] rounded-[16px] bg-[#F0B440] text-[1.3rem] font-bold text-[#121A3D]">
          {t.begin}
        </button>
        <button onClick={onDone} className="mt-2 min-h-12 text-[0.9rem] text-[#B8C0DC] underline-offset-4 hover:underline">
          {t.skip}
        </button>
      </main>
      <IndigoBand height={26} tone="dark" />
    </div>
  );
}

function Stage() {
  const id = useSearchParams().get("p");
  const router = useRouter();
  const hydrated = useHydrated();
  const p = useProfile(id);
  const [i, setI] = useState(0);
  const [pulse, setPulse] = useState(0);
  const [showTips, setShowTips] = useState<boolean | null>(null);
  useEffect(() => setShowTips(!tipsSeen()), []);
  const online = useOnline();
  const [wide, setWide] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px) and (min-height: 700px)");
    const on = () => setWide(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  useWakeLock();

  const run = p?.runs.at(-1);
  const items = run?.session.items ?? [];
  const item = items[i];

  useEffect(() => {
    if (p && run && !run.startedAt) updateRun(p.id, (r) => ({ ...r, startedAt: new Date().toISOString() }));
  }, [p, run]);

  const end = useCallback(() => {
    if (p) updateRun(p.id, (r) => ({ ...r, endedAt: new Date().toISOString() }));
    router.push(`/review/?p=${id}`);
  }, [p, id, router]);

  const go = useCallback(
    (d: number) => {
      const n = i + d;
      if (n < 0) return;
      if (n >= items.length) return end();
      setI(n);
      setPulse(0);
    },
    [i, items.length, end],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight") go(1);
      if (e.key === "ArrowLeft") go(-1);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go]);

  if (!hydrated) return null;
  if (!p || !run || !item)
    return (
      <div className="p-8">
        <Link href="/" className="font-bold text-indigo">
          ‹ {copy.plan.people}
        </Link>
      </div>
    );

  if (showTips === null) return null;
  if (showTips)
    return (
      <Tips
        onDone={() => {
          try {
            localStorage.setItem(TIPS_KEY, "1");
          } catch {
            /* fine: tips show again next time */
          }
          setShowTips(false);
        }}
      />
    );

  const answer = run.responses[item.id];
  const respond = (r: Response) => {
    updateRun(p.id, (cur) => ({ ...cur, responses: { ...cur.responses, [item.id]: r } }));
    if (r === "yes") setPulse((n) => n + 1);
  };
  const link = item.links[0];
  const btn = "min-h-[72px] flex-1 rounded-[16px] px-2 text-[1.05rem] leading-tight font-bold transition-colors sm:px-4 sm:text-[1.3rem]";

  return (
    <div className="flex min-h-dvh flex-col bg-indigo-deep text-[#F3F4F0]" style={{ fontSize: 22 }}>
      <IndigoBand height={26} tone="dark" />
      <header className="flex items-center justify-between gap-3 px-5 pt-4 sm:px-10">
        <div className="flex items-center gap-2 text-[0.8rem] text-[#B8C0DC]">
          <Logo size={24} inverted />
          <span>{p.nickname}</span>
        </div>
        <ol className="hidden items-center gap-1.5 sm:flex" aria-label={copy.stage.of(i + 1, items.length)}>
          {items.map((it, n) => (
            <li
              key={it.id}
              className="h-1.5 w-6 rounded-full"
              style={{ background: run.responses[it.id] === "yes" ? "#F0B440" : n <= i ? "#F3F4F0" : "#3A4785" }}
            />
          ))}
        </ol>
        <button onClick={end} className="min-h-12 rounded-[12px] border border-[#3A4785] px-4 text-[0.8rem] font-bold text-[#B8C0DC] hover:text-white">
          {copy.stage.end}
        </button>
      </header>

      <main key={item.id} className="flex flex-1 flex-col items-center justify-center gap-4 px-6 py-6 text-center sm:gap-5 sm:px-16">
        <div className="deal" style={{ ["--r" as string]: `${[-4, 3, -2, 4][i % 4]}deg` } as React.CSSProperties} aria-hidden>
          <div className="bob">
            <Keepsake k={itemKeepsake(item, regionShort(p.region))} scale={wide ? 0.62 : 0.42} />
          </div>
        </div>
        <div className="text-[0.85rem] text-[#B8C0DC]">{copy.stage.eyebrow(item.kind, regionShort(p.region), item.year)}</div>
        <div className="rise flex flex-col items-center">
          <h1 className="display text-[2.2rem] leading-[1.08] text-[#F3F4F0] sm:text-[2.75rem]" lang={undefined}>
            {item.title}
          </h1>
          {item.subtitle && !/^Film/.test(item.subtitle) && <div className="mt-2 text-[0.85rem] text-[#B8C0DC]">{item.subtitle}</div>}
          <div className="mt-4 h-1 w-28 overflow-hidden rounded-full">
            {pulse > 0 && <div key={pulse} className="thread h-full w-full bg-[#F0B440]" />}
          </div>
        </div>
        <p className="max-w-[32ch] text-[1.2rem] leading-snug text-[#E4E8F3] sm:text-[1.35rem]">“{item.prompt}”</p>
        <div className="text-[0.7rem] text-[#8F98BA]">{copy.plan.suggested}</div>
        {link &&
          (online ? (
            <a href={link.url} target="_blank" rel="noreferrer" className="inline-flex min-h-14 items-center rounded-[14px] bg-[#24336E] px-6 text-[0.9rem] font-bold text-white hover:bg-[#2E3F85]">
              ▶ {link.label}
            </a>
          ) : (
            <span className="text-[0.8rem] text-[#8F98BA]">{copy.plan.needsInternet}</span>
          ))}
      </main>

      <section className="px-5 pb-3 sm:px-10" aria-label={copy.stage.spark}>
        <div className="mb-3 text-center text-[0.95rem]">{copy.stage.spark}</div>
        <div className="mx-auto flex max-w-2xl gap-3">
          <button aria-pressed={answer === "yes"} onClick={() => respond("yes")} className={`${btn} ${answer === "yes" ? "bg-[#F0B440] text-[#121A3D]" : "bg-[#D9981C] text-[#121A3D] opacity-90 hover:opacity-100"}`}>
            {copy.stage.yes}
          </button>
          <button aria-pressed={answer === "little"} onClick={() => respond("little")} className={`${btn} border-2 ${answer === "little" ? "border-[#F3F4F0] bg-[#2E3F85]" : "border-[#3A4785] bg-[#24336E]"}`}>
            {copy.stage.little}
          </button>
          <button aria-pressed={answer === "no"} onClick={() => respond("no")} className={`${btn} border-2 ${answer === "no" ? "border-[#F3F4F0] text-white" : "border-[#3A4785] text-[#B8C0DC]"}`}>
            {copy.stage.no}
          </button>
        </div>
      </section>

      <nav className="flex items-center justify-between px-5 pb-4 pt-2 sm:px-10">
        <button onClick={() => go(-1)} disabled={i === 0} className="min-h-14 px-3 text-[0.95rem] text-[#B8C0DC] disabled:opacity-30">
          ‹ {copy.stage.back}
        </button>
        <span className="text-[0.8rem] text-[#8F98BA]" aria-live="polite">
          {copy.stage.of(i + 1, items.length)}
        </span>
        <button onClick={() => go(1)} className="min-h-14 px-3 text-[0.95rem] font-bold text-white">
          {i === items.length - 1 ? copy.stage.finish : copy.stage.next} ›
        </button>
      </nav>
      <IndigoBand height={26} tone="dark" />
    </div>
  );
}

export default function StagePage() {
  return (
    <Suspense>
      <Stage />
    </Suspense>
  );
}
