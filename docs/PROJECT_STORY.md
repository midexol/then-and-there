# Project story: Then & There

Paste this into Devpost's "About the project" field. The line marked [YOUR LINE] is the one place only you can write: a sentence about why this matters to you. Delete the marker if you'd rather not.

---

## Inspiration

Sitting with an older relative is one of the best things you can do with an afternoon, and one of the hardest to plan. You want something that feels like theirs. A generic "hits of the 70s" playlist doesn't know that your grandmother grew up in Mexico City listening to Pedro Infante, that your grandfather's Liverpool had the Beatles on the radio, or that the highlife she loved in Ibadan is on no "oldies" list. Most tools assume one country and one culture. Families don't. [YOUR LINE]

The question we started from was simple: what would it take to give a caregiver, anywhere in the world, half an hour of material that feels familiar to this particular person?

## What it does

Then & There asks a caregiver for three things: roughly when the person was born, where they grew up, and a few things they loved, such as a singer, a dish or a film. About 20 to 60 seconds later it hands back a 30-minute session of eight items: an opening favourite, then songs, places, tastes and one film, in an order meant to ease into conversation. Each item shows why it was chosen and carries a gentle question to start talking.

The caregiver runs the session full screen on a phone or tablet, one item at a time, at the older person's pace. Nothing advances on its own. After each item they tap Yes, A little or Not really, and the next session builds on what sparked and drops what didn't.

It works for any place in the world. The region is free text, and nothing in the app assumes one culture. It plans activities. It is not medical care, and it never makes claims about anyone's memory or health.

## How Qloo makes it possible

An AI model alone can only name the obvious and then guess. The hard part of this problem is widening three facts into a whole cultural world, and that is what Qloo's taste graph does.

- Describe and find tags turn "Pedro Infante", "bolero" and "tamales" into confirmed entities. When a name is ambiguous, the app asks "Which one did you mean?" and never guesses.
- Recommend runs four calls in parallel for artists, places, brands and films. Each carries the favourites as signals, the place they grew up as the location, and the "55 and older" audience as the demographic.
- Rank re-scores each shortlist for the same audience before the session is composed.
- Insights, the harness's raw command, is the only way to filter by release year. That gives the film slot movies from the person's own teenage and young-adult years. Searching on their favourites alone returned Sholay and Mughal-E-Azam for a Mumbai list and A Hard Day's Night for a Liverpool one.

The era window is the birth decade's midpoint plus 10 to 30 years, weighted toward the age where the musical reminiscence bump peaks. Someone born in the 1940s gets 1955 to 1975.

## How we built it

A small agent on a Fastify server talks to Qloo through the official harness. It resolves the favourites, works out the era window, expands into candidates, filters, ranks, composes an eight-slot arc and adapts after feedback. The web app is a static Next.js export on Vercel. The server runs on Render, because the Qloo harness needs a long-running Node process.

Two rules are enforced in code, with tests, instead of promised:

- Every item must come from Qloo. A guard drops any item whose id never appeared in a Qloo response. A language model may phrase the suggested questions, but it cannot add an item.
- Personal data never leaves the device. The name, birth date and the topics a caregiver wants to avoid are never sent to Qloo or to the model. Qloo sees favourites, an age group and a region.

## Challenges

- Qloo's location lookup is picky. "Mumbai, India" matched nothing and reported success, while "Mumbai" worked, so a session quietly came back almost empty. Our evaluation caught it. Sessions now retry with the city on its own and tell the caregiver.
- Films were the hardest slot. A location filter returned the same global classics for every country. Searching on the favourites with a year window fixed much of it, but Qloo's year-filtered search can take close to a minute, so the film step has its own time budget and the session says so when it runs out.
- Everyone's world is different. We lean songs and brands toward the nationality of the person's own favourites, read from Qloo's own descriptions with no country list. We push down items already offered to people in other countries, and we leave out acts that began after the person's years.
- Writing for a person sitting beside someone else. The session screen has big type, one item at a time, an always-available End session button and no quizzing. Questions invite and never test, and a safety check rejects any that do.

## What we measured, and where we fell short

We built a re-runnable evaluation with 12 invented people, two each from Mexico, the UK, Nigeria, India, the Philippines and Japan, born between the 1930s and 1960s, and ran it against live Qloo three times, fixing what each run showed.

All 12 sessions came back with eight items. All 96 items carried Qloo provenance. All 12 films fell inside the era window, and no question tested memory or touched health. On the one check a script can't do, items that fit the person's place and favourites, we judged by hand and reached about 71%, short of our own 85% bar. Mexico City, Guadalajara, Ibadan and Lagos were strong. London, Mumbai, Chennai and Manila were weaker, because where Qloo's data for older audiences is thin it returns generic names. The judging was done by our AI assistant from general knowledge, not by caregivers or local experts, so it is an estimate. We published the result anyway, along with the full item-level data.

## What we're proud of

- A caregiver in Mexico City, Liverpool or Ibadan gets a session that is about their person, from the same app, with no per-country code.
- An evaluation that found real bugs, and the choice to report a result below our own bar.
- Provenance and privacy rules that tests enforce.
- A session screen designed for two people sitting together, not for a dashboard.

## What we learned

A recommendation engine is only as good as the question you ask it. The biggest gains came from asking Qloo differently (favourites plus a year window for films, a shorter place name for a picky lookup) and from reading its own descriptions to decide what belongs to someone's world. We also learned to say when the data is thin, because a session that admits it is better than one padded with generic names.

## What's next

- Better films and songs where Qloo's data for older audiences is thin.
- Re-judging the same sessions with caregivers and people from each region.
- Interfaces and suggested questions in more languages. Today the interface is English and content keeps its original spelling.

Recommendations describe what people with similar tastes and background often enjoy. They say nothing about any individual's memories, health or history, and the app never claims otherwise.

## Built with

Next.js, TypeScript, Tailwind, Fastify, Node, the Qloo API through `@qloo/qloo-harness` (MCP), Remotion, Render and Vercel.
