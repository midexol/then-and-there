// HTTP API (docs/API_CONTRACT.md). Built as a factory so tests can inject a mock Qloo.
import Fastify, { type FastifyReply } from "fastify";
import cors from "@fastify/cors";
import { QlooError, type QlooClient } from "./qloo/client.js";
import { resolveAnchor } from "./agent/resolve.js";
import { buildSession, SessionError, swapItem, type BuildResult } from "./agent/session.js";
import type { Llm } from "./agent/prompts.js";
import { BIRTH_DECADES, type AnchorKind, type ProfileInput, type SseEvent } from "./types.js";

const KINDS: AnchorKind[] = ["music", "food", "film_tv", "place", "work_hobby"];

type Entry = { events: SseEvent[]; listeners: Set<(e: SseEvent) => void>; done: boolean; state?: BuildResult; createdAt: number };

const s = (v: unknown, max: number) => (typeof v === "string" && v.trim() && v.length <= max ? v.trim() : undefined);
const strs = (v: unknown, maxItems: number, maxLen: number) =>
  Array.isArray(v) ? v.map((x) => s(x, maxLen)).filter((x): x is string => !!x).slice(0, maxItems) : undefined;

/** Builds a fresh ProfileInput from untrusted JSON. Unknown fields (e.g. a name) are dropped, never forwarded. */
export function parseProfile(body: unknown): ProfileInput | null {
  if (!body || typeof body !== "object") return null;
  const b = body as Record<string, unknown>;
  const birthDecade = BIRTH_DECADES.find((d) => d === b.birthDecade);
  const region = s(b.region, 120);
  if (!birthDecade || !region || !Array.isArray(b.anchors)) return null;
  const anchors = b.anchors
    .slice(0, 15)
    .map((a) => {
      if (!a || typeof a !== "object") return null;
      const r = a as Record<string, unknown>;
      const kind = KINDS.find((k) => k === r.kind);
      const label = s(r.label, 80);
      if (!kind || !label) return null;
      return { kind, label, qlooId: s(r.qlooId, 120), tag: s(r.tag, 160), blurb: s(r.blurb, 300) };
    })
    .filter((a): a is NonNullable<typeof a> => !!a);
  return {
    birthDecade,
    region,
    livesNow: s(b.livesNow, 120),
    anchors,
    boost: strs(b.boost, 30, 160),
    avoid: strs(b.avoid, 60, 160),
    avoidTopics: strs(b.avoidTopics, 20, 60),
  };
}

function bucketLimiter(perMinute: number) {
  const hits = new Map<string, number[]>();
  return (key: string) => {
    const now = Date.now();
    const arr = (hits.get(key) ?? []).filter((t) => now - t < 60_000);
    arr.push(now);
    hits.set(key, arr);
    return arr.length <= perMinute;
  };
}

