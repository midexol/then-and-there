import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { QlooClient, type QlooTool, type QlooTransport } from "../qloo/client.js";
import { MockTransport } from "../qloo/mock.js";
import { loadSeed, writeSeed } from "../qloo/seed.js";
import { EXAMPLE_PROFILES, buildExample } from "./examples.js";

class Counting implements QlooTransport {
  readonly mode = "live" as const; // live so the client behaves as it does in production; the answers come from the mock
  calls = 0;
  private inner = new MockTransport();
  call(tool: QlooTool, args: Record<string, unknown>) {
    this.calls++;
    return this.inner.call(tool, args);
  }
}

test("a seeded client builds an example without calling Qloo, and a slow Qloo can't change the result", async () => {
  const first = new Counting();
  const learner = new QlooClient(first, { minGapMs: 0 });
  assert.equal(await buildExample(learner, EXAMPLE_PROFILES[0]!, 1), true, "the mock example has a film");
  const entries = learner.exportEntries();
  assert.ok(Object.keys(entries).length > 5, "the build leaves answers to save");

  // A transport that would hang proves nothing is asked of Qloo once the answers are loaded.
  let asked = 0;
  const hangs: QlooTransport = { mode: "live", call: () => (asked++, new Promise<never>(() => {})) };
  const seeded = new QlooClient(hangs, { minGapMs: 0, timeoutMs: 200 });
  seeded.prime(entries);
  assert.equal(await buildExample(seeded, EXAMPLE_PROFILES[0]!, 1), true);
  assert.equal(asked, 0, "every answer came from the seed");
});

test("a failed or timed-out call is never exported for the seed file", async () => {
  const t: QlooTransport = {
    mode: "live",
    call: async (_tool, args) => (args.q === "bad" ? { status: "error" as const, error: { code: "insights_timeout", retryable: true } } : { status: "ok" as const, results: { entities: [{ entity_id: "a", name: "A" }] } }),
  };
  const c = new QlooClient(t, { minGapMs: 0, retries: 0 });
  await c.call("qloo_search", { q: "some" });
  await c.call("qloo_search", { q: "bad" }).catch(() => {});
  assert.equal(Object.keys(c.exportEntries()).length, 1, "only the good answer is saved");
});

test("the seed file round-trips, and a missing or broken one is just empty", () => {
  const dir = mkdtempSync(join(tmpdir(), "tat-seed-"));
  const path = join(dir, "seed.json");
  assert.deepEqual(loadSeed(path), {});
  writeSeed({ k: { status: "ok", results: [1] } }, path);
  assert.deepEqual(loadSeed(path), { k: { status: "ok", results: [1] } });
  assert.match(readFileSync(path, "utf8"), /savedAt/);
  writeSeed({}, path);
  assert.deepEqual(loadSeed(path), {});
  assert.deepEqual(loadSeed(join(dir, "nope.json")), {});
});

test("the example profiles carry no nickname and match the web's three people", () => {
  assert.equal(EXAMPLE_PROFILES.length, 3);
  assert.ok(EXAMPLE_PROFILES.every((e) => !("nickname" in e) && e.anchors.length === 3));
});
