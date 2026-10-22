"use client";
import { useEffect, useState } from "react";
import { copy } from "@/lib/copy";

/** Short, calm tips that rotate while Qloo works, so a long wait has something to read. */
export function WaitTips({ every = 7000 }: { every?: number }) {
  const tips = copy.building.tips;
  const [i, setI] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setI((n) => (n + 1) % tips.length), every);
    return () => clearInterval(t);
  }, [every, tips.length]);

  return (
    <div className="mt-6 rounded-[18px] border border-line bg-cloth/60 px-5 py-4 text-center" aria-live="off">
      <div className="text-[0.75rem] font-semibold uppercase tracking-[0.14em] text-gold-ink">{copy.building.tipsTitle}</div>
      <p key={i} className="tip-in mt-2 min-h-[3.2rem] text-[1rem] text-ink">
        {tips[i]}
      </p>
      <div className="mt-2 flex justify-center gap-1.5" aria-hidden>
        {tips.map((_, n) => (
          <span key={n} className={`h-1.5 rounded-full transition-all duration-500 ${n === i ? "w-5 bg-gold" : "w-1.5 bg-line"}`} />
        ))}
      </div>
    </div>
  );
}
