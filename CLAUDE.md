# Then & There: agent brief

Then & There helps caregivers anywhere in the world plan reminiscence sessions for older adults. From a few cultural anchors, a Qloo-powered agent builds a 30-minute session of songs, places, foods and films likely to feel familiar, then adapts after each session.
Entry for the **Qloo Agentic Hackathon** (Devpost). Deadline: Oct 30, 11:45 PM EDT (4:45 AM Oct 31 Lagos). **Submit Oct 29.**

## Read first, in this order
1. `docs/BUILD_RULES.md`: evidence, safety and evaluation rules. **These override older wording elsewhere.**
2. `docs/PRD.md`: product, scope, agent design, acceptance criteria
3. `docs/FRONTEND.md`: design system, every screen and state, copy. **The frontend is half the grade. Follow it exactly.**
4. `docs/API_CONTRACT.md`: types, endpoints, SSE events, error codes
5. `docs/QLOO_API_NOTES.md`: Qloo tools, real input schemas, safe-use rules
6. `docs/BRAND.md`: name, logo, icons and the eight screens (the design canvas is the visual reference)
7. `docs/qloo-mcp-tools.json`: the real MCP tool schemas

## Repo layout
```
web/       Next.js (App Router) + TypeScript + Tailwind, deployed on Vercel
server/    Node 22.19+ + TypeScript (Fastify), deployed on Render/Railway/Fly (NOT serverless)
  src/qloo/       MCP client to `qloo mcp` over stdio (env: process.env), cache, bounded retry
  src/agent/      resolve → expand → rank → compose → adapt
  src/app.ts      endpoints from API_CONTRACT.md, SSE for build progress
  src/qloo/mock.ts + fixtures.ts   demo mode when QLOO_API_KEY is missing (or QLOO_MODE=mock)
web/app/   one folder per screen: / · new · build · plan · stage · review · print · about (static export, ?p=<profileId>)
web/lib/   copy.ts (every string), store.ts (localStorage), api.ts (the only network code)
docs/  design/  scripts/
```

## Hard rules
- **Global product.** Never hardcode a country, language or culture. Region is free text resolved through Qloo; example people come from several continents; copy never assumes one culture.
- Qloo runs **only on the server**, through `@qloo/qloo-harness` (`qloo mcp`). The key comes only from `QLOO_API_KEY`. Never put it in the repo, client, logs or prompts.
- **Never send the nickname, birth date or any personal or health data to Qloo or the LLM.** `ProfileInput` has no name field, by design.
- Handle every Qloo envelope status (`ok`, `empty`, `needs_input` → "choose" chips, `partial`, `degraded`, `error`; retry only when `retryable`).
- **The LLM may only present items Qloo returned.** Enforce it in code: drop any item that isn't in the Qloo result set. The LLM writes prompts and orders the arc; it doesn't invent items.
- Every item carries provenance (`why` + `provenance`). The UI marks Qloo items and suggested questions separately.
- Copy never claims health or memory effects. Then & There is an activity planner, not medical care.
- Cache Qloo responses by request hash (in-memory LRU plus a JSON file for the demo persona). Preload the example profile.
- LLM: any OpenAI-compatible endpoint via `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL`.

## Env
```
# server
QLOO_API_KEY=
LLM_BASE_URL=
LLM_API_KEY=
LLM_MODEL=
ALLOWED_ORIGIN=https://<vercel-app>.vercel.app
# web
NEXT_PUBLIC_API_URL=
```

## Status (Oct 13)
Steps 2 to 6 are built and pass in mock mode (11 server tests, plus a Playwright run of every screen). Next: run the probe with the real key, fix `normalize.ts` from `probe-out/`, run the 12-person evaluation, then deploy.

## Build order
1. `bash scripts/probe.sh` → review `probe-out/` → note anything surprising in `docs/PROBE_NOTES.md`
2. server: Qloo MCP client + `/api/anchors/resolve` + `/api/health`
3. server: session agent + SSE stream on the example profile
4. web: tokens + fonts + `IndigoBand` → Home → Profile builder → Building → Session plan
5. web: Session stage → Review → Print card → About and privacy
6. Swap, the adapt loop, every state in FRONTEND.md §4
7. Deploy both, run the example end to end on the live URL, phone test, Lighthouse
8. README (setup, Qloo tools used and why, a redacted request→result example, limitations), MIT license, Devpost text

## Quality bar
Small commits. Type-check and lint before committing. Tests for the composer (only-Qloo-items rule, arc order, adapt loop). Screenshot every screen at 360px and 1280px, in light and dark, before calling a screen done.
