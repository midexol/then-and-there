// Reads the real length of each voiceover clip and the size of each screenshot, and writes src/timeline.json.
import { execFileSync } from "node:child_process";
import { readFileSync, writeFileSync, readdirSync } from "node:fs";

const FPS = 30;
const PAD = 0.7; // breathing room after each line, seconds
const LEAD = 0.5;
const script = JSON.parse(readFileSync("script.json", "utf8"));

const secs = (file) =>
  Number(execFileSync("npx", ["remotion", "ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file], { encoding: "utf8", shell: true }).trim().split(/\s+/).pop());

let t = LEAD;
const scenes = script.scenes.map((s) => {
  const vo = secs(`public/audio/vo-${s.id}.mp3`);
  const from = Math.round(t * FPS);
  const dur = Math.round((vo + PAD) * FPS);
  t += (vo + PAD);
  return { id: s.id, caption: s.caption, from, dur, voStart: from + Math.round(0.1 * FPS), voSeconds: Number(vo.toFixed(2)) };
});
const total = Math.round((t + 1.2) * FPS);

const shots = {};
for (const f of readdirSync("public/shots").filter((f) => f.endsWith(".png"))) {
  const b = readFileSync(`public/shots/${f}`);
  shots[f.replace(".png", "")] = { w: b.readUInt32BE(16), h: b.readUInt32BE(20) };
}
writeFileSync("src/timeline.json", JSON.stringify({ fps: FPS, total, scenes, shots }, null, 2));
console.log(scenes.map((s) => `${s.id} ${(s.from / FPS).toFixed(1)}s +${(s.dur / FPS).toFixed(1)}s`).join("\n"), "\ntotal", (total / FPS).toFixed(1), "s");
