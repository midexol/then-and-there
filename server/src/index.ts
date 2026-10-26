import { buildApp } from "./app.js";
import { QlooClient } from "./qloo/client.js";
import { McpTransport } from "./qloo/mcp.js";
import { MockTransport } from "./qloo/mock.js";
import { OpenAiCompatibleLlm } from "./agent/prompts.js";
import { loadSeed } from "./qloo/seed.js";
import { prewarmExamples } from "./agent/examples.js";

const key = process.env.QLOO_API_KEY?.trim();
const forceMock = process.env.QLOO_MODE === "mock";
const transport: import("./qloo/client.js").QlooTransport = key && !forceMock ? new McpTransport(key) : new MockTransport(Number(process.env.MOCK_LATENCY_MS ?? 350));
const qloo = new QlooClient(transport);
if (transport.mode === "live") qloo.prime(loadSeed());

const { LLM_BASE_URL, LLM_API_KEY, LLM_MODEL } = process.env;
const llm = LLM_BASE_URL && LLM_API_KEY && LLM_MODEL ? new OpenAiCompatibleLlm(LLM_BASE_URL, LLM_API_KEY, LLM_MODEL) : null;

const app = buildApp({ qloo, llm, allowedOrigin: process.env.ALLOWED_ORIGIN ?? "*", logger: true });
const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`Then & There API on :${port} · Qloo ${transport.mode} · LLM ${llm ? llm.model : "templates"}`);
  // The first live call starts the `qloo mcp` harness, which can take close to a minute on a slow host.
  if (transport.mode === "live") {
    // Building the examples ahead costs about forty Qloo calls on every start and competes with real visitors for the two call slots, so it is opt-in.
  void warmUp().then(async () => {
    if (process.env.PREWARM_EXAMPLES === "1") await prewarmExamples(qloo, (m) => app.log.info(m));
  });
  }
});

/** A cold harness can take about a minute to answer its first call, longer than a normal call is allowed, so the warm-up gets two minutes per try and up to three tries, ten seconds apart. */
async function warmUp() {
  const t0 = Date.now();
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      await qloo.call("qloo_capabilities", {}, { timeoutMs: 120_000, retryOnTimeout: false });
      app.log.info(`Qloo harness warm in ${Math.round((Date.now() - t0) / 1000)}s`);
      return;
    } catch {
      if (attempt < 3) await new Promise((r) => setTimeout(r, 10_000));
    }
  }
  app.log.warn("Qloo warm-up failed; the first request will start the harness instead");
}

const shutdown = async () => {
  await app.close();
  await transport.close?.();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
