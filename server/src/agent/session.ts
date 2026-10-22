// The session agent: era window → expand → filter → rank → compose → questions.
// Every item in a session is built from an entity that Qloo returned; `assertQlooOnly` enforces it.
import { randomUUID } from "node:crypto";
import { QlooError, type QlooClient, type QlooEnvelope } from "../qloo/client.js";
import { clip, entities, type QEntity } from "../qloo/normalize.js";
import type { EraWindow, ItemKind, ProfileInput, QlooTarget, Session, SessionItem, SseEvent, StepKey } from "../types.js";
import { eraDistance, eraWindow, inEra } from "./era.js";
import { chooseQuestion, type Llm } from "./prompts.js";
import { belongs, emergedAfter, localHints, type LocalHints } from "./affinity.js";
import { countryKey, recentlyServed, repeatLean, type RecentlyServed } from "./diversity.js";
import { entityIsSafe, fold } from "./safety.js";

// The harness parses this locally: "over 55" maps to the 55_and_older bucket; "55 and older" does not map.
export const DEMOGRAPHIC = "people over 55";
export const ARC: ItemKind[] = ["song", "place", "taste", "film", "song", "place", "taste", "closing_song"];

type Group = "artist" | "movie" | "place" | "taste";
const GROUP_OF: Record<ItemKind, Group> = { song: "artist", closing_song: "artist", place: "place", taste: "taste", film: "movie" };

export type Pools = Record<Group, QEntity[]>;
export type BuildContext = {
  input: ProfileInput;
  era: EraWindow;
  regionShort: string;
  anchorNames: string[];
  signalIds: string[];
  signalTags: string[];
  seenIds: Set<string>;
  /** Nationality and place words that mean "theirs", learned from the favourites and the region (see affinity.ts). */
  local?: LocalHints;
  /** The place name Qloo actually matched, when it wasn't the one the caregiver typed (see the location fallback in buildSession). */
  queryRegion?: string;
};
export type BuildResult = { session: Session; pools: Pools; ctx: BuildContext };
export type Emit = (e: SseEvent) => void;

const isTag = (s: string) => s.startsWith("urn:tag");
const uniq = <T>(xs: T[]) => [...new Set(xs)];

export class SessionError extends Error {
  constructor(
    public code: "qloo_busy" | "qloo_auth" | "thin_data" | "bad_input",
    message: string,
    public retryable: boolean,
  ) {
    super(message);
  }
}

function okEntities(env: QlooEnvelope): QEntity[] {
  return env.status === "ok" || env.status === "partial" || env.status === "degraded" ? entities(env) : [];
}

const urlq = (s: string) => encodeURIComponent(s);
function linksFor(e: QEntity, target: QlooTarget): SessionItem["links"] {
  switch (target) {
    case "artist":
      return [{ label: "Play songs on YouTube", url: `https://www.youtube.com/results?search_query=${urlq(e.name + " songs")}` }];
    case "movie":
      return [{ label: "Find clips on YouTube", url: `https://www.youtube.com/results?search_query=${urlq(`${e.name} ${e.year ?? ""}`.trim())}` }];
    case "place":
      return [
        { label: "See it on a map", url: `https://www.google.com/maps/search/${urlq([e.name, e.address].filter(Boolean).join(", "))}` },
        { label: "Old photos", url: `https://www.google.com/search?tbm=isch&q=${urlq(e.name + " old photos")}` },
      ];
    case "brand":
      return [{ label: "Old pictures", url: `https://www.google.com/search?tbm=isch&q=${urlq(e.name + " vintage")}` }];
  }
}

function likeClause(names: string[]) {
  if (!names.length) return "";
  const shown = names.slice(0, 2);
  return ` who like ${shown.length === 2 ? `${shown[0]} and ${shown[1]}` : shown[0]}`;
}

