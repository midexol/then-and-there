// MOCK transport: answers like `qloo mcp` from fixtures, so the whole app runs without a key.
import { createHash } from "node:crypto";
import type { QlooEnvelope, QlooTool, QlooTransport } from "./client.js";
import { FIXTURES, GLOBAL_FIXTURE, KNOWN_TAGS, type RegionFixture } from "./fixtures.js";

type Target = "artist" | "movie" | "place" | "brand";
const TARGETS: Target[] = ["artist", "movie", "place", "brand"];

const uuid = (s: string) => {
  const h = createHash("sha1").update(s).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20, 32)}`;
};
const slug = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "_");
const fold = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

type Row = { id: string; name: string; target: Target; region: string; year?: number; desc?: string; tags?: string[]; rating?: string };

const ALL: Row[] = [...FIXTURES, GLOBAL_FIXTURE].flatMap((r) =>
  TARGETS.flatMap((t) =>
    r[t].map((f) => ({ id: uuid(`${t}:${f.name}`), name: f.name, target: t, region: r.key, year: f.year, desc: f.desc, tags: f.tags, rating: f.rating })),
  ),
);

function wire(r: Row) {
  return {
    entity_id: r.id,
    name: r.name,
    type: `urn:entity:${r.target}`,
    properties: {
      ...(r.year ? { release_year: r.year } : {}),
      ...(r.desc ? { short_description: r.desc } : {}),
      ...(r.rating ? { content_rating: r.rating } : {}),
    },
    tags: (r.tags ?? []).map((t) => ({ name: t, id: `urn:tag:keyword:qloo:${slug(t)}` })),
  };
}

function env(operation: string, status: QlooEnvelope["status"], results: unknown[], extra: Partial<QlooEnvelope> = {}): QlooEnvelope {
  return {
    schema_version: "1.0-preview.1",
    operation,
    status,
    results: { entities: results },
    result_count: results.length,
    execution: { transport: "mcp", correlation_id: "mock", duration_ms: 5 },
    ...extra,
  };
}

function regionFor(...hints: unknown[]): RegionFixture {
  const text = hints.filter((h) => typeof h === "string").join(" ");
  return FIXTURES.find((f) => f.match.test(text)) ?? GLOBAL_FIXTURE;
}

function seededOrder<T>(xs: T[], seed: string): T[] {
  const score = (x: T, i: number) => parseInt(createHash("md5").update(seed + i + JSON.stringify(x)).digest("hex").slice(0, 6), 16);
  return xs.map((x, i) => [x, score(x, i)] as const).sort((a, b) => a[1] - b[1]).map(([x]) => x);
}

export class MockTransport implements QlooTransport {
  readonly mode = "mock" as const;
  constructor(private latencyMs = 0) {}

  async call(tool: QlooTool, a: Record<string, unknown>): Promise<QlooEnvelope> {
    if (this.latencyMs) await new Promise((r) => setTimeout(r, this.latencyMs));
    switch (tool) {
      case "qloo_capabilities":
        return { status: "ok", operation: "capabilities", results: { ready: true, mode: "mock" } };
      case "qloo_describe":
        return this.describe(String(a.entity ?? ""), a.type as string | undefined);
      case "qloo_find_tags":
        return this.findTags(String(a.query ?? ""));
      case "qloo_recommend":
        return this.recommend(a);
      case "qloo_rank":
        return this.rank(a);
      default:
        return env(tool, "empty", []);
    }
  }

  private describe(entity: string, type?: string): QlooEnvelope {
    const byId = ALL.find((r) => r.id === entity);
    if (byId) return env("describe", "ok", [wire(byId)]);
    const q = fold(entity.trim());
    if (q.length < 2) return env("describe", "empty", []);
    const typeOk = (r: Row) =>
      !type || r.target === type || (type === "actor" && r.target === "artist") || (type === "person" && r.target === "artist") || (type === "tv_show" && r.target === "movie");
    const pool = ALL.filter(typeOk);
    const exact = pool.filter((r) => fold(r.name) === q);
    // Demo the "which one did you mean?" flow.
    if (exact.length === 1 && exact[0]!.name === "Javier Solís") {
      const album = { entity_id: uuid("album:Javier Solís"), name: "Javier Solís", type: "urn:entity:album", properties: { short_description: "Album" } };
      return env("describe", "needs_input", [wire(exact[0]!), album], { summary: "More than one entity matches." });
    }
    if (exact.length >= 1) return env("describe", "ok", [wire(exact[0]!)]);
    const partial = pool.filter((r) => fold(r.name).includes(q) || q.includes(fold(r.name)));
    if (partial.length === 1) return env("describe", "ok", [wire(partial[0]!)]);
    if (partial.length > 1) return env("describe", "needs_input", partial.slice(0, 5).map(wire), { summary: "More than one entity matches." });
    return env("describe", "empty", []);
  }

  private findTags(query: string): QlooEnvelope {
    const q = fold(query.trim());
    const hits = KNOWN_TAGS.filter((t) => fold(t) === q || fold(t).includes(q) || (q.length > 3 && q.includes(fold(t))));
    const results = hits.slice(0, 5).map((t) => ({ id: `urn:tag:keyword:qloo:${slug(t)}`, name: t }));
    return { schema_version: "1.0-preview.1", operation: "find_tags", status: results.length ? "ok" : "empty", results: { tags: results }, result_count: results.length };
  }

  private recommend(a: Record<string, unknown>): QlooEnvelope {
    const target = a.target_type as Target;
    if (!TARGETS.includes(target)) return env("recommend", "empty", []);
    const region = regionFor(a.signal_location, a.filter_location);
    const signals = ((a.signals as string[]) ?? []).map(fold);
    const tags = ((a.signal_tags as string[]) ?? []).join(" ");
    const pool = ALL.filter((r) => r.region === region.key && r.target === target && !signals.includes(fold(r.name)) && !signals.includes(r.id));
    // Rows sharing a requested tag float up, so boosts visibly change the order.
    const ordered = seededOrder(pool, JSON.stringify(a)).sort((x, y) => {
      const hx = (x.tags ?? []).some((t) => tags.includes(slug(t)) || tags.includes(t)) ? 1 : 0;
      const hy = (y.tags ?? []).some((t) => tags.includes(slug(t)) || tags.includes(t)) ? 1 : 0;
      return hy - hx;
    });
    const limit = Math.min(Number(a.limit ?? 10), 20);
    const out = ordered.slice(0, limit).map(wire);
    return env("recommend", out.length ? "ok" : "empty", out);
  }

  private rank(a: Record<string, unknown>): QlooEnvelope {
    const options = (a.options as string[]) ?? [];
    const rows = options.map((o) => ALL.find((r) => r.id === o || fold(r.name) === fold(o))).filter((r): r is Row => !!r);
    const ordered = seededOrder(rows, "rank" + JSON.stringify(a.signals ?? []));
    return env(
      "rank",
      ordered.length ? "ok" : "empty",
      ordered.map((r, i) => ({ ...wire(r), score: Number((1 - i * 0.07).toFixed(2)) })),
    );
  }
}
