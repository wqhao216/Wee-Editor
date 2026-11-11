"""Ghép giọng đọc (một file đọc liền nhiều câu) vào video Phần 3: tách từng câu, đặt đúng mốc, trộn âm.

Chạy lại khi đổi file giọng:
  python3 -I scripts/place_vo.py --vo input/vo/phan3_vo_v4.mp3 --cutmap input/vo/vo_cutmap.json \
      --video input/video/phan3_v2_1.mp4 [--mode stems|track]

Các phần:
  A. Giải mã giọng -> WAV 48 kHz mono, silencedetect (-38 dB, 0.12s).
  B. Xác minh điểm cắt: điểm cắt phải nằm trong khoảng lặng; mép tiếng nói = cuối khoảng lặng trước từ đầu,
     đầu khoảng lặng sau từ cuối; đo tốc độ đọc từng câu để bắt câu bị cắt nhầm ranh giới. (Chưa có ASR:
     faster-whisper chưa cài; xem --whisper.)
  C. Tách clip work/vo_clips/NN.wav (PCM 48 kHz mono 24-bit): đệm 60ms trước, tối đa 150ms sau, không lấn câu
     kề; fade 10/30ms; chuẩn hóa từng clip về cùng loudness (mặc định -16 LUFS). Bản nghe thử: qa/cut_check/.
  D. Đặt lên timeline theo place_at; quá window thì lần lượt: 3.1 cắt đệm cuối (giữ ≥ 40ms) → 3.2 dời sớm
     ≤ 0.3s (không trước khi cảnh bắt đầu, cách câu trước ≥ gap) → 3.3 atempo ≤ 1.05 → 3.4 cần freeze
     (script dừng và báo, vì freeze phải render lại hình) → 3.5 báo câu cần render lại giọng.
     Kiểm 3 vùng cấm bằng RMS.
  E. Trộn: --mode stems (mặc định khi có audio/music_bed.wav + audio/sfx_events.json): dựng lại nhạc từ bed
     chưa hạ, hạ duck_db theo vị trí thật của các câu, SFX giữ nguyên. --mode track: hạ cả track audio của
     video (đúng nguyên văn prompt). Không hạ trong các vùng --no-duck. Đo ebur128 + astats.
  F. Xuất out/phan3_v3_voiced.mp4 (-c:v copy, AAC 192k), out/phan3_vo_track.wav, out/phan3_vo_v4.srt,
     qa/vo_placement.csv, qa/frames/NN.png, qa/vo_report.txt.
"""
from __future__ import annotations

import argparse
import csv
import json
import re
import subprocess
import sys
import unicodedata
from pathlib import Path

import numpy as np

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT / "scripts" / "phan3"))
from audio_lib import SR, db, gain_curve, loudness, n_of, read_wav24, write_wav24  # noqa: E402

VOICE_CEIL = -2.0  # dBFS đỉnh mẫu của giọng sau limiter (chừa chỗ cho true peak ≤ -1 và cho nền khi trộn)

report: list[str] = []


def say(s: str = "") -> None:
    report.append(s)
    print(s)


def run(cmd: list[str]) -> str:
    r = subprocess.run(cmd, capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit(f"lỗi: {' '.join(cmd[:6])}…\n{r.stderr[-800:]}")
    return r.stderr


def fmt(t: float) -> str:
    return f"{int(t // 60)}:{t % 60:06.3f}"


# ============================================================ A. giải mã + khoảng lặng
def decode(vo: Path, work: Path) -> np.ndarray:
    wav = work / "vo_full_48k.wav"
    run(["ffmpeg", "-v", "error", "-y", "-i", str(vo), "-ac", "1", "-ar", str(SR), "-c:a", "pcm_s24le", str(wav)])
    return read_wav24(wav)[:, 0]


def silences(work: Path, noise_db: float, min_d: float) -> list[tuple[float, float]]:
    err = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(work / "vo_full_48k.wav"), "-af",
               f"silencedetect=noise={noise_db}dB:d={min_d}", "-f", "null", "-"])
    st = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", err)]
    en = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", err)]
    out = [(0.0, en[0])] if st and st[0] > 0.01 and en and en[0] < st[0] else []
    out += list(zip(st, en + [1e9] * (len(st) - len(en))))
    return sorted(out)