function whyFor(e: QEntity, target: QlooTarget, ctx: BuildContext, warmUp: boolean): string {
  if (warmUp) return "A favourite you added, to start somewhere comfortable.";
  const like = likeClause(ctx.anchorNames);
  switch (target) {
    case "artist":
      return `Often enjoyed by people 55+ in ${ctx.regionShort}${like}.`;
    case "movie":
      if (e.via === "insights") {
        // Found by release year, not by audience, so don't claim a 55+ audience liked it.
        const names = ctx.anchorNames.slice(0, 2).join(" and ");
        if (e.pick === "famous") return `${e.year ? `From ${e.year}. ` : ""}One of the best-known films from the years they were growing up.`;
        return `${e.year ? `From ${e.year}. ` : ""}From the years they were growing up${names ? `, chosen to go with ${names}` : ""}.`;
      }
      return `${e.year ? `From ${e.year}. ` : ""}Often enjoyed by people 55+${like}.`;
    case "place":
      return `Popular in ${ctx.regionShort} with people 55+.`;
    case "brand":
      return `A name often liked in ${ctx.regionShort} by people 55+.`;
  }
}

const targetOfTaste = (e: QEntity): QlooTarget => (e.type?.includes("place") ? "place" : "brand");

// A taste slot should be something you can eat or drink. Qloo's brand and place results carry no tags, only a
// description, so classify on name + description. Alcohol isn't excluded (beer is part of real food culture) but
// goes last, so it only appears when nothing else is available.
const FOOD_BRAND =
  /\b(food|foods|drink|drinks|beverages?|snacks?|candy|candies|sweets?|chocolates?|breads?|bakery|bakeries|biscuits?|cookies?|cakes?|pastr(?:y|ies)|sauces?|seasonings?|spices?|condiments?|soda|soft drinks?|juices?|coffee|tea|milk|dairy|cheese|yogh?urt|ice cream|cereals?|noodles?|rice|flour|crisps|chips|confection\w*|brewer\w*|brewing|malt|jam|honey|tortillas?|salsa|chili|chilli|tequila|beer|wine|liquor|spirits|whisk(?:e)?y|rum|vodka|grocery|supermarket|tacos?|pizza|burgers?)\b/i;
// A place counts as somewhere to eat only if that is what it IS: checked against the name and the start of the
// description, not anywhere in it. "Warehouse-style event space with eclectic food" and "estate with picnic areas"
// are not food places. All text is accent-folded first, so "Café" and "Caffè" match.
const FOOD_LEAD =
  /\b(restaurants?|cafes?|caffe|cafeteria|eatery|bakery|bakeries|patisserie|diner|tearoom|tea ?house|tea room|chip shop|canteen|taqueria|pizz(?:a|eria)|ice cream|coffee shop|bistro|brasserie|grill|buka|kitchen|street food|chocolate shop|juice bar|food court|gelato|sweet shop|confectioner\w*)\b/i;
const ALCOHOL = /\b(beers?|lager|wine|tequila|whisk(?:e)?y|vodka|rum|liquor|spirits|brandy|gin|breweries|brewery|brewing|cider|alcohol\w*|cantina|pub)\b/i;
const textOf = (e: QEntity) => fold([e.name, e.description ?? "", ...e.tags].join(" | "));

// A reminiscence place is somewhere you'd have gone: a plaza, museum, market, park, theatre. Hotels and nightlife
// sink to the bottom rather than being dropped, so a thin result still fills the slot. Only the name and the start
// of the description are checked, so a museum that mentions a hotel nearby isn't demoted.
const LODGING = /\b(hotels?|hostels?|motels?|resorts?|inns?|lodg\w+|suites?|guest ?house|bed and breakfast|b&b|halls? of residence|residence|dormitor\w+|student housing|apartments?)\b/i;
const LANDMARK =
  /\b(plazas?|squares?|parks?|gardens?|museo|museums?|mercado|markets?|cathedral|church|basilica|palace|castle|galler(?:y|ies)|theat(?:re|er)s?|cinema|stadium|beach|lake|river|monument|historic|landmark|library|promenade|pier|zoo|bandstand|temple|mosque|shrine|cultural cent(?:re|er)|town hall|concert hall)\b/i;
