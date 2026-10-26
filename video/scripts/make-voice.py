"""Writes one MP3 per scene from script.json with Microsoft's neural voices (edge-tts, needs internet)."""
import asyncio, json, pathlib
import edge_tts

root = pathlib.Path(__file__).resolve().parent.parent
cfg = json.loads((root / "script.json").read_text(encoding="utf-8"))
out = root / "public" / "audio"
out.mkdir(parents=True, exist_ok=True)

async def main():
    for s in cfg["scenes"]:
        path = out / f"vo-{s['id']}.mp3"
        await edge_tts.Communicate(s["text"], cfg["voice"], rate=cfg["rate"], pitch=cfg["pitch"]).save(str(path))
        print("wrote", path.name, path.stat().st_size)

asyncio.run(main())
