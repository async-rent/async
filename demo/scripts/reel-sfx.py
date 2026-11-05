"""The reel's soundtrack: the edited music bed (score.py --bed-only) with the recorded effects placed on the picture's
cue frames (out/reel-sfx.json, from scripts/reel-cues.ts), each levelled against the music around it, then mastered
(-14 LUFS integrated, true peak under -1.5 dBTP). No ducking: the music is never pulled under an effect (its two
stop-downs, before the drop and before the logo, are part of the bed).

    python scripts/reel-sfx.py            # -> public/audio/reel.wav and out/qa/reel-sfx.json (the gains it set)

The takes are trims of Mixkit recordings (Mixkit Sound Effects Free License, records in audio/sfx/*.licence.json),
chosen with earshot (out/reel/sfx-audition*.py): rank by the role's description, find for the trim, realness, A/B.
"""
import json
import os
import sys

import numpy as np
import pyloudnorm as pyln
import soundfile as sf
from scipy.signal import fftconvolve, lfilter, resample_poly

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
SR = 48000
BED = os.path.join(ROOT, 'public', 'audio', 'reel-bed.wav')
OUT = os.path.join(ROOT, 'public', 'audio', 'reel.wav')
CUES = os.path.join(ROOT, 'out', 'reel-sfx.json')
REPORT = os.path.join(ROOT, 'out', 'qa', 'reel-sfx.json')
TARGET_LUFS = -14.0
CEILING_DBTP = -1.5
BEAT_S = 60 / 128  # the track's beat
FADE_BEATS = 2.0  # the music fades out over the last two beats before the logo pop
FADE_LEAD_S = 0.1  # ...and is silent this long before it (the re-entry's high accent sits 80 ms ahead of the bar line)
TAIL_DB = -14.0  # the hall's return on the fading bars, low: a decay under the logo, never a hit
PEAK_DB = 0.0  # an effect's peak before the master (dBFS); transients over the ceiling go to the limiter

# role -> the take (file, trim in seconds) and its level over the music (dB): the take's loudest 50 ms against the
# median 50 ms level of the music around the cue (earshot's kit levelling: effects ride 3-10 dB over the bed)
TAKES = {
    'click': dict(id='mixkit-275', start=0.107, end=0.250, over_db=7.0, fade_out=0.02),
    'success': dict(id='mixkit-2575', start=0.058, end=1.20, over_db=8.0, fade_out=0.25),
    'whoosh.gather': dict(id='mixkit-168', start=0.023, end=0.80, over_db=10.0, fade_out=0.08),
}
METER = pyln.Meter(SR, block_size=0.4)


