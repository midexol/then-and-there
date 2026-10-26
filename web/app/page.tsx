"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { IndigoBand } from "@/components/brand";
import { SiteHeader } from "@/components/SiteHeader";
import { Notice, Page } from "@/components/ui";
import { Ambient, ClosingCta, Hero, Landing, PrivacyStrip, SiteFooter } from "@/components/Landing";
import { health } from "@/lib/api";
import { copy } from "@/lib/copy";
import { EXAMPLES, eraFor, profileFromExample, relativeDay, saveProfile, useHydrated, useProfiles } from "@/lib/store";
import type { Profile } from "@/lib/types";

function PersonTile({ p }: { p: Profile }) {
  const last = p.runs.at(-1);
  const href = last ? `/plan/?p=${p.id}` : `/build/?p=${p.id}`;
  const era = eraFor(p.birthDecade);
  return (
    <Link href={href} className="block rounded-[16px] border border-line bg-card p-4 transition-colors hover:border-indigo">
      <div className="text-[1.15rem] font-semibold text-ink">{p.nickname}</div>
      <div className="mt-2 flex flex-wrap gap-2 text-[0.875rem]">
        <span className="rounded-full bg-cloth px-3 py-1 text-indigo">
          <b>Then</b> · {era.from} to {era.to}
        </span>
        <span className="rounded-full bg-cloth px-3 py-1 text-indigo">
          <b>There</b> · {p.region.split(",")[0]}
        </span>
      </div>
      <div className="mt-2 text-[0.875rem] text-ink-soft">{last ? copy.home.lastSession(relativeDay(last.session.createdAt), last.session.items.length) : copy.home.noSessions}</div>
    </Link>
  );
}

function Examples({ onPick }: { onPick: (i: number) => void }) {
  return (
    <section id="examples" aria-labelledby="ex" className="mt-12 scroll-mt-24 md:mt-16">
      <h2 id="ex" className="text-[1.2rem] md:text-[1.35rem]">{copy.home.examplesTitle}</h2>
      <p className="mt-1 text-ink-soft">{copy.home.examplesSub}</p>
      <ul className="mt-4 grid gap-3 sm:grid-cols-3">
        {EXAMPLES.map((ex, i) => (
          <li key={ex.nickname}>
            <button onClick={() => onPick(i)} className="group h-full w-full rounded-[16px] border-2 border-line bg-card p-4 text-left transition-colors hover:border-indigo">
              <span className="block font-semibold text-ink">{ex.nickname}</span>
              <span className="block text-[0.9rem] text-ink-soft">
                {ex.region.split(",")[0]} · born in the {ex.birthDecade}
              </span>
              <span className="mt-1 block text-[0.85rem] text-ink-soft">{ex.anchors.map((a) => a.text).join(", ")}</span>
              <span className="mt-3 flex items-center gap-1 text-[0.9rem] font-semibold text-indigo">See this session</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

export default function Home() {
  const hydrated = useHydrated();
  const profiles = useProfiles();
  const router = useRouter();
  const [mode, setMode] = useState<"live" | "mock" | null>(null);
  useEffect(() => {
    health().then((h) => setMode(h?.mode ?? null));
  }, []);

  const pick = (i: number) => {
    const p = profileFromExample(i);
    saveProfile(p);
    router.push(`/build/?p=${p.id}`);
  };

  // The landing is what the static HTML contains and what a first-time visitor sees at once.
  const landing = !hydrated || profiles.length === 0;
  return (
    <div className="relative overflow-x-clip">
      {!landing && <IndigoBand height={30} />}
      {landing && <Ambient />}
      <SiteHeader landing={landing} />
      {landing && <Hero />}
      <Page narrow={false} className={`relative ${landing ? "max-w-6xl" : "max-w-4xl"}`}>
        {mode === "mock" && (
          <div className="mt-4">
            <Notice>{copy.home.demoMode}</Notice>
          </div>
        )}

        {hydrated && profiles.length > 0 ? (
          <>
            <h1 className="mt-10 text-[2rem] leading-[1.15]">{copy.home.title}</h1>
            <p className="mt-2 text-ink-soft">{copy.home.sub}</p>
            <ul className="mt-6 grid gap-3 sm:grid-cols-2">
              {profiles.map((p) => (
                <li key={p.id}>
                  <PersonTile p={p} />
                </li>
              ))}
              <li>
                <Link
                  href="/new/"
                  className="flex h-full min-h-[120px] items-center justify-center rounded-[16px] border-2 border-dashed border-line font-semibold text-indigo hover:border-indigo"
                >
                  + {copy.home.addSomeone}
                </Link>
              </li>
            </ul>
            <Examples onPick={pick} />
          </>
        ) : (
          <>
            <Landing />
            <Examples onPick={pick} />
            <PrivacyStrip />
            <ClosingCta />
          </>
        )}

        {!landing && <p className="mt-14 text-[0.875rem] text-ink-soft">{copy.notMedical}</p>}
      </Page>
      {landing && <SiteFooter />}
    </div>
  );
}
