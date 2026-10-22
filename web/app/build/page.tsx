"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { WaitTips } from "@/components/WaitTips";
import { WindingLogo } from "@/components/brand";
import { BackLink, Button, ButtonLink, Notice, Page, TopBar } from "@/components/ui";
import { ApiError, eventsUrl, resolveAnchors, startSession } from "@/lib/api";
import { copy } from "@/lib/copy";
import { eraFor, getProfile, regionShort, saveProfile, useHydrated } from "@/lib/store";
import type { ErrorCode, Session, StepKey } from "@/lib/types";

const reducedMotion = () => typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Counts up to `n`, so a result lands with a little life instead of just appearing. */
function CountUp({ n }: { n: number }) {
  const [v, setV] = useState(reducedMotion() ? n : 0);
  useEffect(() => {
    if (reducedMotion()) return setV(n);
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const k = Math.min(1, (t - t0) / 650);
      setV(Math.round(n * (1 - Math.pow(1 - k, 3))));
      if (k < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [n]);
  return <>{v}</>;
}

const ORDER: StepKey[] = ["resolve", "songs", "films", "places", "tastes", "rank", "compose"];
type StepState = { label: string; state: "waiting" | "start" | "done"; count?: number };

function Building() {
  const router = useRouter();
  const id = useSearchParams().get("p");
  const hydrated = useHydrated();
  const [steps, setSteps] = useState<Record<StepKey, StepState>>(
    () => Object.fromEntries(ORDER.map((k) => [k, { label: copy.building.steps[k], state: "waiting" }])) as Record<StepKey, StepState>,
  );
  const [error, setError] = useState<{ code: ErrorCode; message?: string } | null>(null);
  const [slow, setSlow] = useState(false);
  const [taking, setTaking] = useState(false);
  const [ready, setReady] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const profile = hydrated && id ? getProfile(id) : undefined;

  useEffect(() => {
    if (!hydrated || !id) return;
    const p = getProfile(id);
    if (!p) return;
    let es: EventSource | null = null;
    let cancelled = false;
    let navTimer: ReturnType<typeof setTimeout> | undefined;
    const slowTimer = setTimeout(() => setSlow(true), 60_000);
    const takingTimer = setTimeout(() => setTaking(true), 20_000);
    const mark = (k: StepKey, patch: Partial<StepState>) => setSteps((s) => ({ ...s, [k]: { ...s[k], ...patch, label: patch.label ?? s[k].label } }));

    (async () => {
      try {
        // Example people (and old drafts) may hold anchors that haven't been looked up yet.
        let prof = p;
        const unresolved = prof.anchors.filter((a) => !a.status || a.status === "error");
        if (unresolved.length) {
          mark("resolve", { state: "start" });
          const r = await resolveAnchors(unresolved.map((a) => ({ text: a.text, kind: a.kind })));
          let n = 0;
          prof = { ...prof, anchors: prof.anchors.map((a) => (!a.status || a.status === "error" ? r[n++]! : a)) };
          saveProfile(prof);
        }
        const { sessionId } = await startSession(prof);
        if (cancelled) return;
        es = new EventSource(eventsUrl(sessionId));
        es.addEventListener("step", (e) => {
          const d = JSON.parse((e as MessageEvent).data) as { key: StepKey; state: "start" | "done"; label?: string; count?: number };
          mark(d.key, { state: d.state, label: d.label, count: d.count });
        });
        es.addEventListener("session", (e) => {
          const session = JSON.parse((e as MessageEvent).data) as Session;
          es?.close();
          const cur = getProfile(id)!;
          saveProfile({ ...cur, runs: [...cur.runs, { session, responses: {} }] });
          // A beat of "ready" before moving on, so the end of a long wait feels like an arrival.
          setSteps((st) => Object.fromEntries(ORDER.map((k) => [k, { ...st[k], state: "done" }])) as Record<StepKey, StepState>);
          setReady(true);
          const go = () => router.replace(`/plan/?p=${id}`);
          if (reducedMotion()) go();
          else navTimer = setTimeout(go, 1000);
        });
        es.addEventListener("error", (e) => {
          const data = (e as MessageEvent).data;
          es?.close();
          if (data) {
            const d = JSON.parse(data) as { code: ErrorCode; message: string };
            setError({ code: d.code, message: d.message });
          } else if (!cancelled) setError({ code: "network" });
        });
      } catch (e) {
        if (!cancelled) setError({ code: (e instanceof ApiError ? e.code : "network") as ErrorCode });
      }
    })();
    return () => {
      cancelled = true;
      clearTimeout(slowTimer);
      clearTimeout(takingTimer);
      clearTimeout(navTimer);
      es?.close();
    };
  }, [hydrated, id, attempt, router]);

  if (hydrated && !profile)
    return (
      <Page>
        <TopBar left={<BackLink href="/">{copy.building.backHome}</BackLink>} />
        <Notice tone="error">That person isn&apos;t saved on this device.</Notice>
      </Page>
    );
  if (!profile) return null;
  const era = eraFor(profile.birthDecade);

  return (
    <>
      <TopBar left={<BackLink href="/">{copy.building.backHome}</BackLink>} />
      <Page>
        <div className="mt-8 flex flex-col items-center text-center">
          <WindingLogo size={88} still={!!error} />
          <h1 className="mt-5 text-[1.75rem] leading-tight">{copy.building.title(regionShort(profile.region), era.from, era.to)}</h1>
          {ready ? (
            <p className="ready-pop mt-2 inline-flex items-center gap-2 font-semibold text-indigo">
              <svg width="20" height="20" viewBox="0 0 20 20" aria-hidden className="check-draw" fill="none" stroke="var(--gold)" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="10" cy="10" r="8.5" strokeWidth="1.6" />
                <path d="M6 10.5 L9 13.5 L14.5 7" />
              </svg>
              {copy.building.ready}
            </p>
          ) : (
            <p className="mt-2 text-ink-soft">{slow ? copy.building.slow : taking ? copy.building.taking : copy.building.sub}</p>
          )}
        </div>

        {(() => {
          const doneN = ORDER.filter((k) => steps[k].state === "done").length;
          const working = ORDER.some((k) => steps[k].state === "start") ? 0.5 : 0;
          const pct = Math.round(Math.min(1, (doneN + working) / ORDER.length) * 100);
          return (
            <div role="progressbar" aria-label="Building the session" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} className="mt-8 h-1.5 overflow-hidden rounded-full bg-cloth">
              <div className={`build-bar h-full rounded-full bg-gold ${error || ready ? "" : "build-bar-live"}`} style={{ width: `${Math.max(pct, 4)}%` }} />
            </div>
          );
        })()}

        <ol aria-live="polite" className="mt-4 rounded-[18px] border border-line bg-card px-4 py-1">
          {ORDER.map((k, i) => {
            const s = steps[k];
            const word = copy.building.counts[k];
            return (
              <li
                key={k}
                className={`relative -mx-4 flex items-start justify-between gap-3 px-4 py-3 transition-colors duration-500 ${i < ORDER.length - 1 ? "border-b border-cloth" : ""} ${s.state === "waiting" ? "text-ink-soft/70" : "text-ink"} ${s.state === "start" ? "step-active font-semibold" : ""}`}
              >
                <span>{s.label}</span>
                <span className="mt-0.5 flex shrink-0 items-center gap-2" aria-label={s.state === "done" ? "done" : s.state === "start" ? "working" : "waiting"}>
                  {s.state === "done" && !!s.count && word && (
                    <span className="count-pill">
                      <CountUp n={s.count} /> {word}
                    </span>
                  )}
                  {s.state === "done" ? (
                    <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden className="check-draw" fill="none" stroke="var(--indigo)" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3.5 9.5 L7.5 13.5 L14.5 5" />
                    </svg>
                  ) : s.state === "start" ? (
                    <span className="spinner" />
                  ) : null}
                </span>
              </li>
            );
          })}
        </ol>

        {!error && !ready && <WaitTips />}

        {error && (
          <div className="mt-6 flex flex-col gap-3">
            <Notice tone="error">{error.code === "thin_data" && error.message ? error.message : (copy.errors[error.code] ?? copy.errors.network)}</Notice>
            <div className="flex flex-wrap gap-2">
              {error.code !== "qloo_auth" && error.code !== "thin_data" && error.code !== "bad_input" && (
                <Button
                  onClick={() => {
                    setError(null);
                    setSteps(Object.fromEntries(ORDER.map((k) => [k, { label: copy.building.steps[k], state: "waiting" }])) as Record<StepKey, StepState>);
                    setAttempt((a) => a + 1);
                  }}
                >
                  {copy.building.retry}
                </Button>
              )}
              <ButtonLink variant="secondary" href={`/new/?p=${profile.id}`}>
                {copy.plan.edit}
              </ButtonLink>
            </div>
          </div>
        )}

        <p className="mt-8 text-center text-[0.875rem] text-ink-soft">{copy.building.footnote}</p>
      </Page>
    </>
  );
}

export default function BuildPage() {
  return (
    <Suspense>
      <Building />
    </Suspense>
  );
}
