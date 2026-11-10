"""Mix tạm Phần 3 (chưa có giọng) + stem + ducking map + ghép vào animatic.

Mức (plan 4.2–4.3), so với tham chiếu 0 dB = mức giọng đọc (bed đã chuẩn hóa -14 LUFS = 0 dB):
  nhạc -16 dB khi không có lời; dưới lời -24 dB (ducking attack 80ms, release 400ms; bắt đầu hạ
  sớm 80ms để đủ sâu đúng lúc câu bắt đầu); đoạn sau báo lỗi nền -20 dB (đã nằm trong bed).
  SFX theo gain_db trong audio/sfx_events.json.
Sau đó cả mix nhân một hệ số chung để tổng -16 LUFS (yêu cầu chặng 4A). Chưa có giọng nên nhạc bị hạ
gần suốt bài và hệ số chung rất lớn; để true peak ≤ -1 dBTP, đỉnh được nén CHỈ trên stem SFX (nhạc
không bị bơm theo SFX), lookahead 6ms, nhả 80ms.
Hai stem ghi SAU hệ số chung: stem_music + stem_sfx = mix.

Chạy: python3 -I scripts/phan3/mix_audio.py
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from audio_lib import SR, db, gain_curve, loudness, n_of, read_wav24, write_wav24  # noqa: E402
from common import ROOT  # noqa: E402

A = ROOT / "audio"
MUSIC_LEVEL = -16.0
UNDER_VO = -24.0
ATTACK, RELEASE = 0.080, 0.400
CTRL = 1000  # Hz, tốc độ đường cong điều khiển
TARGET_I, MAX_TP = -16.0, -1.0
ANIMATIC = ROOT / "out" / "phan3_v2_animatic.mp4"
OUT_MP4 = ROOT / "out" / "phan3_v2_animatic_audio.mp4"


def ducking(cues: dict, n: int) -> tuple[np.ndarray, dict]:
    m = cues["music"]
    total = m["end"]
    tc = np.arange(int(total * CTRL) + 1) / CTRL
    section = np.where((tc >= m["cutEnd"]) & (tc < m["lowpassOpen"]), -4.0, 0.0)  # bed đã -4 dB ở đoạn này
    # khoảng lời đọc (hạ sớm ATTACK), gộp các khoảng cách nhau ngắn hơn ATTACK + RELEASE
    ranges = []
    for v in cues["vo"]:
        a, b = v["t"] - ATTACK, v["t_end"]
        if ranges and a - ranges[-1][1] < ATTACK + RELEASE:
            ranges[-1][1] = b
        else:
            ranges.append([a, b])
    active = np.zeros_like(tc, dtype=bool)
    for a, b in ranges:
        active |= (tc >= a) & (tc < b)
    want = np.where(active, np.minimum(0.0, UNDER_VO - (MUSIC_LEVEL + section)), 0.0)  # dB hạ thêm
    # Đi xuống trọn độ sâu 8 dB trong ATTACK, đi lên trong RELEASE (tuyến tính theo dB, tốc độ điều khiển 1 kHz)
    step_dn = (MUSIC_LEVEL - UNDER_VO) / (ATTACK * CTRL)
    step_up = (MUSIC_LEVEL - UNDER_VO) / (RELEASE * CTRL)
    g2 = np.zeros_like(want)
    for i in range(1, len(want)):
        if want[i] < g2[i - 1]:
            g2[i] = max(want[i], g2[i - 1] - step_dn)
        elif want[i] > g2[i - 1]:
            g2[i] = min(want[i], g2[i - 1] + step_up)
        else:
            g2[i] = want[i]
    curve_db = MUSIC_LEVEL + g2  # mức nhạc so với tham chiếu (chưa tính -4 dB đã nằm trong bed)
    gain = 10 ** (curve_db / 20)
    t_s = np.arange(n) / SR
    gain_s = np.interp(t_s, tc, gain)
    dmap = {
        "note": "Khoảng nhạc phải hạ theo lời đọc (cues.json vo: t → est_end). Khi có giọng thật ở chặng 4B: "
                "thay t/est_end bằng mốc đo từ file giọng rồi chạy lại mix_audio.py; nhạc và SFX không phải làm lại.",
        "reference": "0 dB = mức giọng đọc; bed nhạc chuẩn hóa -14 LUFS = 0 dB",
        "music_level_db": MUSIC_LEVEL, "under_voice_db": UNDER_VO, "post_error_section_db": -20.0,
        "attack_s": ATTACK, "release_s": RELEASE, "pre_roll_s": ATTACK,
        "merge_gap_s": ATTACK + RELEASE,
        "voice_ranges": [{"t": v["t"], "t_end": v["t_end"]} for v in cues["vo"]],
        "duck_ranges": [{"from": round(a, 3), "full": round(a + ATTACK, 3), "until": round(b, 3), "released": round(b + RELEASE, 3)} for a, b in ranges],
        "curve_100hz_db": [round(float(x), 2) for x in (curve_db + np.where(section < 0, -4.0, 0.0))[::CTRL // 100]],
    }
    return gain_s, dmap


def place_sfx(events: list[dict], n: int) -> np.ndarray:
    out = np.zeros((n, 2))
    cache: dict[str, np.ndarray] = {}
    for e in events:
        x = cache.setdefault(e["file"], read_wav24(A / "sfx" / f"{e['file']}.wav"))
        st = e.get("pitch_semitones", 0)
        if st:
            r = 2 ** (st / 12)
            idx = np.arange(0, len(x) - 1, r)
            x = np.stack([np.interp(idx, np.arange(len(x)), x[:, c]) for c in range(2)], axis=1)
        s = n_of(e["t"])
        seg = out[s:s + len(x)]
        seg += x[:len(seg)] * db(e["gain_db"] + e.get("extra_db", 0))
    return out


def sfx_limiter(music: np.ndarray, sfx: np.ndarray, ceiling_db: float) -> tuple[np.ndarray, float]:
    """Nén đỉnh CHỈ trên stem SFX sao cho |music + r·sfx| ≤ ceiling (đỉnh mẫu). Trả về (r theo mẫu, giảm lớn nhất dB)."""
    c = db(ceiling_db)
    mix = np.abs(music + sfx).max(axis=1)
    m = np.abs(music).max(axis=1)
    s_ = np.abs(sfx).max(axis=1)
    need = np.ones(len(mix))
    over = mix > c
    need[over] = np.clip((c - m[over]) / np.maximum(s_[over], 1e-9), 0.0, 1.0)
    r = gain_curve(need, hold_ms=6, release_s=0.08)
    return r, float(-20 * np.log10(max(r.min(), 1e-9)))


def main() -> None:
    cues = json.loads((ROOT / "work" / "timeline_cues.json").read_text(encoding="utf-8"))
    ev = json.loads((A / "sfx_events.json").read_text(encoding="utf-8"))["events"]
    bed = read_wav24(A / "music_bed.wav")
    n = len(bed)
    gain, dmap = ducking(cues, n)
    music = bed * gain[:, None]
    sfx = place_sfx(ev, n)
    tmp = ROOT / "work" / "mix_premaster.wav"
    pre = music + sfx
    if np.abs(pre).max() >= 1.0:
        raise SystemExit("mix trước chuẩn hóa đã tràn: kiểm tra mức SFX")
    write_wav24(tmp, pre)
    L0 = loudness(tmp)
    G_db = TARGET_I - L0["I"]
    ceiling = MAX_TP - 0.8
    out_tmp = ROOT / "work" / "mix_check.wav"
    if np.abs(music).max() * db(G_db) > db(ceiling):
        print(f"  lưu ý: riêng nhạc đã chạm {20*np.log10(np.abs(music).max())+G_db:.2f} dBFS sau chuẩn hóa")
    for _ in range(8):  # lặp: chuẩn hóa -16 LUFS, nén đỉnh SFX, đo lại TP và loudness
        music_s, sfx_raw = music * db(G_db), sfx * db(G_db)
        r, max_red = sfx_limiter(music_s, sfx_raw, ceiling)
        sfx_s = sfx_raw * r[:, None]
        write_wav24(out_tmp, music_s + sfx_s)
        L = loudness(out_tmp)
        if abs(L["I"] - TARGET_I) <= 0.1 and L["TP"] <= MAX_TP:
            break
        G_db += TARGET_I - L["I"]
        if L["TP"] > MAX_TP:
            ceiling -= (L["TP"] - MAX_TP) + 0.1
    else:
        raise SystemExit(f"không đạt -16 LUFS / TP ≤ -1 sau 8 lần: {L}")
    limiter_info = {"ceiling_sample_peak_db": round(ceiling, 2), "max_reduction_db": round(max_red, 2),
                    "reduced_ms": int((r < 0.999).sum() / SR * 1000)}
    mix = music_s + sfx_s
    write_wav24(A / "stem_music.wav", music_s)
    write_wav24(A / "stem_sfx.wav", sfx_s)
    write_wav24(A / "mix_no_vo.wav", mix)
    dmap["master_gain_db"] = round(G_db, 3)
    dmap["sfx_peak_limiter"] = limiter_info
    (A / "stem_ducking_map.json").write_text(json.dumps(dmap, ensure_ascii=False, indent=1), encoding="utf-8")
    L = loudness(A / "mix_no_vo.wav")
    print(f"mix_no_vo.wav: I {L['I']} LUFS, TP {L['TP']} dBTP, LRA {L['LRA']} LU (trước chuẩn hóa {L0['I']} LUFS / {L0['TP']} dBTP, hệ số chung {G_db:+.2f} dB)")
    print(f"  nén đỉnh stem SFX: {limiter_info}")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(ANIMATIC), "-i", str(A / "mix_no_vo.wav"),
                    "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy", "-c:a", "aac", "-b:a", "320k", "-ar", "48000",
                    "-movflags", "+faststart", "-shortest", str(OUT_MP4)], check=True)
    print(f"Đã ghép: {OUT_MP4.relative_to(ROOT)}")


if __name__ == "__main__":
    main()
