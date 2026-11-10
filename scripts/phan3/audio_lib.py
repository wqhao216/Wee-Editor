"""Thư viện âm thanh tối giản cho Phần 3, chỉ dùng numpy (không scipy).

- WAV PCM 24-bit 48 kHz (ghi/đọc bằng module wave chuẩn).
- Bộ lọc pha-không bằng FFT, đáp ứng biên độ kiểu Butterworth.
- Fade vào/ra để không lách tách.
"""
from __future__ import annotations

import json
import subprocess
import wave
from pathlib import Path

import numpy as np

SR = 48000


def secs(n: int) -> float:
    return n / SR


def n_of(t: float) -> int:
    return int(round(t * SR))


def db(x: float) -> float:
    return 10 ** (x / 20)


def to_db(x: float) -> float:
    return 20 * np.log10(max(x, 1e-12))


def midi_hz(m: float) -> float:
    return 440.0 * 2 ** ((m - 69) / 12)


# ------------------------------------------------------------------ WAV 24-bit
def write_wav24(path: Path, x: np.ndarray) -> None:
    """x: float (n,) hoặc (n, 2), biên độ [-1, 1]."""
    x = np.asarray(x, dtype=np.float64)
    if x.ndim == 1:
        x = x[:, None]
    peak = np.abs(x).max() if x.size else 0
    if peak > 1.0:
        raise ValueError(f"{path.name}: tràn biên độ (peak {peak:.3f})")
    q = np.round(x * 8388607).astype(np.int32)
    b = q.astype("<i4").view(np.uint8).reshape(-1, 4)[:, :3].tobytes()
    path.parent.mkdir(parents=True, exist_ok=True)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(x.shape[1])
        w.setsampwidth(3)
        w.setframerate(SR)
        w.writeframes(b)


def read_wav24(path: Path) -> np.ndarray:
    with wave.open(str(path), "rb") as w:
        assert w.getsampwidth() == 3 and w.getframerate() == SR, path
        ch, n = w.getnchannels(), w.getnframes()
        raw = np.frombuffer(w.readframes(n), dtype=np.uint8).reshape(-1, 3)
    b = np.zeros((raw.shape[0], 4), dtype=np.uint8)
    b[:, :3] = raw
    v = b.view("<i4").reshape(-1)
    v = np.where(v >= 2 ** 23, v - 2 ** 24, v).astype(np.float64) / 8388607
    return v.reshape(-1, ch)


# ------------------------------------------------------------------ lọc
def fft_filter(x: np.ndarray, lo: float | None = None, hi: float | None = None, order: int = 2) -> np.ndarray:
    """Lọc pha-không. lo = tần số cắt high-pass, hi = tần số cắt low-pass (Hz). order: số cực Butterworth."""
    x = np.asarray(x, dtype=np.float64)
    n = x.shape[0]
    nfft = 1 << int(np.ceil(np.log2(max(n, 2) * 1.0)))
    f = np.fft.rfftfreq(nfft, 1 / SR)
    h = np.ones_like(f)
    if hi is not None:
        h *= 1 / np.sqrt(1 + (f / hi) ** (2 * order))
    if lo is not None:
        with np.errstate(divide="ignore"):
            h *= 1 / np.sqrt(1 + (lo / np.maximum(f, 1e-9)) ** (2 * order))
    X = np.fft.rfft(x, n=nfft, axis=0)
    y = np.fft.irfft(X * (h[:, None] if x.ndim == 2 else h), n=nfft, axis=0)
    return y[:n]


def fade(x: np.ndarray, ms_in: float = 5, ms_out: float = 5) -> np.ndarray:
    x = np.array(x, dtype=np.float64, copy=True)
    a, b = n_of(ms_in / 1000), n_of(ms_out / 1000)
    if a:
        r = np.sin(np.linspace(0, np.pi / 2, a)) ** 2
        x[:a] *= r[:, None] if x.ndim == 2 else r
    if b:
        r = np.cos(np.linspace(0, np.pi / 2, b)) ** 2
        x[-b:] *= r[:, None] if x.ndim == 2 else r
    return x


def exp_env(n: int, decay_s: float) -> np.ndarray:
    return np.exp(-np.arange(n) / SR / decay_s)


def attack_decay(n: int, attack_s: float, decay_s: float) -> np.ndarray:
    t = np.arange(n) / SR
    a = np.clip(t / max(attack_s, 1e-6), 0, 1)
    return a * np.exp(-np.maximum(t - attack_s, 0) / decay_s)


def peak_normalize(x: np.ndarray, peak_db: float = -1.0) -> np.ndarray:
    p = np.abs(x).max()
    return x * (db(peak_db) / p) if p > 0 else x


def rng(seed: int) -> np.random.Generator:
    return np.random.default_rng(seed)


def to_stereo(x: np.ndarray, pan: float = 0.0) -> np.ndarray:
    """pan -1 (trái) … 1 (phải), luật công suất bằng nhau."""
    a = (pan + 1) * np.pi / 4
    return np.stack([x * np.cos(a), x * np.sin(a)], axis=1) * np.sqrt(2)


# ------------------------------------------------------------------ đo loudness (ffmpeg)
def loudness(path: Path) -> dict:
    """Đo bằng ffmpeg loudnorm (EBU R128): I (LUFS), TP (dBTP), LRA (LU)."""
    r = subprocess.run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(path), "-af",
                        "loudnorm=I=-16:TP=-1:LRA=11:print_format=json", "-f", "null", "-"],
                       capture_output=True, text=True)
    txt = r.stderr
    j = json.loads(txt[txt.rindex("{"):txt.rindex("}") + 1])
    return {"I": float(j["input_i"]), "TP": float(j["input_tp"]), "LRA": float(j["input_lra"]), "thresh": float(j["input_thresh"])}


# ------------------------------------------------------------------ limiter
def gain_curve(need: np.ndarray, hold_ms: float = 6, release_s: float = 0.08, ctrl: int = 1000) -> np.ndarray:
    """need: hệ số tối đa được phép theo từng mẫu (≤ 1). Trả về hệ số mượt (giữ hold_ms trước/sau, nhả tuyến
    tính trong release_s), luôn ≤ need ở mọi mẫu."""
    k = SR // ctrl
    nb = int(np.ceil(len(need) / k))
    pad = np.ones(nb * k)
    pad[:len(need)] = need
    blk = pad.reshape(nb, k).min(axis=1)
    h = max(1, int(hold_ms * ctrl / 1000))
    look = blk.copy()
    for d in range(1, h + 1):
        look = np.minimum(look, np.concatenate([blk[d:], np.ones(d)]))
        look = np.minimum(look, np.concatenate([np.ones(d), blk[:-d]]))
    out = np.empty_like(look)
    prev, step = 1.0, 1.0 / (release_s * ctrl)
    for i, v in enumerate(look):
        prev = v if v < prev else min(v, prev + step)
        out[i] = prev
    return np.minimum(np.repeat(out, k)[:len(need)], need)


def peak_limit(x: np.ndarray, ceiling_db: float, **kw) -> tuple[np.ndarray, float]:
    """Limiter đỉnh mẫu cho tín hiệu stereo. Trả về (tín hiệu, mức giảm lớn nhất dB)."""
    a = np.abs(x).max(axis=1) if x.ndim == 2 else np.abs(x)
    c = db(ceiling_db)
    need = np.where(a > c, c / np.maximum(a, 1e-12), 1.0)
    r = gain_curve(need, **kw)
    return x * (r[:, None] if x.ndim == 2 else r), float(-20 * np.log10(max(r.min(), 1e-12)))
