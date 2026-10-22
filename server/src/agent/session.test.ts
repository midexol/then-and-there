import { test } from "node:test";
import assert from "node:assert/strict";
import { QlooClient, type QlooTool, type QlooTransport } from "../qloo/client.js";
import { MockTransport } from "../qloo/mock.js";
import { ARC, assertQlooOnly, buildSession, swapItem } from "./session.js";
import { eraWindow } from "./era.js";
import { questionIsSafe } from "./safety.js";
import { templateQuestion, type Llm } from "./prompts.js";
import { parseProfile } from "../app.js";
import { resolveAnchor } from "./resolve.js";
import type { ProfileInput, SseEvent } from "../types.js";

/** Records every argument sent to Qloo so tests can prove what never leaves the server. */
class SpyTransport implements QlooTransport {
  readonly mode = "mock" as const;
  calls: { tool: QlooTool; args: Record<string, unknown> }[] = [];
  private inner = new MockTransport();
  call(tool: QlooTool, args: Record<string, unknown>) {
    this.calls.push({ tool, args });
    return this.inner.call(tool, args);
  }
}

async function resolved(qloo: QlooClient, region: string, decade: ProfileInput["birthDecade"], anchors: [string, "music" | "food" | "film_tv" | "place"][]) {
  const list = await Promise.all(anchors.map(([t, k]) => resolveAnchor(qloo, t, k)));
  return {
    birthDecade: decade,
    region,
    anchors: list
      .filter((a) => a.status === "matched")
      .map((a) => ({ kind: a.kind, label: a.match!.name, ...(a.tag ? { tag: a.tag } : { qlooId: a.match!.qlooId }) })),
  } satisfies ProfileInput;
}

const noop = (_: SseEvent) => {};

test("era window: midpoint + 10 to + 30, peak + 14", () => {
  assert.deepEqual(eraWindow("1940s"), { from: 1955, to: 1975, peak: 1959 });
  assert.deepEqual(eraWindow("1920s"), { from: 1935, to: 1955, peak: 1939 });
});

for (const [region, decade, anchors] of [
  ["Mexico City, Mexico", "1940s", [["Pedro Infante", "music"], ["bolero", "music"], ["tamales", "food"]]],
  ["Liverpool, UK", "1940s", [["The Beatles", "music"], ["Cilla Black", "music"], ["tea", "food"]]],
  ["Ibadan, Nigeria", "1950s", [["King Sunny Adé", "music"], ["highlife", "music"], ["amala", "food"]]],
] as const) {
  test(`full 8-item arc for ${region}, in order, every item from Qloo and inside the era`, async () => {
    const qloo = new QlooClient(new MockTransport());
    const input = await resolved(qloo, region, decade, anchors as never);
    const { session, ctx } = await buildSession(input, { qloo }, noop);
    assert.equal(session.items.length, 8);
    assert.deepEqual(session.items.map((i) => i.kind), ARC);
    assert.deepEqual(session.items.map((i) => i.slot), [1, 2, 3, 4, 5, 6, 7, 8]);
    for (const i of session.items) {
      assert.ok(ctx.seenIds.has(i.provenance.qlooId), `${i.title} must come from Qloo`);
      assert.equal(i.provenance.source, "qloo");
      assert.ok(i.why.length > 0 && i.prompt.length > 0);
      if (i.year) assert.ok(i.year >= session.eraWindow.from && i.year <= session.eraWindow.to, `${i.title} ${i.year} in era`);
    }
    assert.equal(new Set(session.items.map((i) => i.title)).size, 8, "no duplicates");
  });
}

test("Qloo-only guard drops anything Qloo never returned", () => {
  const fake = { provenance: { source: "qloo", qlooId: "invented" } } as never;
  const real = { provenance: { source: "qloo", qlooId: "seen" } } as never;
  assert.deepEqual(assertQlooOnly([fake, real], new Set(["seen"])), [real]);
});

test("LLM can't add items: unknown ids are ignored, unsafe questions fall back to templates", async () => {
  const qloo = new QlooClient(new MockTransport());
  const input = await resolved(qloo, "Liverpool, UK", "1940s", [["The Beatles", "music"]]);
  const llm: Llm = {
    model: "fake",
    async writeQuestions(items) {
      const out: Record<string, string> = { "made-up-id": "Tell me about the Rolling Stones' new album?" };
      items.forEach((it, n) => (out[it.id] = n === 0 ? "Do you remember this song?" : `What does ${it.title} bring to mind?`));
      return out;
    },
  };
  const { session } = await buildSession(input, { qloo, llm }, noop);
  assert.equal(session.items.length, 8);
  assert.equal(session.items[0]!.promptSource, "template", "testing question rejected");
  assert.ok(session.items.slice(1).every((i) => i.promptSource === "llm"));
});

