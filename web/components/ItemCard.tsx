"use client";
import { useEffect, useState } from "react";
import { KindIcon } from "./brand";
import { copy } from "@/lib/copy";
import type { SessionItem } from "@/lib/types";

export function useOnline() {
  const [online, setOnline] = useState(true);
  useEffect(() => {
    const up = () => setOnline(navigator.onLine);
    up();
    window.addEventListener("online", up);
    window.addEventListener("offline", up);
    return () => {
      window.removeEventListener("online", up);
      window.removeEventListener("offline", up);
    };
  }, []);
  return online;
}

export function ItemCard({ item, onSwap, swapping, fresh }: { item: SessionItem; onSwap?: () => void; swapping?: boolean; fresh?: boolean }) {
  const online = useOnline();
  const noMore = item.alternates <= 0;
  return (
    <li aria-busy={swapping || undefined} className={`rounded-[18px] border border-line bg-card p-4 sm:p-5 ${swapping ? "swapping" : ""} ${fresh ? "swap-in" : ""}`}>
      <div className="flex items-center gap-3">
        <KindIcon kind={item.kind} size={40} />
        <div className="flex-1 text-[0.9rem] text-ink-soft">
          <b className="text-ink">{item.slot}</b> · {item.slot === 1 && item.kind === "song" ? copy.warmUp : copy.kindLabel[item.kind]}
        </div>
        <span className="rounded-full border border-line px-2.5 py-0.5 text-[0.75rem] text-indigo">{copy.plan.fromQloo}</span>
      </div>
      <h3 className="display mt-3 text-[1.35rem] leading-snug text-indigo">{item.title}</h3>
      {item.subtitle && <div className="text-[0.95rem] text-ink-soft">{item.subtitle}</div>}
      <p className="mt-2 text-[0.9rem] text-ink-soft">
        <b className="text-ink">{copy.plan.why}</b> {item.why}
      </p>
      <div className="mt-3 rounded-[10px] border-l-4 border-gold bg-ground px-3 py-2">
        <div className="text-[0.78rem] text-ink-soft">{copy.plan.suggested}</div>
        <div className="text-[1.02rem]">“{item.prompt}”</div>
      </div>
      <div className="no-print mt-3 flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-x-4">
          {item.links.map((l) =>
            online ? (
              <a key={l.url} href={l.url} target="_blank" rel="noreferrer" className="inline-flex min-h-12 items-center font-bold text-indigo underline-offset-4 hover:underline">
                ▶ {l.label}
              </a>
            ) : (
              <span key={l.url} className="inline-flex min-h-12 items-center text-ink-soft">
                {l.label} · {copy.plan.needsInternet}
              </span>
            ),
          )}
        </div>
        {onSwap && (
          <button
            onClick={onSwap}
            disabled={noMore || swapping}
            title={noMore ? copy.plan.noMore : undefined}
            className="inline-flex min-h-12 items-center gap-1 rounded-[10px] px-3 font-bold text-indigo hover:bg-cloth disabled:text-ink-soft disabled:hover:bg-transparent"
          >
            <span aria-hidden className={swapping ? "spin-icon" : "inline-block"}>⟳</span> {swapping ? copy.plan.swapping : copy.plan.swap}
            {noMore && <span className="sr-only">. {copy.plan.noMore}</span>}
          </button>
        )}
      </div>
    </li>
  );
}
