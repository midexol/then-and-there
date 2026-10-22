// Safety filters. `avoidTopics` is used here, on our server only. It is never sent to Qloo.
import type { QEntity } from "../qloo/normalize.js";

export const BUILT_IN_AVOID = [
  "war", "wars", "battle", "funeral", "death", "dead", "dying", "murder", "killer", "prison", "jail",
  "massacre", "genocide", "bomb", "bombing", "horror", "slaughter", "suicide", "abuse", "torture",
  // Places of mourning aren't somewhere to go back to in a reminiscence session (a cemetery museum came up for Guadalajara).
  "cemetery", "cemeteries", "graveyard", "crematorium", "mortuary",
];

const ADULT_RATINGS = /^(r|nc-17|x|xxx|18|18\+|r18|r-18|adult)$/i;

export const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

function hits(text: string, topic: string): boolean {
  const t = fold(topic.trim());
  if (!t) return false;
  const hay = fold(text);
  if (/\s/.test(t)) return hay.includes(t);
  return new RegExp(`(^|[^a-z0-9])${t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}([^a-z0-9]|$)`).test(hay);
}

export function matchesAny(text: string, topics: string[]): boolean {
  return topics.some((t) => hits(text, t));
}

// Qloo's own genre labels. Plot-theme tags catch most unsuitable films, but a film with thin tags would slip
// through, so the genre is checked too. This only ever removes films, never adds them.
const UNSAFE_GENRES = /^(horror|war|crime|thriller)$/i;

// Qloo tags nearly every film with its plot themes, so words like "death" and "war" appear on gentle comedies and
// family films too (The Jungle Book, a Cantinflas comedy). These few are "soft": they only block a film that isn't
// plainly gentle. Everything else in BUILT_IN_AVOID stays hard, and so does anything the caregiver listed.
const SOFT_TOPICS = ["death", "dying", "war", "wars", "battle"];
const HARD_TOPICS = BUILT_IN_AVOID.filter((t) => !SOFT_TOPICS.includes(t));
const GENTLE_GENRES = /^(comedy|family|animation|musical|romance)$/i;
const GENTLE_RATINGS = /^(g|pg|approved)$/i;
const UNRATED = /^(|not rated|unrated|nr)$/i;

/** A film is gentle when it has a gentle genre and a rating of G, PG, Approved or none. Non-films have no genres. */
function isGentle(e: QEntity): boolean {
  const rating = (e.contentRating ?? "").trim();
  return !!e.genres?.some((g) => GENTLE_GENRES.test(g.trim())) && (GENTLE_RATINGS.test(rating) || UNRATED.test(rating));
}

export function entityIsSafe(e: QEntity, avoidTopics: string[]): boolean {
  if (e.contentRating && ADULT_RATINGS.test(e.contentRating.trim())) return false;
  if (e.genres?.some((g) => UNSAFE_GENRES.test(g.trim()))) return false;
  const text = [e.name, e.description ?? "", ...e.tags].join(" | ");
  if (matchesAny(text, avoidTopics)) return false; // the caregiver's list is absolute
  if (matchesAny(text, HARD_TOPICS)) return false;
  return !matchesAny(text, SOFT_TOPICS) || isGentle(e);
}

const TESTING = /\b(do|don't|dont|can|can't|cant) you (still )?(remember|recall)\b|\bremember when\b|\bdo you know who\b|\bwhat year\b/i;
const HEALTH = /\b(dementia|alzheimer'?s?|memory loss|therapy|therapeutic|treatment|cognitive|patient|diagnos\w*)\b/i;

/** Questions invite and never test. They also never touch health or the caregiver's avoid list. */
export function questionIsSafe(q: string, avoidTopics: string[]): boolean {
  const s = q.trim();
  if (s.length < 8 || s.length > 160) return false;
  if (TESTING.test(s) || HEALTH.test(s)) return false;
  return !matchesAny(s, [...BUILT_IN_AVOID, ...avoidTopics]);
}