test("avoidTopics and names never reach Qloo; avoid topics filter results", async () => {
  const spy = new SpyTransport();
  const qloo = new QlooClient(spy);
  const base = await resolved(qloo, "Ibadan, Nigeria", "1950s", [["King Sunny Adé", "music"]]);
  const input = parseProfile({ ...base, nickname: "Mama Adunni", name: "Adunni", avoidTopics: ["Milo", "civil war"] })!;
  assert.ok(!("nickname" in input) && !("name" in input), "unknown fields dropped");
  const { session } = await buildSession(input, { qloo }, noop);
  const sent = JSON.stringify(spy.calls.map((c) => c.args));
  assert.ok(!/adunni/i.test(sent), "no name sent");
  assert.ok(!/civil war|"Milo"/i.test(sent), "avoid topics never sent");
  assert.ok(!session.items.some((i) => i.title === "Milo"), "avoid topic filtered");
  assert.ok(!session.items.some((i) => /war/i.test(i.title + (i.subtitle ?? ""))), "built-in avoid list applied");
  assert.ok(!session.items.some((i) => i.title === "Shaft"), "adult rating dropped");
});

test("adapt loop: 'not really' items are excluded next time, 'yes' items become signals", async () => {
  const spy = new SpyTransport();
  const qloo = new QlooClient(spy);
  const input = await resolved(qloo, "Mexico City, Mexico", "1940s", [["Pedro Infante", "music"]]);
  const first = await buildSession(input, { qloo }, noop);
  const no = first.session.items.find((i) => i.kind === "place")!;
  const yes = first.session.items.find((i) => i.kind === "film")!;
  spy.calls = [];
  const second = await buildSession({ ...input, avoid: [no.provenance.qlooId], boost: [yes.provenance.qlooId] }, { qloo }, noop);
  assert.ok(!second.session.items.some((i) => i.provenance.qlooId === no.provenance.qlooId));
  const rec = spy.calls.find((c) => c.tool === "qloo_recommend")!;
  assert.ok((rec.args.signals as string[]).includes(yes.provenance.qlooId));
});

test("swap replaces an item with the next alternate of the same kind", async () => {
  const qloo = new QlooClient(new MockTransport());
  const input = await resolved(qloo, "Liverpool, UK", "1940s", [["The Beatles", "music"]]);
  const state = await buildSession(input, { qloo }, noop);
  const place = state.session.items.find((i) => i.kind === "place")!;
  const swapped = swapItem(state, place.id, [])!;
  assert.equal(swapped.kind, "place");
  assert.equal(swapped.slot, place.slot);
  assert.notEqual(swapped.title, place.title);
  assert.ok(state.ctx.seenIds.has(swapped.provenance.qlooId));
});

test("thin data still returns what we have, with a note", async () => {
  const qloo = new QlooClient(new MockTransport());
  const { session } = await buildSession(
    { birthDecade: "1940s", region: "Reykjavík, Iceland", anchors: [{ kind: "music", label: "jazz", tag: "urn:tag:keyword:qloo:jazz" }] },
    { qloo },
    noop,
  );
  assert.ok(session.items.length > 0 && session.items.length < 8);
  assert.match(session.notes[0]!, /strong matches/);
});

test("questions invite and never test", () => {
  for (const bad of ["Do you remember this?", "Can you remember who sang it?", "What year was this?", "Did this help your dementia?"])
    assert.equal(questionIsSafe(bad, []), false, bad);
  assert.equal(questionIsSafe("Who did you go dancing with?", []), true);
  for (const kind of ["song", "place", "taste", "film", "closing_song"] as const)
    for (let n = 0; n < 20; n++) assert.ok(questionIsSafe(templateQuestion(kind, `id-${n}`), []), `template ${kind}`);
});

/** Live-mode stand-in: Qloo's movie recommendations are all recent, so only the Insights year filter can fill the film slot. */
class ModernMoviesTransport implements QlooTransport {
  readonly mode = "live" as const;
  calls: { tool: QlooTool; args: Record<string, unknown> }[] = [];
  private inner = new MockTransport();
  async call(tool: QlooTool, args: Record<string, unknown>) {
    this.calls.push({ tool, args });
    const film = (id: string, name: string, year: number) => ({ entity_id: id, name, subtype: "urn:entity:movie", properties: { release_year: year }, tags: [] });
    if (tool === "qloo_recommend" && args.target_type === "movie")
      return { status: "ok" as const, results: [film("m1", "Modern Hit", 2019), film("m2", "Another Hit", 2020)] };
    if (tool === "qloo_insights")
      return args.filter_location
        ? { status: "ok" as const, results: [film("c1", "El Bolero de Raquel", 1957), film("c-late", "Too Late", 1990)] }
        : { status: "ok" as const, results: [film("c2", "A Famous Classic", 1965)] };
    return this.inner.call(tool, args);
  }
}

