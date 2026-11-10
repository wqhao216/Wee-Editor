"""Tự tổng hợp toàn bộ SFX của Phần 3 (không mẫu, không tải về) -> audio/sfx/*.wav
48 kHz, 24-bit, stereo, peak -1 dBFS, fade vào/ra 5ms. Mức trộn đặt ở make_events.py.

Chạy: python3 -I scripts/phan3/make_sfx.py
"""
from __future__ import annotations

import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from audio_lib import (SR, attack_decay, exp_env, fade, fft_filter, midi_hz, n_of, peak_normalize,  # noqa: E402
                       rng, to_stereo, write_wav24)
from common import ROOT  # noqa: E402

OUT = ROOT / "audio" / "sfx"


def t_axis(dur: float) -> np.ndarray:
    return np.arange(n_of(dur)) / SR


def swept_noise(dur: float, f0: float, f1: float, bw_oct: float, seed: int) -> np.ndarray:
    """Nhiễu trắng qua dải thông có tâm trượt từ f0 → f1 (theo thang log), xử lý theo khung STFT."""
    n = n_of(dur)
    win, hop = 1024, 256
    noise = rng(seed).standard_normal(n + win)
    out = np.zeros(n + win)
    w = np.hanning(win)
    freqs = np.fft.rfftfreq(win, 1 / SR)
    lf = np.log2(np.maximum(freqs, 1))
    for s in range(0, n, hop):
        p = min(1.0, s / max(n - 1, 1))
        fc = f0 * (f1 / f0) ** p
        g = np.exp(-0.5 * ((lf - np.log2(fc)) / (bw_oct / 2)) ** 2)
        seg = noise[s:s + win] * w
        out[s:s + win] += np.fft.irfft(np.fft.rfft(seg) * g, n=win) * w
    return out[:n]


def tone(freq, dur: float, partials=((1, 1.0),), phase=0.0) -> np.ndarray:
    t = t_axis(dur)
    f = np.broadcast_to(np.asarray(freq, dtype=float), t.shape)
    ph = 2 * np.pi * np.cumsum(f) / SR + phase
    return sum(a * np.sin(k * ph) for k, a in partials)


def finish(x: np.ndarray, pan: float = 0.0) -> np.ndarray:
    return fade(peak_normalize(to_stereo(x, pan), -1.0), 5, 5)


# ------------------------------------------------------------------ từng loại
def whoosh(dur=0.32, f0=500, f1=2600, seed=1):
    """cardIn/cardSwap/cardOut, punchIn: lướt ngắn, sáng dần rồi tắt mềm."""
    x = swept_noise(dur, f0, f1, 1.6, seed)
    t = t_axis(dur)
    env = np.sin(np.pi * np.clip(t / dur, 0, 1)) ** 1.6 * (1 - 0.35 * t / dur)
    return x * env


def whoosh_wipe(dur=0.72):
    """chapterWipe: lướt dày hơn, dài hơn, có chút trầm."""
    x = swept_noise(dur, 260, 4200, 2.0, 7)
    t = t_axis(dur)
    rumble = fft_filter(rng(8).standard_normal(len(t)), hi=180) * 3
    env = (np.clip(t / (0.55 * dur), 0, 1) ** 1.5) * np.clip((dur - t) / (0.45 * dur), 0, 1) ** 0.8
    return (x + 0.35 * rumble) * env


def tick():
    """textIn của khối chữ: tick mềm rất nhỏ (gõ gỗ nhẹ)."""
    dur = 0.06
    x = tone(2400, dur, ((1, 1), (2.1, 0.25))) * exp_env(n_of(dur), 0.008)
    click = fft_filter(rng(3).standard_normal(n_of(dur)), lo=1500, hi=6000) * exp_env(n_of(dur), 0.0025) * 0.4
    return fft_filter(x + click, hi=7000)


def pop(f_hi=900, f_lo=300, dur=0.16):
    """pop ấm: sine trượt cao độ nhanh xuống, tắt nhanh."""
    t = t_axis(dur)
    f = f_lo + (f_hi - f_lo) * np.exp(-t / 0.018)
    x = tone(f, dur, ((1, 1.0), (2, 0.18))) * attack_decay(len(t), 0.002, 0.045)
    return fft_filter(x, hi=5000)


def tick_ok(freq=midi_hz(91)):  # G6
    """ting sáng (callout ok / dấu tích)."""
    dur = 0.38
    n = n_of(dur)
    x = tone(freq, dur, ((1, 1.0), (2.0, 0.28), (3.0, 0.08))) * attack_decay(n, 0.002, 0.11)
    return x


def blip_danger():
    """khung danger: blip trầm, hơi căng (quãng 2 thứ, hơi trượt xuống)."""
    dur = 0.24
    t = t_axis(dur)
    bend = 1 - 0.04 * t / dur
    a = tone(midi_hz(55) * bend, dur, ((1, 1), (2, 0.5), (3, 0.3), (4, 0.15)))
    b = tone(midi_hz(56) * bend, dur, ((1, 1), (2, 0.5), (3, 0.3), (4, 0.15)))
    x = (a + 0.8 * b) * attack_decay(len(t), 0.004, 0.09)
    return fft_filter(x, lo=90, hi=1400)


