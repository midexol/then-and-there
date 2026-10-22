"use client";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { IndigoBand, Wordmark } from "@/components/brand";
import { BackLink, Button, TopBar } from "@/components/ui";
import { copy } from "@/lib/copy";
import { regionShort, useHydrated, useProfile } from "@/lib/store";

function PrintCard() {
  const id = useSearchParams().get("p");
  const hydrated = useHydrated();
  const p = useProfile(id);
  if (!hydrated) return null;
  const run = p?.runs.at(-1);
  if (!p || !run) return null;
  const s = run.session;
  return (
    <>
      <TopBar left={<BackLink href={`/plan/?p=${p.id}`}>{copy.plan.people}</BackLink>} right={<Button onClick={() => window.print()}>{copy.print.print}</Button>} />
      <article className="mx-auto my-4 w-full max-w-[210mm] bg-white text-[#1B1D24] shadow-sm print:my-0 print:shadow-none" style={{ colorScheme: "light" }}>
        <div style={{ ["--indigo" as string]: "#24336E" }}>
          <IndigoBand height={24} />
        </div>
        <header className="flex items-end justify-between gap-4 border-b-2 border-[#24336E] px-8 pb-3 pt-5">
          <div>
            <h1 className="text-[1.6rem] leading-tight" style={{ color: "#121A3D" }}>
              {p.nickname}
            </h1>
            <div className="text-[0.8rem] text-[#565B6B]">
              {copy.print.title} · {regionShort(p.region)}, about {s.eraWindow.from}–{s.eraWindow.to} · {copy.print.date}: ____________
            </div>
          </div>
          <div style={{ ["--indigo" as string]: "#24336E", ["--ground" as string]: "#FFFFFF" }}>
            <Wordmark size={15} />
          </div>
        </header>
        <ol className="px-8 pt-1">
          {s.items.map((it) => (
            <li key={it.id} className="grid grid-cols-[1.6rem_1fr_auto] gap-3 border-b border-[#E4E8F3] py-2.5">
              <b className="text-[#24336E]">{it.slot}</b>
              <div>
                <div className="text-[0.9rem] font-bold">
                  {copy.kindShort[it.kind]} · {it.title}
                  {it.subtitle ? <span className="font-normal text-[#565B6B]"> · {it.subtitle}</span> : null}
                </div>
                <div className="text-[0.82rem] text-[#565B6B]">“{it.prompt}”</div>
              </div>
              <div className="whitespace-nowrap text-[0.7rem] text-[#8C91A0]">☐ Yes ☐ A little</div>
            </li>
          ))}
        </ol>
        <div className="px-8 pt-4">
          <div className="text-[0.8rem] font-bold text-[#565B6B]">{copy.print.notes}</div>
          {[0, 1, 2, 3].map((n) => (
            <div key={n} className="h-7 border-b border-[#CBD1E2]" />
          ))}
        </div>
        <p className="px-8 pb-6 pt-4 text-[0.7rem] text-[#8C91A0]">{copy.print.footer}</p>
      </article>
    </>
  );
}

export default function PrintPage() {
  return (
    <Suspense>
      <PrintCard />
    </Suspense>
  );
}