test("live mode fills the film slot from year-filtered Insights, honestly labelled", async () => {
  const transport = new ModernMoviesTransport();
  const qloo = new QlooClient(transport);
  const input = await resolved(new QlooClient(new MockTransport()), "Mexico City, Mexico", "1940s", [["Pedro Infante", "music"], ["bolero", "music"], ["tamales", "food"]]);
  const { session, ctx } = await buildSession(input, { qloo }, noop);
  const film = session.items.find((i) => i.kind === "film");
  assert.ok(film, "a film is in the session");
  assert.ok(film.year && film.year >= 1955 && film.year <= 1975, `film year ${film.year} is in the era`);
  assert.equal(film.provenance.operation, "insights");
  assert.ok(ctx.seenIds.has(film.provenance.qlooId));
  assert.ok(!/55\+/.test(film.why), "must not claim a 55+ audience liked a film that was found by year");
  assert.ok(!session.items.some((i) => i.title === "Modern Hit" || i.title === "Too Late"), "out-of-era films are dropped");
  const insights = transport.calls.filter((c) => c.tool === "qloo_insights");
  assert.equal(insights.length, 2);
  for (const c of insights) assert.deepEqual([c.args.year_min, c.args.year_max], [1955, 1975]);
  assert.ok(insights.some((c) => c.args.filter_location === "Mexico"), "local films filter by country");
});

test("mock mode never calls Insights", async () => {
  const spy = new SpyTransport();
  const qloo = new QlooClient(spy);
  const input = await resolved(qloo, "Mexico City, Mexico", "1940s", [["Pedro Infante", "music"], ["bolero", "music"], ["tamales", "food"]]);
  await buildSession(input, { qloo }, noop);
  assert.equal(spy.calls.filter((c) => c.tool === "qloo_insights").length, 0);
});

test("tastes are food and drink: non-food brands are dropped, alcohol goes last", async () => {
  const { tastePool } = await import("./session.js");
  const b = (name: string, description: string) => ({ id: name, name, description, tags: [] as string[] });
  const pool = tastePool(
    [b("Andrea", "Mexican footwear brand"), b("Tecate", "Mexican beer brand"), b("Grupo Bimbo", "Multinational bakery and snack food company"), b("Rolling Stone", "American magazine about music and politics"), b("Tripadvisor", "Travel platform with reviews covering hotels, restaurants, and local experiences"), b("Tajín", "Chili lime seasoning")],
    [b("Mambocafé", "Upscale salsa bar and restaurant"), b("Hilton Santa Fe", "Modern hotel in a business district")],
  );
  assert.deepEqual(pool.map((e) => e.name), ["Grupo Bimbo", "Tajín", "Mambocafé", "Tecate"]);
});

test("a rate limit pauses the whole client, then the call succeeds", async () => {
  let n = 0;
  const flaky: QlooTransport = {
    mode: "live",
    async call() {
      n++;
      return n < 3
        ? { status: "error", error: { code: "QLOO_RATE_LIMIT", retryable: true, recovery: "429 Too Many Requests" } }
        : { status: "ok", results: [] };
    },
  };
  const qloo = new QlooClient(flaky, { baseDelayMs: 1, minGapMs: 0 });
  const t0 = Date.now();
  const env = await qloo.call("qloo_recommend", { x: 1 });
  assert.equal(env.status, "ok");
  assert.equal(n, 3, "two rate-limited attempts, then success");
  assert.ok(Date.now() - t0 >= 5800, "waits out the cooldown (2s then 4s), not the 1ms base delay");
});

test("pickTag: exact name wins, food prefers popular_food_item, and a wrong near-miss is never taken", async () => {
  const { pickTag } = await import("./resolve.js");
  const amala = [
    { id: "urn:tag:influenced_by:qloo:mala", name: "Mala" },
    { id: "urn:tag:cuisine:qloo:amala", name: "Amala" },
    { id: "urn:tag:keyword:qloo:amelia", name: "Amelia" },
    { id: "urn:tag:popular_food_item:qloo:amala", name: "Amala" },
  ];
  assert.equal(pickTag(amala, "amala", ["popular_food_item", "cuisine"])?.id, "urn:tag:popular_food_item:qloo:amala");
  assert.equal(pickTag([{ id: "urn:tag:influenced_by:qloo:mala", name: "Mala" }], "amala", []), null, "no exact match and 'mala' is too short to count as near");
  const highlife = [
    { id: "urn:tag:influence:qloo:highlife", name: "Highlife" },
    { id: "urn:tag:genre:qloo:highlife", name: "Highlife" },
    { id: "urn:tag:genre:music:highlife", name: "highlife" },
  ];
  assert.equal(pickTag(highlife, "Highlife", ["genre:music", "genre:qloo", "genre", "influence"])?.id, "urn:tag:genre:music:highlife");
});

