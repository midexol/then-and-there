// Live transport: spawns `qloo mcp` (from @qloo/qloo-harness) and talks MCP over stdio.
// The key is passed only through the child's environment. It never appears in args or logs.
import { execFile } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import type { QlooEnvelope, QlooTool, QlooTransport } from "./client.js";

const execFileAsync = promisify(execFile);

// The package only exports ".", so resolve its entry (dist/index.js) and use the bin beside it.
function harnessBin() {
  const entry = fileURLToPath(import.meta.resolve("@qloo/qloo-harness"));
  return path.join(path.dirname(entry), "bin.js");
}

export class McpTransport implements QlooTransport {
  readonly mode = "live" as const;
  private client: Client | null = null;
  private connecting: Promise<Client> | null = null;

  constructor(private apiKey: string) {}

  private async connect(): Promise<Client> {
    if (this.client) return this.client;
    if (this.connecting) return this.connecting;
    this.connecting = (async () => {
      const env: Record<string, string> = {};
      for (const [k, v] of Object.entries(process.env)) if (v !== undefined) env[k] = v;
      env.QLOO_API_KEY = this.apiKey;
      const transport = new StdioClientTransport({
        command: process.execPath,
        args: [harnessBin(), "mcp"],
        env,
        stderr: "ignore",
      });
      const client = new Client({ name: "then-and-there", version: "0.1.0" });
      transport.onclose = () => {
        this.client = null;
      };
      await client.connect(transport);
      this.client = client;
      return client;
    })().finally(() => {
      this.connecting = null;
    });
    return this.connecting;
  }

  /** `qloo insights` with a release-year window. The key travels only in the child's environment. */
  private async insights(a: Record<string, unknown>): Promise<QlooEnvelope> {
    const str = (v: unknown) => (typeof v === "string" && v.trim() ? v.trim() : undefined);
    const ids = Array.isArray(a.signals) ? a.signals.filter((x): x is string => typeof x === "string").slice(0, 10) : [];
    const args = [harnessBin(), "insights", "-t", String(a.type ?? "movie"), "-n", String(Math.min(Number(a.take) || 15, 20)), "--json"];
    if (ids.length) args.push("-s", ids.join(","));
    const filterLoc = str(a.filter_location);
    const signalLoc = str(a.signal_location);
    if (filterLoc) args.push("--filter-location", filterLoc);
    if (signalLoc) args.push("--signal-location", signalLoc);
    const params: Record<string, unknown> = {};
    if (typeof a.year_min === "number") params["filter.release_year.min"] = a.year_min;
    if (typeof a.year_max === "number") params["filter.release_year.max"] = a.year_max;
    if (Object.keys(params).length) args.push("--params", JSON.stringify(params));
    const env: NodeJS.ProcessEnv = { ...process.env, QLOO_API_KEY: this.apiKey };
    try {
      const { stdout } = await execFileAsync(process.execPath, args, { env, timeout: 25_000, maxBuffer: 8 * 1024 * 1024, windowsHide: true });
      // The command prints "Using signal: …" before the JSON array.
      const start = stdout.indexOf("[");
      if (start < 0) return { status: "empty", operation: "insights", results: [] };
      const results = JSON.parse(stdout.slice(start)) as unknown[];
      return { status: results.length ? "ok" : "empty", operation: "insights", results, result_count: results.length };
    } catch (e) {
      // Never echo the command line: it holds ids and a place. Look only at what the command itself printed, since
      // the error's message repeats the whole command line and an id can contain "401" by chance.
      const out = String((e as { stdout?: string }).stdout ?? "") + String((e as { stderr?: string }).stderr ?? "");
      // execFile kills the child when its time runs out. Report that as a timeout, so the client doesn't repeat a request
      // that was already too slow (each repeat is another full wait).
      const timedOut = (e as { killed?: boolean }).killed === true || (e as { code?: string }).code === "ETIMEDOUT";
      const auth = !timedOut && /\b401\b|unauthori[sz]ed|api[_ ]?key/i.test(out);
      const limited = !timedOut && /\b429\b|too many requests|rate[_ -]?limit/i.test(out);
      const code = auth ? "QLOO_AUTH" : limited ? "QLOO_RATE_LIMIT" : timedOut ? "insights_timeout" : "insights_failed";
      // One short line of the command's own error, with anything key-shaped removed, so the server log says why.
      const head = out.split("\n").map((l) => l.trim()).find(Boolean)?.replace(/[A-Za-z0-9_-]{24,}/g, "…").slice(0, 160);
      console.warn(`qloo insights failed: ${code}${head ? ` — ${head}` : ""}`);
      return { status: "error", error: { code, retryable: !auth, recovery: auth ? "Qloo rejected the credentials." : limited ? "Rate limited (429)." : timedOut ? "Insights request timed out." : "Insights request failed." } };
    }
  }

  async call(tool: QlooTool, args: Record<string, unknown>): Promise<QlooEnvelope> {
    if (tool === "qloo_insights") return this.insights(args);
    const client = await this.connect();
    const res = await client.callTool({ name: tool, arguments: args });
    // Prefer structured content; fall back to the first text block.
    const structured = (res as { structuredContent?: unknown }).structuredContent;
    if (structured && typeof structured === "object" && "status" in structured) return structured as QlooEnvelope;
    const content = (res as { content?: { type: string; text?: string }[] }).content ?? [];
    const text = content.find((c) => c.type === "text")?.text ?? "";
    try {
      return JSON.parse(text) as QlooEnvelope;
    } catch {
      return { status: "error", error: { code: "unparseable_result", retryable: false, recovery: text.slice(0, 200) } };
    }
  }

  async close() {
    await this.client?.close();
    this.client = null;
  }
}
