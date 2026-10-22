// Where does an artist or a brand come from, and does it belong to the listener's world? Answered from Qloo's own
// description of the thing, so no country or nationality is hard-coded: the listener's own favourites teach us what
// "theirs" looks like (their descriptions say "Mexican singer", "Japanese singer", ...), and the region adds its own names.
// These are soft signals that nudge a ranking. They never drop an item on their own, except `emergedAfter`.
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

/**
 * An artist that began after the era window closed can't be part of what they grew up with: "formed in 2019", or "born"
 * within a decade of the window's end. Only artists are tested; a brand can be a taste from home without being old.
 */
export function emergedAfter(text: string | undefined, era: EraWindow): boolean {
  if (!text) return false;
  const m = /\b(formed|founded|established|born|debuted|launched|started|since)\b[^.]{0,90}?\b((?:19|20)\d{2})\b/i.exec(text);
  if (!m) return false;
  const year = Number(m[2]);
  return m[1]!.toLowerCase() === "born" ? year >= era.to - 10 : year > era.to;
}
