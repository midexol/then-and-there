// The browser only ever talks to our server. Never to Qloo or the LLM.
import type { AnchorChip, AnchorKind, ErrorCode, Profile, ResolvedAnchor, SessionItem } from "./types";

export const API = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8787").replace(/\/$/, "");

export class ApiError extends Error {
  constructor(
    public code: ErrorCode | string,
    message: string,
    public retryable = false,
  ) {
    super(message);
  }
}

async function post<T>(path: string, body: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(API + path, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) });
  } catch {
    throw new ApiError("network", "Network error", true);
  }
  const json = (await res.json().catch(() => ({}))) as Record<string, unknown>;
  if (!res.ok) throw new ApiError(String(json.code ?? "network"), String(json.message ?? res.statusText), !!json.retryable);
  return json as T;
}

export async function health(): Promise<{ qloo: string; mode: "live" | "mock"; llm: string } | null> {
  try {
    const r = await fetch(API + "/api/health");
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

export async function resolveAnchors(anchors: { text: string; kind: AnchorKind }[]): Promise<ResolvedAnchor[]> {
  const r = await post<{ anchors: ResolvedAnchor[] }>("/api/anchors/resolve", { anchors });
  return r.anchors;
}

/** What leaves the browser: no nickname, no notes, no history. */
export function toProfileInput(p: Profile) {
  const anchors = p.anchors
    .filter((a: AnchorChip) => a.status === "matched" && a.match)
    .map((a) => ({ kind: a.kind, label: a.match!.name, ...(a.tag ? { tag: a.tag } : { qlooId: a.match!.qlooId }), ...(a.match!.subtitle ? { blurb: a.match!.subtitle } : {}) }));
  return {
    birthDecade: p.birthDecade,
    region: p.region,
    ...(p.livesNow ? { livesNow: p.livesNow } : {}),
    anchors,
    boost: p.boost,
    avoid: p.avoid,
    avoidTopics: p.avoidTopics,
  };
}

export const startSession = (p: Profile) => post<{ sessionId: string }>("/api/sessions", toProfileInput(p));
export const eventsUrl = (id: string) => `${API}/api/sessions/${encodeURIComponent(id)}/events`;
export const swap = (sessionId: string, itemId: string) =>
  post<{ item: SessionItem; items: { id: string; alternates: number }[] }>(`/api/sessions/${encodeURIComponent(sessionId)}/swap`, { itemId });