def syllables(text: str) -> int:
    n = 0
    for w in re.findall(r"[\wÀ-ỹ]+", unicodedata.normalize("NFC", text)):
        n += 3 if w.lower() == "vneid" else 1  # plan 5: "VNeID" tính 3 tiếng
    return n


# ============================================================ B. xác minh điểm cắt
def refine(lines, sil, total):
    def containing(t):
        return next(((a, b) for a, b in sil if a - 0.005 <= t <= b + 0.005), None)

    rows = []
    for i, l in enumerate(lines):
        s, e = l["src_start"], l["src_end"]
        cs, ce = containing(s), containing(e)
        onset = cs[1] if cs else s
        offset = ce[0] if ce else e
        if s <= 0.001 and not cs:  # câu đầu bắt đầu ngay đầu file
            onset = 0.0
        inner = sum(max(0.0, min(b, offset) - max(a, onset)) for a, b in sil if b > onset and a < offset)
        speak = max(offset - onset - inner, 1e-3)
        rows.append({**l, "in_silence": (cs is not None or s <= 0.001, ce is not None), "onset": onset, "offset": offset,
                     "speech": offset - onset, "rate": syllables(l["text"]) / speak, "syl": syllables(l["text"]),
                     "dev_start": onset - s, "dev_end": offset - e})
    rates = np.array([r["rate"] for r in rows])
    med = float(np.median(rates))
    for r in rows:
        r["rate_flag"] = abs(r["rate"] - med) / med > 0.30
    return rows, med


