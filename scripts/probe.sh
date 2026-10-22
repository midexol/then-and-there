#!/usr/bin/env bash
# Day-1 probe: answers the open questions in docs/QLOO_API_NOTES.md with ~12 small calls.
# Prereqs: Node 22.19+, `npm i -g @qloo/qloo-harness` (>=0.1.26), `qloo setup --qloo` done.
# Usage: bash scripts/probe.sh   -> writes JSON to ./probe-out/ (contains no keys)
set -uo pipefail
OUT=probe-out; mkdir -p "$OUT"

ex() { local name="$1" op="$2" json="$3"; echo "== $name"
  qloo exec "$op" --input "$json" > "$OUT/$name.json" 2>&1 \
    && python3 -c "import json,sys;d=json.load(open('$OUT/$name.json'));print('  ',d.get('status'),'|',d.get('result_count'),'|',(d.get('summary') or '')[:120])" 2>/dev/null \
    || echo "   failed, see $OUT/$name.json"; }

echo "== readiness"; qloo setup --status --json > "$OUT/00-status.json" 2>&1; cat "$OUT/00-status.json" | head -5

# --- Q3: how well does coverage hold around the world? (pick demo people from the strongest) ---
ex 10-mx-infante         describe '{"entity":"Pedro Infante","type":"artist"}'
ex 11-uk-beatles         describe '{"entity":"The Beatles","type":"artist"}'
ex 12-ng-ksa             describe '{"entity":"King Sunny Ade","type":"artist"}'
ex 13-in-ilaiyaraaja     describe '{"entity":"Ilaiyaraaja","type":"artist"}'
ex 14-ph-nora            describe '{"entity":"Nora Aunor","type":"person"}'
ex 15-jp-hibari          describe '{"entity":"Hibari Misora","type":"artist"}'
ex 16-loc-mexico         describe '{"entity":"Mexico City","type":"locality"}'
ex 17-loc-ibadan         describe '{"entity":"Ibadan","type":"locality"}'
ex 18-tags-bolero        find_tags '{"query":"bolero music","limit":5}'
ex 19-tags-tamales       find_tags '{"query":"tamales","limit":5}'

# --- Q2: Then & There core — does age + place shift recommendations? (same signals, two age groups) ---
ex 20-mx-artists-55      recommend '{"target_type":"artist","signals":["Pedro Infante"],"demographic":"people over 55","signal_location":"Mexico City, Mexico","limit":10}'
ex 21-mx-artists-young   recommend '{"target_type":"artist","signals":["Pedro Infante"],"demographic":"people under 25","signal_location":"Mexico City, Mexico","limit":10}'
ex 22-uk-artists-55      recommend '{"target_type":"artist","signals":["The Beatles"],"demographic":"people over 55","signal_location":"Liverpool, United Kingdom","limit":10}'
ex 23-ng-artists-55      recommend '{"target_type":"artist","signals":["King Sunny Ade"],"demographic":"people over 55","signal_location":"Ibadan, Nigeria","limit":10}'
ex 24-mx-movies-55       recommend '{"target_type":"movie","signals":["Pedro Infante"],"demographic":"people over 55","signal_location":"Mexico City, Mexico","limit":10}'
ex 25-mx-places          recommend '{"target_type":"place","signal_tags":["bolero music"],"filter_location":"Mexico City, Mexico","limit":10}'
ex 26-uk-places          recommend '{"target_type":"place","signals":["The Beatles"],"filter_location":"Liverpool, United Kingdom","limit":10}'
ex 27-ng-places          recommend '{"target_type":"place","signals":["King Sunny Ade"],"filter_location":"Ibadan, Nigeria","limit":10}'

# --- Tastes are brands: does a place + age shift brand recommendations? (exactly what the server sends) ---
ex 30-mx-brands-55       recommend '{"target_type":"brand","signals":["Pedro Infante"],"demographic":"people over 55","signal_location":"Mexico City, Mexico","limit":10}'
ex 31-uk-brands-55       recommend '{"target_type":"brand","signals":["The Beatles"],"demographic":"people over 55","signal_location":"Liverpool, UK","limit":10}'
ex 32-ng-brands-55       recommend '{"target_type":"brand","signals":["King Sunny Ade"],"demographic":"people over 55","signal_location":"Ibadan, Nigeria","limit":10}'
ex 33-mx-rank            rank '{"options":["Jarritos","Bimbo","Coca-Cola","Chocolate Abuelita"],"option_type":"brand","demographic":"people over 55","signal_location":"Mexico City, Mexico"}'


# --- Q1: does Qloo honour release-year filters? (era window is the core of Then & There) ---------
# Uses the raw insights command because the workflow layer doesn't expose year filters.
raw() { local name="$1"; shift; echo "== $name"; qloo insights "$@" --json > "$OUT/$name.json" 2>&1 \
  && python3 -c "import json;d=json.load(open('$OUT/$name.json'));r=d.get('results',d);ents=(r.get('entities') if isinstance(r,dict) else r) or [];print('   ',len(ents),'results; years:',sorted({(e.get('properties') or {}).get('release_year') for e in ents if isinstance(e,dict)}-{None}))" 2>/dev/null \
  || echo "   failed, see $OUT/$name.json"; }
raw 40-year-filter-on   -t movie --signal-query "Pedro Infante" --params '{"filter.release_year.min":1945,"filter.release_year.max":1965}' -n 15
raw 41-year-filter-off  -t movie --signal-query "Pedro Infante" -n 15
raw 42-age-signal-raw   -t artist --signal-query "The Beatles" --params '{"signal.demographics.age":"55_and_older"}' -n 10

echo; echo "Done. Zip or paste ./probe-out/ back into the chat (it holds no credentials)."
