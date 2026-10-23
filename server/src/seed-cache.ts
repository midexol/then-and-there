/**
 * Refreshes data/demo-cache.json from live Qloo: `QLOO_API_KEY=... npm run seed-cache`. Builds each example person
 * until it has a film, then saves every useful Qloo answer from those builds. Commit the file. It writes nothing if
 * any example comes back without films, so a bad day at Qloo can't be saved as the demo.
 */
import { QlooClient } from "./qloo/client.js";
import { McpTransport } from "./qloo/mcp.js";
import { writeSeed, SEED_PATH } from "./qloo/seed.js";
import { EXAMPLE_PROFILES, buildExample } from "./agent/examples.js";

const key = process.env.QLOO_API_KEY?.trim();
if (!key) {
  console.error("Set QLOO_API_KEY to refresh the seed.");
  process.exit(1);
}
const transport = new McpTransport(key);
const qloo = new QlooClient(transport);
try {
  for (const ex of EXAMPLE_PROFILES) {
    const ok = await buildExample(qloo, ex, 4);
    console.log(`${ex.region}: ${ok ? "ok" : "NO FILMS"}`);
    if (!ok) throw new Error(`${ex.region} came back without films; nothing was written.`);
  }
  const entries = qloo.exportEntries();
  writeSeed(entries);
  console.log(`Saved ${Object.keys(entries).length} answers to ${SEED_PATH}`);
} catch (e) {
  console.error(String(e));
  process.exitCode = 1;
} finally {
  await transport.close?.();
}