export function buildApp(deps: { qloo: QlooClient; llm?: Llm | null; allowedOrigin?: string; logger?: boolean }) {
  const app = Fastify({ logger: deps.logger ?? false, bodyLimit: 32 * 1024 });
  const origins = (deps.allowedOrigin?.trim() || "*").split(",").map((o) => o.trim()).filter(Boolean); // blank means any origin
  app.register(cors, { origin: origins.includes("*") ? true : origins, methods: ["GET", "POST"] });

  const sessions = new Map<string, Entry>();
  const sessionLimit = bucketLimiter(8);
  const resolveLimit = bucketLimiter(60);
  setInterval(() => {
    const cutoff = Date.now() - 2 * 60 * 60_000;
    for (const [id, e] of sessions) if (e.createdAt < cutoff) sessions.delete(id);
  }, 10 * 60_000).unref();

  const fail = (reply: FastifyReply, status: number, code: string, message: string, retryable = false) =>
    reply.code(status).send({ code, message, retryable });

  app.get("/api/health", async () => ({
    qloo: deps.qloo.mode === "live" ? "ready" : "missing_key",
    mode: deps.qloo.mode,
    llm: deps.llm ? "ready" : "missing",
  }));

  app.post("/api/anchors/resolve", async (req, reply) => {
    if (!resolveLimit(req.ip)) return fail(reply, 429, "qloo_busy", "Too many lookups. Wait a moment.", true);
    const body = req.body as { anchors?: unknown };
    if (!Array.isArray(body?.anchors) || body.anchors.length === 0 || body.anchors.length > 10)
      return fail(reply, 400, "bad_input", "Send 1 to 10 anchors.");
    const list = body.anchors
      .map((a) => {
        const r = (a ?? {}) as Record<string, unknown>;
        const kind = KINDS.find((k) => k === r.kind);
        const text = s(r.text, 80);
        return kind && text ? { kind, text } : null;
      })
      .filter((a): a is { kind: AnchorKind; text: string } => !!a);
    if (!list.length) return fail(reply, 400, "bad_input", "Each anchor needs text and a kind.");
    try {
      const anchors = await Promise.all(list.map((a) => resolveAnchor(deps.qloo, a.text, a.kind)));
      return { anchors };
    } catch (e) {
      if (e instanceof QlooError) return fail(reply, e.code === "qloo_auth" ? 503 : 503, e.code === "qloo_auth" ? "qloo_auth" : "qloo_busy", e.message, e.retryable);
      throw e;
    }
  });

  app.post("/api/sessions", async (req, reply) => {
    if (!sessionLimit(req.ip)) return fail(reply, 429, "qloo_busy", "Too many sessions at once. Try again in a minute.", true);
    const input = parseProfile(req.body);
    if (!input) return fail(reply, 400, "bad_input", "A birth decade, a region and an anchors list are required.");
    if (input.anchors.filter((a) => a.qlooId || a.tag).length < 1) return fail(reply, 400, "bad_input", "Add at least one matched favourite.");
    const id = crypto.randomUUID();
    const entry: Entry = { events: [], listeners: new Set(), done: false, createdAt: Date.now() };
    sessions.set(id, entry);
    const push = (e: SseEvent) => {
      entry.events.push(e);
      for (const l of entry.listeners) l(e);
    };
    buildSession(input, deps, push)
      .then((r) => {
        r.session.id = id;
        entry.state = r;
        push({ event: "session", data: r.session });
      })
      .catch((e: unknown) => {
        const err =
          e instanceof SessionError
            ? { code: e.code, message: e.message, retryable: e.retryable }
            : { code: "qloo_busy" as const, message: "Something went wrong while building the session.", retryable: true };
        if (!(e instanceof SessionError)) req.log.error(e);
        push({ event: "error", data: err });
      })
      .finally(() => {
        entry.done = true;
      });
    return reply.code(202).send({ sessionId: id });
  });

  app.get("/api/sessions/:id/events", (req, reply) => {
    const entry = sessions.get((req.params as { id: string }).id);
    if (!entry) return fail(reply, 404, "not_found", "Session not found.");
    reply.hijack();
    const res = reply.raw;
    const origin = req.headers.origin;
    res.writeHead(200, {
      "content-type": "text/event-stream",
      "cache-control": "no-cache, no-transform",
      connection: "keep-alive",
      "x-accel-buffering": "no",
      ...(origin && (origins.includes("*") || origins.includes(origin)) ? { "access-control-allow-origin": origin, vary: "Origin" } : {}),
    });
    const send = (e: SseEvent) => {
      res.write(`event: ${e.event}\ndata: ${JSON.stringify(e.data)}\n\n`);
      if (e.event === "session" || e.event === "error") res.end();
    };
    for (const e of entry.events) send(e);
    if (entry.done && entry.events.some((e) => e.event === "session" || e.event === "error")) return;
    entry.listeners.add(send);
    const ping = setInterval(() => res.write(": ping\n\n"), 15_000);
    req.raw.on("close", () => {
      clearInterval(ping);
      entry.listeners.delete(send);
    });
  });

  app.post("/api/sessions/:id/swap", async (req, reply) => {
    const entry = sessions.get((req.params as { id: string }).id);
    if (!entry?.state) return fail(reply, 404, "not_found", "This session has expired. Build a new one.");
    const itemId = s((req.body as { itemId?: unknown })?.itemId, 80);
    if (!itemId) return fail(reply, 400, "bad_input", "itemId is required.");
    if (!entry.state.session.items.some((i) => i.id === itemId)) return fail(reply, 404, "not_found", "That item isn't in this session.");
    const item = swapItem(entry.state, itemId, entry.state.ctx.input.avoidTopics ?? []);
    if (!item) return fail(reply, 409, "no_alternates", "No more alternatives for this one.");
    return { item, items: entry.state.session.items.map((i) => ({ id: i.id, alternates: i.alternates })) };
  });

  return app;
}