const NIGHTLIFE = /\b(pubs?|bars?|nightclub|club|casino|lounge|mall|shopping)\b/i;
/** Lower is better. Added to the rank position when a place pool is sorted. */
export function placeLean(e: QEntity): number {
  const t = fold(`${e.name} ${(e.description ?? "").slice(0, 90)}`);
  if (LODGING.test(t)) return 8;
  if (LANDMARK.test(t)) return -2;
  return NIGHTLIFE.test(t) ? 3 : 0;
}
// A shop or platform that merely lists food ("deals on fashion, food, electronics") isn't a food brand.
const NOT_FOOD_BRAND = /\b(e-?commerce|marketplace|online (stores?|shop\w*)|platform|social (network|media)|news|magazines?|banks?|insurance|airlines?|telecom\w*|software|streaming)\b/i;
export const isFoodBrand = (e: QEntity) => FOOD_BRAND.test(textOf(e)) && !NOT_FOOD_BRAND.test(textOf(e));
/** Somewhere to eat or drink. A landmark that has a café in it, or a hotel with a restaurant, is not one. */
export function isFoodPlace(e: QEntity): boolean {
  const lead = fold(`${e.name} ${(e.description ?? "").slice(0, 80)}`);
  if (!FOOD_LEAD.test(lead)) return false;
  if (/\bfarm\b/.test(lead) && !/\brestaurants?\b/.test(lead)) return false; // a farm with a café is a farm
  return placeLean(e) >= 0 && placeLean(e) < 8;
}
const isAlcohol = (e: QEntity) => ALCOHOL.test(textOf(e));
/** Alcohol after everything else, even after food places. */
const tasteLean = (e: QEntity) => (isAlcohol(e) ? 100 : 0);
/** Food and drink brands, then places to eat (pubs and bars after plain restaurants); alcohol last. */
export function tastePool(brands: QEntity[], places: QEntity[]): QEntity[] {
  const eat = places.filter(isFoodPlace).sort((a, b) => placeLean(a) - placeLean(b));
  const foodish = [...brands.filter(isFoodBrand), ...eat];
  return [...foodish.filter((e) => !isAlcohol(e)), ...foodish.filter(isAlcohol)];
}

/**
 * Splits Qloo's place results between the two kinds of slot. When a region has few places (Ibadan returns nine,
 * five of them hotels), the cafés and restaurants would all go to the taste slots and the place slots would get
 * hotels. So the two best places are reserved for the place slots first; the tastes take what is left.
 */
export function allocatePlaces(brands: QEntity[], places: QEntity[], ctx: BuildContext, taken: Set<string>): { taste: QEntity[]; place: QEntity[] } {
  const byLean = [...places].sort((a, b) => placeLean(a) - placeLean(b));
  const reserved = new Set(byLean.filter((p) => placeLean(p) < 8 && entityIsSafe(p, ctx.input.avoidTopics ?? [])).slice(0, 2).map((p) => p.id));
  const taste = filterPool(tastePool(brands, places.filter((p) => !reserved.has(p.id))), ctx, taken);
  const place = filterPool(byLean, ctx, taken);
  return { taste, place };
}

export function makeItem(e: QEntity, kind: ItemKind, slot: number, ctx: BuildContext, opts: { warmUp?: boolean; operation?: string } = {}): SessionItem {
  const target: QlooTarget = kind === "taste" ? targetOfTaste(e) : GROUP_OF[kind] === "artist" ? "artist" : (GROUP_OF[kind] as QlooTarget);
  const subtitle =
    target === "movie" ? (e.year ? `Film · ${e.year}` : "Film") : (e.description ?? (target === "place" ? e.address : undefined));
  return {
    id: randomUUID(),
    slot,
    kind,
    title: e.name,
    subtitle: subtitle ? clip(subtitle, 110) : undefined,
    year: e.year,
    why: whyFor(e, target, ctx, !!opts.warmUp),
    prompt: "",
    promptSource: "template",
    provenance: {
      source: "qloo",
      operation: opts.operation ?? e.via ?? "recommend",
      qlooId: e.id,
      qlooType: target,
      signals: ctx.anchorNames.slice(0, 5),
      demographic: DEMOGRAPHIC,
      location: ctx.queryRegion ?? ctx.input.region,
    },
    links: linksFor(e, target),
    alternates: 0,
  };
}

