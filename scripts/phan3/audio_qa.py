"""Tự kiểm âm thanh chặng 4A -> qa/audio_report.txt + qa/audio_timeline.png

Chạy: python3 -I scripts/phan3/audio_qa.py
"""
from __future__ import annotations

import json
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from audio_lib import SR, db, loudness, n_of, read_wav24, to_db  # noqa: E402
from common import QA, ROOT  # noqa: E402
import mix_audio as M  # noqa: E402

A = ROOT / "audio"
FRAME = 1 / 30
lines: list[str] = []


def say(s: str = "") -> None:
    lines.append(s)
    print(s)


def fmt(t: float) -> str:
    return f"{int(t // 60)}:{t % 60:06.3f}"


def main() -> None:
    cues = json.loads((ROOT / "work" / "timeline_cues.json").read_text(encoding="utf-8"))
    evj = json.loads((A / "sfx_events.json").read_text(encoding="utf-8"))
    ev, dropped = evj["events"], evj["dropped"]
    dmap = json.loads((A / "stem_ducking_map.json").read_text(encoding="utf-8"))
    music = read_wav24(A / "stem_music.wav")
    sfx = read_wav24(A / "stem_sfx.wav")
    mix = read_wav24(A / "mix_no_vo.wav")
    m = cues["music"]
    n = len(mix)
    say("TỰ KIỂM ÂM THANH · Phần 3 · chặng 4A (chưa có giọng)")
    say(f"Độ dài: nhạc {len(music) / SR:.3f}s, SFX {len(sfx) / SR:.3f}s, mix {n / SR:.3f}s (video 170.000s)")
    say()

    # 1. Sự kiện
    say("1. SỰ KIỆN SFX (audio/sfx_events.json)")
    kinds: dict[str, int] = {}
    for e in ev:
        kinds[e["kind"]] = kinds.get(e["kind"], 0) + 1
    for k, v in sorted(kinds.items(), key=lambda kv: -kv[1]):
        say(f"   {k:16s} {v:3d}   file {next(e['file'] for e in ev if e['kind'] == k)}.wav, "
            f"{next(e['gain_db'] for e in ev if e['kind'] == k)} dB")
    say(f"   tổng {len(ev)} giữ, {len(dropped)} bỏ: " + "; ".join(f"{d['kind']} {fmt(d['t'])} ({d['src']})" for d in dropped))
    shifted = [e for e in ev if "shifted_from" in e]
    say(f"   lùi để tránh trùng: {len(shifted)} — " + "; ".join(f"{e['kind']} {fmt(e['shifted_from'])}→{fmt(e['t'])}" for e in shifted))
    close = []
    srt = sorted(ev, key=lambda e: e["t"])
    for a, b in zip(srt, srt[1:]):
        if b["t"] - a["t"] < 0.040:
            same = "group" in a and a.get("group") == b.get("group")
            close.append((a, b, same))
    bad_close = [c for c in close if not c[2]]
    say(f"   cặp lệch < 40ms: {len(close)} (cố ý, cùng một chuỗi: {len(close) - len(bad_close)}; KHÔNG cố ý: {len(bad_close)})")
    for a, b, _ in bad_close:
        say(f"     LỖI {fmt(a['t'])} {a['kind']} / {fmt(b['t'])} {b['kind']}")
    worst, wt = 0, 0.0
    for k in range(int(170 / 0.01)):
        t = k * 0.01
        g = {e.get("group", id(e)) for e in ev if e["t"] <= t < e["t"] + e["audible_s"]}
        if len(g) > worst:
            worst, wt = len(g), t
    say(f"   nhiều nhất cùng vang: {worst} SFX (tính chuỗi là một), ở {fmt(wt)}  (plan 4.3: tối đa 2)")
    say()

    # 2. Khoảng lặng
    say("2. KHOẢNG LẶNG 0.5s (plan 4.2: cắt nhạc đúng lúc dòng báo lỗi hiện)")
    a, b = n_of(m["errorLine"]), n_of(m["cutEnd"])
    pk = np.abs(music[a:b]).max()
    rms = np.sqrt(np.mean(music[a:b] ** 2))
    before = np.sqrt(np.mean(music[a - n_of(0.5):a - n_of(0.02)] ** 2))
    say(f"   nhạc {fmt(m['errorLine'])}–{fmt(m['cutEnd'])}: đỉnh {to_db(pk):.1f} dBFS, RMS {to_db(rms):.1f} dBFS "
        f"(0.5s ngay trước: RMS {to_db(before):.1f} dBFS) → {'IM HẲN' if pk < 1e-6 else 'CÒN TIẾNG'}")
    say(f"   plan ghi 2:27.7; mốc dùng {fmt(m['errorLine'])} = khung gốc 322.067 có dòng đỏ (chậm 2 khung, đã chốt chặng 3)")
    say(f"   trong khoảng lặng chỉ có error_buzz (SFX): mix đỉnh {to_db(np.abs(mix[a:b]).max()):.1f} dBFS")
    say()

    # 3. Mốc riser / error_buzz / ding_end
    say("3. MỐC riser / error_buzz / ding_end trên stem SFX (dung sai ±1 khung = 33ms)")
    say("   riser mở đầu gần như im (to dần) nên đo bằng tương quan chéo chuẩn hóa toàn mẫu; error_buzz và ding_end có")
    say("   attack rõ nên đo điểm khởi âm (chuông tắt dần theo hàm mũ làm tương quan khớp cả ở độ trễ sai).")
    plan_t = {"riser": 139.6, "error_buzz": 147.7, "ding_end": 167.0}
    for kind in ("riser", "error_buzz", "ding_end"):
        e = next(x for x in ev if x["kind"] == kind)
        ref = read_wav24(A / "sfx" / f"{e['file']}.wav").sum(axis=1)
        w0 = n_of(e["t"] - 0.3)
        seg = sfx[w0:n_of(e["t"] + 0.3) + len(ref)].sum(axis=1)
        # tương quan chéo chuẩn hóa trên TOÀN BỘ mẫu (FFT), để SFX khác vang chồng không kéo lệch
        nfft = 1 << int(np.ceil(np.log2(len(seg) + len(ref))))
        c = np.fft.irfft(np.fft.rfft(seg, nfft) * np.conj(np.fft.rfft(ref, nfft)), nfft)[: len(seg) - len(ref) + 1]
        e2 = np.convolve(seg ** 2, np.ones(len(ref)), mode="valid")
        ncc = c / np.sqrt(np.maximum(e2, 1e-20) * np.sum(ref ** 2))
        lag = int(np.argmax(ncc))
        found = (w0 + lag) / SR
        # điểm khởi âm: mẫu đầu tiên trong cửa sổ vượt -40 dB so với đỉnh của stem trong 0.3s sau mốc
        x = np.abs(sfx[w0:n_of(e["t"] + 0.3)]).max(axis=1)
        thr = x[n_of(0.3) - 1:].max() * db(-40)
        quiet = np.abs(sfx[n_of(e["t"] - 0.3):n_of(e["t"] - 0.005)]).max() < thr
        onset = (w0 + int(np.argmax(x > thr))) / SR if quiet else None
        method = "khởi âm" if kind != "riser" and onset is not None else "tương quan"
        meas = onset if method == "khởi âm" else found
        ok = abs(meas - e["t"]) <= FRAME
        extra = f"tương quan {fmt(found)} (khớp {ncc[lag]:.3f})" + (f", khởi âm {fmt(onset)}" if onset is not None else "")
        say(f"   {'OK ' if ok else 'LỖI'} {kind:10s} đặt {fmt(e['t'])}, đo ({method}) {fmt(meas)}: lệch {(meas - e['t']) * 1000:+.1f} ms; "
            f"so với plan {fmt(plan_t[kind])}: {(meas - plan_t[kind]) * 1000:+.1f} ms   [{extra}]")
    say()

    # 4. Loudness
    say("4. LOUDNESS (ffmpeg loudnorm, EBU R128)")
    for name, f in (("mix (không giọng)", A / "mix_no_vo.wav"), ("stem nhạc", A / "stem_music.wav"), ("stem SFX", A / "stem_sfx.wav"),
                    ("bed nhạc (chưa hạ mức)", A / "music_bed.wav")):
        L = loudness(f)
        say(f"   {name:24s} I {L['I']:6.2f} LUFS   TP {L['TP']:6.2f} dBTP   LRA {L['LRA']:4.1f} LU")
    mp4 = ROOT / "out" / "phan3_v2_animatic_audio.mp4"
    tmp = ROOT / "work" / "mp4_audio.wav"
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(mp4), "-vn", "-c:a", "pcm_s24le", str(tmp)], check=True)
    L = loudness(tmp)
    say(f"   {'track AAC trong mp4':24s} I {L['I']:6.2f} LUFS   TP {L['TP']:6.2f} dBTP   (mục tiêu -16 LUFS, ≤ -1 dBTP)")
    probe = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "stream=codec_type,codec_name,sample_rate,bit_rate,nb_frames:format=duration",
                            "-of", "compact", str(mp4)], capture_output=True, text=True).stdout.strip().replace("\n", " | ")
    say(f"   {probe}")
    lim = dmap.get("sfx_peak_limiter", {})
    say(f"   hệ số chung {dmap['master_gain_db']:+.2f} dB; nén đỉnh stem SFX: trần {lim.get('ceiling_sample_peak_db')} dBFS, "
        f"giảm lớn nhất {lim.get('max_reduction_db')} dB, tổng {lim.get('reduced_ms')} ms")
    say()

    # 5. Ducking
    say("5. DUCKING theo lời đọc (stem_ducking_map.json)")
    tc = np.arange(len(dmap["curve_100hz_db"])) / 100
    curve = np.array(dmap["curve_100hz_db"])
    inside = np.zeros_like(tc, dtype=bool)
    for r in dmap["duck_ranges"]:
        inside |= (tc >= r["full"]) & (tc < r["until"])
    say(f"   {len(dmap['voice_ranges'])} câu → {len(dmap['duck_ranges'])} khoảng hạ (gộp câu cách < {dmap['merge_gap_s']:.2f}s); "
        f"nhạc dưới lời {np.median(curve[inside]):.1f} dB, ngoài lời {np.median(curve[~inside & (tc < m['b8Start'])]):.1f} dB (tham chiếu 0 dB = giọng)")
    say(f"   thời gian nhạc bị hạ: {inside.sum() / 100:.1f}s / 170s")
    say()

    # 6. Nén đỉnh từng sự kiện
    say("6. SFX BỊ NÉN ĐỈNH NHIỀU NHẤT (do chưa có giọng nên cả mix phải nâng mạnh)")
    bed = read_wav24(A / "music_bed.wav")
    gain, _ = M.ducking(cues, len(bed))
    G = db(dmap["master_gain_db"])
    r, _ = M.sfx_limiter(bed * gain[:, None] * G, M.place_sfx(ev, len(bed)) * G, lim["ceiling_sample_peak_db"])
    rows = sorted(((-20 * np.log10(max(r[n_of(e["t"]):n_of(e["t"]) + n_of(e["audible_s"])].min(), 1e-9)), e) for e in ev),
                  key=lambda x: -x[0])
    for red, e in rows[:8]:
        say(f"   {red:4.1f} dB  {fmt(e['t'])}  {e['kind']:16s} {e['src']}")
    say(f"   bị nén > 3 dB: {sum(x[0] > 3 for x in rows)}/{len(rows)}, > 6 dB: {sum(x[0] > 6 for x in rows)}")

    (QA / "audio_report.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")
    draw_timeline(cues, ev, music, sfx, dmap)


