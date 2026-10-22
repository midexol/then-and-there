# Deploying Then & There

Two pieces, deployed in this order:

1. **The API** (`server/`) on Render. It has to be a long-running Node 22.19+ process, because the Qloo harness doesn't run serverless.
2. **The web app** (`web/`) on Vercel, as a static export.

Then one setting on the API (its allowed origin) is updated to the web app's URL.

The Qloo key can't be rotated or regenerated, so it only ever goes into Render's dashboard as a secret. Don't paste it into a chat, an issue, a commit or the Vercel project.

## 1. API on Render

1. In Render: **New → Blueprint**, connect GitHub, and choose `midexol/then-and-there`. Render reads `render.yaml` and proposes a web service called `then-and-there-api` with root directory `server`.
2. When it asks for the secret values, fill in:

   | Variable | Value |
   |---|---|
   | `QLOO_API_KEY` | your hackathon key (secret) |
   | `ALLOWED_ORIGIN` | `*` for now; step 4 narrows it |
   | `LLM_BASE_URL`, `LLM_API_KEY`, `LLM_MODEL` | leave empty. Without them the app uses its built-in suggested questions |

   `QLOO_BASE_URL` and `QLOO_TRUSTED_BASE_URL` are already set in the blueprint to `https://hackathon.api.qloo.com`. A hackathon key returns 401 on any other host.
3. Pick the plan. **Starter (about $7 a month) is recommended while judges are looking.** The free plan sleeps after 15 minutes of silence, and waking it costs the first visitor a cold start of the service plus about 50 seconds for the Qloo harness. The landing page already pings `/api/health` when it opens, which starts the wake-up early, but a paid plan avoids it altogether.
4. Deploy. When it's live, open `https://<your-service>.onrender.com/api/health`. You want:

   ```json
   {"qloo":"ready","mode":"live","llm":"missing"}
   ```

   `"mode":"mock"` means the key wasn't picked up (check `QLOO_API_KEY`). `llm: "missing"` is expected.

## 2. Web app on Vercel

Either use the Vercel dashboard or the CLI.

**Dashboard:** **Add New → Project**, import `midexol/then-and-there`, and set:

| Setting | Value |
|---|---|
| Root Directory | `web` |
| Framework Preset | Next.js (the project is configured for a static export) |
| `NEXT_PUBLIC_API_URL` | the Render URL, e.g. `https://then-and-there-api.onrender.com` (no trailing slash) |
| `NEXT_PUBLIC_SITE_URL` | the URL Vercel gives the project, or your own domain |

These `NEXT_PUBLIC_*` values are baked in at build time, so changing one means redeploying.

**CLI:** from the repo root, `vercel link --cwd web`, then
`vercel env add NEXT_PUBLIC_API_URL production`, `vercel env add NEXT_PUBLIC_SITE_URL production`, and `vercel deploy --prod --cwd web`.

## 3. Close the loop

Back in Render, set `ALLOWED_ORIGIN` to the Vercel URL (for example `https://then-and-there.vercel.app`, no trailing slash). Render restarts the service. If you use a custom domain too, list both, comma-separated.

## 4. Check it end to end

On the live Vercel URL:

- [ ] The landing page loads and the "Try it" dial changes the years.
- [ ] **Plan a first session** → the example people appear under "Or try it with an example".
- [ ] Pick **Grandma Rosa**: the build screen shows real steps and a finished 8-item session in about 20 to 60 seconds.
- [ ] Open **Start session**, move through two items on a phone, then end it and open the review.
- [ ] Browser dev tools show no CORS errors (if you see one, `ALLOWED_ORIGIN` doesn't match the page's origin exactly).
- [ ] `https://<render-url>/api/health` still says `mode: live`.

## Troubleshooting

| Symptom | Likely cause |
|---|---|
| Build screen says "The server's Qloo access isn't working" | The key is wrong, or `QLOO_BASE_URL` / `QLOO_TRUSTED_BASE_URL` are missing or differ from each other |
| `mode: mock` on `/api/health` | `QLOO_API_KEY` isn't set on the service |
| "Then & There can't reach its server" | `NEXT_PUBLIC_API_URL` is wrong or missing in the Vercel build, or the free Render service is waking up |
| Network error naming CORS | `ALLOWED_ORIGIN` isn't the web app's exact origin |
| First session after a quiet period takes about a minute longer | Cold start (free plan). Use the Starter plan or a monitor that pings `/api/health` every 10 minutes |
| A session has no film and says films were slow | Qloo's era-film search timed out. That's capped on purpose; planning again usually brings them back |

## Run the same thing locally

```bash
cd server && npm ci && npm run build
PORT=8788 ALLOWED_ORIGIN='*' node --env-file=../.env dist/index.js   # the compiled server, as Render runs it
cd ../web && NEXT_PUBLIC_API_URL=http://localhost:8788 npm run build   # → web/out
npx serve out -l 5000
```
