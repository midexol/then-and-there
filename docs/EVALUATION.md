# Evaluation

Run on **22 Oct 2026** against the real Qloo hackathon API (live mode, no mock data), through the same HTTP API the app uses.
The raw results, with every item for all 12 people, are in [`evaluation-results.json`](evaluation-results.json).

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
| Full 8-item session for at least 10 of 12 people | **12 of 12** | Pass |
| 100% of items come from Qloo | **96 of 96** carry Qloo provenance | Pass (see note 1) |
| 90% or more of dated items inside the era window | **12 of 12** | Pass (see note 2) |
| 100% avoid-safe | **0 hits** on the caregiver's topic, **0** on the built-in hard topics | Pass |
| 100% gentle questions | **0 of 96** questions test memory or touch health | Pass |
| A session in under 60 seconds | **15–32 seconds** per person (median about 21) | Pass on this day (see note 3) |
| 85% or more of items fit the region or the anchors, judged by hand | **about 59%** (57 of 96) | **Not met** |

1. "From Qloo" is checked here by the provenance fields every item carries. The guarantee itself is code: `assertQlooOnly`
   drops any item whose id never appeared in a Qloo response, and a unit test enforces it.
2. Only films carry a release year, so this bar covers the 12 films, one per session. Artists, places and brands are matched
   to the person by region and by the 55-and-older audience, not by decade, and we say so in the app.
3. Qloo's response time varies a lot. On another day the same build took more than two minutes, which is why the build screen
   shows real progress and why the film search is capped (see `docs/QLOO_API_NOTES.md`).

## The bar we did not meet: does it fit the person?

This is the one check a script can't do, so every item was read by hand. **A caveat first:** one reviewer (an AI assistant
working from general knowledge, not a caregiver or a local expert) judged each item against the person's region, era and
favourites. Treat the counts as a careful estimate, not a measurement. A fresh pair of eyes from each region would improve it.

Each item was marked:
- **Fits**: from or about that place and era, or clearly tied to the favourites, and the right kind of thing for its slot.
- **Loose**: plausible and safe, but generic (for example a film that is well known everywhere) or only loosely tied.
- **Miss**: clearly the wrong place, era, audience or kind of thing.

| | Fits | Loose | Miss | What stood out |
|---|---|---|---|---|
| mx-1 Mexico City | 8 | 0 | 0 | Plaza Garibaldi, Museo Dolores Olmedo, Tajín, Vicente Fernández, and a 1957 Mexican film |
| mx-2 Guadalajara | 7 | 1 | 0 | A cemetery museum surfaced as a place: local, but a sombre subject |
| uk-1 Liverpool | 5 | 3 | 0 | Walker Art Gallery, FACT, The Kinks fit. A Southport chocolate shop and *The Sound of Music* are loose |
| uk-2 London | 2 | 6 | 0 | Only Vera Lynn is clearly right. Chain restaurants, a barber, and American singers for a Vera Lynn fan |
| ng-1 Ibadan | 7 | 1 | 0 | Local places and Fela and Femi Kuti. *Rocky* is the loose film |
| ng-2 Lagos | 7 | 1 | 0 | Local places, Tony Allen, Femi Kuti. A British film is loose |
| in-1 Mumbai | 3 | 4 | 1 | A bookshop appeared in a taste slot (miss). Qloo had to be asked for "Mumbai", not "Mumbai, India" (see below) |
| in-2 Chennai | 2 | 3 | 3 | One favourite wasn't found. Three songs were Brazilian or unknown artists (miss) |
| ph-1 Manila | 4 | 4 | 0 | Café Ysabel, Figaro, Oishi fit. Modern bands and *The Sound of Music* are loose |
| ph-2 Cebu | 5 | 2 | 1 | Magellan's Cross and a Cebu lechon place fit. A 2020s pop group for someone born in the 1960s (miss) |
| jp-1 Tokyo | 3 | 4 | 1 | A UK tea brand in Tokyo (miss). Western singers are loose |
| jp-2 Osaka | 4 | 3 | 1 | Shonen Knife is Osaka. A UK tea brand again (miss) |
| **Total** | **57** | **32** | **7** | |

So about **59% fit**, 33% are loose and 7% are misses. If "loose but plausible" counted as fitting it would be 93%, but we
don't think that is the honest reading of the bar.

### What the pattern says

- **It works well where Qloo's data is deep for older audiences and local places**: Mexico City, Guadalajara, Ibadan and Lagos
  were 7 to 8 of 8. Cebu was 5 of 8.
- **It is much weaker for London, Mumbai, Chennai, Tokyo and Osaka.** Qloo's recommendations for a 55-and-older audience in those
  places lean toward globally popular names (American singers, UK brands, the same two or three famous films).
- **The film slot is generic outside Mexico.** *The Sound of Music* appeared 4 times, *Rocky* 3 times. The local-film search
  returns little for most countries, so the "best-known films of the era" fills the slot.
- **Tastes repeat.** Mister Donut, Ahmad Tea, Figaro Coffee, Oishi and Grupo Bimbo each appeared twice.
- **Artists have no release year,** so a modern act can be offered to someone born in the 1960s (a 2020s pop group appeared once).

## What the evaluation found and we fixed

1. **A session that silently came back almost empty.** The first full run gave 11 of 12 full sessions. Mumbai got only 2 items.
   Qloo's location lookup returns nothing for "Mumbai, India" (and reports success), yet "Mumbai" works. The session now
   retries songs, films, places and tastes with the city on its own when every located search is empty, uses that name from
   then on, and tells the caregiver what it did. This is a general rule, not a list of cities. Mumbai now builds all 8 items.
   (Mumbai was re-run after the fix; the other eleven are from the first run, where the fallback did not apply.)
2. **A first attempt at capping slow film searches** stopped retries after a rate limit too, which cost a Mexico City session
   its film. A search that times out is no longer repeated, and a rate limit still is.

## What we are not claiming

- That a recommendation is something a particular person will remember. Results describe what people with similar tastes and
  background often enjoy, and say nothing about an individual's memory or health.
- That every region is equally well served. The honest picture is above, and the app already tells the caregiver when a place
  has thin data.
- That this was a user study. It was not. **Three caregiver usability tests are still to do** (see the submission checklist), as
  are Lighthouse accessibility, a keyboard pass, a screen-reader pass on the stage, and a test on a real phone.

## Ideas that could raise the fit rate (not done yet)

- Prefer artists whose description mentions the region, and drop modern acts for older birth decades.
- Down-rank a brand or film that already appeared for a different region in the same run (the repeats above).
- Use local-language search for the favourites that Qloo did not match.
