# Qloo API notes (from the public starter kit, before key arrives)

Source: github.com/qloo/qloo-hackathon-kit and npm `@qloo/qloo-harness` 0.1.26.
Confirm everything here with live calls once the key arrives.

## How access works
- Install: `npm install --global @qloo/qloo-harness` (Node **22.19+**). Check `qloo --version` ≥ 0.1.26.
- Credential: `qloo setup --qloo` locally, or `QLOO_API_KEY` env var on a server. Never in the repo, browser, or prompts.
- Surfaces (all share one quota): `qloo explore` (chat), `qloo exec <workflow>` (JSON), `qloo api <endpoint>` (raw), `qloo mcp` (stdio MCP server).
- **Deploy constraint:** backend must be a VM/container with Node 22.19+ and the harness installed. **Serverless functions are not supported.** Browser never calls Qloo.

## MCP tools
| Tool | Use |
| --- | --- |
| `qloo_capabilities` | Readiness check, no Qloo call |
| `qloo_find_tags` | Turn a vague concept ("highlife", "cozy mystery") into Qloo tag IDs |
| `qloo_describe` / `qloo_entity_tags` | Resolve and describe an entity |
| `qloo_recommend` | "Fans of X also like…" — `signals` + `target_type` |
| `qloo_rank` | Rank a shortlist for an audience — `options`, `option_type`, `signals` or `demographic` |
| `qloo_where_popular` | Where an entity is popular — `entity` + `within` |
| `qloo_compare_audiences` | How two fan bases differ — `group_a`, `group_b` |
| `qloo_audience_demographics` | Who an audience is |
| `qloo_trends` | Is it rising — 1–5 entities + date range |

Typical chain: `find_tags`/`describe` → **show matches to user and confirm** → `recommend` / `rank` / `where_popular`.

## Entity types seen in the harness
actor, album, artist, author, book, **brand**, director, **locality**, movie, music_artist, person, **place**, podcast, tv_show, videogame

## Age demographic buckets
`24_and_younger`, `25_to_29`, `30_to_34`, `35_to_44`, `45_to_54`, `55_and_older`

## Result envelope
`status`: `ok` | `empty` | `needs_input` (ambiguous — show candidates and ask) | `partial` | `degraded` | `error` (`error.code`, `error.retryable`, `error.recovery`). Retry only when `retryable` is true.

## Safe-use rules (organizer-published — judges will look for this)
- Results are **aggregate affinities**, not facts about an individual. Don't phrase them as predictions about a person.
- Don't infer identity, health, finances, politics, or use for housing/jobs/credit/insurance decisions.
- **Don't send names, emails, IDs, location histories or other personal data** to Qloo.
- Show provenance: separate "Qloo returned this" from "our interpretation".
- Don't force a fuzzy tag/entity match — confirm or refine.

## Submission guide extras (from the kit)
Problem statement · which Qloo tools and why · a redacted request→result walkthrough · screenshots with no credentials/personal data · clean-environment setup steps · **known limitations, including what results do not establish**. Judges are told to weigh usefulness, execution, **provenance and user clarity, responsible data handling, reproducibility**.

## Questions to answer with the first live calls (Day 1 probe)
1. Does `recommend` with `target_type=brand` return sensible brands for music/TV/place signals? (Sponsor Scout core)
2. Does `55_and_older` + a locality shift `recommend` results meaningfully? (Then & There core)
3. How well does coverage hold across regions (Mexico, UK, Nigeria, India, Philippines)? Pick demo people from the strongest.
4. Latency per call, and quota/rate limit published for the event.

## Confirmed from `qloo mcp` tools/list (harness 0.1.26, Oct 13)
Full schemas: `docs/qloo-mcp-tools.json`. What changed our design:
- `qloo_recommend.target_type` is one of **artist, book, brand, movie, person, place, podcast, tv_show, videogame**. There is **no song/track and no food type**.
  - Song slots are **artists** ("Pedro Infante"), with a "play his songs" link. The caregiver picks the track. We never invent song titles.
  - Taste slots are **brands** (sodas, biscuits, malt drinks) or **food places** (old cafés, markets).
- Inputs: `signals` (names or Qloo UUIDs, max 10), `signal_tags`, `signal_location`, `demographic` (natural language, parsed locally by the harness: use "people over 55", "seniors" or a range like "men 25-34". "55 and older" does NOT parse. A demographic also requires `signal_location`), `filter_location`, `include_tags`/`exclude_tags`, `limit` ≤ 20, `explain`.
- **No release-year filter on the MCP surface.** The era window is enforced on our server from each result's `release_year`.
- `qloo_describe` takes `entity` + `type` (also `locality`, `album`, `actor`…), and ambiguity comes back as `needs_input` with candidates.
- `qloo_rank` takes `options` (≤ 10) + `option_type` + the same signal fields. Scores from separate calls aren't comparable.
- Envelope: `schema_version, operation, status, summary, interpretation, results, result_count, warnings, error{code,layer,retryable,recovery}, execution{transport,correlation_id,duration_ms}, provenance`.
- The exact shape of each item in `results` is **not yet confirmed**. `server/src/qloo/normalize.ts` accepts several shapes (`id`/`entity_id`, top-level or `properties.release_year`, and so on). Fix it from `probe-out/` once the probe runs.

## Era films come from Insights, with a time budget

The MCP `qloo_recommend` tool can't filter by release year, so films from the listener's teenage years come from the raw `qloo insights` command with a `filter.release_year` window (`classicFilms` in `server/src/agent/session.ts`). It runs two searches: the favourites alone, and the best-known films of the era with the place as a signal. A `filter_location` on movies is not used, because it returned the same global classics (The Godfather, Star Wars) for Japan and the Philippines; the favourites alone returned Sholay and Mughal-E-Azam for a Mumbai list, A Hard Day's Night for Liverpool, and 1950s–60s Japanese films for Tokyo. That query can be slow or hang on Qloo's side: on one test day every Insights call ran past 110 seconds while the Qloo host itself answered in about a second.

So the film step is capped. A search that **times out is not repeated** (the `qloo insights` child is killed after 25 s and reported as `insights_timeout`; a rate limit is still retried after its pause), and the step stops waiting after **30 seconds** (`FILM_BUDGET_MS`). If nothing came back in time, the session is built without era films and says so in its notes ("Films from their era were slow to load this time..."). Songs, places and tastes are unaffected. Before the cap, repeated timeouts plus the queue behind them held a session for about two minutes.
