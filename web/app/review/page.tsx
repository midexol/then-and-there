"use client";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useState } from "react";
import { BackLink, Button, Notice, Page, TopBar } from "@/components/ui";
import { copy } from "@/lib/copy";
import { deleteProfile, regionShort, updateProfile, updateRun, useHydrated, useProfile } from "@/lib/store";
import { Keepsake, itemKeepsake } from "@/components/keepsakes";
import type { Response, SessionItem } from "@/lib/types";

function Group({ title, items, tone }: { title: string; items: SessionItem[]; tone: "gold" | "indigo" | "soft" }) {
  if (!items.length) return null;
  const border = tone === "gold" ? "border-2 border-gold" : "border border-line";
  const head = tone === "gold" ? "text-gold-ink" : tone === "indigo" ? "text-indigo" : "text-ink-soft";
  return (
    <section className={`rounded-[16px] bg-card p-4 ${border}`}>
      <h2 className={`font-body text-[0.95rem] font-bold ${head}`} style={{ fontFamily: "var(--font-body)" }}>
        {title} · {items.length}
      </h2>
      <ul className="mt-2 flex flex-col gap-1">
        {items.map((i) => (
          <li key={i.id} className={tone === "soft" ? "text-ink-soft" : "text-ink"}>
            {i.title}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Review() {
  const id = useSearchParams().get("p");
  const router = useRouter();
  const hydrated = useHydrated();
  const p = useProfile(id);
  const [confirm, setConfirm] = useState(false);
  if (!hydrated) return null;
  const run = p?.runs.at(-1);
  if (!p || !run)
    return (
      <Page>
        <TopBar left={<BackLink href="/">{copy.plan.people}</BackLink>} />
        <Notice tone="error">There&apos;s no session here yet.</Notice>
      </Page>
    );

  const items = run.session.items;
  const by = (r: Response | undefined) => items.filter((i) => run.responses[i.id] === r);
  const yes = by("yes"),
    little = by("little"),
    no = by("no"),
    none = by(undefined);
  const mins = run.startedAt && run.endedAt ? Math.max(1, Math.round((+new Date(run.endedAt) - +new Date(run.startedAt)) / 60000)) : undefined;

  function planNext() {
    const warmUp = items.find((i) => i.provenance.operation === "describe")?.provenance.qlooId;
    const shown = items.map((i) => i.provenance.qlooId).filter((q) => q !== warmUp);
    updateProfile(p!.id, (cur) => ({
      ...cur,
      boost: [...new Set([...yes.map((i) => i.provenance.qlooId), ...cur.boost])].slice(0, 20),
      avoid: [...new Set([...cur.avoid, ...shown])].slice(-60),
    }));
    router.push(`/build/?p=${p!.id}`);
  }

  function exportJson() {
    const blob = new Blob([JSON.stringify(p, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `then-and-there-${p!.nickname.replace(/\W+/g, "-").toLowerCase() || "profile"}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  }

  return (
    <>
      <TopBar
        left={<BackLink href="/">{copy.plan.people}</BackLink>}
        right={
          <Link href={`/print/?p=${p.id}`} className="inline-flex min-h-12 items-center px-2 font-bold text-indigo">
            {copy.plan.print}
          </Link>
        }
      />
      <Page>
        <h1 className="mt-4 text-[2rem] leading-[1.15]">{copy.review.title(p.nickname)}</h1>
        <p className="mt-1 text-ink-soft">{copy.review.meta(items.length, mins)}</p>

        {yes.length > 0 && (
          <section aria-label={copy.review.keepsakes} className="-mx-5 mt-6 overflow-x-auto px-5 pb-3">
            <div className="flex items-end gap-5 pt-3">
              {yes.map((it, n) => (
                <div key={it.id} className="deal shrink-0" style={{ ["--r" as string]: `${n % 2 ? 4 : -4}deg`, animationDelay: `${n * 110}ms` } as React.CSSProperties}>
                  <Keepsake k={itemKeepsake(it, regionShort(p.region))} scale={0.5} />
                </div>
              ))}
            </div>
            <p className="mt-2 text-[0.85rem] text-ink-soft">{copy.review.keepsakesNote}</p>
          </section>
        )}

        <div className="mt-6 flex flex-col gap-3">
          <Group title={copy.review.sparked} items={yes} tone="gold" />
          <Group title={copy.review.little} items={little} tone="indigo" />
          <Group title={copy.review.notReally} items={no} tone="soft" />
          <Group title={copy.review.unanswered} items={none} tone="soft" />
        </div>

        <p className="mt-5 text-[0.95rem] text-ink-soft">{copy.review.sadness}</p>

        <section className="mt-5 rounded-[16px] bg-cloth p-4">
          <h2 className="text-[1.2rem]">{copy.review.nextTitle}</h2>
          {yes.length || no.length ? (
            <p className="mt-1">
              {yes.length > 0 && (
                <>
                  {copy.review.lean} <b>{yes.map((i) => i.title).join(", ")}</b>.{" "}
                </>
              )}
              {no.length > 0 && (
                <>
                  {copy.review.skip} <b>{no.map((i) => i.title).join(", ")}</b>.
                </>
              )}
            </p>
          ) : (
            <p className="mt-1 text-ink-soft">{copy.review.nextEmpty}</p>
          )}
        </section>

        <div className="mt-5">
          <label htmlFor="note" className="font-bold">
            {copy.review.note}
          </label>
          <textarea
            id="note"
            rows={3}
            defaultValue={run.note ?? ""}
            placeholder={copy.review.notePlaceholder}
            onBlur={(e) => updateRun(p.id, (r) => ({ ...r, note: e.target.value }))}
            className="mt-2 w-full rounded-[10px] border-2 border-line bg-card p-3 text-ink focus:border-indigo focus:outline-none"
          />
        </div>

        <div className="mt-8 flex flex-col gap-3">
          <Button full onClick={planNext} className="min-h-14 text-[1.05rem]">
            {copy.review.planNext}
          </Button>
          {!confirm ? (
            <div className="flex justify-center gap-4">
              <Button variant="quiet" onClick={exportJson}>
                {copy.review.export}
              </Button>
              <Button variant="quiet" onClick={() => setConfirm(true)} style={{ color: "var(--err)" }}>
                {copy.review.delete}
              </Button>
            </div>
          ) : (
            <div role="alertdialog" aria-label={copy.review.confirmDelete} className="rounded-[14px] border-2 border-err bg-card p-4 text-center">
              <p className="font-bold">{copy.review.confirmDelete}</p>
              <div className="mt-3 flex justify-center gap-3">
                <Button
                  className="bg-err text-white"
                  onClick={() => {
                    deleteProfile(p.id);
                    router.push("/");
                  }}
                >
                  {copy.review.confirmYes}
                </Button>
                <Button variant="secondary" onClick={() => setConfirm(false)}>
                  {copy.review.cancel}
                </Button>
              </div>
            </div>
          )}
        </div>
      </Page>
    </>
  );
}

export default function ReviewPage() {
  return (
    <Suspense>
      <Review />
    </Suspense>
  );
}
