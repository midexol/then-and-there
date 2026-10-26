# Evaluation

Run on 22 Oct 2026 against the real Qloo hackathon API (live mode, no mock data), through the same HTTP API the app uses.
We ran it three times: a first run, a second after three changes made because of what the first showed, and a third after a
further change to places and tastes (see [What changed between the runs](#what-changed-between-the-runs)). This page reports the
third run, with the earlier ones alongside where it matters. The raw results of the third run, with every item for all 12
people, are in [`evaluation-results.json`](evaluation-results.json).

To run it yourself (the script never sees the Qloo key; it only calls our API):

```bash
node scripts/evaluate.mjs                 # all 12 people against http://localhost:8787
API=https://your-api node scripts/evaluate.mjs
node scripts/evaluate.mjs in-1            # re-run one person; the others are kept
```

## Who was tested

Twelve invented people, two each from six countries, born between the 1930s and the 1960s, each with three favourites
(`scripts/eval-people.json`). Each also had one topic to avoid. No names or personal details exist in the test data.

| | Region | Born | Favourites |
|---|---|---|---|
| mx-1 | Mexico City, Mexico | 1940s | Pedro Infante, bolero, tamales |
| mx-2 | Guadalajara, Mexico | 1930s | Jorge Negrete, mariachi, pozole |
| uk-1 | Liverpool, UK | 1940s | The Beatles, Cilla Black, tea |
| uk-2 | London, UK | 1930s | Vera Lynn, Cliff Richard, fish and chips |
| ng-1 | Ibadan, Nigeria | 1950s | King Sunny Adé, highlife, amala |
| ng-2 | Lagos, Nigeria | 1940s | Fela Kuti, Victor Olaiya, jollof rice |
| in-1 | Mumbai, India | 1940s | Lata Mangeshkar, Raj Kapoor, samosa |
| in-2 | Chennai, India | 1950s | Rajinikanth, M. S. Subbulakshmi, dosa |
| ph-1 | Manila, Philippines | 1950s | Pilita Corrales, Nora Aunor, adobo |
| ph-2 | Cebu City, Philippines | 1960s | Rico J. Puno, Dolphy, lechon |
| jp-1 | Tokyo, Japan | 1940s | Hibari Misora, Akira Kurosawa, sushi |
| jp-2 | Osaka, Japan | 1960s | Kyu Sakamoto, Toshiro Mifune, ramen |

## Pass bars (from `docs/BUILD_RULES.md`)

| Bar | Result | |
|---|---|---|
| Full 8-item session for at least 10 of 12 people | 12 of 12 | Pass |
| 100% of items come from Qloo | 96 of 96 carry Qloo provenance | Pass (see note 1) |
| 90% or more of dated items inside the era window | **12 of 12** | Pass (see note 2) |
| 100% avoid-safe | 0 hits on the caregiver's topic, 0 on the built-in hard topics | Pass |
| 100% gentle questions | 0 of 96 questions test memory or touch health | Pass |
| A session in under 60 seconds | **15 to 35 seconds** per person (median about 19) | Pass on this day (see note 3) |
| 85% or more of items fit the region or the anchors, judged by hand | about 71% (68 of 96), up from about 59% and 65% | Not met |

1. "From Qloo" is checked here by the provenance fields every item carries. The guarantee itself is code: `assertQlooOnly`
   drops any item whose id never appeared in a Qloo response, and a unit test enforces it.
2. Only films carry a release year, so this bar covers the 12 films, one per session. Artists, places and brands are matched
   to the person by region and by the 55-and-older audience, not by decade, and we say so in the app.
3. Qloo's response time varies a lot. On another day the same build took more than two minutes, which is why the build screen
   shows real progress and why the film search is capped (see `docs/QLOO_API_NOTES.md`).

## The bar we did not meet: does it fit the person?

A script can't check this, so every item was read by hand in all three runs. One reviewer (an AI
assistant working from general knowledge, not a caregiver or a local expert) judged each item against the person's region, era
and favourites. Treat the counts as a careful estimate. The same reviewer made the changes being tested, so a
fresh pair of eyes from each region would improve it.

Each item was marked:
- **Fits**: from or about that place and era, or clearly tied to the favourites, and the right kind of thing for its slot.
- **Loose**: plausible and safe, but generic (for example a well-known film that isn't tied to this person) or only loosely tied.
- **Miss**: clearly the wrong place, era, audience or kind of thing.

| | Fits (run 1, 2, 3) | Loose | Miss | What stood out in the third run |
|---|---|---|---|---|
| mx-1 Mexico City | 8 → 8 → **8** | 0 | 0 | Plaza Garibaldi, Museo Dolores Olmedo, Tajín, Vicente Fernández, and a 1957 Mexican film |
| mx-2 Guadalajara | 7 → 7 → **8** | 0 | 0 | Mercado Libertad and a Guadalajara eatery serving Mexican classics replaced a cemetery museum and a tourist train |
| uk-1 Liverpool | 5 → 6 → **6** | 2 | 0 | *A Hard Day's Night* is the film. A Southport chocolate shop and a halal eatery are loose |
| uk-2 London | 2 → 2 → **4** | 4 | 0 | The Magic Circle and the Jewel Tower (a 14th-century remnant of the Palace of Westminster) now fill the place slots. American singers and a 2001 burger chain remain |
| ng-1 Ibadan | 7 → 7 → **7** | 1 | 0 | Local places and Fela and Femi Kuti. The film (*Whitey*, 1980) is loose |
| ng-2 Lagos | 7 → 7 → **7** | 1 | 0 | Local places, Tony Allen, Femi Kuti. A British film (*Kes*) is loose |
| in-1 Mumbai | 3 → 3 → **4** | 4 | 0 | The bookshop is gone from the taste slots. *Anand* (1971) is the film. One place shows a description that doesn't match its name (a kebab restaurant described as a bookstore): Qloo's data |
| in-2 Chennai | 2 → 2 → **3** | 4 | 1 | North and South Indian cooking is now a taste. An Italian eatery and one unknown artist remain |
| ph-1 Manila | 4 → 3 → **4** | 3 | 1 | A Filipino coffee chain is back. A Hungarian arthouse film (miss) and a Chinese seafood restaurant remain |
| ph-2 Cebu | 5 → 5 → **5** | 2 | 1 | Casa Gorordo Museum and Magellan's Cross fit. A Palestinian film (*Wedding in Galilee*) is a miss |
| jp-1 Tokyo | 3 → 6 → **6** | 2 | 0 | A 1960 Naruse film, Yoko Ono, Calbee. A French grand maison as a place, and Miles Davis, are loose |
| jp-2 Osaka | 4 → 6 → **6** | 2 | 0 | Calbee, Shonen Knife, Yukihiro Takahashi. A Taiwanese film and a theme-park chophouse are loose |
| **Total** | **57 → 62 → 68** | **25** | **3** | |

About 71% fit (up from 59% and 65%), 26% are loose and 3% are misses (down from 7%). Counting "loose but plausible" as
fitting would give 97%, but we don't think that is a fair reading of the bar.

### What the pattern says

- It works well where Qloo's data is deep for older audiences and local places. Mexico City, Guadalajara, Ibadan and Lagos were
  7 to 8 of 8 in all three runs, and Tokyo and Osaka moved up to 6.
- London, Mumbai, Chennai and Manila are still weakest (4, 4, 3 and 4 of 8). Where Qloo's data for older audiences is thin,
  the songs and tastes it returns are generic: American singers, chain restaurants, modern DJs.
- The film fix helped some people and not others. A search on the favourites alone gave *A Hard Day's Night* (Liverpool), *Anand*
  (Mumbai) and a 1960 Japanese film (Tokyo). For the Philippines and Osaka it returned world arthouse cinema that
  has little to do with the person (*Adoption*, *Wedding in Galilee*, *The Boys from Fengkuei*). That is what Qloo's taste graph connects to
  those favourites. The filler "best-known films" search still supplies the film for Chennai.
- Repeats across countries are gone. *The Sound of Music* (4 times in the first run) and *Rocky* (3) no longer appear. Items that
  repeat now do so within one country (Mexico, the Philippines, Japan), which is correct.
- Songs are better matched. Foreign acts (Brazilian psytrance for Chennai, an American pop group for Tokyo) mostly moved down, and
  a 2020s pop group for someone born in the 1960s was removed. London still gets American singers because the whole pool is American.
- Places and tastes improved in the third run. Somewhere you'd go to see now fills the place slots (a market in Guadalajara, a house
  museum in Cebu, the Jewel Tower in London), the cemetery museum and the bookshop are gone, and tastes lean toward their own cooking. Foreign
  cooking still shows up where the pool has little else (an Italian eatery for Chennai).
- The film slot is now the weakest. Five of twelve films were loose and two were misses. *Adoption* and *Wedding in Galilee* are world cinema
  that Qloo links to the favourites and that has nothing to do with the person; *The Boys from Fengkuei* (Taiwanese, for Osaka) is a loose fit.

## What changed between the runs

The first run (59% fit) showed three problems, so three changes were made and the whole evaluation re-run (65%). The places and tastes
were the weakest slot, so a fourth change followed and it was re-run again (71%):

1. Films from the favourites, not a location filter. The old search filtered films by country and returned the same global classics
   (*The Godfather*, *Star Wars*) for every country. Searching on the favourites alone, with the year window, returns films from the
   person's own world where Qloo has them. Those rise eight places over the best-known filler films, and a filler film is now described as
   "one of the best-known films from the years they were growing up", not "chosen to go with" the favourites.
2. Songs and brands lean toward their world. The favourites' own Qloo descriptions say what nationality counts as "theirs" (no
   country list), and songs and brands described as theirs rise and those described as from elsewhere fall. An act formed after their
   years is left out.