/** Drops any item whose entity id never appeared in a Qloo response. */
export function assertQlooOnly(items: SessionItem[], seenIds: Set<string>): SessionItem[] {
  return items.filter((i) => i.provenance.source === "qloo" && seenIds.has(i.provenance.qlooId));
}

export const FILM_BUDGET_MS = 30_000;

/**
 * Films from inside the era window. The MCP recommend tool can't filter by release year, and for a 55+ audience it
 * returns only recent hits, so films come from Insights with a year filter instead. Two searches, mixed together:
 *  - the favourites alone ("films like what they love, from those years"), which finds films that belong to their
 *    world: in testing it returned Sholay and Mughal-E-Azam for a Mumbai favourite list, A Hard Day's Night for a
 *    Liverpool one, and Japanese films from the 1950s and 60s for a Tokyo one;
 *  - the best-known films of the era in their place (location as a signal), as filler.
 * A location *filter* on films is deliberately not used: tested, it returned the same global classics (The Godfather,
 * Star Wars) for every country. Their own favourites come first. Live mode only; the mock transport has in-era films.
 */
export async function classicFilms(qloo: QlooClient, ctx: BuildContext, budgetMs = FILM_BUDGET_MS, onSlow?: () => void): Promise<QEntity[]> {
  const base = { type: "movie", signals: ctx.signalIds, year_min: ctx.era.from, year_max: ctx.era.to, take: 15 };
  let slow = false;
  const run = async (extra: Record<string, unknown>) => {
    try {
      // A search that times out is not repeated (a retry costs another full wait). A rate limit still is, after its pause.
      return okEntities(await qloo.call("qloo_insights", { ...base, ...extra }, { retryOnTimeout: false }));
    } catch (e) {
      if (e instanceof QlooError && e.timedOut) slow = true;
      return [] as QEntity[]; // films are one slot of eight; a failed lookup shouldn't sink the session
    }
  };
  // Songs, places and tastes are ready in about half a minute. Films shouldn't hold the session back past a fixed
  // budget: after it, the session is built with whatever films the plain recommend call found.
  let timer: ReturnType<typeof setTimeout> | undefined;
  const budget = new Promise<QEntity[][]>((resolve) => {
    timer = setTimeout(() => ((slow = true), resolve([[], []])), budgetMs);
  });
  // Without a favourite Qloo can look up by id there is nothing to search "like", so only the filler search runs.
  const mineSearch = ctx.signalIds.length ? run({}) : Promise.resolve([] as QEntity[]);
  const [mine, famous] = await Promise.race([Promise.all([mineSearch, run({ signal_location: ctx.input.region })]), budget]).finally(() => clearTimeout(timer));
  if (slow) onSlow?.();
  const out: QEntity[] = [];
  for (let i = 0; i < Math.max(mine.length, famous.length); i++) {
    if (mine[i]) out.push({ ...mine[i]!, via: "insights", pick: "favourites" });
    if (famous[i]) out.push({ ...famous[i]!, via: "insights", pick: "famous" });
  }
  return out;
}

/**
 * Place recommendations, hard-filtered to the region. For a whole country that filter is too heavy for Qloo and
 * times out (Mexico and Japan do; Nigeria doesn't). Loosening the query doesn't help: the same search without the
 * hard filter, or with a food tag, also runs past a minute. So wait once (no retry), and on a timeout carry on without
 * places instead of stalling the whole session, and say why through `onTooBig`. Only a timeout does this: an error
 * or an empty answer means something else (an unknown place, an outage) and is handled as before.
 */
export async function recommendPlaces(qloo: QlooClient, args: Record<string, unknown>, onTooBig: () => void): Promise<QlooEnvelope> {
  try {
    return await qloo.call("qloo_recommend", args, { retryOnTimeout: false });
  } catch (err) {
    if (!(err instanceof QlooError) || !err.timedOut || !args.filter_location) throw err;
    onTooBig();
    return { status: "empty", operation: "recommend", results: [] };
  }
}

