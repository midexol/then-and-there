# Then & There: API contract (web ⇄ server)

The web app only talks to our server. The server only sends Qloo **cultural anchors, an age group and a region**. It never sends names, nicknames, birth dates or health information.

Base URL: `NEXT_PUBLIC_API_URL` (e.g. `https://then-and-there-api.onrender.com`).

## Types
```ts
type AnchorKind = "music" | "food" | "film_tv" | "place" | "work_hobby";

type Candidate = { qlooId: string; name: string; type: string; subtitle?: string };

type ResolvedAnchor = {
  text: string;                 // what the caregiver typed
  kind: AnchorKind;
  status: "matched" | "choose" | "none";
  match?: Candidate;            // when matched
  candidates?: Candidate[];     // when choose (max 5)
  tag?: string;                 // when it resolves better as a Qloo tag (e.g. "bolero", "highlife music")
};

type ProfileInput = {           // NOTE: no nickname here, the server never sees it
  birthDecade: "1920s" | "1930s" | "1940s" | "1950s" | "1960s" | "1970s";
  // server computes the era window: decade midpoint + 10 to + 30 years, weighted to + 14 (reminiscence bump)
  region: string;               // where they grew up, anywhere: "Mexico City, Mexico"
  livesNow?: string;            // optional: where they live now (adds local places)
  anchors: { qlooId?: string; tag?: string; kind: AnchorKind; label: string }[];
  boost?: string[];             // qlooIds/tags that sparked last time
  avoid?: string[];             // qlooIds that did not spark last time
  avoidTopics?: string[];       // caregiver's "topics to avoid": used ONLY on our server for filtering and prompt steering, NEVER sent to Qloo
};

type SessionItem = {
  id: string;
  slot: number;                 // 1..8, order of the arc
  kind: "song" | "place" | "taste" | "film" | "closing_song";
  title: string; subtitle?: string;
  year?: number;                // release year when Qloo has one (films)
  why: string;                  // plain-English provenance, built from the Qloo request
  prompt: string;               // conversation prompt (marked as suggested in the UI)
  promptSource: "llm" | "template";
  provenance: { source: "qloo"; operation: string; qlooId: string; qlooType: "artist" | "movie" | "place" | "brand";
                signals: string[]; demographic?: string; location?: string };
  links: { label: string; url: string }[];   // e.g. YouTube search, Wikipedia
  alternates: number;           // how many swaps remain
};

type Session = { id: string; createdAt: string; eraWindow: { from: number; to: number; peak: number }; items: SessionItem[]; notes: string[] };
```

## Endpoints
| Method and path | Body | Returns |
| --- | --- | --- |
| `GET /api/health` | none | `{ qloo: "ready" or "missing_key", mode: "live" or "mock", llm: "ready" or "missing" }` |
| `POST /api/anchors/resolve` | `{ anchors: {text, kind}[] }` | `{ anchors: ResolvedAnchor[] }` |
| `POST /api/sessions` | `ProfileInput` | `{ sessionId }` (202), then stream |
| `GET /api/sessions/:id/events` | none | **SSE stream** (below) |
| `POST /api/sessions/:id/swap` | `{ itemId }` | `{ item: SessionItem, items: {id, alternates}[] }` or 409 `{ code: "no_alternates" }` |

Song slots are **artists** (Qloo has no song type) and taste slots are **brands** or food places. See QLOO_API_NOTES.md. Without `QLOO_API_KEY` (or with `QLOO_MODE=mock`) the server answers from fixtures and adds a "Demo data" note.

## SSE events (`/api/sessions/:id/events`)
```
event: step      data: {"key":"songs","label":"Finding songs people who love Pedro Infante also love…","state":"start"}
event: step      data: {"key":"songs","state":"done","count":10}
event: item      data: SessionItem          (optional early items)
event: session   data: Session              (final, complete)
event: error     data: {"code":"qloo_busy"|"qloo_auth"|"llm_down"|"thin_data","message":"…","retryable":true}
```
Step keys in order: `resolve`, `songs`, `films`, `places`, `tastes`, `rank`, `compose`.

## Error codes the UI must handle
| Code | UI copy |
| --- | --- |
| `qloo_busy` | Qloo is busy right now. Try again in a minute. Your profile is saved. |
| `qloo_auth` | The server's Qloo access isn't working. Tell the person who runs this app. |
| `llm_down` | Then & There can't write the prompts right now. You can still see the items. |
| `thin_data` | We found {n} strong matches. Add another favourite to get a fuller session. |
| network error | Then & There can't reach its server. Check your connection and try again. |