test("a genre typed as a favourite resolves to the genre tag, not an entity named after it", async () => {
  const transport: QlooTransport = {
    mode: "mock",
    async call(tool, args) {
      if (tool === "qloo_describe")
        return { status: "ok", results: [{ entity_id: "E-HIGHLIFE", name: "HIGHLIFE", properties: { description: "Highlife is a music genre that originated in Ghana." }, tags: [] }] };
      if (tool === "qloo_find_tags")
        return { status: "ok", results: { tags: [{ id: "urn:tag:influence:qloo:highlife", name: "Highlife" }, { id: "urn:tag:genre:music:highlife", name: "highlife" }] } };
      throw new Error(`unexpected ${tool} ${JSON.stringify(args)}`);
    },
  };
  const r = await resolveAnchor(new QlooClient(transport), "highlife", "music");
  assert.equal(r.status, "matched");
  assert.equal(r.tag, "urn:tag:genre:music:highlife");
});

test("an artist whose lookup misses on accents is retried without them", async () => {
  const asked: string[] = [];
  const transport: QlooTransport = {
    mode: "mock",
    async call(tool, args) {
      if (tool !== "qloo_describe") return { status: "empty", results: [] };
      asked.push(String(args.entity));
      return String(args.entity).includes("é")
        ? { status: "needs_input", results: [] }
        : { status: "ok", results: [{ entity_id: "KSA-1", name: "King Sunny Ade", properties: { description: "Nigerian bandleader" }, tags: [] }] };
    },
  };
  const r = await resolveAnchor(new QlooClient(transport), "King Sunny Adé", "music");
  assert.deepEqual(asked, ["King Sunny Adé", "king sunny ade"]);
  assert.equal(r.status, "matched");
  assert.equal(r.match?.qlooId, "KSA-1");
});

test("places: plazas and museums beat hotels and pubs, but hotels still fill a slot if nothing else exists", async () => {
  const { placeLean } = await import("./session.js");
  const p = (name: string, description: string) => ({ id: name, name, description, tags: [] as string[] });
  const places = [
    p("Hilton Mexico City Santa Fe", "Modern hotel in Santa Fe business district with elegant interiors"),
    p("Handyman Pub", "Neighbourhood pub with live music"),
    p("Plaza Garibaldi", "Historic Mexico City plaza renowned for mariachi performances"),
    p("Museo Dolores Olmedo", "Art museum in a 16th-century hacienda"),
    p("Chuchito Perez", "Fusion eatery"),
    p("Orisun Hall of Residence", "A university hall of residence for students"),
  ];
  const sorted = [...places].sort((a, b) => placeLean(a) - placeLean(b)).map((e) => e.name);
  assert.deepEqual(sorted.slice(0, 2).sort(), ["Museo Dolores Olmedo", "Plaza Garibaldi"]);
  assert.deepEqual(sorted.slice(-2).sort(), ["Hilton Mexico City Santa Fe", "Orisun Hall of Residence"]);
  assert.ok(sorted.indexOf("Handyman Pub") > sorted.indexOf("Chuchito Perez"));
  assert.equal(placeLean(p("Museo del Prado", "Art museum with the largest collection of paintings in the country, set in a restored hacienda. Near a hotel.")), -2, "a museum that mentions a hotel isn't demoted");
});

test("film safety: unsuitable genres are dropped even when the film has no scary tags", async () => {
  const { entityIsSafe } = await import("./safety.js");
  const { toEntity } = await import("../qloo/normalize.js");
  const film = (name: string, genres: string[], rating?: string, tags: string[] = []) =>
    toEntity({ entity_id: name, name, tags: tags.map((t) => ({ name: t })), properties: { release_year: 1960, genres, content_rating: rating, description: "A film." } })!;
  assert.equal(entityIsSafe(film("Quiet Horror", ["Horror", "Drama"]), []), false, "horror genre, no tags");
  assert.equal(entityIsSafe(film("Old War Picture", ["War", "Drama"]), []), false);
  assert.equal(entityIsSafe(film("Gangster Tale", ["Crime"], "Approved"), []), false);
  assert.equal(entityIsSafe(film("Rated R Drama", ["Drama"], "R"), []), false, "adult rating");
  assert.equal(entityIsSafe(film("Scary Tagged", ["Drama"], undefined, ["murder"]), []), false, "scary tag still works");
  assert.equal(entityIsSafe(film("Mary Poppins", ["Comedy", "Family", "Fantasy"], "G"), []), true);
  assert.equal(entityIsSafe(film("Rocky", ["Drama", "Sport"], "PG"), []), true);
  assert.equal(entityIsSafe(film("Caregiver Avoids Boxing", ["Drama", "Sport"], "PG", ["boxing"]), ["boxing"]), false, "caregiver's own avoid topics apply");
});