/** Era, safety, avoid list, duplicates. */
export function filterPool(xs: QEntity[], ctx: BuildContext, taken: Set<string>): QEntity[] {
  const avoidIds = new Set(ctx.input.avoid ?? []);
  const out: QEntity[] = [];
  for (const e of xs) {
    const key = fold(e.name);
    if (taken.has(e.id) || taken.has(key) || avoidIds.has(e.id)) continue;
    if (!inEra(e.year, ctx.era)) continue;
    if (!entityIsSafe(e, ctx.input.avoidTopics ?? [])) continue;
    taken.add(e.id);
    taken.add(key);
    out.push(e);
  }
  return out;
}

export function composeArc(pools: Pools, ctx: BuildContext, warmUp?: QEntity): SessionItem[] {
  const items: SessionItem[] = [];
  const cursor: Record<Group, number> = { artist: 0, movie: 0, place: 0, taste: 0 };
  ARC.forEach((kind, i) => {
    const slot = i + 1;
    if (slot === 1 && warmUp) {
      items.push(makeItem(warmUp, kind, slot, ctx, { warmUp: true, operation: "describe" }));
      return;
    }
    const g = GROUP_OF[kind];
    const e = pools[g][cursor[g]];
    if (!e) return;
    cursor[g]++;
    items.push(makeItem(e, kind, slot, ctx));
  });
  // Whatever is left in each pool becomes the swap alternates.
  for (const g of Object.keys(pools) as Group[]) pools[g] = pools[g].slice(cursor[g]);
  for (const it of items) it.alternates = Math.min(pools[GROUP_OF[it.kind]].length, 5);
  return items;
}

/** Rank positions to move an item by: described as theirs rises a few places, described as from elsewhere falls. */
/** Films found from the favourites rise this many places: they belong to the person, where the best-known ones belong to everyone. */
const FAVOURITE_FILM_LEAN = -8;
const ORIGIN_LEAN: Record<-1 | 0 | 1, number> = { [-1]: 6, 0: 0, 1: -4 };

