# Then & There — Frontend spec

The frontend is half the score ("Design: a complete, coherent product experience"). This file is the source of truth for how Then & There looks, reads and behaves. If code and this file disagree, this file wins until it is updated on purpose.

## 1. Who it's for, and the one job

- **Primary user:** a caregiver. Usually an adult child or grandchild, sometimes a care-home activity coordinator. They are often on a phone, short on time, and not technical.
- **Secondary user:** the older person, who sees the screen during **Session mode** on a phone or tablet. They may have weaker eyesight and less patience for small targets.
- **The one job:** turn a few things you know about someone into a 30-minute session that feels familiar to them, then make running it effortless.

## 2. Design direction: *Indigo*

Then & There is for families everywhere, so its identity comes from a craft families everywhere share: **indigo resist-dyed cloth**. Japanese shibori, West African adire, Indonesian batik, Indian dabu and European blaudruck all use deep indigo, undyed cool cloth, and resist patterns of circles, dots and lines. Almost every grandparent on earth has worn or kept a cloth like this. It is warm without being cream, and rooted without belonging to any one country.

The direction **avoids** the warm-cream-plus-terracotta "AI default", dashboard card grids, all-caps eyebrow labels, monospace data labels and gradient washes.

**Spend boldness in one place:** the **Session stage**, the full-screen view where one song, food or place fills the screen. Everything else stays quiet, roomy and legible.

### Tokens (put in `web/app/tokens.css`; Tailwind reads them through `theme.extend.colors`)
```css
:root {
  /* Indigo: dyed cloth, undyed ground, one gold thread */
  --ground:      #F3F4F0;  /* cool undyed cotton, page background */
  --cloth:       #E4E8F3;  /* indigo-tinted surface for cards and inputs */
  --indigo:      #24336E;  /* primary: headings, buttons, brand */
  --indigo-deep: #121A3D;  /* session stage background, dark-mode ground */
  --ink:         #1B1D24;  /* body text */
  --ink-soft:    #565B6B;  /* secondary text (passes 4.5:1 on ground) */
  --gold:        #D9981C;  /* the one accent: "sparked a response", playing now */
  --line:        #CBD1E2;  /* hairlines, chip borders */
  --ok:          #2F7A55;  /* matched */
  --warn:        #9A5B00;  /* needs a choice */
  --err:         #A3322A;  /* errors only */

  --font-display: "Young Serif", Georgia, "Times New Roman", serif;
  --font-body: "Atkinson Hyperlegible", system-ui, -apple-system, "Segoe UI", sans-serif;

  --radius-sm: 6px;   /* chips, inputs */
  --radius-lg: 18px;  /* session stage, item cards */
}
@media (prefers-color-scheme: dark) { :root:not([data-theme="light"]) {
  --ground:#121A3D; --cloth:#1C2754; --indigo:#AFC0F5; --indigo-deep:#0B1029;
  --ink:#EEF0F7; --ink-soft:#A9B0C8; --gold:#F0B440; --line:#2E3A6E;
  --ok:#6CC79A; --warn:#F0B440; --err:#FF8C82; color-scheme:dark; } }
```
- **Atkinson Hyperlegible** was designed by the Braille Institute for low-vision readers. It's the right body face for an elder-care product, and the subject itself justifies it.
- **Young Serif** for headings only: sturdy and friendly, used sparingly.
- No third typeface. No monospace.

### Type scale (rem; body base 18px, Session mode base 22px)
| Role | Size / line-height | Font |
| --- | --- | --- |
| Session item title | 2.75 / 1.1 | Young Serif |
| Page title (h1) | 2.0 / 1.15 | Young Serif |
| Section (h2) | 1.375 / 1.25 | Young Serif |
| Body | 1.0 / 1.6 | Atkinson |
| Small / meta | 0.875 / 1.5 | Atkinson |

Sentence case everywhere, with no all-caps labels. Keep line length under 70 characters.

### The resist-dye motif
One SVG pattern component, `<IndigoBand />`: a horizontal strip of resist circles and dots, generated in code (not an image), 24–32px tall, drawn in `--indigo` at 12–18% opacity on light surfaces. Use it in **exactly three places**: the top of Home, the header of a printed session card, and the edges of the Session stage. Nowhere else.

### Shape and spacing
- An 8px spacing grid. Mobile gutters are 20px.
- **Minimum tap target is 48×48px. Session mode buttons are at least 72px tall.**
- Cards are used only for session items. Everything else sits on the ground, with no card-wrapping.
- No drop shadows except a soft one on the Session stage.

## 3. Screens