test("soft words (death, war...) only block a film that isn't gentle; hard words and the caregiver's list always block", async () => {
  const { entityIsSafe } = await import("./safety.js");
  const { toEntity } = await import("../qloo/normalize.js");
  const film = (name: string, genres: string[], rating: string | undefined, tags: string[]) =>
    toEntity({ entity_id: name, name, tags: tags.map((t) => ({ name: t })), properties: { release_year: 1960, genres, content_rating: rating, description: "A film." } })!;
  // gentle genre + soft word + G/PG/Approved/unrated => allowed
  assert.equal(entityIsSafe(film("Cantinflas Comedy", ["Comedy", "Drama"], undefined, ["death"]), []), true);
  assert.equal(entityIsSafe(film("Jungle Book", ["Animation", "Family"], "Approved", ["death"]), []), true);
  assert.equal(entityIsSafe(film("Musical With A Battle", ["Musical", "Romance"], "G", ["battle", "war"]), []), true);
  assert.equal(entityIsSafe(film("Unrated Family", ["Family"], "Not Rated", ["dying"]), []), true);
  // soft word but not gentle => still blocked
  assert.equal(entityIsSafe(film("Action Adventure", ["Adventure", "Action"], "PG", ["wars", "battle"]), []), false);
  assert.equal(entityIsSafe(film("Plain Drama", ["Drama"], undefined, ["death"]), []), false);
  assert.equal(entityIsSafe(film("PG-13 Comedy", ["Comedy"], "PG-13", ["death"]), []), false, "PG-13 isn't on the gentle list");
  // hard word => blocked even when gentle
  assert.equal(entityIsSafe(film("Funeral Comedy", ["Comedy"], "G", ["funeral"]), []), false);
  assert.equal(entityIsSafe(film("Murder Musical", ["Musical"], "G", ["murder"]), []), false);
  assert.equal(entityIsSafe(film("Prison Comedy", ["Comedy"], undefined, ["prison"]), []), false);
  // the caregiver's own list is absolute
  assert.equal(entityIsSafe(film("Cantinflas Comedy", ["Comedy"], undefined, ["death"]), ["death"]), false);
  assert.equal(entityIsSafe(film("Gentle Musical", ["Musical"], "G", ["war"]), ["war"]), false);
  // non-films have no genres, so soft words still block them
  assert.equal(entityIsSafe({ id: "a", name: "A Band", description: "Songs about death", tags: [] }, []), false);
});

test("clip shortens at a sentence or word end, never mid-word", async () => {
  const { clip } = await import("../qloo/normalize.js");
  assert.equal(clip("Short text.", 50), "Short text.");
  const long = "Juan Gabriel was a Mexican singer, songwriter, and performer renowned for his prolific career spanning decades.";
  const out = clip(long, 70);
  assert.ok(out.length <= 71 && out.endsWith("…") && !/\s…$/.test(out), out);
  assert.ok(!/\bpr…$/.test(out), "no cut inside a word");
  assert.equal(clip("First sentence is long enough to count here. Second sentence goes on and on and on.", 60), "First sentence is long enough to count here.");
});

test("a shop that merely lists food isn't a food brand", async () => {
  const { isFoodBrand } = await import("./session.js");
  const b = (name: string, description: string) => ({ id: name, name, description, tags: [] as string[] });
  assert.equal(isFoodBrand(b("Habari Shop", "Habari Shop is an e-commerce platform offering deals on fashion, food, electronics")), false);
  assert.equal(isFoodBrand(b("Grupo Bimbo", "Mexican multinational food company known for its bakery products")), true);
});

const placeEntity = (name: string, description: string) => ({ id: name, name, description, tags: [] as string[] });

test("places to eat: judged by what the place is, with accents folded", async () => {
  const { isFoodPlace } = await import("./session.js");
  assert.equal(isFoodPlace(placeEntity("Oliver's Café", "Casual New Bodija café-bar serving international and Nigerian small plates")), true, "accented café");
  assert.equal(isFoodPlace(placeEntity("Caffè Nero", "Casual coffee shop offering specially blended hot and cold drinks")), true);
  assert.equal(isFoodPlace(placeEntity("Pullman Liverpool Restaurant", "Dockside restaurant at King's Dock serving modern dishes")), true);
  assert.equal(isFoodPlace(placeEntity("Camp and Furnace", "Warehouse-style live event space with eclectic food, weekend BBQs and a bar")), false, "an event space that serves food");
  assert.equal(isFoodPlace(placeEntity("Walton Hall and Gardens", "Lavish Elizabethan-style estate with ornamental gardens, picnic areas and a café")), false, "a landmark with a café");
  assert.equal(isFoodPlace(placeEntity("Claremont Farm", "Working Wirral farm with café and shop offering locally sourced produce")), false, "a farm with a café");
  assert.equal(isFoodPlace(placeEntity("Albert Dock", "Historic waterfront complex of restored warehouses housing museums, restaurants and shops")), false, "a landmark");
  assert.equal(isFoodPlace(placeEntity("Moor Hall Restaurant with Rooms", "Michelin-starred fine-dining restaurant and hotel in the countryside")), false, "a hotel");
});

