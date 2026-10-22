// Turns Qloo envelope `results` into a flat entity list.
// The per-item shape is not yet confirmed by a live probe, so this accepts the shapes
// the harness and Insights API are known to use. Tighten it once probe-out/ is in.
import type { QlooEnvelope } from "./client.js";

export type QEntity = {
  id: string;
  name: string;
  type?: string;
  year?: number;
  description?: string;
  tags: string[];
  contentRating?: string;
  popularity?: number;
  address?: string;
  image?: string;
  /** Set when the entity came from somewhere other than `qloo_recommend` (e.g. "insights"). */
  via?: string;
  /** For films found by Insights: found from the favourites, or one of the best-known films of the era. */
  pick?: "favourites" | "famous";
  /** Film and TV genres from Qloo ("Horror", "Crime", ...). Used by the safety filter. */
  genres?: string[];
};

/** Shortens text for display without cutting a word: prefers a sentence end, then a word end, and adds "…". */
export function clip(s: string, max: number): string {
  const t = s.trim();
  if (t.length <= max) return t;
  const head = t.slice(0, max);
  const sentence = Math.max(head.lastIndexOf(". "), head.lastIndexOf("! "), head.lastIndexOf("? "));
  if (sentence >= 40) return head.slice(0, sentence + 1);
  const space = head.lastIndexOf(" ");
  return `${(space > 20 ? head.slice(0, space) : head).replace(/[\s,;:–-]+$/, "")}…`;
}

type Rec = Record<string, unknown>;
const isRec = (v: unknown): v is Rec => !!v && typeof v === "object" && !Array.isArray(v);
const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);

function findArray(results: unknown): unknown[] {
  if (Array.isArray(results)) return results;
  if (isRec(results)) {
    for (const k of ["entities", "results", "items", "candidates", "tags", "data"]) {
      const v = results[k];
      if (Array.isArray(v)) return v;
      if (isRec(v)) {
        const inner = findArray(v);
        if (inner.length) return inner;
      }
    }
    if (str(results.name) && (str(results.id) || str(results.entity_id))) return [results];
  }
  return [];
}

function yearOf(r: Rec): number | undefined {
  const props = isRec(r.properties) ? r.properties : {};
  for (const v of [r.release_year, props.release_year, r.year]) {
    const n = typeof v === "string" ? parseInt(v, 10) : v;
    if (typeof n === "number" && Number.isInteger(n) && n > 1800 && n < 2100) return n;
  }
  for (const v of [r.release_date, props.release_date]) {
    const m = typeof v === "string" ? /^(\d{4})/.exec(v) : null;
    if (m) return parseInt(m[1]!, 10);
  }
  return undefined;
}

function tagsOf(r: Rec): string[] {
  const raw = r.tags;
  if (!Array.isArray(raw)) return [];
  return raw
    .map((t) => (typeof t === "string" ? t : isRec(t) ? (str(t.name) ?? str(t.id)) : undefined))
    .filter((t): t is string => !!t);
}

function addressOf(r: Rec): string | undefined {
  const props = isRec(r.properties) ? r.properties : {};
  const a = r.address ?? props.address;
  if (typeof a === "string") return a;
  if (isRec(a)) return [a.city, a.locality, a.region, a.country].map(str).filter(Boolean).join(", ") || undefined;
  return undefined;
}

export function toEntity(v: unknown): QEntity | null {
  if (!isRec(v)) return null;
  const r = isRec(v.entity) ? { ...v, ...v.entity } : v;
  const props = isRec(r.properties) ? r.properties : {};
  const id = str(r.entity_id) ?? str(r.id) ?? str(r.qloo_id);
  const name = str(r.name);
  if (!id || !name) return null;
  const image = isRec(props.image) ? str(props.image.url) : str(props.image);
  const genres = Array.isArray(props.genres)
    ? props.genres.map((g) => (typeof g === "string" ? g : isRec(g) ? str(g.name) : undefined)).filter((g): g is string => !!g)
    : [];
  return {
    ...(genres.length ? { genres } : {}),
    id,
    name,
    type: str(r.type) ?? str(r.subtype),
    year: yearOf(r),
    description: str(props.short_description) ?? str(props.description) ?? str(r.description),
    tags: tagsOf(r),
    contentRating: str(props.content_rating) ?? str(r.content_rating),
    popularity: typeof r.popularity === "number" ? r.popularity : undefined,
    address: addressOf(r),
    image,
  };
}

export function entities(env: QlooEnvelope): QEntity[] {
  return findArray(env.results).map(toEntity).filter((e): e is QEntity => !!e);
}

/** Candidates for a needs_input envelope (may live in results or interpretation). */
export function candidates(env: QlooEnvelope): QEntity[] {
  const fromResults = entities(env);
  if (fromResults.length) return fromResults;
  return findArray(env.interpretation).map(toEntity).filter((e): e is QEntity => !!e);
}

/** Tag URNs from qloo_find_tags. */
export function tagsFrom(env: QlooEnvelope): { id: string; name: string }[] {
  return findArray(env.results)
    .map((t) => (isRec(t) ? { id: str(t.id) ?? str(t.tag_id) ?? str(t.urn), name: str(t.name) } : null))
    .filter((t): t is { id: string; name: string } => !!t?.id && !!t?.name);
}
