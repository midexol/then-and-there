# Then & There: PRD

Qloo Agentic Hackathon · deadline Oct 30, 2026, 11:45 PM EDT (4:45 AM Oct 31 Lagos) · submit Oct 29

## One line
Then & There helps caregivers plan reminiscence sessions for older adults: from a few cultural anchors, a Qloo-powered agent builds a session of music, films, foods and places likely to feel familiar, then adapts after each session.

## Problem
Reminiscence activities (music, photos, foods and stories from someone's past) are standard practice in elder care, and caregivers often run them. The hard part is content. A caregiver knows three facts ("loved boleros, grew up in Mexico City, was a teacher") and needs thirty minutes of material that will feel familiar. Generic playlists ("hits of the 70s") assume one culture and one country. Families are global and often diasporic: a grandmother who grew up in Manila and now lives in London needs Manila's 1960s, not London's. LLMs name the obvious items and then guess.

## Users
| User | Job | Win |
| --- | --- | --- |
| Family caregiver | Spend meaningful time with a parent or grandparent | A ready-to-run session in 2 minutes |
| Care-home activity coordinator | Run personalized activities for many residents | A session card per resident, refined over time |
| Volunteer visitor | Have something to talk about | Conversation prompts grounded in real culture |

## Why it fails without Qloo
The core step widens a few anchors into a cohort's cultural world: the artists, films, places and brands that people with these tastes, this age bucket and this region over-index on. That is Qloo's cross-domain affinity graph (`recommend` with `signals`, `demographic: 55 and older`, `signal_location`). An LLM alone can only name the obvious and would invent the rest.

## Responsible design (judges are told to weigh this)
- **No personal data to Qloo.** The person's name, exact birth date, health details and address never leave the browser or our server. Qloo only receives cultural anchors (artists, foods, places), an age bucket and a region.
- **Not medical.** Then & There is an activity-planning tool, not therapy or treatment. The copy makes no health claims and never mentions diagnoses.
- **Aggregate, not personal.** Each item is labeled "often familiar to people who share these tastes", never "they will remember this".
- **Provenance on every card:** "From Qloo: related to Pedro Infante, age 55+, Mexico City" versus "Suggested by the assistant", shown separately.
- **Caregiver confirms matches.** Ambiguous entity resolutions (`needs_input`) appear as choices and are never silently guessed.

## Scope
**MVP**
1. Profile form: nickname (stored locally only), decade they grew up in, region/city, 3 to 8 anchors (music, food, films, places, work/hobby as tags)
2. Anchor resolution: `describe`/`find_tags`, with confirm chips for ambiguous matches
3. Expansion: parallel `recommend` calls for artist, movie/tv_show, place and brand, using signals plus demographic plus location
4. Session plan: the agent picks about 8 items in a 30-minute arc (warm-up song → place memory → food → film → closing song), each with one conversation prompt
5. Session card: printable, with one-tap listen/watch links where available
6. After-session log: per item, a 👍 / 😐 / 👎 sparked-a-response marker. The next session reuses 👍 items as new signals and drops 👎 ones.
7. Profiles and logs stored in the caregiver's browser (localStorage), exportable as JSON. No account needed.

**Stretch:** multiple profiles for a care home; a "theme of the week" option (markets, school days, weddings); a large-type "show on a tablet" mode for the session itself.

**Out:** accounts, voice, real photo libraries, any health tracking.

## Agent design
Plan → act → reflect, with Qloo tools exposed through `qloo mcp`.
1. **Resolve:** turn the anchors into entities and tags, and ask the user when the result is `needs_input`.
2. **Expand:** run 4 `recommend` calls, one per target type, sharing signals, `demographic: "adults 55 and older"` and `signal_location`.
3. **Rank:** `rank` the candidate shortlist against the anchors to order items within each type.
4. **Compose:** the LLM builds the 30-minute arc and writes prompts, using only items Qloo returned. This is enforced in code: any item not present in a Qloo result is dropped.
5. **Adapt:** feedback rewrites the signal set for the next session.

## UI
- **Home:** "Who are we spending time with today?" with saved profile cards and a New button.
- **Profile builder:** a friendly step-by-step form (era → place → anchors), with anchor chips that resolve live (✓ matched / ? choose).
- **Session view:** a vertical timeline of 8 cards (type icon, title, why-it-fits line, prompt, listen link), a provenance badge on each card, and Print and Start buttons.
- **After-session log:** the same cards with three feedback buttons each, then Save.
- **Look:** see `docs/FRONTEND.md` (full design system, screens, states and copy).

## Stack
Next.js (TypeScript, Tailwind) on Vercel for the UI. A Node 22.19+ backend on Render, Railway or Fly, running `@qloo/qloo-harness` (`qloo mcp`) and the agent. Serverless functions are not supported by the harness. The LLM goes through any OpenAI-compatible provider, configured by env var. Frontend design: see `docs/FRONTEND.md`. API contract: see `docs/API_CONTRACT.md`.

## Demo story (no video required, but the description and screenshots follow this)
"My grandmother grew up in Mexico City in the 1950s and loves Pedro Infante and tamales." Three anchors produce a session card in about 40 seconds. Then the same flow for a grandfather from 1960s Liverpool and a grandmother from 1960s Ibadan, three continents in under two minutes. A second run after feedback shows a session adapting.

## Acceptance criteria
- From 3 anchors, a complete 8-item session in under 60 s, every item traceable to a Qloo result
- Ambiguous anchors produce a choice and never a silent guess
- Feedback changes the next session's items
- No name or personal data appears in any outgoing Qloo request (verified from request logs)
- Live public URL works end to end on mobile

## Risks
| Risk | Mitigation |
| --- | --- |
| Coverage is uneven across regions (thinner for some countries or older entities) | Day-1 probe across 4 regions; fall back to tag signals (genre, cuisine) plus location; pick demo people from the regions with the richest data; say plainly in the limitations section which regions are thinner |
| Age bucket barely shifts results | Lean on location and tags; say so in the limitations section |
| Health framing reads as a medical claim | Activity-planning language only; disclaimer in the footer |
| Quota limits | Cache every Qloo response by request hash; preload the demo personas |