test("a region with few places: the place slots keep the best two, tastes take the rest, hotels come last", async () => {
  const { allocatePlaces } = await import("./session.js");
  const ctx = {
    input: { birthDecade: "1950s", region: "Ibadan, Nigeria", anchors: [], avoidTopics: [] },
    era: { from: 1965, to: 1985, peak: 1969 }, regionShort: "Ibadan", anchorNames: [], signalIds: [], signalTags: [], seenIds: new Set<string>(),
  } as never;
  const places = [
    placeEntity("BON Hotel Nest", "Polished hotel in a serene residential area with modern amenities"),
    placeEntity("Premier Hotel", "Historic hotel on Mokola Hill offering serene environment"),
    placeEntity("Latitude Café & Lounge", "Upscale lounge-restaurant at Ventura Mall offering cocktails and coffee"),
    placeEntity("Bamboo Towers", "Casual restaurant and bar near Trans Amusement Park offering food"),
    placeEntity("Orisun Hall of Residence", "Student-oriented hall of residence on South Campus"),
    placeEntity("Frostyz Ice Cream Lounge", "Upscale ice cream lounge and cafe offering artisanal desserts"),
    placeEntity("Oliver's Café", "Casual New Bodija café-bar serving international and Nigerian small plates"),
  ];
  const { taste, place } = await Promise.resolve(allocatePlaces([], places, ctx, new Set()));
  const hotels = ["BON Hotel Nest", "Premier Hotel", "Orisun Hall of Residence"];
  assert.equal(taste.length >= 2 && place.length >= 2, true);
  assert.ok(!hotels.includes(place[0]!.name) && !hotels.includes(place[1]!.name), `place slots: ${place.slice(0, 2).map((p) => p.name)}`);
  assert.ok(!hotels.includes(taste[0]!.name) && !hotels.includes(taste[1]!.name), `taste slots: ${taste.slice(0, 2).map((p) => p.name)}`);
  assert.equal(new Set([...taste, ...place].map((e) => e.id)).size, taste.length + place.length, "no place offered twice");
});

test("when Qloo rejects every request, say so instead of 'busy'; transient failures stay retryable", async () => {
  const input = { birthDecade: "1940s", region: "asdfghjkl", anchors: [{ kind: "music", label: "Pedro Infante", qlooId: "BEC81FD4" }] } as never;
  const failing = (retryable: boolean): QlooTransport => ({
    mode: "mock",
    async call(tool) {
      if (tool === "qloo_describe") return { status: "empty", results: [] };
      return { status: "error", error: { code: retryable ? "QLOO_RATE_LIMIT" : "QLOO_CONTRACT", retryable } };
    },
  });
  await assert.rejects(
    () => buildSession(input, { qloo: new QlooClient(failing(false)) }, noop),
    (e: Error & { code?: string; retryable?: boolean }) => e.code === "thin_data" && e.retryable === false && e.message.includes("asdfghjkl"),
  );
  await assert.rejects(
    () => buildSession(input, { qloo: new QlooClient(failing(true), { retries: 0, baseDelayMs: 1 }) }, noop),
    (e: Error & { code?: string; retryable?: boolean }) => e.code === "qloo_busy" && e.retryable === true,
  );
});

test("swap: an item that isn't in the session is 'not found', not 'no more alternatives'", async () => {
  const { buildApp } = await import("../app.js");
  const qloo = new QlooClient(new MockTransport());
  const app = buildApp({ qloo, llm: null, allowedOrigin: "*", logger: false });
  const input = await resolved(qloo, "Mexico City, Mexico", "1940s", [["Pedro Infante", "music"], ["bolero", "music"], ["tamales", "food"]]);
  const res = await app.inject({ method: "POST", url: "/api/sessions", payload: { ...input, anchors: input.anchors.map((a) => ({ ...a })) } });
  assert.equal(res.statusCode, 202);
  const { sessionId } = res.json() as { sessionId: string };
  let r = await app.inject({ method: "POST", url: `/api/sessions/${sessionId}/swap`, payload: { itemId: "nope" } });
  for (let i = 0; i < 100 && r.json().message?.includes("expired"); i++) {
    await new Promise((ok) => setTimeout(ok, 50)); // the session is still building
    r = await app.inject({ method: "POST", url: `/api/sessions/${sessionId}/swap`, payload: { itemId: "nope" } });
  }
  assert.equal(r.statusCode, 404);
  assert.equal(r.json().message, "That item isn't in this session.");
  const gone = await app.inject({ method: "POST", url: "/api/sessions/does-not-exist/swap", payload: { itemId: "x" } });
  assert.equal(gone.statusCode, 404);
  assert.match(gone.json().message, /expired/);
  await app.close();
});

