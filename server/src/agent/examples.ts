import type { QlooClient } from "../qloo/client.js";
import { RecentlyServed } from "./diversity.js";
import { resolveAnchor } from "./resolve.js";
import { buildSession } from "./session.js";
import type { AnchorKind, ProfileInput, Session } from "../types.js";

/**
 * The example people on the web's home screen (web/lib/store.ts), without their nicknames: a nickname never reaches
 * the server. Keep the decade, region and anchors identical to the web's list, or the saved answers won't match.
 */
export const EXAMPLE_PROFILES: { birthDecade: ProfileInput["birthDecade"]; region: string; anchors: [string, AnchorKind][] }[] = [
  { birthDecade: "1940s", region: "Mexico City, Mexico", anchors: [["Pedro Infante", "music"], ["bolero", "music"], ["tamales", "food"]] },
  { birthDecade: "1940s", region: "Liverpool, UK", anchors: [["The Beatles", "music"], ["Cilla Black", "music"], ["tea", "food"]] },
  { birthDecade: "1950s", region: "Ibadan, Nigeria", anchors: [["King Sunny Adé", "music"], ["highlife", "music"], ["amala", "food"]] },
];

/** Resolves an example's anchors the way the browser does before it asks for a session. */
export async function exampleInput(qloo: QlooClient, ex: (typeof EXAMPLE_PROFILES)[number]): Promise<ProfileInput> {
  const list = await Promise.all(ex.anchors.map(([text, kind]) => resolveAnchor(qloo, text, kind)));
  return {
    birthDecade: ex.birthDecade,
    region: ex.region,
    anchors: list
      .filter((a) => a.status === "matched")
      .map((a) => ({ kind: a.kind, label: a.match!.name, ...(a.tag ? { tag: a.tag } : { qlooId: a.match!.qlooId }) })),
  };
}

export const hasFilm = (s: Session) => s.items.some((i) => i.kind === "film");

/**
 * Builds an example session up to `tries` times until it has a film, so every answer it needs is cached. Uses its own
 * "recently served" record so these builds don't change what real visitors are offered. Returns whether it got a film.
 */
export async function buildExample(qloo: QlooClient, ex: (typeof EXAMPLE_PROFILES)[number], tries = 3): Promise<boolean> {
  for (let i = 0; i < tries; i++) {
    try {
      const { session } = await buildSession(await exampleInput(qloo, ex), { qloo, llm: null, recent: new RecentlyServed() }, () => {});
      if (hasFilm(session)) return true;
    } catch {
      // Qloo busy or slow: the next try meets whatever the first one cached.
    }
  }
  return false;
}

/** Builds each example in turn in the background. Never throws. */
export async function prewarmExamples(qloo: QlooClient, log: (msg: string) => void) {
  for (const ex of EXAMPLE_PROFILES) {
    const ok = await buildExample(qloo, ex);
    log(`Example ${ex.region}: ${ok ? "ready, films included" : "built without films (Qloo was slow)"}`);
  }
}
