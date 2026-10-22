import { test } from "node:test";
import assert from "node:assert/strict";
import { QlooClient, type QlooTool, type QlooTransport } from "../qloo/client.js";
import { MockTransport } from "../qloo/mock.js";
import { cuisineBelongs, foundedYear, localHints } from "./affinity.js";
import { entityIsSafe } from "./safety.js";
import { buildSession, isFoodPlace, placeLean } from "./session.js";
import type { QEntity } from "../qloo/normalize.js";
import type { ProfileInput } from "../types.js";

// Names and descriptions below are real ones Qloo returned in the evaluation.
const e = (name: string, description: string, type = "urn:entity:place"): QEntity => ({ id: name, name, type, description, tags: [] });

test("places: somewhere you'd go to see beats a restaurant, which beats a venue or a service", () => {
  const walker = placeLean(e("Walker Art Gallery", "Victorian-era Liverpool gallery housing major European and British art"));
  const garibaldi = placeLean(e("Plaza Garibaldi", "Historic Mexico City plaza renowned for mariachi performances"));
  const cross = placeLean(e("Magellan's Cross", "Historic cross marking the introduction of Christianity to the Philippines"));
  const restaurant = placeLean(e("Z Kitchen", "Women-owned upscale international restaurant offering cocktails and small plates"));
  const barber = placeLean(e("Thy Barber", "Classic men's barber offering hand-tailored haircuts and beard grooming"));
  const banquet = placeLean(e("Blue Sea Mumbai", "Seafront banquet and catering venue in Worli with indoor and outdoor halls"));
  const venue = placeLean(e("Plaza Ibarra", "Quaint Quezon City event venue with elegant function rooms, gardens"));
  const hotel = placeLean(e("Grand Hotel", "A hotel by the sea"));
  for (const culture of [walker, garibaldi, cross]) assert.ok(culture < restaurant, "culture before a restaurant");
  for (const service of [barber, banquet, venue]) assert.ok(service > restaurant, "a barber, a banquet hall or an event venue after a restaurant");
  assert.ok(hotel > barber, "hotels still come last");
  assert.equal(placeLean(e("Plaza Ibarra", "event venue")), placeLean(e("Anywhere", "event venue")), "a plaza in the name doesn't rescue an event venue");
});

test("tastes: a bookshop with a café is a bookshop, a restaurant is somewhere to eat", () => {
  assert.equal(isFoodPlace(e("Granth Book Store", "Cozy, curated independent bookstore with an in-store café and a reading nook")), false);
  assert.equal(isFoodPlace(e("Tara Books", "Independent Chennai-based publisher and bookshop showcasing handmade books")), false);
  assert.equal(isFoodPlace(e("Oliver's Café", "Casual New Bodija café-bar serving international and Nigerian cuisine")), true);
  assert.equal(isFoodPlace(e("Frostyz Ice Cream Lounge", "Upscale ice cream lounge and cafe in Ibadan offering artisanal flavours")), true);
});

test("cuisine: cooking from elsewhere falls, their own rises, and a name or a missing clue is left alone", () => {
  const mumbai = localHints("Mumbai, India", ["Lata Mangeshkar was an Indian singer"]);
  assert.equal(cuisineBelongs("Gustoso. Upscale Italian and pizza restaurant in Mumbai offering artisanal", mumbai), -1);
  assert.equal(cuisineBelongs("Fusilli Reasons. Laid-back vegetarian Italian eatery specializing in garlic bread", mumbai), -1);
  assert.equal(cuisineBelongs("The Clearing House. Sophisticated European fare in a high-ceilinged hall", mumbai), -1);
  assert.equal(cuisineBelongs("Absolute Thai Restaurant. Upscale pan-Asian restaurant in Teynampet", mumbai), -1, "the name counts");
  assert.equal(cuisineBelongs("Local Thali. Casual Indian restaurant serving home-style thalis", mumbai), 1);
  const lagos = localHints("Lagos, Nigeria", ["Fela Kuti was a Nigerian musician"]);
  assert.equal(cuisineBelongs("Oliver's Café. Casual café-bar serving international and Nigerian cuisine", lagos), 1);
  assert.equal(cuisineBelongs("Hard Rock Cafe Manila. Rock 'n' roll-themed restaurant serving American cuisine", localHints("Manila, Philippines", ["Pilita Corrales is a Filipino singer"])), -1);
  assert.equal(cuisineBelongs("Frostyz. Upscale ice cream lounge and cafe in Ibadan", lagos), 0, "no cooking named, nothing to go on");
  assert.equal(cuisineBelongs(undefined, lagos), 0);
});