def draw_timeline(cues, ev, music, sfx, dmap) -> None:
    W, PX = 3600, 3600 / 170
    rows = {"scene": (40, 70), "vo": (80, 110), "music": (130, 330), "duck": (340, 420), "sfx": (440, 640), "ev": (650, 760)}
    H = 830
    img = np.full((H, W + 120, 3), 255, np.uint8)
    X = lambda t: int(110 + t * PX)  # noqa: E731
    put = lambda s, x, y, c=(40, 40, 40), sc=0.45: cv2.putText(img, s, (x, y), cv2.FONT_HERSHEY_SIMPLEX, sc, c, 1, cv2.LINE_AA)  # noqa: E731
    for name, (y0, _) in rows.items():
        put({"scene": "CANH", "vo": "LOI DOC", "music": "NHAC", "duck": "MUC NHAC dB", "sfx": "SFX", "ev": "SU KIEN"}[name], 6, y0 + 22, sc=0.5)
    for s in range(0, 171, 5):
        x = X(s)
        cv2.line(img, (x, 30), (x, H - 40), (235, 235, 235), 1)
        put(f"{s // 60}:{s % 60:02d}", x - 14, H - 18, sc=0.42)
    pal = [(250, 225, 120), (214, 239, 189), (200, 220, 250), (240, 200, 220)]
    for i, s in enumerate(cues["scenes"]):
        cv2.rectangle(img, (X(s["start"]), 40), (X(s["end"]), 70), pal[i % 4], -1)
        put(s["id"], X(s["start"]) + 4, 61)
        for g in s["segments"]:
            if g["type"] == "freeze":
                cv2.rectangle(img, (X(g["out_in"]), 66), (X(g["out_out"]), 70), (120, 120, 120), -1)
    for v in cues["vo"]:
        cv2.rectangle(img, (X(v["t"]), 84), (X(v["t_end"]), 106), (255, 170, 90), -1)

    def wave(x, y0, y1, col):
        a = np.abs(x).max(axis=1)
        k = len(a) // (W) + 1
        blocks = np.pad(a, (0, k * W - len(a)))[: k * W].reshape(W, k).max(axis=1)
        top = blocks.max() or 1
        mid = (y0 + y1) // 2
        for i, v in enumerate(blocks):
            h = int(v / top * (y1 - y0) / 2)
            cv2.line(img, (110 + i, mid - h), (110 + i, mid + h), col, 1)
    wave(music, *rows["music"], (90, 140, 60))
    wave(sfx, *rows["sfx"], (170, 90, 60))
    curve = np.array(dmap["curve_100hz_db"])
    y0, y1 = rows["duck"]
    yv = lambda d: int(y0 + (-(d) - 14) / (30 - 14) * (y1 - y0))  # noqa: E731  (-14 … -30 dB)
    pts = np.array([[X(i / 100), yv(max(min(d, -14), -30))] for i, d in enumerate(curve)], np.int32)
    cv2.polylines(img, [pts], False, (40, 90, 200), 2)
    for d in (-16, -20, -24):
        cv2.line(img, (110, yv(d)), (110 + W, yv(d)), (220, 220, 220), 1)
        put(f"{d}", 70, yv(d) + 4, sc=0.38)
    colors = {"callout_ok_pop": (40, 160, 60), "callout_ok_tick": (40, 160, 60), "callout_danger": (60, 60, 220), "callout_warn": (20, 150, 240),
              "click": (0, 0, 0), "tua": (150, 150, 150), "text_in": (180, 180, 180), "card_swap": (200, 120, 40), "card_in": (200, 120, 40),
              "card_out": (200, 120, 40), "punch_in": (230, 170, 110), "wipe": (0, 200, 230), "riser": (180, 0, 180), "error_buzz": (0, 0, 255),
              "ding_end": (0, 140, 255), "check_b8": (40, 200, 40), "badge": (120, 90, 200), "chip": (120, 90, 200), "flow_node": (150, 60, 150),
              "flow_line": (150, 60, 150)}
    y0, y1 = rows["ev"]
    for e in ev:
        cv2.line(img, (X(e["t"]), y0), (X(e["t"]), y1), colors.get(e["kind"], (0, 0, 0)), 2)
    mm = cues["music"]
    for t, lab in ((mm["riserStart"], "riser"), (mm["errorLine"], "cat 0.5s + error_buzz"), (mm["lowpassOpen"], "mo low-pass"), (mm["rStart"], "ding_end")):
        cv2.line(img, (X(t), 30), (X(t), H - 40), (0, 0, 220), 1)
        put(lab, X(t) + 3, 128, (0, 0, 200), 0.45)
    cv2.rectangle(img, (X(mm["errorLine"]), rows["music"][0]), (X(mm["cutEnd"]), rows["music"][1]), (0, 0, 255), 2)
    cv2.rectangle(img, (X(mm["cutEnd"]), rows["music"][0] + 4), (X(mm["lowpassOpen"]), rows["music"][0] + 14), (200, 120, 0), -1)
    put("low-pass 1.5k, -20 dB", X(mm["cutEnd"]), rows["music"][0] + 28, (200, 120, 0), 0.42)
    leg = [("ok", (40, 160, 60)), ("danger", (60, 60, 220)), ("warn", (20, 150, 240)), ("click", (0, 0, 0)), ("whoosh", (200, 120, 40)),
           ("tua", (150, 150, 150)), ("tick khoi chu", (180, 180, 180)), ("riser/buzz/ding", (0, 0, 255))]
    x = 110
    for lab, col in leg:
        cv2.rectangle(img, (x, H - 60), (x + 14, H - 48), col, -1)
        put(lab, x + 18, H - 49, sc=0.42)
        x += 150
    cv2.imwrite(str(QA / "audio_timeline.png"), img)
    say("Đã ghi qa/audio_report.txt, qa/audio_timeline.png")


if __name__ == "__main__":
    main()
