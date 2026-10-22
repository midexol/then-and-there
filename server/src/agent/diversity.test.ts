import { test } from "node:test";
import assert from "node:assert/strict";
import { QlooClient, type QlooTool, type QlooTransport } from "../qloo/client.js";
import { MockTransport } from "../qloo/mock.js";
import { countryKey, RecentlyServed, repeatLean, REPEAT_CAP } from "./diversity.js";
import { buildSession } from "./session.js";
import type { ProfileInput } from "../types.js";

test("countryKey: the country is the last part, folded", () => {
  assert.equal(countryKey("Mumbai, India"), "india");
  assert.equal(countryKey("São Paulo, Brasil"), "brasil");
  assert.equal(countryKey("Japan"), "japan");
});

test("RecentlyServed counts the other countries an item was offered for, never its own", () => {
  const r = new RecentlyServed();
  r.record(["x"], "mexico");
  assert.equal(r.elsewhere("x", "mexico"), 0, "its own country doesn't count: two Mexican cities can share a Mexican brand");
  assert.equal(r.elsewhere("x", "japan"), 1);
  r.record(["x"], "uk");
  assert.equal(r.elsewhere("x", "japan"), 2);
  assert.equal(r.elsewhere("x", "uk"), 1);
  assert.equal(r.elsewhere("never-seen", "japan"), 0);
});

test("RecentlyServed forgets the oldest items past its cap, and the penalty is capped", () => {
  const r = new RecentlyServed(3);
  r.record(["a", "b", "c", "d"], "mexico");
  assert.equal(r.elsewhere("a", "japan"), 0, "the oldest was dropped");
  assert.equal(r.elsewhere("d", "japan"), 1);
  assert.equal(repeatLean(50), REPEAT_CAP);
  assert.equal(repeatLean(0), 0);
});

class SameActsEverywhere implements QlooTransport {
  readonly mode = "mock" as const;
  private inner = new MockTransport();
  call(tool: QlooTool, args: Record<string, unknown>) {
    if (tool === "qloo_recommend" && args.target_type === "artist") {
      const a = (n: number) => ({ entity_id: `act-${n}`, name: `Act ${n}`, subtype: "urn:entity:artist", properties: { description: `Act ${n} is a singer` }, tags: [] });
      return Promise.resolve({ status: "ok" as const, results: [1, 2, 3, 4, 5, 6].map(a) });
    }
    return this.inner.call(tool, args);
  }
}

test("the same generic acts are offered less to people in other countries, but not to the same country again", async () => {
  const recent = new RecentlyServed();
  const qloo = new QlooClient(new SameActsEverywhere(), { minGapMs: 0 });
  const build = async (region: string) => {
    const input: ProfileInput = { birthDecade: "1940s", region, anchors: [] };
    const { session } = await buildSession(input, { qloo, recent }, () => {});
    return session.items.filter((i) => i.kind === "song" || i.kind === "closing_song").map((i) => i.title);
  };
  const mexico = await build("Mexico City, Mexico");
  const japan = await build("Tokyo, Japan");
  assert.ok(mexico.length >= 2 && japan.length >= 2);
  assert.deepEqual(mexico.slice(0, 2), ["Act 1", "Act 2"], "first time, the top of Qloo's list");
  assert.ok(!japan.slice(0, 2).includes("Act 1") && !japan.slice(0, 2).includes("Act 2"), `Tokyo gets different acts first: ${japan.join(", ")}`);
  const mexicoAgain = await build("Guadalajara, Mexico");
  assert.deepEqual(mexicoAgain.slice(0, 2), ["Act 1", "Act 2"], "another Mexican city isn't penalised for what Mexico already had");
});