test("foundedYear reads when a business says it began", () => {
  assert.equal(foundedYear("Established in 1993, this Filipino coffeehouse chain serves"), 1993);
  assert.equal(foundedYear("Founded in 1925, a family bakery"), 1925);
  assert.equal(foundedYear("Casual pizza-focused fast-food spot in Besant Nagar"), undefined);
  assert.equal(foundedYear(undefined), undefined);
});

test("a place of mourning isn't offered: a cemetery museum is not for a reminiscence session", () => {
  assert.equal(entityIsSafe(e("Museo Panteón de Belén", "Historic cemetery museum in Guadalajara offering guided tours"), []), false);
  assert.equal(entityIsSafe(e("Museo Dolores Olmedo", "Art museum in a 16th-century hacienda showcasing the largest collection"), []), true);
});

class MumbaiPlaces implements QlooTransport {
  readonly mode = "mock" as const;
  private inner = new MockTransport();
  call(tool: QlooTool, args: Record<string, unknown>) {
    if (tool === "qloo_recommend" && args.target_type === "place") {
      return Promise.resolve({
        status: "ok" as const,
        results: [
          { entity_id: "p-fort", name: "Old Fort", subtype: "urn:entity:place", properties: { description: "Historic fort overlooking the harbour" }, tags: [] },
          { entity_id: "p-temple", name: "Shore Temple", subtype: "urn:entity:place", properties: { description: "Ancient temple on the waterfront" }, tags: [] },
          { entity_id: "p-barber", name: "Gents Barber", subtype: "urn:entity:place", properties: { description: "Classic men's barber and grooming" }, tags: [] },
          { entity_id: "p-italian", name: "Gustoso", subtype: "urn:entity:place", properties: { description: "Upscale Italian and pizza restaurant in Mumbai" }, tags: [] },
          { entity_id: "p-thali", name: "Local Thali", subtype: "urn:entity:place", properties: { description: "Casual Indian restaurant serving home-style thalis" }, tags: [] },
          { entity_id: "p-books", name: "Granth Book Store", subtype: "urn:entity:place", properties: { description: "Cozy independent bookstore with an in-store café" }, tags: [] },
        ],
      });
    }
    if (tool === "qloo_recommend" && args.target_type === "brand") return Promise.resolve({ status: "ok" as const, results: [] });
    return this.inner.call(tool, args);
  }
}

test("in a session: culture fills the place slots, their own cooking comes first among tastes, a bookshop never appears as a taste", async () => {
  const qloo = new QlooClient(new MumbaiPlaces(), { minGapMs: 0 });
  const input: ProfileInput = {
    birthDecade: "1940s",
    region: "Mumbai, India",
    anchors: [{ kind: "music", label: "Lata Mangeshkar", qlooId: "lata-id", blurb: "Lata Mangeshkar was an Indian singer" }],
  };
  const { session } = await buildSession(input, { qloo }, () => {});
  const places = session.items.filter((i) => i.kind === "place").map((i) => i.title);
  const tastes = session.items.filter((i) => i.kind === "taste").map((i) => i.title);
  assert.deepEqual(places.sort(), ["Old Fort", "Shore Temple"], `culture in the place slots: ${places.join(", ")}`);
  assert.equal(tastes[0], "Local Thali", `their own cooking first: ${tastes.join(", ")}`);
  assert.ok(!tastes.includes("Granth Book Store") && !places.includes("Granth Book Store"), "a bookshop with a café is neither");
});