test("a place Qloo knows nothing about: the note blames the place, not the favourites", async () => {
  class NoLocalData implements QlooTransport {
    readonly mode = "mock" as const;
    private inner = new MockTransport();
    call(tool: QlooTool, args: Record<string, unknown>) {
      if (tool === "qloo_recommend" && (args.target_type === "place" || args.target_type === "brand")) return Promise.resolve({ status: "ok" as const, results: [] });
      return this.inner.call(tool, args);
    }
  }
  const qloo = new QlooClient(new NoLocalData());
  const input = await resolved(new QlooClient(new MockTransport()), "Atlantis", "1940s", [["Pedro Infante", "music"], ["bolero", "music"], ["tamales", "food"]]);
  const { session } = await buildSession(input, { qloo }, noop);
  assert.ok(session.items.length > 0 && session.items.length < 8);
  assert.match(session.notes[0]!, /little on “Atlantis”.*nearby larger city/);
  assert.ok(!session.notes.some((n) => /Add another favourite/.test(n)), "must not blame the favourites");
  // and with data present but too few items, the favourites note still applies
  const normal = await buildSession(await resolved(new QlooClient(new MockTransport()), "Mexico City, Mexico", "1940s", [["Pedro Infante", "music"]]), { qloo: new QlooClient(new MockTransport()) }, noop);
  assert.ok(!normal.session.notes.some((n) => /little on/.test(n)));
});

/** Qloo as it behaves for a whole country: the hard place filter never answers, everything else does. */
class CountryFilterHangs implements QlooTransport {
  readonly mode = "mock" as const;
  calls: { tool: QlooTool; args: Record<string, unknown> }[] = [];
  private inner = new MockTransport();
  call(tool: QlooTool, args: Record<string, unknown>) {
    this.calls.push({ tool, args });
    if (tool === "qloo_recommend" && args.target_type === "place" && args.filter_location) return new Promise<never>(() => {});
    return this.inner.call(tool, args);
  }
}

test("a timeout is retried at most once, and not at all when the caller says the request is heavy", async () => {
  let n = 0;
  const hangs: QlooTransport = { mode: "mock", call: () => (n++, new Promise<never>(() => {})) };
  const qloo = () => new QlooClient(hangs, { timeoutMs: 30, retries: 3, baseDelayMs: 1, minGapMs: 0 });
  n = 0;
  await assert.rejects(() => qloo().call("qloo_recommend", { a: 1 }), (e: Error & { timedOut?: boolean }) => e.timedOut === true);
  assert.equal(n, 2, "default: one retry after a timeout, not three");
  n = 0;
  await assert.rejects(() => qloo().call("qloo_recommend", { a: 2 }, { retryOnTimeout: false }), (e: Error & { timedOut?: boolean }) => e.timedOut === true);
  assert.equal(n, 1, "heavy request: no retry");
});

test("a whole-country place filter that times out: one attempt, no places, a clear reason", async () => {
  const { recommendPlaces } = await import("./session.js");
  const t = new CountryFilterHangs();
  const qloo = new QlooClient(t, { timeoutMs: 40, minGapMs: 0 });
  let tooBig = 0;
  const env = await recommendPlaces(qloo, { target_type: "place", signal_location: "Mexico", filter_location: "Mexico", limit: 20 }, () => tooBig++);
  assert.equal(env.status, "empty");
  assert.equal(tooBig, 1);
  assert.equal(t.calls.filter((c) => c.args.target_type === "place").length, 1, "one attempt: no retry, no second heavy query");

  // an empty answer (Qloo doesn't know the place) is not "too big", and a real error still surfaces
  const empty = new QlooClient({ mode: "mock", call: async () => ({ status: "ok" as const, results: [] }) }, { minGapMs: 0 });
  let tooBig2 = 0;
  await recommendPlaces(empty, { target_type: "place", signal_location: "Atlantis", filter_location: "Atlantis" }, () => tooBig2++);
  assert.equal(tooBig2, 0);
  const broken = new QlooClient({ mode: "mock", call: async () => ({ status: "error" as const, error: { code: "QLOO_CONTRACT", retryable: false } }) }, { minGapMs: 0 });
  await assert.rejects(() => recommendPlaces(broken, { target_type: "place", filter_location: "x" }, () => tooBig2++));
  assert.equal(tooBig2, 0);
});

test("a country-only region builds quickly without places and says why", async () => {
  const t = new CountryFilterHangs();
  const qloo = new QlooClient(t, { timeoutMs: 60, minGapMs: 0 });
  const input = await resolved(new QlooClient(new MockTransport()), "Mexico City, Mexico", "1940s", [["Pedro Infante", "music"], ["bolero", "music"], ["tamales", "food"]]);
  const t0 = Date.now();
  const { session } = await buildSession({ ...input, region: "Mexico" }, { qloo }, noop);
  assert.ok(Date.now() - t0 < 5000, "must not stall waiting on the heavy query");
  assert.ok(session.items.length >= 4 && !session.items.some((i) => i.kind === "place"));
  assert.match(session.notes[0]!, /too big an area.*city or town/);
  assert.ok(!session.notes.some((n) => /Add another favourite/.test(n)), "must not blame the favourites");
});

