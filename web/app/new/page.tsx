"use client";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useRef, useState } from "react";
import { BackLink, Button, Notice, Page, TopBar } from "@/components/ui";
import { KindIcon } from "@/components/brand";
import { ApiError, resolveAnchors } from "@/lib/api";
import { copy } from "@/lib/copy";
import { eraFor, getProfile, newId, saveProfile } from "@/lib/store";
import { BIRTH_DECADES, type AnchorChip, type AnchorKind, type BirthDecade, type Profile } from "@/lib/types";

const KINDS: AnchorKind[] = ["music", "food", "film_tv", "place", "work_hobby"];
const MIN_MATCHED = 3;

function Progress({ step }: { step: number }) {
  return (
    <div className="mt-2" aria-label={copy.builder.step(step)}>
      <div className="mb-2 text-[0.875rem] text-ink-soft">{copy.builder.step(step)}</div>
      <div className="grid grid-cols-3 gap-1.5" aria-hidden>
        {[1, 2, 3].map((n) => (
          <div key={n} className={`h-1.5 rounded-full ${n <= step ? "bg-indigo" : "bg-line"}`} />
        ))}
      </div>
    </div>
  );
}

function Field({ label, help, children, id }: { label: string; help?: string; children: React.ReactNode; id: string }) {
  return (
    <div className="mt-8">
      <label htmlFor={id} className="display block text-[1.6rem] leading-tight text-indigo">
        {label}
      </label>
      {help && (
        <p id={`${id}-help`} className="mt-1 text-[0.95rem] text-ink-soft">
          {help}
        </p>
      )}
      <div className="mt-3">{children}</div>
    </div>
  );
}

const inputCls =
  "w-full min-h-12 rounded-[10px] border-2 border-line bg-card px-4 text-[1.05rem] text-ink placeholder:text-ink-soft/70 focus:border-indigo focus:outline-none";

function Chip({ a, onRemove, onRetry, onOpen, open }: { a: AnchorChip; onRemove: () => void; onRetry: () => void; onOpen: () => void; open: boolean }) {
  const label = a.match?.name ?? a.text;
  const base = "inline-flex min-h-11 items-center gap-1 rounded-full pl-3 text-[0.95rem]";
  let cls = "",
    icon = "",
    action: (() => void) | undefined,
    title = "";
  switch (a.status) {
    case "matched":
      cls = "bg-indigo text-on-indigo";
      icon = "✓";
      title = a.match?.subtitle ? `${a.match.name} · ${a.match.subtitle}` : `${a.match?.name} · ${a.match?.type}`;
      break;
    case "choose":
      cls = "border-2 border-dashed border-gold bg-card text-ink";
      icon = "?";
      action = onOpen;
      title = copy.builder.choose;
      break;
    case "none":
      cls = "bg-cloth text-ink-soft";
      icon = "✕";
      title = copy.builder.notFound(a.text);
      break;
    case "error":
      cls = "border-2 border-err bg-card text-ink";
      icon = "!";
      action = onRetry;
      title = copy.builder.lookupFailed;
      break;
    default:
      cls = "bg-cloth text-ink-soft";
      icon = "";
      title = copy.builder.resolving;
  }
  return (
    <span className={`${base} ${cls} ${!a.status ? "shimmer" : ""} ${a.status === "matched" ? "chip-pop" : ""}`} title={title}>
      {action ? (
        <button type="button" onClick={action} aria-expanded={a.status === "choose" ? open : undefined} className="inline-flex min-h-11 items-center gap-1 font-bold">
          <span aria-hidden>{icon}</span> {label}
        </button>
      ) : (
        <span className="inline-flex items-center gap-1">
          {icon ? <span aria-hidden>{icon}</span> : null}
          {label}
          {!icon && (
            <span aria-hidden className="dots">
              <i />
              <i />
              <i />
            </span>
          )}
          <span className="sr-only">: {title}</span>
        </span>
      )}
      <button type="button" onClick={onRemove} aria-label={copy.builder.remove(label)} className="inline-flex h-11 w-10 items-center justify-center rounded-full opacity-80 hover:opacity-100">
        ×
      </button>
    </span>
  );
}

