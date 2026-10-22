"use client";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { ItemCard } from "@/components/ItemCard";
import { Logo } from "@/components/brand";
import { BackLink, ButtonLink, Notice, Page, Pill, TopBar } from "@/components/ui";
import { ApiError, swap } from "@/lib/api";
import { copy } from "@/lib/copy";
import { regionShort, updateRun, useHydrated, useProfile } from "@/lib/store";

function Plan() {
  const id = useSearchParams().get("p");
  const hydrated = useHydrated();
  const p = useProfile(id);
  const [swapping, setSwapping] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);

  if (!hydrated) return null;
  const run = p?.runs.at(-1);
  if (!p || !run)
    return (
      <Page>
        <TopBar left={<BackLink href="/">{copy.plan.people}</BackLink>} />
        <Notice tone="error">There&apos;s no session here yet.</Notice>
        <div className="mt-4">{p && <ButtonLink href={`/build/?p=${p.id}`}>{copy.builder.build}</ButtonLink>}</div>
      </Page>
    );
  const s = run.session;
  const thin = s.items.length < 8;

  async function doSwap(itemId: string) {
    setSwapping(itemId);
    setErr(null);
    try {
      const r = await swap(s.id, itemId);
      const alt = new Map(r.items.map((x) => [x.id, x.alternates]));
      setFresh(r.item.id);
      updateRun(p!.id, (cur) => ({
        ...cur,
        session: {
          ...cur.session,
          items: cur.session.items.map((it) => (it.id === itemId ? r.item : { ...it, alternates: alt.get(it.id) ?? it.alternates })),
        },
      }));
    } catch (e) {
      if (e instanceof ApiError && e.code === "no_alternates")
        updateRun(p!.id, (cur) => ({ ...cur, session: { ...cur.session, items: cur.session.items.map((it) => (it.id === itemId ? { ...it, alternates: 0 } : it)) } }));
      else setErr(e instanceof ApiError && e.code in copy.errors ? copy.errors[e.code as keyof typeof copy.errors] : copy.errors.network);
    } finally {
      setSwapping(null);
    }
  }

  return (
    <>
      <TopBar
        left={<BackLink href="/">{copy.plan.people}</BackLink>}
        right={
          <>
            <Link href={`/new/?p=${p.id}`} className="inline-flex min-h-12 items-center px-2 font-bold text-indigo">
              {copy.plan.edit}
            </Link>
            <Link href={`/print/?p=${p.id}`} className="inline-flex min-h-12 items-center px-2 font-bold text-indigo">
              {copy.plan.print}
            </Link>
          </>
        }
      />
      <Page narrow={false} className="max-w-3xl">
        <div className="mt-4 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-[2rem] leading-[1.15]">{p.nickname}</h1>
            <div className="mt-3 flex flex-wrap gap-2">
              <Pill label={copy.plan.then}>
                {s.eraWindow.from}–{s.eraWindow.to}
              </Pill>
              <Pill label={copy.plan.there}>{regionShort(p.region)}</Pill>
              <Pill>{copy.plan.length(s.items.length)}</Pill>
            </div>
          </div>
          <Link href="/" aria-label="Then & There home" className="hidden sm:block">
            <Logo size={44} />
          </Link>
        </div>

        {(thin || s.notes.length > 0) && (
          <div className="mt-5 flex flex-col gap-2">
            {s.notes.map((n) => (
              <Notice key={n} tone={/strong matches/.test(n) ? "gold" : "info"}>
                {n}
              </Notice>
            ))}
          </div>
        )}
        {err && (
          <div className="mt-4">
            <Notice tone="error">{err}</Notice>
          </div>
        )}

        <div className="mt-6 hidden sm:flex sm:gap-3">
          <ButtonLink href={`/stage/?p=${p.id}`} className="min-h-14 px-8">
            {copy.plan.start}
          </ButtonLink>
          <ButtonLink variant="secondary" href={`/print/?p=${p.id}`} className="min-h-14">
            {copy.plan.print}
          </ButtonLink>
        </div>

        <ol className="mt-6 flex flex-col gap-3">
          {s.items.map((it) => (
            <ItemCard key={it.id} item={it} onSwap={() => doSwap(it.id)} swapping={swapping === it.id} fresh={fresh === it.id} />
          ))}
        </ol>

        <p className="mt-6 text-center text-[0.875rem] text-ink-soft">{copy.plan.disclaimer(p.nickname)}</p>
        <div className="h-24 sm:hidden" />
      </Page>
      <div className="no-print fixed inset-x-0 bottom-0 bg-gradient-to-t from-ground from-60% to-transparent px-5 pb-5 pt-8 sm:hidden">
        <ButtonLink href={`/stage/?p=${p.id}`} full className="min-h-14 text-[1.05rem]">
          {copy.plan.start}
        </ButtonLink>
      </div>
    </>
  );
}

export default function PlanPage() {
  return (
    <Suspense>
      <Plan />
    </Suspense>
  );
}