### 3.1 Home: "Who are we spending time with today?"
```
[IndigoBand]
Then & There
Who are we spending time with today?

( Grandma Rosa · Mexico City )   ( Grandpa Ken · Liverpool )   ( + Someone new )
   Last session: 3 days ago · 8 items

[Small print] Then & There plans reminiscence activities. It is not medical care.
```
- Profiles are large tappable tiles with name and last session date. They live only in this browser.
- Empty state: one large button, **"Plan a first session"**, plus **three example people from three continents**, so judges see the flow without typing and see straight away that it works anywhere: *Grandma Rosa, Mexico City, 1950s*; *Grandpa Ken, Liverpool, 1960s*; *Mama Adunni, Ibadan, 1960s*. The final set is chosen from the probe results, keeping the three with the richest Qloo data.

### 3.2 Profile builder (a real sequence, so numbered steps are allowed)
Three short steps, one question per screen, with a progress bar of three segments.
1. **"What should we call them?"** A nickname, with a helper line: *"Stays on this device. Never sent anywhere."* Then **"Roughly when were they born?"** as chips from the 1920s to the 1970s, with a helper line: *"We use this to find things from their teenage and young-adult years."* After the build, show the computed window back: *"Looking for things from about 1962–1975."*
2. **"Where did they grow up?"** A city or region anywhere in the world, with suggestions (resolved through Qloo's locality search). Helper line: *"Where they grew up, not where they live now. A grandmother from Manila who lives in London grew up in Manila."* An optional second field, **"Where do they live now?"**, adds local places they might visit.
3. **"What did they love?"** A chip input grouped by kind: Music, Food, Films and TV, Places, Work and hobbies. Each typed anchor resolves live:
   - ✓ **Matched**: indigo chip with a check. Hover or long-press shows what Qloo matched it to ("Pedro Infante · actor and singer").
   - ? **Choose**: gold outline chip. Tapping opens a sheet listing candidates: *"Which one did you mean?"*
   - ✕ **Not found**: muted chip with *"Qloo doesn't know this one. It'll be kept as a note for you."*
   - A minimum of 3 matched anchors is needed to continue, and the button says so: **"Add 1 more to continue"** becomes **"Build the session"**.
   - Optional, below the anchors: **"Anything to steer away from?"** with the helper *"Optional. Stays private, and is never shared with Qloo."* Free-text chips (e.g. "her husband", "the war years").

### 3.3 Building (the wait is a moment, not a spinner)
The backend streams real steps (see API_CONTRACT.md). Show them as a short, live list:
```
Finding songs people who love Pedro Infante also love…    ✓
Looking for films from their era…                         ✓
Places around Mexico City…                                ●
Putting the session in order…
```
Each line appears as its event arrives. No fake progress, no percentages. Typical length is 20–50s. If it takes longer than 60s, add: *"Still working. Qloo is taking longer than usual."*

### 3.4 Session plan (the main caregiver screen)
```
Grandma Rosa · 30-minute session             [Start session]  [Print card]

1  Warm-up song      Amorcito corazón — Pedro Infante
                     Why: often loved by people 55+ who love bolero
                     Ask: "Where were you when you first heard this?"
                     ▶ Listen on YouTube           Swap ⟳

2  A place           Palacio de Bellas Artes, Mexico City
3  A taste           Tamales and champurrado
4  A film            …
…  (8 items: song → place → taste → film → song → place → taste → closing song)
```
- **Numbering is correct here**, because the session really is ordered.
- Each item shows its **title**, a **"Why this?"** line (the Qloo provenance in plain words), one **conversation prompt**, a **listen/look** link, and **Swap**. Swap replaces that item with the next Qloo candidate of the same kind, with no full rebuild.
- A small **"From Qloo"** marker sits on each item, beside an assistant-written prompt marked **"Suggested question"**. Judges are told to look for exactly this kind of provenance.
- Footer: *"These are things often familiar to people with similar tastes and background, not facts about Grandma Rosa."*

### 3.5 Session mode: the stage (the bold moment)
Full-screen, `--indigo-deep` background, indigo band on the edges, one item at a time.
```
┌──────────────────────────────────────────────┐
│ ░░ indigo band ░░                            │
│                                              │
│            A song from the 1950s             │
│                                              │
│          Amorcito corazón                    │  ← 2.75rem Young Serif, --ground color
│          Pedro Infante                       │
│                                              │
│   "Where were you when you first heard it?"  │
│                                              │
│        [ ▶ Play on YouTube ]                 │
│                                              │
│  Did this spark something?                   │
│  [  😊 Yes  ]   [  🙂 A little  ]   [  — Not really  ]   │  ← 72px buttons
│                                              │
│  ‹ Back                 3 of 8       Next ›  │
└──────────────────────────────────────────────┘
```
- One orchestrated motion: when moving to the next item, the old one fades and the new title rises 12px over 400ms. Disable it under `prefers-reduced-motion`.
- Tapping **Yes** pulses a small gold thread under the title once, and saves the response. Nothing else animates.
- Use a screen wake lock while a session runs, so the tablet doesn't sleep mid-song.
- An **End session** button leads to the review.

### 3.6 Review and next time
- A summary of what sparked (gold), what was a little familiar and what wasn't.
- **"Plan the next session"** feeds the "Yes" items back in as new signals and drops the "Not really" ones. Show it: *"Next time we'll lean into: bolero, old Mexico City cinemas. We'll skip: westerns."*
- **Export** the profile as JSON, and **Delete** it with a two-step confirm built into the page.

### 3.7 Print card
A one-page A4/Letter print stylesheet: indigo band header, the person's nickname, 8 items with prompts, and space for handwritten notes. Care homes print things, so this is a real feature.

### 3.8 About and privacy
Short and plain: what Then & There sends to Qloo (cultural anchors, age group, region) and what it never sends (names, birth dates, health information). Repeats that it is not medical care. Credits Qloo.

## 4. States checklist (each must be designed, not left to defaults)
- First visit with no profiles: example profile plus "Plan a first session"
- Anchor resolving, matched, choose, not found
- Building: streaming steps; slow (over 60s) message
- Qloo busy or rate limited: *"Qloo is busy right now. Try again in a minute. Your profile is saved."*
- Model or server down: *"Then & There can't reach its server. Check your connection and try again."*
- A session with fewer than 8 items (thin data): show what we have, and say *"We found 5 strong matches. Add another favourite to get a fuller session."*
- Swap with no more candidates: disable Swap, with tooltip *"No more like this. Try adding an anchor."*
- Offline while in Session mode: the session already loaded keeps working; links show *"Needs internet."*

## 5. Accessibility floor
- WCAG AA contrast in both themes; body text 18px or larger, 22px or larger in Session mode
- All actions reachable by keyboard, with a visible focus ring (2px `--gold`, 2px offset)
- Tap targets 48px or larger, 72px or larger in Session mode
- `prefers-reduced-motion` respected; no autoplaying audio
- Every icon button has a text label (not icon-only)
- Interface in English for the hackathon, with every string in one `copy.ts` file so translation is a drop-in later.
- Content in any language and script: anchors keep their original spelling and diacritics (*corazón*, *Adé*, *Ọ̀yọ́*, *Ilaiyaraaja*, *美空ひばり*). Use `lang` attributes when the content language is known, and fonts with broad Latin coverage, falling back to system fonts for other scripts.

## 6. Voice and copy rules
- Talk to the caregiver like a kind, organised friend. Plain verbs, sentence case.
- Buttons say what happens: **Build the session**, **Start session**, **Print card**, **Plan the next session**.
- Never claim memory or health effects. Say "often familiar to people with similar tastes", never "they will remember".
- Errors say what happened and what to do. No apologies, no jokes.

## 7. Tech notes for the frontend
- Next.js (App Router) + TypeScript + Tailwind, with tokens in `tokens.css` mapped into Tailwind's theme.
- Fonts through `next/font/google` (`Young_Serif`, `Atkinson_Hyperlegible`), with fallbacks as in the tokens.
- Profiles and session history in `localStorage`, behind one small `store.ts` with try/catch. Export and import as JSON.
- Server-Sent Events for the build stream (`EventSource` on `/api/sessions/:id/events`).
- The frontend never talks to Qloo or the LLM directly. It only calls our server.
- Deploy the web app on Vercel. The server runs separately (see CLAUDE.md).

## 8. Definition of done (frontend)
- [ ] Every screen in §3 and every state in §4 implemented
- [ ] Looks right at 360px, 768px and 1280px, in light and dark
- [ ] Session mode tested on a real phone, with the screen staying awake
- [ ] Print card prints on one page
- [ ] Lighthouse accessibility score of 95 or more
- [ ] The example profile runs end to end in under 60s on the deployed URL

## 9. Added Oct 13: landing, tips and motion
- **First-visit landing** (home with no saved people, `web/components/Landing.tsx`):
  - Headline "Bring back the world they grew up in." with **Plan a first session** and **See an example** (which scrolls to the three example people).
  - A still, phone-sized stage preview.
  - How it works: three numbered steps.
  - "Why their teenage years", built around a big 14.
  - The privacy strip.
  - Returning visitors go straight to their people tiles.
- **First-session tips** (stage, shown once and skippable; the `then-and-there:tips-seen` flag lives in localStorage): go at their pace, follow their lead, it's okay to stop.
- **Motion** (all off under `prefers-reduced-motion`):
  - The stage title rises into place.
  - A gold thread draws under the title on Yes.
  - **The clock hands wind backwards** on the Building screen and stop on error.
  - **Swap**: the old card dims, then the new one fades in.
  - A pulsing gold dot marks steps in progress.
