"""Tự sáng tác nhạc nền Phần 3 bằng tổng hợp (không mẫu) -> audio/music_bed.wav (170s, 48 kHz 24-bit).

96 BPM (ô nhịp = 2.5s, 68 ô = 170s), Đô trưởng. Mốc cấu trúc lấy từ work/timeline_cues.json
(music.*), tức từ edl.json qua chính code dựng video:
  0 → s00End          intro: chỉ pad (+ vài nốt pluck), fade vào 1s
  s00End → b7MgStart  B1–B7: pad, bass mềm, pluck thưa, hi-hat rất nhỏ — vòng C–G–Am–F
  b7MgStart → b8Start dày lên dẫn vào B8 (hi-hat 16 tăng dần; riser là SFX riêng)
  b8Start → errorLine B8 "nhạc giảm": pad + bass nhịp 8, giọng thứ Am–F–Dm–E, -3 dB
  errorLine → cutEnd  CẮT 0.5s (im hẳn)
  cutEnd → lowpassOpen vào lại -20 dB (= -4 dB so với nền -16), low-pass 1.5 kHz, vẫn Am–F–Dm–E
  lowpassOpen → rStart sáng lại (mở low-pass 0.3s), F–G–C–C, đầy đủ nhạc cụ
  rStart → end        hợp âm Đô trưởng kết (cùng ding_end), fade 1s cuối (plan 4.2)
Mức: bed chuẩn hóa -14 LUFS (= mức tham chiếu 0 dB); mức -16 dB của plan áp ở bước mix.

Chạy: python3 -I scripts/phan3/make_music.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from audio_lib import SR, db, fft_filter, loudness, midi_hz, n_of, peak_limit, rng, write_wav24  # noqa: E402
from common import ROOT  # noqa: E402

BPM = 96
BEAT = 60 / BPM
BAR = 4 * BEAT
OUT = ROOT / "audio" / "music_bed.wav"
RAW = ROOT / "work" / "music_raw.wav"

CHORDS = {  # giọng pad (MIDI), nốt bass (MIDI)
    "C": ([60, 64, 67, 72], 36), "G": ([59, 62, 67, 71], 43), "Am": ([57, 60, 64, 69], 45),
    "F": ([57, 60, 65, 69], 41), "Dm": ([57, 62, 65, 69], 38), "E": ([56, 59, 64, 68], 40),
}


class Bus:
    def __init__(self, dur: float):
        self.x = np.zeros((n_of(dur) + SR * 4, 2))

    def add(self, t: float, sig: np.ndarray, gain: float = 1.0, pan: float = 0.0) -> None:
        s = n_of(t)
        if s < 0:
            sig, s = sig[-s:], 0
        a = (pan + 1) * np.pi / 4
        seg = self.x[s:s + len(sig)]
        seg[:, 0] += sig[:len(seg)] * gain * np.cos(a) * np.sqrt(2)
        seg[:, 1] += sig[:len(seg)] * gain * np.sin(a) * np.sqrt(2)


def osc(f: float, dur: float, partials, detune_cents: float = 0.0, phase: float = 0.0) -> np.ndarray:
    t = np.arange(n_of(dur)) / SR
    ff = f * 2 ** (detune_cents / 1200)
    return sum(a * np.sin(2 * np.pi * k * ff * t + phase * k) for k, a in partials)


def env_ar(n: int, attack: float, release: float, hold: float) -> np.ndarray:
    t = np.arange(n) / SR
    up = np.clip(t / attack, 0, 1)
    down = np.clip(1 - (t - hold) / release, 0, 1)
    return np.minimum(up, down) ** 1.5


def pad_chord(bus: Bus, t: float, chord: str, dur: float, gain: float, attack=0.45) -> None:
    notes, _ = CHORDS[chord]
    length = dur + 0.8
    for j, m in enumerate(notes):
        for k, (det, pan) in enumerate(((-6, -0.5), (0, 0.0), (6, 0.5))):
            s = osc(midi_hz(m), length, ((1, 1.0), (2, 0.28), (3, 0.08), (4, 0.03)), det, phase=0.7 * j + k)
            bus.add(t, s * env_ar(len(s), attack, 0.8, dur), gain / 3, pan)


def bass_note(bus: Bus, t: float, m: int, length: float, gain: float) -> None:
    s = osc(midi_hz(m), length + 0.1, ((1, 1.0), (2, 0.22), (3, 0.05)))
    n = len(s)
    tt = np.arange(n) / SR
    e = np.clip(tt / 0.008, 0, 1) * np.exp(-tt / 0.45) * np.clip((length + 0.1 - tt) / 0.08, 0, 1)
    bus.add(t, s * e, gain, 0.0)


def pluck(bus: Bus, t: float, m: int, gain: float, pan: float) -> None:
    dur = 1.2
    tt = np.arange(n_of(dur)) / SR
    f = midi_hz(m)
    s = sum((1 / k ** 1.3) * np.sin(2 * np.pi * k * f * tt) * np.exp(-tt * (2.5 + 2.2 * k)) for k in range(1, 7))
    bus.add(t, s * np.clip(tt / 0.002, 0, 1), gain, pan)


def hat(bus: Bus, t: float, gain: float, seed: int) -> None:
    n = n_of(0.08)
    s = fft_filter(rng(seed).standard_normal(n), lo=7000, hi=14000) * np.exp(-np.arange(n) / SR / 0.022)
    bus.add(t, s, gain, 0.25)


def grid(t0: float, t1: float, step: float, origin: float):
    k = int(np.ceil((t0 - origin) / step - 1e-9))
    while origin + k * step < t1 - 1e-9:
        yield k, origin + k * step
        k += 1


def compose(m: dict) -> np.ndarray:
    total = m["end"]
    bus = Bus(total)
    G = {"pad": db(-12), "bass": db(-9), "pluck": db(-15), "hat": db(-27)}

    # ---- A: 0 → b8Start (vòng C–G–Am–F, gốc nhịp 0)
    prog_a = ["C", "G", "Am", "F"]
    for k, t in grid(0, m["b8Start"], BAR, 0.0):
        ch = prog_a[k % 4]
        dur = min(BAR, m["b8Start"] - t)
        pad_chord(bus, t, ch, dur, G["pad"])
        if t >= m["s00End"] - 1e-9 and t < m["b7MgStart"]:
            root = CHORDS[ch][1]
            for b, ln in ((0, 0.55), (2, 0.55), (3.5, 0.28)):
                tb = t + b * BEAT
                if tb < m["b7MgStart"]:
                    nxt = CHORDS[prog_a[(k + 1) % 4]][1] if b == 3.5 else root
                    bass_note(bus, tb, nxt, ln, G["bass"])
        if k % 2 == 1 or t < m["s00End"]:  # pluck thưa: ô lẻ, và intro
            notes = CHORDS[ch][0]
            for j, (b, idx) in enumerate(((0, 0), (0.5, 1), (1, 2), (2, 3))):
                tb = t + b * BEAT
                if tb < m["b7MgStart"]:
                    pluck(bus, tb, notes[idx] + 12, G["pluck"], -0.3 + 0.2 * j)
    for k, t in grid(m["s00End"], m["b7MgStart"], BEAT / 2, 0.0):
        if k % 2 == 1:
            hat(bus, t, G["hat"], k)
    # dẫn vào B8: hi-hat 16 tăng dần
    span = m["b8Start"] - m["b7MgStart"]
    for k, t in grid(m["b7MgStart"], m["b8Start"], BEAT / 4, 0.0):
        p = (t - m["b7MgStart"]) / span
        hat(bus, t, G["hat"] * db(-6 + 9 * p), 1000 + k)

    # ---- B: b8Start → errorLine (giảm, giọng thứ, gốc nhịp b8Start)
    prog_b = ["Am", "F", "Dm", "E"]
    for k, t in grid(m["b8Start"], m["errorLine"], BAR, m["b8Start"]):
        ch = prog_b[k % 4]
        pad_chord(bus, t, ch, min(BAR, m["errorLine"] - t), G["pad"] * db(-3), attack=0.8)
    for k, t in grid(m["b8Start"] + 2 * BEAT, m["errorLine"], BEAT / 2, m["b8Start"]):
        ch = prog_b[int((t - m["b8Start"]) // BAR) % 4]
        bass_note(bus, t, CHORDS[ch][1], 0.22, G["bass"] * db(-5))

    # ---- C: cutEnd → lowpassOpen (vào lại, gốc nhịp cutEnd; low-pass áp sau)
    for k, t in grid(m["cutEnd"], m["lowpassOpen"], BAR, m["cutEnd"]):
        ch = prog_b[k % 4]
        pad_chord(bus, t, ch, min(BAR, m["lowpassOpen"] - t) + 0.1, G["pad"], attack=0.05 if k == 0 else 0.45)
    for k, t in grid(m["cutEnd"], m["lowpassOpen"], BEAT, m["cutEnd"]):
        ch = prog_b[int((t - m["cutEnd"]) // BAR) % 4]
        bass_note(bus, t, CHORDS[ch][1], 0.4, G["bass"] * db(-2))

    # ---- D: lowpassOpen → rStart (sáng lại, gốc nhịp lowpassOpen)
    prog_d = ["F", "G", "C", "C"]
    for k, t in grid(m["lowpassOpen"], m["rStart"], BAR, m["lowpassOpen"]):
        ch = prog_d[k % 4]
        pad_chord(bus, t, ch, min(BAR, m["rStart"] - t), G["pad"], attack=0.08 if k == 0 else 0.45)
        root = CHORDS[ch][1]
        for b in (0, 2):
            if t + b * BEAT < m["rStart"]:
                bass_note(bus, t + b * BEAT, root, 0.55, G["bass"])
        notes = CHORDS[ch][0]
        for j, (b, idx) in enumerate(((0, 0), (0.5, 1), (1, 2), (1.5, 3), (2, 2), (3, 1))):
            if t + b * BEAT < m["rStart"]:
                pluck(bus, t + b * BEAT, notes[idx] + 12, G["pluck"], -0.3 + 0.12 * j)
    for k, t in grid(m["lowpassOpen"], m["rStart"], BEAT / 2, m["lowpassOpen"]):
        if k % 2 == 1:
            hat(bus, t, G["hat"], 5000 + k)

    # ---- E: rStart → end (hợp âm kết Đô trưởng, vào mềm: "hit" do ding_end đảm nhận, plan 4.2 2:47.0)
    pad_chord(bus, m["rStart"], "C", m["end"] - m["rStart"], G["pad"], attack=0.25)
    bass_note(bus, m["rStart"] + 0.05, 36, 2.6, G["bass"] * db(-3))

    return bus.x[:n_of(total)]


def structure(x: np.ndarray, m: dict) -> tuple[np.ndarray, np.ndarray]:
    """Low-pass ở đoạn C, cắt 0.5s, fade vào/ra. Trả về (bed, lp_weight)."""
    n = len(x)
    t = np.arange(n) / SR
    lp = fft_filter(x, hi=1500, order=2)
    w = np.zeros(n)  # 1 = dùng bản low-pass
    w[(t >= m["cutEnd"]) & (t < m["lowpassOpen"])] = 1.0
    open_ = (t >= m["lowpassOpen"]) & (t < m["lowpassOpen"] + 0.3)
    w[open_] = 1 - (t[open_] - m["lowpassOpen"]) / 0.3
    y = x * (1 - w[:, None]) + lp * w[:, None]
    g = np.ones(n)
    g *= np.clip(t / 1.0, 0, 1)  # intro fade vào 1s
    g[(t >= m["errorLine"]) & (t < m["cutEnd"])] = 0.0  # cắt 0.5s
    pre = (t >= m["errorLine"] - 0.01) & (t < m["errorLine"])
    g[pre] *= (m["errorLine"] - t[pre]) / 0.01  # tắt trong 10ms để không lách tách
    post = (t >= m["cutEnd"]) & (t < m["cutEnd"] + 0.01)
    g[post] *= (t[post] - m["cutEnd"]) / 0.01
    g[(t >= m["cutEnd"]) & (t < m["lowpassOpen"])] *= db(-4)  # -20 dB so với nền -16 (plan 4.2)
    rel = (t >= m["lowpassOpen"]) & (t < m["lowpassOpen"] + 0.3)
    g[rel] *= db(-4 * (1 - (t[rel] - m["lowpassOpen"]) / 0.3))
    fo = t >= m["end"] - 1.0
    g[fo] *= np.clip((m["end"] - t[fo]) / 1.0, 0, 1) ** 1.5  # fade 1s nối Phần 4 (plan 4.2)
    return y * g[:, None], w


def main() -> None:
    cues = json.loads((ROOT / "work" / "timeline_cues.json").read_text(encoding="utf-8"))
    m = cues["music"]
    raw = compose(m)
    raw = raw / np.abs(raw).max() * 0.9
    write_wav24(RAW, raw)
    li = loudness(RAW)["I"]
    raw = raw * db(-14 - li)  # chuẩn hóa bản thô về -14 LUFS (mức tham chiếu)
    # Master nhẹ: đỉnh ≤ -4.5 dBFS ở -14 LUFS (PLR ~9.5 dB) để khi cả mix chưa có giọng được nâng
    # lên -16 LUFS, đoạn nhạc không bị hạ (không có lời) vẫn dưới true peak -1 dBTP.
    raw, red = peak_limit(raw, -4.5, hold_ms=8, release_s=0.12)
    write_wav24(RAW, raw / max(1.0, np.abs(raw).max() / 0.99))
    li2 = loudness(RAW)["I"]
    raw = raw * db(-14 - li2)
    raw, red2 = peak_limit(raw, -4.5, hold_ms=8, release_s=0.12)
    print(f"  limiter bed: giảm đỉnh tối đa {max(red, red2):.1f} dB")
    bed, _ = structure(raw, m)
    peak = np.abs(bed).max()
    if peak > 0.98:
        bed *= 0.98 / peak
    write_wav24(OUT, bed)
    L = loudness(OUT)
    print(f"music_bed.wav {len(bed) / SR:.2f}s, BPM {BPM}, bản thô {li:.1f} LUFS → chuẩn -14; bed: I {L['I']} LUFS, TP {L['TP']} dBTP, LRA {L['LRA']}")


if __name__ == "__main__":
    main()
