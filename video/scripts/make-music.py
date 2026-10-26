"""Synthesizes the soundtrack (original, no samples, nothing to license): public/audio/music.wav, about 96 s."""
import wave
import numpy as np

SR = 44100
BPM = 104
BEAT = 60 / BPM
BARS = 42
N = int(SR * BEAT * 4 * BARS)
rng = np.random.default_rng(7)
L = np.zeros(N)
R = np.zeros(N)

def hz(note):  # note names as semitones from A4
    return 440.0 * 2 ** (note / 12)

# C - G - Am - F, voiced as chord tones in semitones from A4
CHORDS = [
    dict(root=-33, tones=[-9, -5, -2, 2]),    # Cmaj9: C4 E4 G4 D5
    dict(root=-38, tones=[-14, -10, -7, 0]),  # G add9: G3 B3 D4 A4
    dict(root=-36, tones=[-12, -9, -5, -2]),  # Am7: A3 C4 E4 G4
    dict(root=-40, tones=[-16, -12, -9, -5]), # Fmaj7: F3 A3 C4 E4
]

def put(buf, start, sig, gain=1.0):
    i = int(start * SR)
    if i >= N:
        return
    sig = sig[: N - i]
    buf[i : i + len(sig)] += sig * gain

def env_ar(n, a, r):
    t = np.arange(n) / SR
    e = np.minimum(1, t / a) * np.exp(-t / r)
    return e

def pad(freq, dur):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.zeros(n)
    for det in (-0.004, 0.0, 0.004):
        f = freq * (1 + det)
        s += np.sin(2 * np.pi * f * t) + 0.35 * np.sin(2 * np.pi * 2 * f * t)
    a = np.minimum(1, t / 0.7)
    r = np.minimum(1, (dur - t) / 0.9)
    return s / 6 * a * np.clip(r, 0, 1)

def pluck(freq, dur=0.7):
    n = int(dur * SR)
    t = np.arange(n) / SR
    s = np.sin(2 * np.pi * freq * t) + 0.5 * np.sin(2 * np.pi * 2 * freq * t) * np.exp(-t / 0.12) + 0.2 * np.sin(2 * np.pi * 3 * freq * t) * np.exp(-t / 0.06)
    return s * np.minimum(1, t / 0.004) * np.exp(-t / 0.22)

def bass(freq, dur=0.5):
    n = int(dur * SR)
    t = np.arange(n) / SR
    return np.sin(2 * np.pi * freq * t) * np.minimum(1, t / 0.01) * np.exp(-t / 0.28)

def kick():
    n = int(0.3 * SR)
    t = np.arange(n) / SR
    f = 45 + 90 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.11)

def noise_burst(dur, decay, hp=0.9):
    n = int(dur * SR)
    x = rng.standard_normal(n)
    x = x - hp * np.concatenate([[0], x[:-1]])  # crude high-pass
    t = np.arange(n) / SR
    return x * np.exp(-t / decay)

def section(bar):
    if bar < 6: return 0   # pad, then plucks
    if bar < 14: return 1  # bass and a soft kick
    if bar < 34: return 2  # full groove
    return 3               # ease out

for bar in range(BARS):
    c = CHORDS[bar % 4]
    t0 = bar * 4 * BEAT
    sec = section(bar)
    level = [0.55, 0.75, 1.0, 0.7][sec]
    # pad
    for tone in c["tones"]:
        p = pad(hz(tone), 4 * BEAT + 0.8)
        put(L, t0, p, 0.11 * level)
        put(R, t0, p, 0.11 * level)
    # plucks: eight notes up and back down the chord
    if bar >= 2:
        order = [0, 1, 2, 3, 2, 1, 2, 1]
        for k in range(8):
            f = hz(c["tones"][order[k]] + 12)
            s = pluck(f)
            pan = 0.35 if k % 2 == 0 else 0.65
            put(L, t0 + k * BEAT / 2, s, 0.16 * level * (1 - pan))
            put(R, t0 + k * BEAT / 2, s, 0.16 * level * pan)
    # bass
    if sec >= 1 and sec != 3:
        for b in (0, 2):
            s = bass(hz(c["root"]))
            put(L, t0 + b * BEAT, s, 0.34)
            put(R, t0 + b * BEAT, s, 0.34)
        s = bass(hz(c["root"] + 12), 0.3)
        put(L, t0 + 3.5 * BEAT, s, 0.18)
        put(R, t0 + 3.5 * BEAT, s, 0.18)
    # drums
    if sec in (1, 2):
        for b in range(4):
            k = kick()
            put(L, t0 + b * BEAT, k, 0.42 if sec == 2 else 0.26)
            put(R, t0 + b * BEAT, k, 0.42 if sec == 2 else 0.26)
        for b in range(8):
            h = noise_burst(0.05, 0.012)
            put(L, t0 + b * BEAT / 2 + BEAT / 4 * (b % 2 == 0) * 0, h, 0.035 if b % 2 else 0.018)
            put(R, t0 + b * BEAT / 2, h, 0.035 if b % 2 else 0.018)
    if sec == 2:
        for b in (1, 3):
            cl = noise_burst(0.14, 0.04, hp=0.6)
            put(L, t0 + b * BEAT, cl, 0.09)
            put(R, t0 + b * BEAT, cl, 0.09)

# gentle fades, soft clip, normalise
fade_in = np.minimum(1, np.arange(N) / (SR * 1.5))
fade_out = np.minimum(1, (N - np.arange(N)) / (SR * 3.0))
for ch in (L, R):
    ch *= fade_in * fade_out
out = np.stack([np.tanh(L * 1.6), np.tanh(R * 1.6)], axis=1)
out = out / np.max(np.abs(out)) * 0.89
pcm = (out * 32767).astype("<i2")
with wave.open("public/audio/music.wav", "wb") as w:
    w.setnchannels(2)
    w.setsampwidth(2)
    w.setframerate(SR)
    w.writeframes(pcm.tobytes())
print("music.wav", round(N / SR, 1), "seconds")
