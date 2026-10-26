// Where does an artist or a brand come from, and does it belong to the listener's world?
import { fold } from "./safety.js";
import type { EraWindow } from "../types.js";

const ROLES =
  "singers?|singer-songwriters?|vocalists?|musicians?|bands?|groups?|duos?|trios?|composers?|songwriters?|rappers?|drummers?|guitarists?|pianists?|violinists?|artists?|orchestras?|ensembles?|projects?|collectives?|actors?|actress(?:es)?|filmmakers?|directors?|comedians?|poets?";
const THINGS =
  "compan(?:y|ies)|brands?|chains?|restaurants?|retailers?|multinationals?|manufacturers?|franchises?|firms?|corporations?|conglomerates?|producers?|bakery|bakeries|caf[eé]s?|coffeehouses?|labels?|distributors?";
// "X was a Mexican singer", "Y is an English rock band", "Z is a UK-based tea company"
const DEMONYM = new RegExp(`\\b(?:is|was|are|were)\\s+(?:an?|the)\\s+(?:[a-z-]+\\s+){0,2}?([A-Z][a-z]+)(?:\\s+(?:and|&)\\s+[A-Z][a-z]+)?\\s+(?:[A-Za-z-]+\\s+){0,3}?(?:${ROLES}|${THINGS})\\b`);
const BASED = /\b([A-Z][A-Za-z]{1,})-based\b/;

export type Origin = { demonym?: string; basedIn?: string };

export function originOf(text?: string): Origin {
  if (!text) return {};
  const d = DEMONYM.exec(text)?.[1];
  const b = BASED.exec(text)?.[1];
  return { ...(d ? { demonym: d } : {}), ...(b ? { basedIn: b } : {}) };
}

export type LocalHints = {
  /** Names of the region: each comma-separated part, folded ("mexico city", "mexico"). */
  places: string[];
  /** Nationality words the listener's own favourites are described with, folded ("mexican"). */
  demonyms: Set<string>;
};

const GENERIC_PLACE = new Set(["city", "town", "the", "of"]);

/** The region's own names plus the nationality words found in the descriptions of the favourites. */
export function localHints(region: string, blurbs: string[]): LocalHints {
  const places = region
    .split(",")
    .map((p) => fold(p).trim())
    .filter((p) => p.length >= 2 && !GENERIC_PLACE.has(p));
  const demonyms = new Set<string>();
  for (const b of blurbs) {
    const d = originOf(b).demonym;
    if (d) demonyms.add(fold(d));
  }
  return { places, demonyms };
}

const wordIn = (hay: string, needle: string) => new RegExp(`(^|[^a-z0-9])${needle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(hay);

/** A nationality word matches a place name when it starts with the place's first four letters: Japan → Japanese. */
const demonymOfPlace = (demonym: string, place: string) => place.length >= 5 && !place.includes(" ") && demonym.startsWith(place.slice(0, 4));

/** 1: described as belonging to their world. -1: described as from somewhere else. 0: can't tell. */
export function belongs(text: string | undefined, hints: LocalHints): 1 | 0 | -1 {
  if (!text) return 0;
  const hay = fold(text);
  if (hints.places.some((p) => wordIn(hay, p))) return 1;
  const { demonym, basedIn } = originOf(text);
  if (demonym) {
    const d = fold(demonym);
    if (hints.demonyms.has(d) || hints.places.some((p) => demonymOfPlace(d, p))) return 1;
  }
  if (basedIn) {
    const b = fold(basedIn);
    if (hints.places.includes(b)) return 1;
  }
  return demonym || basedIn ? -1 : 0;
}

/** An artist that began after the era window closed can't be part of what they grew up with: "formed in 2019", or "born" within a decade of the window's end. */
export function emergedAfter(text: string | undefined, era: EraWindow): boolean {
  if (!text) return false;
  const m = /\b(formed|founded|established|born|debuted|launched|started|since)\b[^.]{0,90}?\b((?:19|20)\d{2})\b/i.exec(text);
  if (!m) return false;
  const year = Number(m[2]);
  return m[1]!.toLowerCase() === "born" ? year >= era.to - 10 : year > era.to;
}

// "Italian and pizza restaurant", "European fare", "serving American cuisine": which cooking is it?
const CUISINE = new RegExp(
  "\\b([A-Z][a-z]+(?:-[A-Z][a-z]+)?)(?:\\s+(?:and|&)\\s+[A-Za-z-]+)?\\s+(?:[a-z-]+\\s+){0,2}?(?:restaurants?|eateries|eatery|cuisine|fare|pizzeria|bistro|food|kitchen|grill|diner|caf[e\u00e9]s?|bakery|steakhouse|burgers?|pizza)\\b",
);

/** 1: the cooking is theirs (or the place is named). -1: it's from somewhere else (an Italian pizzeria in Mumbai). 0: can't tell. */
export function cuisineBelongs(text: string | undefined, hints: LocalHints): 1 | 0 | -1 {
  if (!text) return 0;
  const w = CUISINE.exec(text)?.[1];
  if (!w) return 0;
  const f = fold(w);
  if (hints.places.includes(f) || hints.demonyms.has(f) || hints.places.some((p) => demonymOfPlace(f, p))) return 1;
  return -1;
}

/** The year a business says it was established, if its description says so ("Established in 1993"). */
export function foundedYear(text: string | undefined): number | undefined {
  const m = text ? /\b(?:established|founded|since|started|launched)\b[^.]{0,40}?\b((?:18|19|20)\d{2})\b/i.exec(text) : null;
  return m ? Number(m[1]) : undefined;
}
