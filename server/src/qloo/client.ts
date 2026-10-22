// The one door to Qloo. Every Qloo call in the app goes through `QlooClient.call`.
// Real mode talks to `qloo mcp` over stdio; mock mode answers from fixtures.

export type QlooStatus = "ok" | "empty" | "needs_input" | "partial" | "degraded" | "error";

export type QlooEnvelope = {
  schema_version?: string;
  operation?: string;
  status: QlooStatus;
  summary?: string;
  interpretation?: unknown;
  results?: unknown;
  result_count?: number;
  warnings?: string[];
  error?: { code: string; layer?: string; retryable: boolean; recovery?: string };
  execution?: { transport?: string; correlation_id?: string; duration_ms?: number };
  provenance?: unknown;
};

export type QlooTool =
  | "qloo_capabilities"
  | "qloo_recommend"
  | "qloo_rank"
  | "qloo_describe"
  | "qloo_find_tags"
  | "qloo_where_popular"
  | "qloo_entity_tags"
  // Raw Insights through the harness's `qloo insights` command. Only this path can filter by release year,
  // which the MCP recommend tool can't. Live mode only: the mock transport answers "empty".
  | "qloo_insights";

export interface QlooTransport {
  readonly mode: "live" | "mock";
  call(tool: QlooTool, args: Record<string, unknown>): Promise<QlooEnvelope>;
  close?(): Promise<void>;
}

export class QlooError extends Error {
  constructor(
    public code: "qloo_busy" | "qloo_auth" | "qloo_error",
    message: string,
    public retryable: boolean,
    /** The request ran out of time. Repeating the identical request will do the same, so it isn't retried. */
    public timedOut = false,
  ) {
    super(message);
  }
}

/** Small LRU keyed by request hash. */
class Lru<V> {
  private map = new Map<string, V>();
  constructor(private max: number) {}
  get(k: string) {
    const v = this.map.get(k);
    if (v !== undefined) {
      this.map.delete(k);
      this.map.set(k, v);
    }
    return v;
  }
  set(k: string, v: V) {
    this.map.delete(k);
    this.map.set(k, v);
    if (this.map.size > this.max) this.map.delete(this.map.keys().next().value as string);
  }
}

function stableKey(tool: string, args: Record<string, unknown>) {
  const sort = (v: unknown): unknown =>
    Array.isArray(v)
      ? v.map(sort)
      : v && typeof v === "object"
        ? Object.fromEntries(Object.keys(v as object).sort().map((k) => [k, sort((v as Record<string, unknown>)[k])]))
        : v;
  return tool + ":" + JSON.stringify(sort(args));
}

const AUTH_CODES = /auth|credential|unauthori[sz]ed|forbidden|api[_ ]?key|missing_key/i;

const RATE_LIMIT = /rate[_ -]?limit|429|too many/i;

export class QlooClient {
  private cache = new Lru<QlooEnvelope>(500);
  public calls = 0;
  private active = 0;
  private waiters: (() => void)[] = [];
  private nextStart = 0;
  private cooldownUntil = 0;
  constructor(
    private transport: QlooTransport,
    private opts: { retries?: number; baseDelayMs?: number; timeoutMs?: number; maxConcurrent?: number; minGapMs?: number } = {},
  ) {}

  get mode() {
    return this.transport.mode;
  }

  /**
   * Live Qloo answers 429 when a session fires a burst of calls (4 recommends, 2 insights, then 4 ranks).
   * Cap concurrency and space out request starts. Mock mode is unthrottled.
   */
  private async throttled<T>(fn: () => Promise<T>): Promise<T> {
    const live = this.transport.mode === "live";
    const max = this.opts.maxConcurrent ?? (live ? 2 : Infinity);
    const gap = this.opts.minGapMs ?? (live ? 400 : 0);
    while (this.active >= max) await new Promise<void>((r) => this.waiters.push(r));
    this.active++;
    try {
      // A rate limit pauses every queued call, not just the one that hit it, so retries don't keep spending the allowance.
      const start = Math.max(Date.now(), this.nextStart, this.cooldownUntil);
      this.nextStart = start + gap;
      if (start > Date.now()) await sleep(start - Date.now());
      return await fn();
    } finally {
      this.active--;
      this.waiters.shift()?.();
    }
  }

  /** Calls a tool with cache + bounded retry. Throws QlooError only for `error` envelopes. */
  async call(tool: QlooTool, args: Record<string, unknown>, callOpts: { retryOnTimeout?: boolean; maxRetries?: number } = {}): Promise<QlooEnvelope> {
    const key = stableKey(tool, args);
    const hit = this.cache.get(key);
    if (hit) return hit;

    const retries = callOpts.maxRetries ?? this.opts.retries ?? (this.transport.mode === "live" ? 3 : 2);
    const base = this.opts.baseDelayMs ?? 600;
    let last: QlooEnvelope | undefined;
    let timedOut = false;
    let timeoutRetried = false;
    for (let attempt = 0; attempt <= retries; attempt++) {
      this.calls++;
      let env: QlooEnvelope;
      try {
        env = await this.throttled(() => withTimeout(this.transport.call(tool, args), this.opts.timeoutMs ?? 30_000));
      } catch (e) {
        env = { status: "error", error: { code: /timeout after/.test(String(e)) ? "QLOO_TIMEOUT" : "transport", retryable: true, recovery: String(e) } };
      }
      if (env.status !== "error") {
        if (env.status === "ok" || env.status === "empty" || env.status === "needs_input") this.cache.set(key, env);
        return env;
      }
      last = env;
      // A timeout often means the request itself is too heavy (e.g. a whole-country place filter), and repeating it
      // multiplies the wait. So: one retry at most (a cold harness can be slow on its first call), none if the caller
      // knows the request is heavy.
      if (/timeout/i.test(env.error?.code ?? "")) {
        timedOut = true;
        if (callOpts.retryOnTimeout === false || timeoutRetried) break;
        timeoutRetried = true;
        continue;
      }
      if (!env.error?.retryable || attempt === retries) break;
      // A rate limit needs a real pause (it's a time window); other transient errors retry quickly.
      const limited = RATE_LIMIT.test(`${env.error.code} ${env.error.recovery ?? ""}`);
      if (limited) this.cooldownUntil = Math.max(this.cooldownUntil, Date.now() + 2000 * 2 ** attempt);
      else await sleep(base * 2 ** attempt);
    }
    const code = last?.error?.code ?? "unknown";
    if (AUTH_CODES.test(code) || AUTH_CODES.test(last?.error?.recovery ?? ""))
      throw new QlooError("qloo_auth", `Qloo rejected the credentials (${code}).`, false);
    if (last?.error?.retryable) throw new QlooError("qloo_busy", `Qloo is busy (${code}).`, true, timedOut);
    throw new QlooError("qloo_error", `Qloo error (${code}).`, false);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(`timeout after ${ms}ms`)), ms);
    p.then(
      (v) => (clearTimeout(t), resolve(v)),
      (e) => (clearTimeout(t), reject(e)),
    );
  });
}