def blip_warn():
    """khung warn: blip trung tính (quãng 5 đúng), ngắn."""
    dur = 0.18
    x = (tone(midi_hz(76), dur) + 0.6 * tone(midi_hz(83), dur)) * attack_decay(n_of(dur), 0.003, 0.05)
    return fft_filter(x, hi=4000)


def click():
    """click chuột khô, rõ: nhấn + nhả (nhả nhỏ hơn, sau 38ms)."""
    dur = 0.08
    n = n_of(dur)
    r = rng(11)

    def one(at, amp):
        e = np.zeros(n)
        s = n_of(at)
        k = np.arange(n - s)
        e[s:] = np.exp(-k / SR / 0.0018)
        body = np.zeros(n)
        body[s:] = np.sin(2 * np.pi * 3100 * k / SR) * np.exp(-k / SR / 0.004)
        return amp * (fft_filter(r.standard_normal(n), lo=2500, hi=9000) * e * 0.7 + body * 0.5)
    return one(0.0, 1.0) + one(0.038, 0.45)


def riser(dur=1.4):
    """riser 1.4s dẫn vào B8: nhiễu quét lên + âm trượt lên, rung nhanh dần, to dần."""
    t = t_axis(dur)
    p = t / dur
    nz = swept_noise(dur, 250, 6000, 1.4, 21)
    glide = midi_hz(57) * 2 ** (2 * p ** 1.5)  # A3 → A5
    trem = 0.6 + 0.4 * np.sin(2 * np.pi * np.cumsum(4 + 14 * p ** 2) / SR)
    tonal = tone(glide, dur, ((1, 1), (2, 0.35), (3, 0.12))) * trem
    env = p ** 2.2
    x = (0.8 * nz + 0.5 * tonal) * env
    return x * np.clip((dur - t) / 0.02, 0, 1)


def error_buzz():
    """buzz trầm 0.3s: hai răng cưa lệch nhẹ, lọc thấp, rung 30 Hz."""
    dur = 0.3
    t = t_axis(dur)
    saw = lambda f: 2 * ((f * t) % 1) - 1  # noqa: E731
    x = saw(110) + 0.8 * saw(116.5)
    x = fft_filter(x, lo=60, hi=1500) * (0.75 + 0.25 * np.sin(2 * np.pi * 30 * t))
    return x * attack_decay(len(t), 0.006, 0.16) * np.clip((dur - t) / 0.04, 0, 1)


def ding_end():
    """ding kết: chuông (các bội không điều hòa) C6 + C5 mềm, tắt dài."""
    dur = 2.2
    n = n_of(dur)
    f = midi_hz(84)
    x = (tone(f, dur, ((1, 1.0), (2.756, 0.32), (5.404, 0.12))) * attack_decay(n, 0.003, 0.65)
         + 0.45 * tone(f / 2, dur, ((1, 1.0), (2, 0.2))) * attack_decay(n, 0.004, 0.9))
    return x


def tua():
    """đầu đoạn tua nhanh: tiếng "rẹt" ngắn quét lên kèm 3 nhịp lách tách nhỏ."""
    dur = 0.2
    n = n_of(dur)
    zip_ = swept_noise(dur, 700, 5000, 1.0, 31) * np.sin(np.pi * np.arange(n) / n) ** 2
    ticks = np.zeros(n)
    for i, at in enumerate((0.02, 0.07, 0.12)):
        s = n_of(at)
        k = np.arange(n - s)
        ticks[s:] += np.sin(2 * np.pi * (1800 + 400 * i) * k / SR) * np.exp(-k / SR / 0.006) * 0.5
    return fft_filter(0.7 * zip_ + ticks, hi=7000)


def pop_node():
    """FlowDiagram: mỗi nút pop (tròn, cao hơn pop thường)."""
    return pop(f_hi=1300, f_lo=520, dur=0.18)


def draw_line(dur=0.4):
    """FlowDiagram: tiếng "kéo" nhỏ khi đường nối vẽ (bút dạ trên giấy)."""
    t = t_axis(dur)
    nz = fft_filter(rng(41).standard_normal(len(t)), lo=1800, hi=5500)
    flutter = 0.7 + 0.3 * np.sin(2 * np.pi * 23 * t + 1.3 * np.sin(2 * np.pi * 7 * t))
    env = np.clip(t / 0.05, 0, 1) * np.clip((dur - t) / 0.12, 0, 1)
    return nz * flutter * env


SFX = {
    "whoosh": whoosh, "whoosh_wipe": whoosh_wipe, "tick": tick, "pop": pop, "tick_ok": tick_ok,
    "blip_danger": blip_danger, "blip_warn": blip_warn, "click": click, "riser": riser,
    "error_buzz": error_buzz, "ding_end": ding_end, "tua": tua, "pop_node": pop_node, "draw_line": draw_line,
}


def main() -> None:
    for name, fn in SFX.items():
        x = finish(fn())
        write_wav24(OUT / f"{name}.wav", x)
        print(f"  {name:12s} {len(x) / SR:5.2f}s")
    print(f"Đã ghi {len(SFX)} file vào audio/sfx/")


if __name__ == "__main__":
    main()
