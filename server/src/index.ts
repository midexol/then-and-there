import { buildApp } from "./app.js";
import { QlooClient } from "./qloo/client.js";
import { McpTransport } from "./qloo/mcp.js";
import { MockTransport } from "./qloo/mock.js";
import { OpenAiCompatibleLlm } from "./agent/prompts.js";

const key = process.env.QLOO_API_KEY?.trim();
const forceMock = process.env.QLOO_MODE === "mock";
const transport: import("./qloo/client.js").QlooTransport = key && !forceMock ? new McpTransport(key) : new MockTransport(Number(process.env.MOCK_LATENCY_MS ?? 350));
const qloo = new QlooClient(transport);

const { LLM_BASE_URL, LLM_API_KEY, LLM_MODEL } = process.env;
const llm = LLM_BASE_URL && LLM_API_KEY && LLM_MODEL ? new OpenAiCompatibleLlm(LLM_BASE_URL, LLM_API_KEY, LLM_MODEL) : null;

const app = buildApp({ qloo, llm, allowedOrigin: process.env.ALLOWED_ORIGIN ?? "*", logger: true });
const port = Number(process.env.PORT ?? 8787);
app.listen({ port, host: "0.0.0.0" }).then(() => {
  app.log.info(`Then & There API on :${port} · Qloo ${transport.mode} · LLM ${llm ? llm.model : "templates"}`);
  // The first live call starts the `qloo mcp` harness, which can take close to a minute on a slow host. Do it now,
  // in the background, so the first caregiver's lookup isn't the one that waits. Never blocks startup or crashes it.
  if (transport.mode === "live") {
    const t0 = Date.now();
    qloo
      .call("qloo_capabilities", {})
      .then(() => app.log.info(`Qloo harness warm in ${Math.round((Date.now() - t0) / 1000)}s`))
      .catch(() => app.log.warn("Qloo warm-up failed; the first request will start the harness instead"));
  }
});

const shutdown = async () => {
  await app.close();
  await transport.close?.();
  process.exit(0);
};
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