test("films never hold a session back: no repeat after a timeout, a retry after a rate limit, and a fixed budget", async () => {
  const { classicFilms } = await import("./session.js");
  const ctx = {
    input: { birthDecade: "1940s", region: "Liverpool, UK", anchors: [] } as unknown as ProfileInput,
    era: eraWindow("1940s"),
    regionShort: "Liverpool",
    anchorNames: [],
    signalIds: [],
    signalTags: [],
    seenIds: new Set<string>(),
  };
  const film = { entity_id: "f1", name: "A Film", subtype: "urn:entity:movie", properties: { release_year: 1960 }, tags: [] };

  // A search that times out is tried once per query (2 queries) and reported as slow.
  let tries = 0;
  const timesOut: QlooTransport = { mode: "live", call: async () => (tries++, { status: "error" as const, error: { code: "insights_timeout", retryable: true } }) };
  let slow = 0;
  assert.deepEqual(await classicFilms(new QlooClient(timesOut, { baseDelayMs: 1, minGapMs: 0 }), ctx, 5_000, () => slow++), []);
  assert.equal(tries, 2, "two searches, no repeat after a timeout");
  assert.equal(slow, 1, "the caller is told the film search was slow");

  // A rate limit is retried after its pause and then succeeds.
  let calls = 0;
  const limitedOnce: QlooTransport = {
    mode: "live",
    call: async () => (++calls <= 2 ? { status: "error" as const, error: { code: "QLOO_RATE_LIMIT", retryable: true, recovery: "Rate limited (429)." } } : { status: "ok" as const, results: [film] }),
  };
  const got = await classicFilms(new QlooClient(limitedOnce, { baseDelayMs: 1, minGapMs: 0 }), ctx, 20_000);
  assert.ok(got.length >= 1, "films arrive after the rate limit clears");

  // A search that never answers: the budget ends the wait.
  const hanging: QlooTransport = { mode: "live", call: () => new Promise<never>(() => {}) };
  const t0 = Date.now();
  let slow2 = 0;
  assert.deepEqual(await classicFilms(new QlooClient(hanging, { timeoutMs: 400, minGapMs: 0 }), ctx, 60, () => slow2++), []);
  assert.ok(Date.now() - t0 < 300, "returned at the budget, not at the request timeout");
  assert.equal(slow2, 1);
});

class UnmatchedCityCountry implements QlooTransport {
  readonly mode = "mock" as const;
  calls: { tool: QlooTool; args: Record<string, unknown> }[] = [];
  private inner = new MockTransport();
  call(tool: QlooTool, args: Record<string, unknown>) {
    this.calls.push({ tool, args });
    // Like Qloo for "Mumbai, India": a located search with a comma matches nothing, but the bare city works.
    if (tool === "qloo_recommend" && typeof args.signal_location === "string" && args.signal_location.includes(","))
      return Promise.resolve({ status: "ok" as const, results: [] });
    return this.inner.call(tool, args);
  }
}

test("a 'City, Country' Qloo can't match is retried as the city alone, and the session says so", async () => {
  const t = new UnmatchedCityCountry();
  const qloo = new QlooClient(t, { minGapMs: 0 });
  const input = await resolved(new QlooClient(new MockTransport()), "Mexico City, Mexico", "1940s", [["Pedro Infante", "music"], ["bolero", "music"], ["tamales", "food"]]);
  const { session } = await buildSession(input, { qloo }, noop);
  assert.equal(session.items.length, 8, "a full session after the retry");
  assert.ok(session.notes.some((n) => n.includes("Mexico City, Mexico") && n.includes("“Mexico City” instead")), "the note names what was typed and the city that was used");
  const retried = t.calls.filter((c) => c.tool === "qloo_recommend" && c.args.signal_location === "Mexico City");
  assert.ok(retried.length >= 4, "songs, films, places and tastes were searched again with the city alone");
  assert.ok(session.items.every((i) => i.provenance.location === "Mexico City" || i.provenance.operation === "describe" || !i.provenance.location), "provenance records the name Qloo matched");
});

test("a place Qloo matches as typed is not retried", async () => {
  const spy = new SpyTransport();
  const qloo = new QlooClient(spy, { minGapMs: 0 });
  const input = await resolved(qloo, "Mexico City, Mexico", "1940s", [["Pedro Infante", "music"], ["bolero", "music"], ["tamales", "food"]]);
  const { session } = await buildSession(input, { qloo }, noop);
  assert.ok(!spy.calls.some((c) => c.args.signal_location === "Mexico City"), "no city-only retry when the full name worked");
  assert.ok(!session.notes.some((n) => /instead/.test(n)));
});
