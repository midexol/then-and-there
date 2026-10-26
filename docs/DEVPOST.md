# Devpost text: Then & There

Paste each section into the matching Devpost field.

- **Live app:** https://then-and-there-lime.vercel.app
- **Code:** https://github.com/midexol/then-and-there (MIT)
- **Demo video:** add the YouTube link here (70 seconds, `video/out/then-and-there-demo.mp4`)

---

## Tagline

Bring back the world they grew up in.

## Short description

Then & There helps a caregiver plan a 30-minute session for an older person: songs, places, tastes and films from the time and place they were young, found with Qloo, then run one item at a time on a phone or tablet.

## The problem

When you sit with an older relative or someone you care for, it is hard to find something to do together that feels like theirs. A generic playlist or a quiz doesn't know that your grandmother grew up in Mexico City in the 1940s, that your grandfather's Liverpool had the Beatles on the radio, or that the highlife she loved in Ibadan isn't on any "oldies" list. Caregivers all over the world are guessing.

## What it does

A caregiver tells Then & There three things: roughly when the person was born, where they grew up, and a few things they loved (a singer, a dish, a film). Then & There builds an 8-item session in about 20 to 60 seconds: an opening favourite, then songs, places, tastes and one film, in an order meant to ease into conversation. The caregiver runs it full-screen, one item at a time, with a gentle suggested question for each. After each item they tap **Yes**, **A little** or **Not really**, and the next session builds on what sparked and drops what didn't.

It works for any place in the world: the region is free text, and nothing in the app assumes one culture.

It plans activities. It is not medical care, and it never claims anything about anyone's memory or health.

## How we built it, and how we use Qloo

A small agent on a Node server (Fastify) talks to Qloo through the official `@qloo/qloo-harness`. The pipeline is: **resolve** the favourites, work out an **era window**, **expand** into candidates, **filter**, **rank**, **compose** an arc, and **adapt** after feedback.

| Qloo capability | What we use it for |
|---|---|
| `qloo_describe`, `qloo_find_tags` | Turn "Pedro Infante", "bolero" or "tamales" into confirmed entities or tag signals. An ambiguous name asks "Which one did you mean?" instead of guessing. |
| `qloo_recommend` | Four calls in parallel (artists, places, brands, films). Each carries the favourites as signals, the place they grew up as `signal_location`, and the "55 and older" audience as the demographic. |
| `qloo_rank` | Re-scores each shortlist for the same audience before it is composed. |
| `qloo insights` (the harness's raw command) | The only way to filter by release year, so the film slot comes from the person's own teenage and young-adult years. Searching on their favourites alone returned *Sholay* and *Mughal-E-Azam* for a Mumbai list and *A Hard Day's Night* for a Liverpool one. |

The era window is the birth decade's midpoint plus 10 to 30 years, weighted toward the age where the musical "reminiscence bump" peaks. Someone born in the 1940s gets 1955 to 1975.

Every item carries where it came from, and `assertQlooOnly` drops any item whose id never appeared in a Qloo response. An optional language model may write the suggested questions, but it can only phrase items Qloo returned. Without one, built-in questions are used, and a safety check rejects anything that tests memory or touches health.

The name, birth date, notes and the topics a caregiver wants to avoid never leave the device or reach Qloo. Qloo sees favourites, an age group and a region. Profiles live in the browser's local storage.

## Does it work? We measured it

We built an evaluation (`scripts/evaluate.mjs`, re-runnable by anyone) with 12 invented people: two each from Mexico, the UK, Nigeria, India, the Philippines and Japan, born between the 1930s and 1960s. We ran it against live Qloo three times, fixing what each run showed.

| Check | Result |
|---|---|
| Full 8-item session | 12 of 12 |
| Every item carries Qloo provenance | 96 of 96 |
| Films inside the era window | 12 of 12 |
| The caregiver's avoid topics and built-in hard topics | 0 hits |
| Suggested questions that test memory or touch health | 0 of 96 |
| Build time | about 20 to 40 seconds, under a second when cached |
| Items that fit the person's place and favourites, judged by hand | about 71%, against our own 85% bar |

Mexico City, Guadalajara, Ibadan and Lagos were 7 to 8 of 8 items, and Tokyo and Osaka reached 6. London, Mumbai, Chennai and Manila are weaker (3 to 4 of 8), because where Qloo's data for older audiences is thin it returns generic names: American singers, chain restaurants, modern DJs. The film slot is the weakest part overall. The by-hand judgement was made by the team's AI assistant from general knowledge, not by caregivers or local experts, so it is an estimate. The app says so in its notes when a place has thin data, and `docs/EVALUATION.md` has the details.

## Challenges

- Qloo's location lookup is picky. "Mumbai, India" matched nothing (and reported success) while "Mumbai" worked, so a session silently came back almost empty. The evaluation caught it; sessions now retry with the city on its own and say so.
- Films: a location filter on films returned the same global classics for every country. Searching on the favourites alone fixed much of it.
- Speed and reliability: some Qloo calls were slow on some days. The film search gets about a minute, a timed-out request is never repeated, the three example people are cached, and the build screen shows real progress.
- Everyone's world is different: we lean songs and brands toward the nationality of the person's own favourites (read from Qloo's own descriptions, with no country list), push down what was already offered to people in other countries, and keep out acts that began after their years.

## What we're proud of

- A reproducible evaluation that found real bugs, and the willingness to publish a result below our own bar.
- Provenance and privacy rules that tests enforce.
- A session screen designed for a person sitting beside someone: big type, one thing at a time, an always-available **End session**, and nothing that quizzes.

## What's next

- Better films and songs where Qloo's data for older audiences is thin.
- Re-judging the same sessions with caregivers and people from each region.
- Interfaces and suggested questions in more languages (today the interface is English; content keeps its original spelling).

## What these results do not establish

Recommendations describe what people with similar tastes and background often enjoy. They say nothing about any individual's memories, health or history, and the app never claims otherwise.

## Built with

Next.js, TypeScript, Tailwind, Fastify, Node, the Qloo API through `@qloo/qloo-harness` (MCP), Render and Vercel.

---

## Screenshots to attach

Take these from the deployed app with the example people (no real names or credentials):

1. Landing page (hero scene)
2. Onboarding step with matched favourites
3. Build screen mid-build, with real steps
4. Session plan with "From Qloo" and "Suggested question" marks
5. Session stage (one item, full-screen)
6. Review screen
7. Privacy page ("What we share, and what we never do")

## The demo video

70 seconds, made with Remotion from real screenshots of the live app (`video/`). The scenes, in order:

1. The hook: where do you even start?
2. Three things she loved: 1940s, Mexico City, Pedro Infante, bolero, tamales.
3. A real build from the live app, sped up.
4. The plan: eight items, each from Qloo, with a reason and a question.
5. The session, one item at a time, with **Yes**, **A little** and **Not really**.
6. The review: what sparked shapes the next session.
7. Mexico City, Liverpool and Ibadan side by side.
8. Close: powered by Qloo, open source, an activity planner and not medical care.