# ============================================================ C. tách clip
def cut_clips(audio, rows, args, clips_dir: Path, check_dir: Path):
    total = len(audio) / SR
    for i, r in enumerate(rows):
        prev_off = rows[i - 1]["offset"] if i else 0.0
        next_on = rows[i + 1]["onset"] if i + 1 < len(rows) else total
        a = max(r["onset"] - args.pre_pad, prev_off + 0.03, 0.0)
        b = min(r["offset"] + args.post_pad, next_on - 0.03, total)
        r["clip_src"] = (a, b)
        r["head"] = r["onset"] - a  # đệm trước thật
        r["tail"] = b - r["offset"]  # đệm sau thật
    tmp = clips_dir / "_tmp.wav"
    for r in rows:
        a, b = r["clip_src"]
        x = audio[n_of(a):n_of(b)].copy()
        fi, fo = n_of(0.010), n_of(0.030)
        x[:fi] *= np.sin(np.linspace(0, np.pi / 2, fi)) ** 2
        x[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
        # Chuẩn hóa về voice_lufs rồi limiter đỉnh (lookahead 5ms, nhả 60ms) ở VOICE_CEIL; lặp để bù loudness
        # mà limiter làm giảm. Giọng ElevenLabs có PLR 15–21 dB nên không limiter thì không thể vừa -16 LUFS vừa ≤ -1 dBTP.
        y = x / max(np.abs(x).max(), 1e-9) * 0.5
        total = 1.0
        red = np.zeros(len(y))
        for _ in range(4):
            write_wav24(tmp, np.clip(y * total, -0.999, 0.999)[:, None] / max(1.0, np.abs(y * total).max() / 0.999))
            L = loudness(tmp)
            scale = max(1.0, np.abs(y * total).max() / 0.999)
            total *= db(args.voice_lufs - (L["I"] + 20 * np.log10(scale)))
            z = y * total
            a_ = np.abs(z)
            need = np.where(a_ > db(VOICE_CEIL), db(VOICE_CEIL) / np.maximum(a_, 1e-12), 1.0)
            gc = gain_curve(need, hold_ms=5, release_s=0.06)
            out = z * gc
            write_wav24(tmp, out[:, None])
            if abs(loudness(tmp)["I"] - args.voice_lufs) <= 0.15:
                break
            total *= db(args.voice_lufs - loudness(tmp)["I"])
        red = -20 * np.log10(np.maximum(gc, 1e-12))
        r["limit_max_db"] = round(float(red.max()), 1)
        r["limit_ms_over3"] = int((red > 3).sum() / SR * 1000)
        r["norm_gain_db"] = round(20 * np.log10(total * 0.5 / max(np.abs(x).max(), 1e-9)), 2)
        r["tp_capped"] = False
        x, g = out, 1.0
        r["clip"] = x * g
        write_wav24(clips_dir / f"{r['id']}.wav", r["clip"][:, None])
        write_wav24(check_dir / f"{r['id']}.wav", r["clip"][:, None])
    tmp.unlink(missing_ok=True)


# ============================================================ D. đặt lên timeline
def atempo(x: np.ndarray, factor: float, work: Path) -> np.ndarray:
    a, b = work / "_at_in.wav", work / "_at_out.wav"
    write_wav24(a, x[:, None])
    run(["ffmpeg", "-v", "error", "-y", "-i", str(a), "-af", f"atempo={factor:.5f}", "-c:a", "pcm_s24le", "-ar", str(SR), str(b)])
    y = read_wav24(b)[:, 0]
    a.unlink(missing_ok=True)
    b.unlink(missing_ok=True)
    return y


def place(rows, scenes, args, work):
    prev_speech_end = 0.0
    for i, r in enumerate(rows):
        r.update({"start": r["place_at"] - r["head"], "atempo": 1.0, "shift": 0.0, "freeze": 0.0, "steps": []})
        # place_at = mốc từ đầu tiên (đệm trước nằm trước mốc)
        x = r["clip"]
        window = r["window"]
        speech_from_place = lambda: len(x) / SR - r["head"]  # noqa: E731  thời lượng từ place_at tới hết clip
        if speech_from_place() > window:
            # 3.1 cắt đệm cuối, giữ ≥ 40ms
            need = speech_from_place() - window
            can = max(0.0, r["tail"] - 0.040)
            cut = min(need, can)
            if cut > 0:
                x = x[: len(x) - n_of(cut)]
                fo = n_of(0.030)
                x[-fo:] *= np.cos(np.linspace(0, np.pi / 2, fo)) ** 2
                r["tail"] -= cut
                r["steps"].append(f"3.1 cắt đệm cuối {cut * 1000:.0f}ms")
        if speech_from_place() > window:
            # 3.2 dời sớm ≤ 0.3s: không trước khi cảnh bắt đầu, cách câu trước ≥ gap
            need = speech_from_place() - window
            scene_start = scenes.get(r["scene"], 0.0)
            room = min(args.max_shift, r["place_at"] - max(scene_start, prev_speech_end + args.gap))
            sh = min(need, max(0.0, room))
            if sh > 0:
                r["shift"] = -sh
                r["start"] -= sh
                window += sh
                r["steps"].append(f"3.2 dời sớm {sh * 1000:.0f}ms")
        if speech_from_place() > window:
            # 3.3 atempo ≤ 1.05
            f = speech_from_place() / window
            if f <= args.max_atempo + 1e-9:
                x = atempo(x, f, work)
                r["head"] /= f
                r["tail"] /= f
                r["atempo"] = round(f, 4)
                r["steps"].append(f"3.3 atempo {f:.3f}")
        if speech_from_place() > window + 1e-3:
            r["steps"].append(f"3.4 CẦN FREEZE {speech_from_place() - window:.2f}s (hoặc 3.5 render lại giọng)")
        r["clip_placed"] = x
        r["start"] = round(r["start"], 4)
        r["speech_start"] = r["start"] + r["head"]
        r["speech_end"] = r["start"] + len(x) / SR - r["tail"]
        r["end"] = r["start"] + len(x) / SR
        prev_speech_end = r["speech_end"]
    for i, r in enumerate(rows):
        nxt = rows[i + 1]["speech_start"] if i + 1 < len(rows) else None  # mốc bắt đầu nói của câu sau
        r["gap_next"] = (nxt - r["end"]) if nxt is not None else None
        r["status"] = ("CẦN XỬ LÝ" if any("3.4" in s for s in r["steps"]) or (r["gap_next"] is not None and r["gap_next"] < args.gap - 1e-3)
                       else ("ĐÃ CHỈNH" if r["steps"] else "OK"))
    return rows


# ============================================================ E. trộn
def duck_env(rows, n, args):
    ctrl = 1000
    tc = np.arange(int(n / SR * ctrl) + 1) / ctrl
    active = np.zeros_like(tc, dtype=bool)
    ranges = []
    for r in rows:
        a, b = r["speech_start"] - args.attack, r["speech_end"]
        if ranges and a - ranges[-1][1] < args.attack + args.release:
            ranges[-1][1] = b
        else:
            ranges.append([a, b])
    for a, b in ranges:
        active |= (tc >= a) & (tc < b)
    for a, b in args.no_duck:
        active &= ~((tc >= a) & (tc < b))
    want = np.where(active, -args.duck_db, 0.0)
    g = np.zeros_like(want)
    dn, up = args.duck_db / (args.attack * ctrl), args.duck_db / (args.release * ctrl)
    for i in range(1, len(want)):
        g[i] = max(want[i], g[i - 1] - dn) if want[i] < g[i - 1] else min(want[i], g[i - 1] + up)
    return np.interp(np.arange(n) / SR, tc, 10 ** (g / 20)), ranges


def mix(rows, args, work, n):
    voice = np.zeros(n)
    for r in rows:
        s = n_of(r["start"])
        x = r["clip_placed"]
        voice[s:s + len(x)] += x[: max(0, n - s)]
    # chỉnh nhẹ cả track giọng về đúng voice_lufs (các clip đã ~ mức này; đo lại trên toàn track)
    tv = work / "_voice_check.wav"
    write_wav24(tv, voice[:, None])
    Lv = loudness(tv)
    trim = min(args.voice_lufs - Lv["I"], (args.max_tp - 0.2) - Lv["TP"])
    voice = voice * db(trim)
    env, ranges = duck_env(rows, n, args)
    if args.mode == "stems":
        sys.path.insert(0, str(ROOT / "scripts" / "phan3"))
        import mix_audio as M
        bed = read_wav24(ROOT / "audio" / "music_bed.wav")[:n]
        ev = json.loads((ROOT / "audio" / "sfx_events.json").read_text(encoding="utf-8"))["events"]
        # mức tham chiếu 0 dB = mức giọng (BUILD_NOTES 4A: bed -14 LUFS = 0 dB); giọng ở voice_lufs nên dời cả cảnh
        shift = args.voice_lufs - (-14.0)
        music = bed * db(args.music_db + shift) * env[:, None]
        sfx = M.place_sfx(ev, n) * db(shift)
        back = music + sfx
    else:
        src = work / "_track.wav"
        run(["ffmpeg", "-v", "error", "-y", "-i", str(args.video), "-vn", "-ac", "2", "-ar", str(SR), "-c:a", "pcm_s24le", str(src)])
        back = read_wav24(src)[:n] * env[:, None]
        music = sfx = None
    # giọng mono đặt vào giữa: -3 dB mỗi kênh (pan công suất bằng nhau) để loudness của giọng trong mix stereo
    # bằng loudness của track giọng mono (BS.1770 cộng năng lượng 2 kênh)
    voice_st = voice * db(-3.01)
    full = back + voice_st[:, None]
    lim_db = 0.0
    ceil = args.max_tp - 0.5  # đỉnh mẫu của mix; giọng đã ≤ VOICE_CEIL nên luôn còn chỗ cho nền
    if np.abs(full).max() > db(ceil):
        a_v = np.abs(voice_st)
        a_b = np.abs(back).max(axis=1)
        over = np.abs(full).max(axis=1) > db(ceil)
        need = np.ones(n)
        need[over] = np.clip((db(ceil) - a_v[over]) / np.maximum(a_b[over], 1e-9), 0.05, 1)
        rr = gain_curve(need, hold_ms=6, release_s=0.08)
        back = back * rr[:, None]
        lim_db = float(-20 * np.log10(max(rr.min(), 1e-9)))
        full = back + voice_st[:, None]
    return voice, back, full, ranges, lim_db


# ============================================================ F. xuất
BREAK_BEFORE = {"thì", "nên", "cũng", "mà", "và", "vì", "để", "khi", "nếu", "còn", "rồi", "là", "dù", "với", "ở", "cho"}


def _split_long(clause: str, mx: int) -> list[str]:
    """Vế dài hơn mx: ngắt ở khoảng trắng; ưu tiên ngắt TRƯỚC hư từ (thì, nên, cũng…) để không chẻ từ ghép."""
    if len(clause) <= mx:
        return [clause]
    sp = [i for i, c in enumerate(clause) if c == " " and len(clause[:i]) <= mx and len(clause[i + 1:]) <= mx] or \
         [i for i, c in enumerate(clause) if c == " "]

    def cost(i):
        nxt = clause[i + 1:].split(" ", 1)[0].lower()
        return abs(i - len(clause) / 2) - (14 if nxt in BREAK_BEFORE else 0)
    i = min(sp, key=cost)
    return _split_long(clause[:i], mx) + _split_long(clause[i + 1:], mx)


def to_pages(text: str, mx: int = 42) -> list[list[str]]:
    """Phụ đề: ngắt ở dấu phẩy/dấu câu trước; mỗi dòng ≤ mx ký tự, mỗi cue ≤ 2 dòng. Không đổi chữ."""
    if len(text) <= mx:
        return [[text]]
    clauses = [c for c in re.split(r"(?<=[,.:;?!])\s+", text) if c]
    pieces = [p for c in clauses for p in _split_long(c, mx)]
    lines: list[str] = []
    for p in pieces:
        if lines and len(lines[-1]) + 1 + len(p) <= mx:
            lines[-1] = lines[-1] + " " + p
        else:
            lines.append(p)
    # cân hai dòng khi cả câu vừa 2 dòng nhưng ngắt dồn lệch: thử ngắt ở dấu phẩy cân nhất
    if len(lines) == 2:
        return [lines]
    return [lines[i:i + 2] for i in range(0, len(lines), 2)]


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms % 3600000 // 60000:02d}:{ms % 60000 // 1000:02d},{ms % 1000:03d}"


def write_srt(rows, path: Path):
    k, out = 1, []
    for i, r in enumerate(rows):
        pages = to_pages(r["text"])
        a = r["speech_start"]
        b = r["speech_end"] + 0.15
        if i + 1 < len(rows):
            b = min(b, rows[i + 1]["speech_start"] - 0.05)
        tot = sum(len(" ".join(p)) for p in pages)
        t = a
        for p in pages:
            d = (b - a) * len(" ".join(p)) / tot
            out.append(f"{k}\n{srt_time(t)} --> {srt_time(t + d)}\n" + "\n".join(p) + "\n")
            k += 1
            t += d
    path.write_text("\n".join(out), encoding="utf-8")
    return k - 1


def frames(rows, video: Path, qa: Path):
    from PIL import Image, ImageDraw, ImageFont
    fdir = qa / "frames"
    fdir.mkdir(parents=True, exist_ok=True)
    font = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf", 30)
    small = ImageFont.truetype("/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf", 26)
    for r in rows:
        png = fdir / f"{r['id']}.png"
        run(["ffmpeg", "-v", "error", "-y", "-ss", f"{r['speech_start']:.3f}", "-i", str(video), "-frames:v", "1", str(png)])
        im = Image.open(png).convert("RGB")
        d = ImageDraw.Draw(im, "RGBA")
        lines = [f"Câu {r['id']} · {r['scene']} · {fmt(r['speech_start'])}"] + [" ".join(p) for p in to_pages(r["text"], 60)]
        h = 20 + 44 * len(lines)
        d.rectangle([20, 20, 1300, 20 + h], fill=(17, 17, 17, 215))
        for j, ln in enumerate(lines):
            d.text((40, 32 + 44 * j), ln, font=font if j == 0 else small, fill=(255, 225, 77) if j == 0 else (255, 255, 255))
        im.save(png)


def rms_db(x, a, b):
    seg = x[n_of(max(a, 0)):n_of(b)]
    return 20 * np.log10(max(np.sqrt(np.mean(seg ** 2)) if len(seg) else 0, 1e-12))


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--vo", default="input/vo/phan3_vo_v4.mp3")
    ap.add_argument("--cutmap", default="input/vo/vo_cutmap.json")
    ap.add_argument("--video", default="input/video/phan3_v2_1.mp4")
    ap.add_argument("--mode", choices=["stems", "track"], default=None)
    ap.add_argument("--voice-lufs", type=float, default=-16.0)
    ap.add_argument("--max-tp", type=float, default=-1.0)
    ap.add_argument("--music-db", type=float, default=-16.0, help="mức nhạc khi không lời, so với mức giọng (plan 4.2)")
    ap.add_argument("--duck-db", type=float, default=7.0)
    ap.add_argument("--attack", type=float, default=0.050)
    ap.add_argument("--release", type=float, default=0.300)
    ap.add_argument("--pre-pad", type=float, default=0.060)
    ap.add_argument("--post-pad", type=float, default=0.150)
    ap.add_argument("--gap", type=float, default=0.2)
    ap.add_argument("--max-shift", type=float, default=0.3)
    ap.add_argument("--max-atempo", type=float, default=1.05)
    ap.add_argument("--silence-db", type=float, default=-38)
    ap.add_argument("--silence-min", type=float, default=0.12)
    ap.add_argument("--out", default="out/phan3_v3_voiced.mp4")
    args = ap.parse_args()
    args.video = ROOT / args.video
    args.no_duck = [(146.8, 149.0), (166.5, 170.0)]
    forbidden = [(0.0, 0.5, "trước 0.5s"), (147.3, 148.3, "error_buzz 147.3–148.3"), (167.0, 170.0, "cảnh R 167–170")]
    if args.mode is None:
        args.mode = "stems" if (ROOT / "audio/music_bed.wav").exists() and (ROOT / "audio/sfx_events.json").exists() else "track"
    work, qa, outd = ROOT / "work", ROOT / "qa", ROOT / "out"
    clips_dir, check_dir = work / "vo_clips", qa / "cut_check"
    for d in (work / "vo", clips_dir, check_dir, qa, outd):
        d.mkdir(parents=True, exist_ok=True)
    cut = json.loads((ROOT / args.cutmap).read_text(encoding="utf-8"))
    lines = cut["lines"]
    vid_dur = float(json.loads(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "json", str(args.video)],
                                              capture_output=True, text=True).stdout)["format"]["duration"])
    cues = ROOT / "work" / "timeline_cues.json"
    scenes = {s["id"]: s["start"] for s in json.loads(cues.read_text(encoding="utf-8"))["scenes"]} if cues.exists() else {}

    say(f"GHÉP GIỌNG · {Path(args.vo).name} → {Path(args.out).name}  (chế độ trộn: {args.mode})")
    audio = decode(ROOT / args.vo, work / "vo")
    say(f"A. giọng {len(audio) / SR:.2f}s, {len(lines)} câu; video {vid_dur:.3f}s")
    sil = silences(work / "vo", args.silence_db, args.silence_min)
    rows, med = refine(lines, sil, len(audio) / SR)
    say(f"B. xác minh điểm cắt (chưa có ASR: faster-whisper chưa cài)")
    bad_sil = [r["id"] for r in rows if not all(r["in_silence"])]
    say(f"   điểm cắt nằm trong khoảng lặng: {2 * len(rows) - sum(not a for r in rows for a in r['in_silence'])}/{2 * len(rows)}"
        + (f"; KHÔNG: {', '.join(bad_sil)}" if bad_sil else ""))
    say(f"   tốc độ đọc trung vị {med:.2f} âm tiết/giây; câu lệch > 30% (nghi cắt nhầm ranh giới): "
        + (", ".join(f"{r['id']} ({r['rate']:.2f})" for r in rows if r["rate_flag"]) or "không có"))
    cut_clips(audio, rows, args, clips_dir, check_dir)
    say(f"C. 37 clip → work/vo_clips/, bản nghe thử → qa/cut_check/; chuẩn hóa {args.voice_lufs} LUFS/clip, limiter đỉnh {VOICE_CEIL} dBFS")
    lim = sorted(rows, key=lambda r: -r["limit_max_db"])
    say(f"   nén đỉnh giọng: tối đa {lim[0]['limit_max_db']} dB (câu {lim[0]['id']}); trung vị {np.median([r['limit_max_db'] for r in rows]):.1f} dB; "
        f"thời gian bị nén > 3 dB: {sum(r['limit_ms_over3'] for r in rows)} ms trên toàn bộ 37 câu")
    say("   nén nhiều nhất: " + ", ".join(f"{r['id']} {r['limit_max_db']} dB/{r['limit_ms_over3']}ms" for r in lim[:5]))
    rows = place(rows, scenes, args, work / "vo")
    n = n_of(vid_dur)
    voice, back, full, ranges, lim_db = mix(rows, args, work / "vo", n)
    say("D. đặt câu:")
    for step in ("3.1", "3.2", "3.3", "3.4"):
        ids = [r["id"] for r in rows if any(s.startswith(step) or step in s for s in r["steps"])]
        say(f"   bước {step}: {len(ids)} câu{(': ' + ', '.join(ids)) if ids else ''}")
    need = [r for r in rows if r["status"] == "CẦN XỬ LÝ"]
    if need:
        say("   DỪNG: các câu sau không vừa khung, cần freeze hoặc render lại giọng: " + ", ".join(r["id"] for r in need))
    for a, b, lab in forbidden:
        v = rms_db(voice, a, b)
        say(f"   vùng cấm {lab}: RMS giọng {v:.1f} dBFS → {'SẠCH' if v < -70 else 'CÓ GIỌNG'}")

    # ---- xuất audio + video
    vt = outd / "phan3_vo_track.wav"
    write_wav24(vt, voice[:, None])
    mixw = work / "vo" / "mix_voiced.wav"
    write_wav24(mixw, full)
    run(["ffmpeg", "-v", "error", "-y", "-i", str(args.video), "-i", str(mixw), "-map", "0:v:0", "-map", "1:a:0", "-c:v", "copy",
         "-c:a", "aac", "-b:a", "192k", "-ar", str(SR), "-movflags", "+faststart", "-shortest", str(ROOT / args.out)])
    Lv, Lm = loudness(vt), loudness(mixw)
    say(f"E. giọng: I {Lv['I']} LUFS, TP {Lv['TP']} dBTP; mix: I {Lm['I']} LUFS, TP {Lm['TP']} dBTP, LRA {Lm['LRA']} LU"
        + (f"; nén đỉnh phần nền tối đa {lim_db:.1f} dB" if lim_db else ""))
    st = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(vt), "-af", "astats=metadata=0:reset=0", "-f", "null", "-"])
    pk = re.findall(r"Peak level dB: (-?[\d.inf]+)", st)
    clip_n = re.findall(r"Number of (?:clipped )?samples? (?:clipped)?: ?(\d+)", st)
    flat = re.findall(r"Flat factor: ([\d.]+)", st)
    say(f"   astats giọng: đỉnh {pk[-1] if pk else '?'} dBFS, flat factor {flat[-1] if flat else '?'} (0 = không bị cắt ngọn)")
    eb = run(["ffmpeg", "-hide_banner", "-nostats", "-i", str(mixw), "-af", "ebur128=peak=true", "-f", "null", "-"])
    m = re.search(r"Integrated loudness:\s+I:\s+(-?[\d.]+) LUFS.*?True peak:\s+Peak:\s+(-?[\d.]+) dBFS", eb, re.S)
    if m:
        say(f"   ebur128 mix: I {m.group(1)} LUFS, true peak {m.group(2)} dBFS")
    say(f"   ducking: {len(ranges)} khoảng, -{args.duck_db} dB, attack {args.attack * 1000:.0f}ms, release {args.release * 1000:.0f}ms; "
        f"không hạ {args.no_duck}")
    nsrt = write_srt(rows, outd / "phan3_vo_v4.srt")
    with open(qa / "vo_placement.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.writer(f)
        w.writerow(["id", "scene", "place_at", "start_thật", "end_thật", "dur", "window", "atempo", "shift", "freeze_thêm", "gap_tới_câu_sau",
                    "trạng_thái", "ghi_chú", "nén_đỉnh_tối_đa_dB"])
        for r in rows:
            w.writerow([r["id"], r["scene"], r["place_at"], f"{r['speech_start']:.3f}", f"{r['speech_end']:.3f}",
                        f"{r['speech_end'] - r['speech_start']:.3f}", r["window"], r["atempo"], f"{r['shift']:.3f}", f"{r['freeze']:.2f}",
                        "" if r["gap_next"] is None else f"{r['gap_next']:.3f}", r["status"], "; ".join(r["steps"]), r["limit_max_db"]])
    frames(rows, ROOT / args.out, qa)
    say(f"F. {args.out}, out/phan3_vo_track.wav, out/phan3_vo_v4.srt ({nsrt} khối), qa/vo_placement.csv, qa/frames/ (37 ảnh)")
    (qa / "vo_report.txt").write_text("\n".join(report) + "\n", encoding="utf-8")
    json.dump([{k: v for k, v in r.items() if k not in ("clip", "clip_placed")} for r in rows],
              open(work / "vo" / "placement.json", "w"), ensure_ascii=False, indent=1, default=str)


if __name__ == "__main__":
    main()