3. Repeats across countries move down. The server remembers which countries it has offered each artist, brand and film to and ranks it
   lower for other countries. This is kept in memory only, so results for one region can depend slightly on what was built before it.
4. Places and tastes that belong to the person's world. Places you'd go to see (a plaza, museum, temple, market, waterfront) rank before
   restaurants, and a barber, banquet hall or event venue ranks last. Tastes lean toward cooking described as theirs and away from cooking
   described as from elsewhere, and prefer brands that existed in their young years. A bookshop with a café is no longer a taste, and
   places of mourning (a cemetery museum had come up) are never offered. All of it reads Qloo's own descriptions; no place or cuisine is
   hard-coded.

## Other things the evaluation found, and fixed

1. A session that silently came back almost empty. The first full run gave 11 of 12 full sessions. Mumbai got only 2 items.
   Qloo's location lookup returns nothing for "Mumbai, India" (and reports success), yet "Mumbai" works. The session now
   retries songs, films, places and tastes with the city on its own when every located search is empty, uses that name from
   then on, and tells the caregiver what it did. This is a general rule, not a list of cities. Mumbai now builds all 8 items.
   (Mumbai was re-run after the fix; the other eleven are from the first run, where the fallback did not apply.)
2. A first attempt at capping slow film searches stopped retries after a rate limit too, which cost a Mexico City session
   its film. A search that times out is no longer repeated, and a rate limit still is.

## What we are not claiming

- That a recommendation is something a particular person will remember. Results describe what people with similar tastes and
  background often enjoy, and say nothing about an individual's memory or health.
- That every region is equally well served. The honest picture is above, and the app already tells the caregiver when a place
  has thin data.
- That this was a user study. It was not. Three caregiver usability tests are still to do (see the submission checklist), as
  are Lighthouse accessibility, a keyboard pass, a screen-reader pass on the stage, and a test on a real phone.

## What could raise the fit rate further (not done)

- Films: when the favourites-only film search returns cinema from a different culture, fall back to the best-known films of that
  country's own era instead, or prefer films whose description names the person's country.
- Songs where the pool is foreign: London and Tokyo still get American acts because that is most of what Qloo returns for an older
  audience there. A second search for artists from the favourites' own country could widen the pool.
- Descriptions that don't match names: one Mumbai place carried a bookstore description under a kebab restaurant's name. That is
  Qloo's data; the app can't tell.
- Favourites Qloo did not match: one Chennai favourite wasn't found; local-language search could recover some of these.
- A fresh pair of eyes: re-judge the same 96 items with someone from each region. The same reviewer made the changes and judged them.
