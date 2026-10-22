// Live anchor resolution for the profile builder: what the caregiver typed → a Qloo entity or tag.
import type { QlooClient } from "../qloo/client.js";
import { candidates, clip, entities, tagsFrom, type QEntity } from "../qloo/normalize.js";
import type { AnchorKind, Candidate, ResolvedAnchor } from "../types.js";
import { fold } from "./safety.js";

const DESCRIBE_TYPE: Partial<Record<AnchorKind, string[]>> = {
  music: ["artist"],
  film_tv: ["movie", "tv_show"],
  place: ["place", "locality"],
};

// find_tags returns many tags with the same name ("Amala" as a cuisine, a popular food item, ...), so prefer the
// most useful tag type for what was typed. Qloo tag ids look like urn:tag:<type>:<scope>:<slug>.
const TAG_PREFERENCE: Partial<Record<AnchorKind, string[]>> = {
  music: ["genre:music", "genre:qloo", "genre", "subgenre", "style", "influence"],
  food: ["popular_food_item", "cuisine", "specialty_dish", "product_category"],
};

// An artist lookup can return an entity that is really a genre ("Highlife is a music genre that…").
const GENRE_DESCRIPTION = /\b(music(al)? genre|genre of|genre that|style of music|musical style|form of (music|dance)|dance music|type of music)\b/i;

const readableType = (t?: string) => (t ? t.replace(/^urn:entity:/, "").replace(/_/g, " ") : "");

function toCandidate(e: QEntity): Candidate {
  const bits = [readableType(e.type), e.year ? String(e.year) : "", e.description ?? ""].filter(Boolean);
  return { qlooId: e.id, name: e.name, type: readableType(e.type), subtitle: clip(bits.join(" · "), 90) || undefined };
}

/**
 * The best tag for what was typed: an exact name match, most useful type first. Without an exact match, accept a
 * tag whose name contains (or is contained in) the text. Never the first result by default: "amala" used to
 * match "Mala".
 */
export function pickTag(tags: { id: string; name: string }[], text: string, prefer: string[] = []): { id: string; name: string } | null {
  const want = fold(text.trim());
  if (!want) return null;
  const typeOf = (id: string) => id.replace(/^urn:tag:/, "").split(":");
  const rank = (id: string) => {
    const [type, scope] = typeOf(id);
    const i = prefer.findIndex((p) => p === `${type}:${scope}` || p === type);
    return i < 0 ? prefer.length : i;
  };
  // Whole words only: "mala" is inside "amala" but is a different thing.
  const hasWord = (hay: string, needle: string) => needle.length >= 4 && ` ${hay} `.includes(` ${needle} `);
  const exact = tags.filter((t) => fold(t.name) === want);
  const near = tags.filter((t) => hasWord(fold(t.name), want) || hasWord(want, fold(t.name)));
  const pool = exact.length ? exact : near;
  return [...pool].sort((a, b) => rank(a.id) - rank(b.id))[0] ?? null;
}

async function viaDescribe(qloo: QlooClient, text: string, types: string[]): Promise<ResolvedAnchor | null> {
  for (const type of types) {
    const env = await qloo.call("qloo_describe", { entity: text, type });
    if (env.status === "needs_input") {
      const c = candidates(env).slice(0, 5).map(toCandidate);
      if (c.length) return { text, kind: "music", status: "choose", candidates: c };
    }
    if (env.status === "ok" || env.status === "partial" || env.status === "degraded") {
      const [first] = entities(env);
      if (first) return { text, kind: "music", status: "matched", match: toCandidate(first) };
    }
  }
  return null;
}

async function viaTags(qloo: QlooClient, text: string, kind: AnchorKind): Promise<ResolvedAnchor | null> {
  const env = await qloo.call("qloo_find_tags", { query: text, limit: 10 });
  if (env.status !== "ok" && env.status !== "partial") return null;
  const tag = pickTag(tagsFrom(env), text, TAG_PREFERENCE[kind] ?? []);
  if (!tag) return null;
  return { text, kind: "music", status: "matched", tag: tag.id, match: { qlooId: tag.id, name: tag.name, type: "tag" } };
}

export async function resolveAnchor(qloo: QlooClient, text: string, kind: AnchorKind): Promise<ResolvedAnchor> {
  const clean = text.trim().slice(0, 80);
  const describeTypes = DESCRIBE_TYPE[kind];
  const plain = fold(clean); // "Adé" → "Ade": the artist lookup can miss on accents
  const named = async () => {
    if (!describeTypes) return null;
    const r = await viaDescribe(qloo, clean, describeTypes);
    if (r) return r;
    return plain !== clean.toLowerCase() ? viaDescribe(qloo, plain, describeTypes) : null;
  };

  // Named things first (artists, films, places); concepts (foods, jobs, genres) as tags.
  const order = describeTypes ? [named, () => viaTags(qloo, clean, kind)] : [() => viaTags(qloo, clean, kind), () => viaDescribe(qloo, clean, ["brand"])];
  for (const step of order) {
    const r = await step();
    if (!r) continue;
    // "highlife" / "bolero" come back as an entity that is really a genre: use the genre tag instead.
    if (kind === "music" && r.status === "matched" && !r.tag && GENRE_DESCRIPTION.test(r.match?.subtitle ?? "")) {
      const tag = await viaTags(qloo, clean, kind);
      if (tag) return { ...tag, text: clean, kind };
    }
    return { ...r, text: clean, kind };
  }
  return { text: clean, kind, status: "none" };
}