export async function buildSession(
  input: ProfileInput,
  deps: { qloo: QlooClient; llm?: Llm | null; recent?: RecentlyServed },
  emit: Emit,
): Promise<BuildResult> {
  const { qloo } = deps;
  const recent = deps.recent ?? recentlyServed;
  const country = countryKey(input.region);
  const era = eraWindow(input.birthDecade);
  const seenIds = new Set<string>();
  const step = (key: StepKey, state: "start" | "done", extra: { label?: string; count?: number } = {}) =>
    emit({ event: "step", data: { key, state, ...extra } });

  // --- resolve: confirm anchors with Qloo and pick a warm-up favourite --------------------
  step("resolve", "start", { label: "Matching their favourites" });
  const anchorIds = input.anchors.map((a) => a.qlooId).filter((x): x is string => !!x && !isTag(x));
  const anchorTags = input.anchors.map((a) => a.tag ?? (a.qlooId && isTag(a.qlooId) ? a.qlooId : undefined)).filter((x): x is string => !!x);
  const boost = input.boost ?? [];
  const ctx: BuildContext = {
    input,
    era,
    regionShort: input.region.split(",")[0]!.trim(),
    anchorNames: input.anchors.filter((a) => a.qlooId || a.tag).map((a) => a.label),
    signalIds: uniq([...boost.filter((b) => !isTag(b)), ...anchorIds]).slice(0, 10),
    signalTags: uniq([...boost.filter(isTag), ...anchorTags]).slice(0, 10),
    seenIds,
    local: localHints(input.region, input.anchors.map((a) => a.blurb).filter((b): b is string => !!b)),
  };
  let warmUp: QEntity | undefined;
  const firstMusic = input.anchors.find((a) => a.kind === "music" && a.qlooId && !isTag(a.qlooId));
  if (firstMusic?.qlooId && !(input.avoid ?? []).includes(firstMusic.qlooId)) {
    try {
      const env = await qloo.call("qloo_describe", { entity: firstMusic.qlooId, type: "artist" });
      // Only the entity the caregiver chose: describe can return related entities, and the first isn't always theirs.
      const e = okEntities(env).find((x) => x.id.toLowerCase() === firstMusic.qlooId!.toLowerCase());
      if (e && entityIsSafe(e, input.avoidTopics ?? [])) {
        warmUp = e;
        seenIds.add(e.id);
      }
    } catch (err) {
      if (err instanceof QlooError && err.code === "qloo_auth") throw new SessionError("qloo_auth", err.message, false);
    }
  }
  step("resolve", "done", { count: input.anchors.length });

  // --- expand: four recommend calls in parallel, 3× what we need ---------------------------
  const base: Record<string, unknown> = { demographic: DEMOGRAPHIC, signal_location: input.region, limit: 20, explain: true };
  if (ctx.signalIds.length) base.signals = ctx.signalIds;
  if (ctx.signalTags.length) {
    base.signal_tags = ctx.signalTags;
    base.signal_tags_operator = "union";
  }
  const lead = ctx.anchorNames[0];
  const jobs: { key: StepKey; label: string; args: Record<string, unknown> }[] = [
    { key: "songs", label: lead ? `Finding music people who love ${lead} also love` : "Finding music from their era", args: { ...base, target_type: "artist" } },
    { key: "films", label: `Looking for films from about ${era.from}–${era.to}`, args: { ...base, target_type: "movie" } },
    { key: "places", label: `Places around ${ctx.regionShort}`, args: { ...base, target_type: "place", filter_location: input.region } },
    { key: "tastes", label: `Tastes from ${ctx.regionShort}`, args: { ...base, target_type: "brand" } },
  ];
  for (const j of jobs) step(j.key, "start", { label: j.label });
  const notes: string[] = [];
  let busy = 0;
  let rejected = 0; // calls Qloo refused outright (not retryable): typically a place it can't match
  let placesTooBig = false; // the region is a whole country: Qloo timed out filtering places by it
  let filmsSlow = false; // the era-film search timed out or ran out of its budget
  const classics = qloo.mode === "live" ? classicFilms(qloo, ctx, FILM_BUDGET_MS, () => (filmsSlow = true)) : Promise.resolve([] as QEntity[]);
  const raw = await Promise.all(
    jobs.map(async (j) => {
      try {
        const env = j.key === "places" ? await recommendPlaces(qloo, j.args, () => (placesTooBig = true)) : await qloo.call("qloo_recommend", j.args);
        if (env.status === "degraded" || env.status === "partial") notes.push("Some Qloo results were partial this time.");
        let list = okEntities(env);
        if (j.key === "films") list = [...(await classics), ...list];
        list.forEach((e) => seenIds.add(e.id));
        step(j.key, "done", { count: list.length });
        return list;
      } catch (err) {
        if (err instanceof QlooError && err.code === "qloo_auth") throw new SessionError("qloo_auth", err.message, false);
        busy++;
        if (err instanceof QlooError && !err.retryable) rejected++;
        step(j.key, "done", { count: 0 });
        return [] as QEntity[];
      }
    }),
  );
  if (busy === jobs.length) {
    // Retrying won't help when Qloo rejects every request, and "busy" would be a lie. The place is the usual cause.
    if (rejected === jobs.length)
      throw new SessionError("thin_data", `We couldn't build a session for “${input.region}”. Check the place name and favourites, or try a nearby city.`, false);
    throw new SessionError("qloo_busy", "Qloo is busy right now.", true);
  }
  let [artistsRaw, moviesRaw, placesRaw, brandsRaw] = raw as [QEntity[], QEntity[], QEntity[], QEntity[]];

  // Qloo's location lookup knows some places only by a shorter name: "Mumbai, India" matches nothing (status ok, zero
  // results) while "Mumbai" works. If every located search came back empty, try the city on its own, say so, and use
  // that name from here on. Not a list of places: it applies to any "City, Country" the lookup can't match.
  const city = input.region.split(",")[0]?.trim();
  if (city && city !== input.region.trim() && !artistsRaw.length && !placesRaw.length && !brandsRaw.length) {
    const retryJobs = jobs; // songs, films, places, tastes
    for (const j of retryJobs) step(j.key, "start", { label: `Trying “${city}” on its own` });
    const again = await Promise.all(
      retryJobs.map(async (j) => {
        const args = { ...j.args, signal_location: city, ...(j.args.filter_location ? { filter_location: city } : {}) };
        try {
          const env = j.key === "places" ? await recommendPlaces(qloo, args, () => (placesTooBig = true)) : await qloo.call("qloo_recommend", args);
          return okEntities(env);
        } catch {
          return [] as QEntity[];
        }
      }),
    );
    retryJobs.forEach((j, i) => step(j.key, "done", { count: again[i]!.length }));
    if (again.some((l) => l.length)) {
      ctx.queryRegion = city;
      [artistsRaw, , placesRaw, brandsRaw] = again as [QEntity[], QEntity[], QEntity[], QEntity[]];
      moviesRaw = [...moviesRaw, ...again[1]!];
      for (const l of again) l.forEach((e) => seenIds.add(e.id));
      notes.push(`Qloo didn't recognise “${input.region}” as typed, so its songs, films, places and tastes were searched for “${city}” instead.`);
    }
  }

  // --- filter ------------------------------------------------------------------------------
  const taken = new Set<string>(warmUp ? [warmUp.id, fold(warmUp.name)] : []);
  for (const a of input.anchors) if (a.qlooId) taken.add(a.qlooId);
  // Tastes are food and drink brands, then places to eat; the two best places are held back for the place slots.
  const { taste, place } = allocatePlaces(brandsRaw, placesRaw, ctx, taken);
  const pools: Pools = {
    // An act that began after their years can't be part of what they grew up with.
    artist: filterPool(artistsRaw.filter((e) => !emergedAfter(e.description, era)), ctx, taken),
    movie: filterPool(moviesRaw, ctx, taken),
    taste,
    place,
  };

  // --- rank: Qloo rank against the same profile, then a soft pull toward the peak year ------
  step("rank", "start", { label: "Choosing the strongest matches" });
  const optionType: Record<Group, string> = { artist: "artist", movie: "movie", place: "place", taste: "brand" };
  await Promise.all(
    (Object.keys(pools) as Group[]).map(async (g) => {
      const pool = pools[g];
      if (pool.length < 2) return;
      const head = pool.slice(0, 10);
      const rankable = g === "taste" ? head.filter((e) => targetOfTaste(e) === "brand") : head;
      let order = new Map<string, number>(head.map((e, i) => [e.id, i]));
      if (rankable.length >= 2) {
        try {
          const env = await qloo.call("qloo_rank", {
            options: rankable.map((e) => e.id),
            option_type: optionType[g],
            demographic: DEMOGRAPHIC,
            signal_location: ctx.queryRegion ?? input.region,
            ...(ctx.signalIds.length ? { signals: ctx.signalIds } : {}),
          });
          const ranked = okEntities(env).map((e) => e.id);
          if (ranked.length) order = new Map([...ranked, ...head.map((e) => e.id).filter((id) => !ranked.includes(id))].map((id, i) => [id, i]));
        } catch {
          notes.push("Ranking was skipped for one group; results are in Qloo's recommendation order.");
        }
      }
      // Qloo's rank order, nudged by what suits a reminiscence session: films near the peak year, places you'd
      // have gone, and alcohol last. Without the nudge, ranking would undo the earlier ordering.
      // Artists and brands also lean toward what is described as theirs and away from what is described as from elsewhere.
      const origin = (e: QEntity) => ((g === "artist" || (g === "taste" && targetOfTaste(e) === "brand")) && ctx.local ? ORIGIN_LEAN[belongs(e.description, ctx.local)] : 0);
      // Something already offered to people in other countries is probably not specific to this one (places are exempt).
      const repeat = (e: QEntity) => (g === "place" ? 0 : repeatLean(recent.elsewhere(e.id, country)));
      const lean = (e: QEntity) => (g === "movie" ? eraDistance(e.year, era) + (e.pick === "favourites" ? FAVOURITE_FILM_LEAN : 0) : g === "place" ? placeLean(e) : g === "taste" ? tasteLean(e) : 0) + origin(e) + repeat(e);
      // Qloo ranked the first ten; the rest keep their recommendation position. Sorting the whole pool lets a nudge pass
      // over a repeated or off-theme item in favour of one further down.
      const score = (e: QEntity) => (order.get(e.id) ?? pool.indexOf(e)) + lean(e);
      pools[g] = [...pool].sort((a, b) => score(a) - score(b));
    }),
  );
  step("rank", "done");

  // --- compose -----------------------------------------------------------------------------
  step("compose", "start", { label: "Putting the session in order" });
  let items = assertQlooOnly(composeArc(pools, ctx, warmUp), seenIds);

  let llmOut: Record<string, string> | null = null;
  if (deps.llm && items.length) {
    try {
      llmOut = await deps.llm.writeQuestions(
        items.map((i) => ({ id: i.id, kind: i.kind, title: i.title, subtitle: i.subtitle, year: i.year })),
        { region: input.region, era: `${era.from}–${era.to}`, avoidTopics: input.avoidTopics ?? [] },
      );
    } catch {
      notes.push("Suggested questions are from our built-in set this time.");
    }
  }
  items = items.map((i) => ({ ...i, ...chooseQuestion(llmOut, i.id, i.kind, input.avoidTopics ?? [], i.kind === "taste" && i.provenance.qlooType === "place") }));
  step("compose", "done", { count: items.length });

  if (items.length < ARC.length) {
    // Places and tastes come from the region. If Qloo returned neither, the place is the likely cause, not the favourites.
    const noLocal = placesRaw.length === 0 && brandsRaw.length === 0;
    notes.unshift(
      placesTooBig
        ? `“${input.region}” is too big an area for Qloo to pick places in, so this session has none. Enter a city or town (a place they actually lived) to add them.`
        : noLocal
          ? `Qloo has little on “${input.region}” yet, so there are no places or tastes. Try a nearby larger city.`
          : filmsSlow && !items.some((i) => i.kind === "film")
            ? "Films from their era were slow to load this time, so this session has none. Planning it again usually brings them back."
            : `We found ${items.length} strong matches. Add another favourite to get a fuller session.`,
    );
  }
  if (qloo.mode === "mock") notes.push("Demo data: this server is running without a Qloo key.");

  // Remember what was offered, so the same generic names rank lower for people in other countries. The favourite they
  // chose themselves isn't "offered", and places are local by nature.
  recent.record(items.filter((i) => i.provenance.operation !== "describe" && i.kind !== "place" && i.provenance.qlooType !== "place").map((i) => i.provenance.qlooId), country);

  const session: Session = { id: randomUUID(), createdAt: new Date().toISOString(), eraWindow: era, items, notes: uniq(notes) };
  if (items.length === 0) throw new SessionError("thin_data", "We couldn't find enough matches. Check the place name, or try different favourites.", false);
  return { session, pools, ctx };
}

/** Swap one item for the next alternate of the same group. Returns null when none are left. */
export function swapItem(state: BuildResult, itemId: string, avoidTopics: string[]): SessionItem | null {
  const idx = state.session.items.findIndex((i) => i.id === itemId);
  const cur = state.session.items[idx];
  if (!cur) return null;
  const g = GROUP_OF[cur.kind];
  const next = state.pools[g].shift();
  if (!next) return null;
  const item = makeItem(next, cur.kind, cur.slot, state.ctx);
  Object.assign(item, chooseQuestion(null, item.id, item.kind, avoidTopics, item.kind === "taste" && item.provenance.qlooType === "place"));
  state.session.items[idx] = item;
  const left = Math.min(state.pools[g].length, 5);
  for (const it of state.session.items) if (GROUP_OF[it.kind] === g) it.alternates = left;
  return item;
}
