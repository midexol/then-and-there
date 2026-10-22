import { test } from "node:test";
import assert from "node:assert/strict";
import { QlooClient, type QlooTool, type QlooTransport } from "../qloo/client.js";
import { MockTransport } from "../qloo/mock.js";
import { belongs, emergedAfter, localHints, originOf } from "./affinity.js";
import { eraWindow } from "./era.js";
import { buildSession } from "./session.js";
import type { ProfileInput } from "../types.js";

// Descriptions below are real ones Qloo returned in the evaluation.
const PEDRO = "Pedro Infante was a renowned Mexican singer, actor, and cultural icon of the Golden Age";
const HIBARI = "Hibari Misora was a Japanese singer and actress, one of the most beloved entertainers";

test("originOf reads a nationality or a base from how Qloo describes something", () => {
  assert.equal(originOf("Tajdar Junaid is a Pakistani classical and Sufi singer renowned for devotional music").demonym, "Pakistani");
  assert.equal(originOf("Henrique Camacho is a Brazilian singer-songwriter and musician").demonym, "Brazilian");
  assert.equal(originOf("Brownman Revival is a Filipino reggae band that blends traditional").demonym, "Filipino");
  assert.equal(originOf("Grupo Bimbo is a Mexican multinational food company known for bread").demonym, "Mexican");
  assert.equal(originOf("Ahmad Tea is a UK-based family tea company offering a wide range").basedIn, "UK");
  assert.deepEqual(originOf("Plaza Garibaldi is a historic plaza in Mexico City"), {});
  assert.deepEqual(originOf(undefined), {});
});

test("belongs: theirs rises, from elsewhere falls, and anything unclear is left alone", () => {
  const tokyo = localHints("Tokyo, Japan", [HIBARI]);
  assert.equal(belongs("Mister Donut is Japan's largest donut franchise chain offering", tokyo), 1, "names their country");
  assert.equal(belongs("Shonen Knife is a Japanese all-female pop punk band", tokyo), 1, "their nationality");
  assert.equal(belongs("Carole King (born 1942) is an American singer-songwriter and pianist", tokyo), -1, "another nationality");
  assert.equal(belongs("Ahmad Tea is a UK-based family tea company offering a wide range", tokyo), -1, "based elsewhere");
  assert.equal(belongs("A café near the station", tokyo), 0, "nothing to go on");

  // The favourites teach the nationality word, even where it doesn't look like the country's name (Philippines → Filipino).
  const manila = localHints("Manila, Philippines", ["Pilita Corrales is a Filipino singer and actress"]);
  assert.equal(belongs("Brownman Revival is a Filipino reggae band that blends", manila), 1);
  assert.equal(belongs("Bette Midler is an American singer, actress, and comedian", manila), -1);

  // With no favourite to learn from, the region's own names still work.
  const noFavourites = localHints("Chennai, India", []);
  assert.equal(belongs("Rajinikanth is an Indian actor", noFavourites), 1);
  assert.equal(belongs("Henrique Camacho is a Brazilian singer-songwriter", noFavourites), -1);
});

test("emergedAfter: an act that began after their years isn't part of them", () => {
  const era = eraWindow("1940s"); // 1955-1975
  assert.equal(emergedAfter("BINI is an eight-member Filipino P-pop girl group formed through a reality talent show in 2019", era), true);
  assert.equal(emergedAfter("The Bloomfields are a rock band formed in Manila in 2008", era), true);
  assert.equal(emergedAfter("Someone (born 1988) is a singer", era), true);
  assert.equal(emergedAfter("Carole King (born 1942) is an American singer-songwriter", era), false);
  assert.equal(emergedAfter("The Kinks formed in Muswell Hill, London in 1963 by brothers Ray and Dave Davies", era), false);
  assert.equal(emergedAfter("A legendary singer with a long career", era), false, "no date, no judgement");
});

class ThreeActs implements QlooTransport {
  readonly mode = "mock" as const;
  private inner = new MockTransport();
  call(tool: QlooTool, args: Record<string, unknown>) {
    if (tool === "qloo_recommend" && args.target_type === "artist") {
      const a = (id: string, name: string, description: string) => ({ entity_id: id, name, subtype: "urn:entity:artist", properties: { description }, tags: [] });
      return Promise.resolve({
        status: "ok" as const,
        results: [
          a("a-foreign", "Foreign Star", "Foreign Star is an American singer-songwriter and pianist"),
          a("a-modern", "Modern Group", "Modern Group is a Mexican pop group formed in 2016"),
          a("a-local", "Local Voice", "Local Voice is a Mexican singer known for ranchera"),
          a("a-local2", "Another Local", "Another Local was a Mexican singer and composer"),
          a("a-foreign2", "Second Foreign", "Second Foreign is a Brazilian singer"),
        ],
      });
    }
    return this.inner.call(tool, args);
  }
}

test("in a session, a local act outranks a foreign one and an act formed after their years is left out", async () => {
  const qloo = new QlooClient(new ThreeActs(), { minGapMs: 0 });
  const input: ProfileInput = {
    birthDecade: "1940s",
    region: "Mexico City, Mexico",
    anchors: [{ kind: "music", label: "Pedro Infante", qlooId: "pedro-id", blurb: PEDRO }],
  };
  const { session } = await buildSession(input, { qloo }, () => {});
  const songs = session.items.filter((i) => i.kind === "song" || i.kind === "closing_song").map((i) => i.title);
  assert.ok(!songs.includes("Modern Group"), "formed in 2016, after the era window");
  const firstForeign = Math.min(...["Foreign Star", "Second Foreign"].map((n) => (songs.includes(n) ? songs.indexOf(n) : 99)));
  const lastLocal = Math.max(...["Local Voice", "Another Local"].map((n) => songs.indexOf(n)));
  assert.ok(lastLocal >= 0, "local acts are in the session");
  assert.ok(lastLocal < firstForeign, `local acts first: ${songs.join(", ")}`);
});
