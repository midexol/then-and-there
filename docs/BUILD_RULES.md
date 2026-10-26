# Then & There: build rules from the development blueprint

The full blueprint lives in Claude Docs ("Then & There: Full Development Blueprint"). These are the parts that change code. They override older wording in PRD.md where the two differ.

## Evidence-driven rules
- Era window: ask for the birth decade. Window = decade midpoint + 10 to + 30 years, weighted toward + 14 (the musical reminiscence bump peaks around age 14). Every item with a known `release_year` must fall inside the window; places and foods may have no year.
- Music leads: a session opens and closes with a song, and songs are the largest share of items.
- Generic over personal: use culturally familiar material from the right era and place, not personal archives. (Generic material produced better conversations in the CIRCA research.)
- Pace belongs to the older person: the Session stage never auto-advances.
- No health claims: never use the words therapy, treatment, improve, memory loss or dementia in UI copy. Then & There plans activities and is not medical care.

## Safety rules
- `avoidTopics` (free text) is used only on our server: (1) drop Qloo items whose name, tags or description match; (2) tell the LLM to steer away; (3) re-check the generated question, and fall back to a template on a match. Never send it to Qloo.
- Built-in avoid list: war, funeral, death, prison and similar. Drop adult-rated items (`content_rating`).
- Questions invite and never test. Ban "Do you remember…". Prefer "What does this make you think of?" Add a unit test that scans generated questions.
- "Not really" means the item is excluded next time, with no follow-up.
- An End session control on every stage screen. Review shows: "If a memory brings sadness, it's okay to stop and simply sit together."

## Agent pipeline (in order)
resolve → era window → expand (4 × recommend, ask for 3× the items needed, year filter where Qloo honours it, else filter client-side) → filter (era, avoid, rating, duplicates) → rank (qloo_rank vs anchors; keep alternates for swap) → compose (8-slot arc; LLM writes questions only; code drops non-Qloo items; template fallback) → adapt (yes = boost signal, not really = exclude).

## Evaluation (write results to docs/EVALUATION.md)
- 12 example people: 2 each from Mexico, the UK, Nigeria, India, the Philippines and Japan, with birth decades from the 1930s to the 1960s.
- Pass bars: 100% Qloo-sourced items; 90% or more inside the era window; 85% or more fit the region or anchors (by hand); 100% avoid-safe; 100% gentle questions; full 8 items for at least 10 of 12 people.
- 3 caregiver usability tests (task: plan a session for someone you know, then run 2 items); fix the top 3 issues.
- Lighthouse accessibility 95+, keyboard pass, screen reader pass on the stage, real Android phone, screen-shared video call.

## Checkpoints and cut lines
- Oct 20: real sessions stream from the server. If not, drop swap and use 6 items.
- Oct 24: all screens done. If not, drop the print card and "lives now".
- Oct 26: evaluation passes. If not, limit to the regions that pass and say so.
- Never cut: era window, Qloo-only guard, avoid filter, Session stage, three examples, caregiver tests, honest limitations.
