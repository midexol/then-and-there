import { test } from "node:test";
import assert from "node:assert/strict";
import { parseInsightsOutput } from "./mcp.js";

test("insights output: a list after the signal lines is read, no list means no results, a cut-off list throws", () => {
  const films = [{ entity_id: "f1", name: "A Film" }];
  assert.deepEqual(parseInsightsOutput(`Using signal: Pedro Infante\n${JSON.stringify(films, null, 2)}\n`), films);
  assert.deepEqual(parseInsightsOutput("Nothing found.\n"), []);
  assert.deepEqual(parseInsightsOutput("[]"), []);
  assert.throws(() => parseInsightsOutput('[\n  { "entity_id": "f1", "na'));
});