function Builder() {
  const router = useRouter();
  const params = useSearchParams();
  const editId = params.get("p");
  const [step, setStep] = useState(1);
  const [p, setP] = useState<Profile>(() => ({
    id: newId(),
    nickname: "",
    birthDecade: "1940s",
    region: "",
    anchors: [],
    avoidTopics: [],
    boost: [],
    avoid: [],
    runs: [],
    createdAt: new Date().toISOString(),
  }));
  const [decadeChosen, setDecadeChosen] = useState(false);
  const [kind, setKind] = useState<AnchorKind>("music");
  const [text, setText] = useState("");
  const [avoidText, setAvoidText] = useState("");
  const [openChip, setOpenChip] = useState<number | null>(null);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const headingRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (editId) return;
    const d = params.get("decade");
    const r = params.get("region");
    if (d && (BIRTH_DECADES as readonly string[]).includes(d)) {
      setP((cur) => ({ ...cur, birthDecade: d as BirthDecade, region: r ?? cur.region }));
      setDecadeChosen(true);
    } else if (r) setP((cur) => ({ ...cur, region: r }));
  }, [editId, params]);

  useEffect(() => {
    if (!editId) return;
    const existing = getProfile(editId);
    if (existing) {
      setP(existing);
      setDecadeChosen(true);
    }
  }, [editId]);

  useEffect(() => {
    headingRef.current?.querySelector<HTMLElement>("label, h1")?.focus?.();
  }, [step]);

  const set = (patch: Partial<Profile>) => setP((cur) => ({ ...cur, ...patch }));
  const setAnchor = (i: number, patch: Partial<AnchorChip>) =>
    setP((cur) => ({ ...cur, anchors: cur.anchors.map((a, j) => (j === i ? { ...a, ...patch } : a)) }));

  async function lookup(i: number, a: { text: string; kind: AnchorKind }) {
    try {
      const [r] = await resolveAnchors([a]);
      setP((cur) => ({ ...cur, anchors: cur.anchors.map((x, j) => (j === i && x.text === a.text ? { ...r! } : x)) }));
    } catch (e) {
      setAnchor(i, { status: "error" });
      setLookupError(e instanceof ApiError && e.code in copy.errors ? copy.errors[e.code as keyof typeof copy.errors] : copy.errors.network);
    }
  }

  function add() {
    const t = text.trim();
    if (!t || p.anchors.some((a) => a.text.toLowerCase() === t.toLowerCase() && a.kind === kind)) return;
    const i = p.anchors.length;
    setP((cur) => ({ ...cur, anchors: [...cur.anchors, { text: t, kind }] }));
    setText("");
    void lookup(i, { text: t, kind });
  }

  function addAvoid() {
    const t = avoidText.trim();
    if (!t) return;
    set({ avoidTopics: [...new Set([...p.avoidTopics, t])].slice(0, 20) });
    setAvoidText("");
  }

  const matched = p.anchors.filter((a) => a.status === "matched").length;
  const pending = p.anchors.some((a) => !a.status);
  const era = eraFor(p.birthDecade);
  const canNext1 = p.nickname.trim().length > 0 && decadeChosen;
  const canNext2 = p.region.trim().length > 1;
  const canBuild = matched >= MIN_MATCHED && !pending;

  function finish() {
    const profile = { ...p, nickname: p.nickname.trim(), region: p.region.trim(), livesNow: p.livesNow?.trim() || undefined, example: false };
    saveProfile(profile);
    router.push(`/build/?p=${profile.id}`);
  }

  const backHref = editId ? `/plan/?p=${editId}` : "/";

  return (
    <>
      <TopBar
        left={
          step === 1 ? (
            <BackLink href={backHref}>{copy.builder.back}</BackLink>
          ) : (
            <button onClick={() => setStep(step - 1)} className="inline-flex min-h-12 items-center gap-1 font-bold text-indigo">
              <span aria-hidden>‹</span> {copy.builder.back}
            </button>
          )
        }
      />
      <Page>
        <Progress step={step} />
        <div ref={headingRef}>
          {step === 1 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (canNext1) setStep(2);
              }}
            >
              <Field id="nick" label={copy.builder.q1}>
                <input id="nick" className={inputCls} value={p.nickname} placeholder={copy.builder.q1Placeholder} autoComplete="off" maxLength={40} onChange={(e) => set({ nickname: e.target.value })} />
              </Field>
              <fieldset className="mt-8">
                <legend className="display text-[1.6rem] leading-tight text-indigo">{copy.builder.q1b}</legend>
                <p className="mt-1 text-[0.95rem] text-ink-soft">{copy.builder.q1bHelp}</p>
                <div className="mt-3 grid grid-cols-3 gap-2">
                  {BIRTH_DECADES.map((d) => {
                    const on = decadeChosen && p.birthDecade === d;
                    return (
                      <button
                        type="button"
                        key={d}
                        aria-pressed={on}
                        onClick={() => {
                          set({ birthDecade: d as BirthDecade });
                          setDecadeChosen(true);
                        }}
                        className={`min-h-12 rounded-[10px] border-2 text-[1rem] font-bold ${on ? "border-indigo bg-indigo text-on-indigo" : "border-line bg-card text-ink hover:border-indigo"}`}
                      >
                        {d}
                      </button>
                    );
                  })}
                </div>
                {decadeChosen && <p className="mt-3 text-[0.95rem] text-indigo">{copy.builder.eraPreview(era.from, era.to)}</p>}
              </fieldset>
              <div className="mt-10">
                <Button type="submit" full disabled={!canNext1}>
                  {copy.builder.next}
                </Button>
              </div>
            </form>
          )}

          {step === 2 && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (canNext2) setStep(3);
              }}
            >
              <Field id="region" label={copy.builder.q2} help={copy.builder.q2Help}>
                <input id="region" aria-describedby="region-help" className={inputCls} value={p.region} placeholder={copy.builder.q2Placeholder} maxLength={120} onChange={(e) => set({ region: e.target.value })} />
              </Field>
              <div className="mt-6">
                <label htmlFor="now" className="block font-bold text-ink">
                  {copy.builder.q2b}
                </label>
                <input id="now" className={`${inputCls} mt-2`} value={p.livesNow ?? ""} maxLength={120} onChange={(e) => set({ livesNow: e.target.value })} />
              </div>
              <div className="mt-10">
                <Button type="submit" full disabled={!canNext2}>
                  {copy.builder.next}
                </Button>
              </div>
            </form>
          )}

          {step === 3 && (
            <div>
              <h1 tabIndex={-1} className="mt-8 text-[1.6rem] leading-tight">
                {copy.builder.q3(p.nickname.trim())}
              </h1>
              <p className="mt-1 text-[0.95rem] text-ink-soft">{copy.builder.q3Help}</p>

              <div role="radiogroup" aria-label="Kind of favourite" className="mt-4 flex flex-wrap gap-2">
                {KINDS.map((k) => (
                  <button
                    key={k}
                    role="radio"
                    aria-checked={kind === k}
                    onClick={() => setKind(k)}
                    className={`inline-flex min-h-11 items-center gap-2 rounded-full border-2 py-1 pl-1 pr-3 text-[0.9rem] font-bold ${kind === k ? "border-indigo bg-cloth text-indigo" : "border-line text-ink-soft hover:border-indigo"}`}
                  >
                    <KindIcon kind={k} size={30} />
                    {copy.kinds[k]}
                  </button>
                ))}
              </div>
              <form
                className="mt-3 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  add();
                }}
              >
                <label htmlFor="anchor" className="sr-only">
                  {copy.builder.addPlaceholder(kind)}
                </label>
                <input id="anchor" className={inputCls} value={text} maxLength={80} placeholder={copy.builder.addPlaceholder(kind)} onChange={(e) => setText(e.target.value)} />
                <Button type="submit" variant="secondary" disabled={!text.trim()}>
                  {copy.builder.add}
                </Button>
              </form>

              {lookupError && p.anchors.some((a) => a.status === "error") && (
                <div className="mt-4">
                  <Notice tone="error">{lookupError}</Notice>
                </div>
              )}
              <div aria-live="polite" className="mt-5 flex flex-col gap-4">
                {KINDS.filter((k) => p.anchors.some((a) => a.kind === k)).map((k) => (
                  <div key={k}>
                    <div className="text-[0.875rem] font-bold text-ink-soft">{copy.kinds[k]}</div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {p.anchors.map((a, i) =>
                        a.kind !== k ? null : (
                          <Chip
                            key={`${a.text}-${i}`}
                            a={a}
                            open={openChip === i}
                            onOpen={() => setOpenChip(openChip === i ? null : i)}
                            onRetry={() => {
                              setAnchor(i, { status: undefined });
                              void lookup(i, a);
                            }}
                            onRemove={() => setP((cur) => ({ ...cur, anchors: cur.anchors.filter((_, j) => j !== i) }))}
                          />
                        ),
                      )}
                    </div>
                    {p.anchors.map((a, i) =>
                      a.kind === k && a.status === "choose" && openChip === i ? (
                        <div key={`c${i}`} className="mt-3 rounded-[14px] border border-line bg-card p-3">
                          <div className="font-bold">{copy.builder.choose}</div>
                          <ul className="mt-2 flex flex-col gap-1">
                            {a.candidates?.map((c) => (
                              <li key={c.qlooId}>
                                <button
                                  onClick={() => {
                                    setAnchor(i, { status: "matched", match: c, candidates: undefined });
                                    setOpenChip(null);
                                  }}
                                  className="flex min-h-12 w-full items-center justify-between gap-3 rounded-[10px] px-3 text-left hover:bg-cloth"
                                >
                                  <span className="font-bold">{c.name}</span>
                                  <span className="text-[0.85rem] text-ink-soft">{c.subtitle ?? c.type}</span>
                                </button>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null,
                    )}
                    {p.anchors.map((a, i) =>
                      a.kind === k && a.status === "none" ? (
                        <p key={`n${i}`} className="mt-2 text-[0.85rem] text-ink-soft">
                          {copy.builder.notFound(a.text)}
                        </p>
                      ) : null,
                    )}
                  </div>
                ))}
              </div>

              <div className="mt-8 border-t border-line pt-6">
                <label htmlFor="avoid" className="block font-bold text-ink">
                  {copy.builder.avoidTitle}
                </label>
                <p id="avoid-help" className="text-[0.875rem] text-ink-soft">
                  {copy.builder.avoidHelp}
                </p>
                <form
                  className="mt-2 flex gap-2"
                  onSubmit={(e) => {
                    e.preventDefault();
                    addAvoid();
                  }}
                >
                  <input id="avoid" aria-describedby="avoid-help" className={inputCls} value={avoidText} maxLength={60} placeholder={copy.builder.avoidPlaceholder} onChange={(e) => setAvoidText(e.target.value)} />
                  <Button type="submit" variant="secondary" disabled={!avoidText.trim()}>
                    {copy.builder.add}
                  </Button>
                </form>
                {p.avoidTopics.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {p.avoidTopics.map((t) => (
                      <span key={t} className="inline-flex min-h-11 items-center rounded-full border border-line bg-card pl-3 text-[0.95rem]">
                        {t}
                        <button aria-label={copy.builder.remove(t)} onClick={() => set({ avoidTopics: p.avoidTopics.filter((x) => x !== t) })} className="h-11 w-10">
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-10">
                <Button full disabled={!canBuild} onClick={finish} className="min-h-14 text-[1.05rem]">
                  {matched < MIN_MATCHED ? copy.builder.needMore(MIN_MATCHED - matched) : editId ? copy.builder.save : copy.builder.build}
                </Button>
                {matched < MIN_MATCHED && (
                  <p aria-live="polite" className="mt-3 text-center text-[0.9rem] text-ink-soft">
                    <b>{copy.builder.progress(matched, MIN_MATCHED)}.</b>{" "}
                    {pending
                      ? (
                          <>
                            {copy.builder.hintPending}
                            <span aria-hidden className="dots">
                              <i />
                              <i />
                              <i />
                            </span>
                          </>
                        )
                      : p.anchors.some((a) => a.status === "choose")
                        ? copy.builder.hintChoose
                        : p.anchors.some((a) => a.status === "error")
                          ? copy.builder.hintError
                          : p.anchors.some((a) => a.status === "none")
                            ? copy.builder.hintNone
                            : copy.builder.hintAdd(MIN_MATCHED - matched)}
                  </p>
                )}
              </div>
            </div>
          )}
        </div>
      </Page>
    </>
  );
}

export default function NewPage() {
  return (
    <Suspense>
      <Builder />
    </Suspense>
  );
}
