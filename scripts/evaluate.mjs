#!/usr/bin/env node
// Runs the 12-person evaluation from docs/BUILD_RULES.md against a running API and writes docs/evaluation-results.json.
//
//   node scripts/evaluate.mjs                       # API on http://localhost:8787 (live Qloo needs QLOO_API_KEY on the server)
//   API=https://<your-api> node scripts/evaluate.mjs
//   node scripts/evaluate.mjs mx-1 uk-2             # only some people
//
// It checks what a machine can check: every item carries Qloo provenance, film years sit inside the era window, the
// caregiver's avoid list and the built-in hard topics never appear, suggested questions invite and never test, and the
// session has all 8 items. Whether items *fit* a place and its people is a human judgement; the script prints every item
// so it can be reviewed by hand (see docs/EVALUATION.md). The script never sees or needs the Qloo key.
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const API = process.env.API ?? "http://localhost:8787";
const here = dirname(fileURLToPath(import.meta.url));
const only = new Set(process.argv.slice(2));
const people = JSON.parse(readFileSync(join(here, "eval-people.json"), "utf8")).filter((p) => !only.size || only.has(p.id));

// Mirrors server/src/agent/safety.ts (BUILT_IN_AVOID without the "soft" words, TESTING, HEALTH), so the check is independent of the code under test.
const HARD_TOPICS = ["funeral", "murder", "killer", "prison", "jail", "massacre", "genocide", "bomb", "bombing", "horror", "slaughter", "suicide", "abuse", "torture"];
const SOFT_TOPICS = ["war", "wars", "battle", "death", "dead", "dying"];
const TESTING = /\b(do|don't|dont|can|can't|cant) you (still )?(remember|recall)\b|\bremember when\b|\bdo you know who\b|\bwhat year\b|\b(quiz|guess|correct answer)\b/i;
const HEALTH = /\b(dementia|alzheimer'?s?|memory loss|therapy|therapeutic|treatment|cognitive|patient|diagnos\w*)\b/i;

const fold = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
const has = (text, topic) => new RegExp(`(^|[^a-z0-9])${fold(topic).replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(fold(text));
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function post(path, body) {
  const r = await fetch(API + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  const text = await r.text();
  try { return { status: r.status, body: JSON.parse(text) }; } catch { return { status: r.status, body: text }; }
}

async function stream(sessionId, onStep) {
  const r = await fetch(`${API}/api/sessions/${sessionId}/events`);
  const dec = new TextDecoder();
  let buf = "";
  for await (const chunk of r.body) {
    buf += dec.decode(chunk, { stream: true });
    let i;
    while ((i = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, i);
      buf = buf.slice(i + 2);
      const ev = /^event: (.*)$/m.exec(block)?.[1];
      const data = /^data: (.*)$/m.exec(block)?.[1];
      if (ev === "step") onStep(JSON.parse(data));
      if (ev === "session") return { ok: true, session: JSON.parse(data) };
      if (ev === "error") return { ok: false, error: JSON.parse(data) };
    }
  }
  return { ok: false, error: { code: "stream_ended", message: "The stream ended without a session." } };
}

async function runPerson(p) {
  const t0 = Date.now();
  const out = { id: p.id, region: p.region, decade: p.decade, avoid: p.avoid, anchors: [], notes: [] };
  const r = await post("/api/anchors/resolve", { anchors: p.anchors.map(([text, kind]) => ({ kind, text })) });
  if (r.status !== 200) return { ...out, failed: `resolve ${r.status}`, secs: Math.round((Date.now() - t0) / 1000) };
  const profileAnchors = [];
  for (const a of r.body.anchors) {
    out.anchors.push({ text: a.text, kind: a.kind, status: a.status, matched: a.match?.name ?? null });
    if (a.status === "matched") profileAnchors.push({ kind: a.kind, label: a.match.name, ...(a.tag ? { tag: a.tag } : { qlooId: a.match.qlooId }), ...(a.match.subtitle ? { blurb: a.match.subtitle } : {}) });
    else if (a.status === "choose" && a.candidates?.[0]) {
      // The app asks the caregiver to choose. Here the first candidate stands in, and the run says so.
      const c = a.candidates[0];
      out.notes.push(`"${a.text}" was ambiguous; used the first candidate "${c.name}"`);
      profileAnchors.push({ kind: a.kind, label: c.name, qlooId: c.qlooId, ...(c.subtitle ? { blurb: c.subtitle } : {}) });
    }
  }
  out.matchedAnchors = profileAnchors.length;
  const start = await post("/api/sessions", { birthDecade: p.decade, region: p.region, avoidTopics: p.avoid, anchors: profileAnchors });
  if (start.status !== 202) return { ...out, failed: `start ${start.status} ${JSON.stringify(start.body).slice(0, 120)}`, secs: Math.round((Date.now() - t0) / 1000) };
  const steps = {};
  const res = await stream(start.body.sessionId, (s) => { if (s.state === "done") steps[s.key] = Math.round((Date.now() - t0) / 1000); });
  out.secs = Math.round((Date.now() - t0) / 1000);
  out.stepDoneAt = steps;
  if (!res.ok) return { ...out, failed: `${res.error.code}: ${res.error.message}` };
  out.era = res.session.eraWindow;
  out.sessionNotes = res.session.notes;
  out.items = res.session.items.map((i) => ({ slot: i.slot, kind: i.kind, title: i.title, subtitle: i.subtitle ?? null, year: i.year ?? null, why: i.why, prompt: i.prompt, promptSource: i.promptSource, qlooId: i.provenance?.qlooId ?? null, operation: i.provenance?.operation ?? null }));
  return out;
}

function check(o) {
  if (!o.items) return o;
  const text = (i) => [i.title, i.subtitle, i.why, i.prompt].filter(Boolean).join(" | ");
  const films = o.items.filter((i) => i.kind === "film");
  const withYear = o.items.filter((i) => i.year != null);
  o.checks = {
    items: o.items.length,
    full: o.items.length === 8,
    qlooSourced: o.items.every((i) => i.qlooId && i.operation),
    yearItems: withYear.length,
    yearInEra: withYear.filter((i) => i.year >= o.era.from && i.year <= o.era.to).length,
    films: films.length,
    avoidListHits: o.items.filter((i) => o.avoid.some((t) => has(text(i), t))).map((i) => i.title),
    hardTopicHits: o.items.filter((i) => HARD_TOPICS.some((t) => has(text(i), t))).map((i) => i.title),
    softTopicHits: o.items.filter((i) => SOFT_TOPICS.some((t) => has(text(i), t))).map((i) => i.title),
    ungentleQuestions: o.items.filter((i) => TESTING.test(i.prompt) || HEALTH.test(i.prompt)).map((i) => i.prompt),
    emptyQuestions: o.items.filter((i) => !i.prompt || i.prompt.length < 8).length,
  };
  return o;
}

const OUT = join(here, "..", "docs", "evaluation-results.json");
// A partial re-run (node scripts/evaluate.mjs in-1) replaces only those people and keeps the rest of the saved results.
const saved = only.size ? (() => { try { return JSON.parse(readFileSync(OUT, "utf8")).results; } catch { return []; } })() : [];
const results = [];
const merged = () => {
  if (!only.size) return results;
  const ids = JSON.parse(readFileSync(join(here, "eval-people.json"), "utf8")).map((p) => p.id);
  const byId = new Map([...saved, ...results].map((r) => [r.id, r]));
  return ids.filter((id) => byId.has(id)).map((id) => byId.get(id));
};
for (const p of people) {
  process.stdout.write(`${p.id} ${p.region} (${p.decade}) ... `);
  let o;
  try { o = check(await runPerson(p)); } catch (e) { o = { id: p.id, region: p.region, decade: p.decade, failed: String(e).slice(0, 160) }; }
  results.push(o);
  console.log(o.failed ? `FAILED ${o.failed}` : `${o.checks.items} items in ${o.secs}s, films ${o.checks.films}, years in era ${o.checks.yearInEra}/${o.checks.yearItems}`);
  writeFileSync(OUT, JSON.stringify({ ranAt: new Date().toISOString(), api: API.startsWith("http://localhost") ? "local" : API, results: merged() }, null, 2));
  await sleep(4000); // be kind to Qloo's rate limit
}

const all = merged();
const ok = all.filter((r) => r.checks);
const sum = (f) => ok.reduce((n, r) => n + f(r.checks), 0);
console.log("\n--- summary ---");
console.log(`full 8 items:            ${ok.filter((r) => r.checks.full).length}/${all.length}   (bar: 10 of 12)`);
console.log(`Qloo provenance on all:  ${ok.filter((r) => r.checks.qlooSourced).length}/${ok.length}   (bar: 100%)`);
console.log(`in-era (items with year): ${sum((c) => c.yearInEra)}/${sum((c) => c.yearItems)}   (bar: 90%)`);
console.log(`avoid-list hits:         ${sum((c) => c.avoidListHits.length)}   (bar: 0)`);
console.log(`hard-topic hits:         ${sum((c) => c.hardTopicHits.length)}   (bar: 0)`);
console.log(`ungentle questions:      ${sum((c) => c.ungentleQuestions.length)}   (bar: 0)`);
