# Deploying Then & There

Two pieces, deployed in this order:

1. **The API** (`server/`) on Render. It has to be a long-running Node 22.19+ process, because the Qloo harness doesn't run serverless.
2. **The web app** (`web/`) on Vercel, as a static export.

Then one setting on the API (its allowed origin) is updated to the web app's URL.

The Qloo key can't be rotated or regenerated, so it only ever goes into Render's dashboard as a secret. Don't paste it into a chat, an issue, a commit or the Vercel project.

## 1. API on Render

1. Open https://dashboard.render.com/blueprints, or use **New → Blueprint**. Connect your GitHub account when asked, and allow Render to read `midexol/then-and-there` (it is a private repo, so Render has to be granted access to it).
2. Choose the repo and the `main` branch. Render reads `render.yaml` and shows one web service, `then-and-there-api`, on the **Starter** plan.
3. It asks for one value: **`QLOO_API_KEY`**. Paste your hackathon key there. Nothing else is needed; the Qloo host, the allowed origin and the Node version are already in the blueprint.
4. Click **Apply**. The first build takes a few minutes (it installs, compiles the TypeScript and starts the server).
5. When the service shows **Live**, open `https://<your-service>.onrender.com/api/health`. You want:

   ```json
   {"qloo":"ready","mode":"live","llm":"missing"}
   ```

   `"mode":"mock"` means the key wasn't picked up. `llm: "missing"` is expected.

**Plan.** The blueprint uses **Starter (about $7 a month)**, which never sleeps. The **free** plan works too but sleeps after 15 minutes idle, and waking it costs the first visitor about a minute (the service starting, then the Qloo connection). The landing page pings `/api/health` when it opens, which starts the wake-up early, but a paid plan avoids it altogether. To use free, change `plan: starter` to `plan: free` in `render.yaml`, or change the plan in the Render dashboard.

**Optional language model.** To have suggested questions written by a model instead of the built-in set, add `LLM_BASE_URL`, `LLM_API_KEY` and `LLM_MODEL` in the service's Environment tab (any OpenAI-compatible endpoint). Leave them out and everything still works.

For Groq, which is OpenAI-compatible: `LLM_BASE_URL=https://api.groq.com/openai/v1`, `LLM_MODEL=llama-3.3-70b-versatile` (or any chat model listed in the Groq console) and `LLM_API_KEY` set to a key from console.groq.com. Paste the key only into Render's dashboard. Only item names, the region and the era go to the model, never a nickname or personal details.

**Example people.** Films come from a slow Qloo search that can time out, which leaves a session with 7 items and a note saying so. To keep the three examples reliable, run `QLOO_API_KEY=… npm run seed-cache` in `server/` on your own machine (set the key in your shell, not in a file), then commit `server/data/demo-cache.json`. The server loads it at startup. Set `PREWARM_EXAMPLES=1` on Render only if you have no seed file: it builds the examples at every start, which costs about forty Qloo calls.

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

This step is optional hardening: the blueprint allows any origin (`*`), which is fine for a public API with no cookies or logins. To narrow it, in Render set `ALLOWED_ORIGIN` to the Vercel URL (for example `https://then-and-there.vercel.app`, no trailing slash). Render restarts the service. If you use a custom domain too, list both, comma-separated.

## 4. Check it end to end

On the live Vercel URL:

- [ ] The landing page loads and the "Try it" dial changes the years.
- [ ] **Plan a first session** → the example people appear under "Or try it with an example".
- [ ] Pick **Grandma Rosa**: the build screen shows real steps and a finished session of 7 or 8 items (7 when Qloo's film search is slow, with a note saying so) in about 20 to 60 seconds.
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
