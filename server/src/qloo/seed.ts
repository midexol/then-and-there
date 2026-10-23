import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import type { QlooEnvelope } from "./client.js";

/** Saved Qloo answers for the example people, committed so a restart or a slow Qloo never changes what they get. */
export const SEED_PATH = fileURLToPath(new URL("../../data/demo-cache.json", import.meta.url));

type SeedFile = { savedAt: string; entries: Record<string, QlooEnvelope> };

/** Reads the seed file. A missing or damaged file is not an error: the server just starts without a seed. */
export function loadSeed(path = SEED_PATH): Record<string, QlooEnvelope> {
  try {
    const f = JSON.parse(readFileSync(path, "utf8")) as Partial<SeedFile>;
    return f.entries && typeof f.entries === "object" ? f.entries : {};
  } catch {
    return {};
  }
}

export function writeSeed(entries: Record<string, QlooEnvelope>, path = SEED_PATH) {
  mkdirSync(dirname(path), { recursive: true });
  const file: SeedFile = { savedAt: new Date().toISOString(), entries };
  writeFileSync(path, JSON.stringify(file) + "\n");
}