def load(path):
    x, sr = sf.read(path, always_2d=True, dtype='float64')
    if x.shape[1] == 1:
        x = np.repeat(x, 2, axis=1)
    if sr != SR:
        g = np.gcd(sr, SR)
        x = resample_poly(x, SR // g, sr // g, axis=0)
    return x[:, :2]


def rms50(x):
    """50 ms RMS levels (dB) of a stereo stretch, 25 ms apart."""
    m = (x ** 2).mean(axis=1)
    w, h = int(0.05 * SR), int(0.025 * SR)
    if len(m) < w:
        return np.array([10 * np.log10(max(m.mean(), 1e-12))])
    v = np.lib.stride_tricks.sliding_window_view(m, w)[::h].mean(axis=1)
    return 10 * np.log10(np.maximum(v, 1e-12))


def lufs(x):
    """Loudness of a short stretch: integrated over 400 ms blocks, padded with its own repeats when shorter."""
    if len(x) < int(0.42 * SR):
        x = np.tile(x, (int(np.ceil(0.42 * SR / max(1, len(x)))), 1))
    v = METER.integrated_loudness(x)
    return v if np.isfinite(v) else -70.0


def take(role):
    t = TAKES[role]
    x = load(os.path.join(ROOT, 'audio', 'sfx', f"{t['id']}.wav"))
    a, b = int(t['start'] * SR), int(t['end'] * SR)
    x = x[a:b].copy()
    n_in, n_out = int(0.003 * SR), int(t['fade_out'] * SR)
    x[:n_in] *= np.linspace(0, 1, n_in)[:, None]
    x[-n_out:] *= (np.linspace(1, 0, n_out) ** 2)[:, None]
    env = np.abs(x).max(axis=1)
    k = int(0.005 * SR)
    smooth = np.convolve(env, np.ones(k) / k, mode='same')
    return x, int(np.argmax(smooth))


def hall(x, rt=3.8, pre=0.018, seed=7):
    """A hall send: the signal through a decaying, darkening noise tail (rt to -60 dB), decorrelated per side."""
    rng = np.random.default_rng(seed)
    n = int(rt * SR)
    t = np.arange(n) / SR
    env = np.exp(-6.91 * t / rt)
    ir = np.zeros((n + int(pre * SR), 2))
    for c in range(2):
        noise = rng.standard_normal(n) * env
        # darker as it decays: a one-pole low-pass on the tail
        noise = lfilter([0.18], [1, -0.82], noise)
        ir[int(pre * SR):, c] = noise
    ir /= np.sqrt((ir ** 2).sum(axis=0, keepdims=True))
    return np.stack([fftconvolve(x[:, c], ir[:, c]) for c in range(2)], axis=1)


def bed_ref(bed, t, role):
    """The music's level the effect sits over: the 1.2 s before the cue, skipping the 0.5 s stop-down before a hit."""
    gap = 0.55 if role == 'whoosh.gather' else 0.0
    a, b = int(max(0.0, t - gap - 1.2) * SR), int(max(0.05, t - gap) * SR)
    return float(np.median(rms50(bed[a:b])))


def true_peak_limit(x, ceiling_db):
    """A look-ahead limiter on the 4x-oversampled peak: gain = ceiling / peak, held 2 ms ahead, released over 25 ms."""
    ceil = 10 ** (ceiling_db / 20)
    up = resample_poly(x, 4, 1, axis=0)
    peak = np.abs(up).max(axis=1).reshape(-1, 4).max(axis=1)[: len(x)]
    need = np.minimum(1.0, ceil / np.maximum(peak, 1e-9))
    look = int(0.002 * SR)
    # the gain each sample needs within the next 5 ms (a sliding minimum), so the gain is down before the peak
    pad = np.pad(need, (0, look), constant_values=1.0)
    win = np.lib.stride_tricks.sliding_window_view(pad, look + 1)[: len(need)].min(axis=1)
    if win.min() >= 1.0:
        return x, 0.0
    # attack at once, release exponentially over 25 ms: it catches a click's transient without pumping the music
    rel = np.exp(-1.0 / (0.025 * SR))
    g = np.empty_like(win)
    cur = 1.0
    for i, w in enumerate(win):
        cur = w if w < cur else min(w, 1.0 - (1.0 - cur) * rel)
        g[i] = cur
    return x * g[:, None], float(20 * np.log10(g.min()))


def main():
    cues = json.load(open(CUES))
    fps, total = cues['fps'], cues['total']
    n = int(round(total / fps * SR))
    bed = load(BED)
    bed = np.pad(bed, ((0, max(0, n - len(bed))), (0, 0)))[:n]
    fx = np.zeros_like(bed)
    rows = []
    cache = {}
    for e in cues['events']:
        role = e['role']
        if role not in cache:
            cache[role] = take(role)
        x, pk = cache[role]
        t = e['f'] / fps
        start = int(round(t * SR)) - (pk if e['align'] == 'peak' else int(0.005 * SR))
        ref = bed_ref(bed, t, role)
        gain_db = ref + TAKES[role]['over_db'] - float(rms50(x).max())
        # never louder than the music's own peaks: a take's peak stays 3 dB under full scale before the master
        peak_db = 20 * np.log10(max(np.abs(x).max(), 1e-9))
        capped = gain_db > PEAK_DB - peak_db
        gain_db = min(gain_db, PEAK_DB - peak_db)
        a, b = max(0, start), min(n, start + len(x))
        fx[a:b] += x[a - start:b - start] * 10 ** (gain_db / 20)
        rows.append(dict(id=e['id'], role=role, t=round(t, 3), take=TAKES[role]['id'], bed_db=round(ref, 1), gain_db=round(gain_db, 1), peak_capped=bool(capped)))
    # the close is silent: the music fades out over the last two beats before the logo pop and is gone before the
    # track's re-entry hit (and the high accent 80 ms ahead of it), so nothing sounds on the closing logo motion; a
    # low hall send of the fading bars lets them decay instead of stopping
    if cues.get('musicOut') is not None:
        t_out = cues['musicOut'] / fps
        a, b = int(round((t_out - FADE_BEATS * BEAT_S) * SR)), int(round((t_out - FADE_LEAD_S) * SR))
        u = np.linspace(0, 1, b - a)
        send = bed[a:b] * (np.cos(u * np.pi / 2) ** 2)[:, None]
        bed[a:b] = send
        bed[b:] = 0.0
        wet = hall(send, rt=2.4) * 10 ** (TAIL_DB / 20)
        e = min(n, a + len(wet))
        fx[a:e] += wet[: e - a]
    raw = bed + fx
    # loudness and the true-peak ceiling together: normalise, limit, and normalise again on what the limiter left
    g = 10 ** ((TARGET_LUFS - METER.integrated_loudness(raw)) / 20)
    for _ in range(3):
        mix, gr = true_peak_limit(raw * g, CEILING_DBTP - 0.2)
        g *= 10 ** ((TARGET_LUFS - METER.integrated_loudness(mix)) / 20)
    # the tail fades with the picture (the reel's last 36 frames)
    nf = int(36 / fps * SR)
    mix[-nf:] *= (np.linspace(1, 0, nf) ** 1.6)[:, None]
    final = METER.integrated_loudness(mix)
    up = resample_poly(mix, 4, 1, axis=0)
    tp = 20 * np.log10(np.abs(up).max())
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    sf.write(OUT, mix.astype(np.float32), SR, subtype='PCM_24')
    rep = dict(out=os.path.relpath(OUT, ROOT), seconds=round(n / SR, 3), lufs=round(final, 2), true_peak_dbtp=round(float(tp), 2),
               limiter_db=round(gr, 2), effects=rows, ducking='none')
    os.makedirs(os.path.dirname(REPORT), exist_ok=True)
    json.dump(rep, open(REPORT, 'w'), indent=1)
    ok = abs(final - TARGET_LUFS) <= 0.5 and tp <= CEILING_DBTP
    print(f"{'PASS' if ok else 'FAIL'}  {rep['out']}  {rep['seconds']} s  {final:.2f} LUFS  TP {tp:.2f} dBTP  limiter {gr:.2f} dB")
    for r in rows:
        print(f"  {r['t']:7.3f} s  {r['role']:14} {r['take']:12} bed {r['bed_db']:6.1f} dB  gain {r['gain_db']:+6.1f} dB{' (peak cap)' if r['peak_capped'] else ''}  ({r['id']})")
    return 0 if ok else 1


if __name__ == '__main__':
    sys.exit(main())
