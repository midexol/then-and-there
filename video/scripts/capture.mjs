// Records the screenshots in public/shots from the live app at phone size. Needs Playwright (npm i playwright) and, optionally, CHROME_PATH.
// It plays through Grandma Rosa. The Ken and Adunni plan shots come from the same flow on the home screen.
import { chromium } from "playwright";
const OUT = new URL("../public/shots", import.meta.url).pathname.replace(/^[/]([A-Za-z]:)/, "$1");
const U = "https://then-and-there-lime.vercel.app";
const b = await chromium.launch({ executablePath: process.env.CHROME_PATH || undefined });
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "light" });
const p = await ctx.newPage();
const shot = (n, o = {}) => p.screenshot({ path: OUT + "/" + n + ".png", ...o });
const settle = (ms = 700) => p.waitForTimeout(ms);

await p.goto(U + "/", { waitUntil: "load", timeout: 90000 }); await settle(1200);
await shot("landing");
await p.getByRole("link", { name: /See an example/ }).first().click(); await settle(1500);
await shot("examples");

// A real build: only the region text is changed on the way out, so the server's cache doesn't answer it.
await p.route("**/api/sessions", async (route) => {
  const req = route.request();
  if (req.method() !== "POST") return route.continue();
  const body = JSON.parse(req.postData() || "{}");
  if (body.region) body.region = "Mexico City";
  await route.continue({ postData: JSON.stringify(body) });
});
await p.getByRole("button", { name: /Rosa/ }).or(p.getByRole("link", { name: /Rosa/ })).first().click();
await p.waitForURL(/build/, { timeout: 30000 }); 
const t0 = Date.now(); let k = 0;
while (!/plan/.test(p.url()) && Date.now() - t0 < 150000) {
  await shot("build-" + String(k++).padStart(2, "0")); await p.waitForTimeout(1500);
}
console.log("build frames", k, "seconds", (Date.now() - t0) / 1000);
await p.unroute("**/api/sessions");
await settle(1800);
await shot("plan-top");
await shot("plan-full", { fullPage: true });

await p.getByRole("link", { name: /Start session/ }).or(p.getByRole("button", { name: /Start session/ })).first().click(); await settle(1200);
await shot("tips");
await p.getByRole("button", { name: /Let's begin/ }).click(); await settle(900);
const answers = ["Yes", "A little", "Yes", "Yes"];
for (let i = 0; i < 4; i++) {
  await shot("stage-" + (i + 1));
  await p.getByRole("button", { name: new RegExp("^" + answers[i]) }).first().click(); await settle(500);
  await shot("stage-" + (i + 1) + "-answered");
  await p.getByRole("button", { name: /^Next/ }).first().click(); await settle(700);
}
await p.getByRole("button", { name: /End session/ }).or(p.getByRole("link", { name: /End session/ })).first().click(); await settle(2500);
if (/stage/.test(p.url())) await p.getByRole("button", { name: /End session|Yes, end|End/ }).last().click().catch(() => {});
await p.waitForURL(/review/, { timeout: 20000 }); await settle(1500);
await shot("review-top"); await shot("review-full", { fullPage: true });
await p.getByRole("button", { name: /Plan the next session/ }).or(p.getByRole("link", { name: /Plan the next session/ })).first().click();
await p.waitForURL(/plan/, { timeout: 120000 }); await settle(2500);
await shot("plan-next-top");

for (const [name, re] of [["ken", /Ken/], ["adunni", /Adunni/]]) {
  await p.goto(U + "/", { waitUntil: "load", timeout: 90000 }); await settle(1500); await p.getByRole("link", { name: /See an example/ }).first().click(); await settle(1200);
  await p.getByRole("button", { name: re }).or(p.getByRole("link", { name: re })).first().click();
  await p.waitForURL(/plan/, { timeout: 150000 }); await settle(2500);
  await shot("plan-" + name + "-top");
}
await b.close(); console.log("done");
