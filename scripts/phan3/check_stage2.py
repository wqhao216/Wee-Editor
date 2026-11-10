"""Tự kiểm chặng 2 (hệ thống thiết kế) trên các ảnh tĩnh đã render.

Đầu vào: qa/style/qa_probe.json, qa/style/check/qa_probe.json (do render_stills.mjs ghi,
gồm hình chữ nhật thật của từng phần tử), work/test/strings.json (mọi chuỗi chữ trên màn).
Đầu ra: qa/style/check_report.txt

A. Chữ: mọi chuỗi trên màn có nguyên văn trong plan / cues.json / srt; dạng NFC; không thừa khoảng trắng.
B. Glyph: ký tự nào không có trong Be Vietnam Pro.
C. Bố cục: khối chữ trái nằm trong x 96–720; dòng hỏi/trả lời 1 dòng; sub ≤ 2 dòng; phụ đề ≤ 2 dòng,
   ≤ 1400px; nhãn khung trong khung hình, không đè pill/phụ đề/nhau; ≤ 2 khung cùng lúc, mỗi khung ≥ 2s.
D. Khung khoanh đúng chỗ: so phần ảnh trong khung trên ảnh render với đúng vùng box_src của khung gốc
   (template matching), báo độ lệch theo pixel màn hình và pixel gốc.
E. OCR (tesseract vie) các dòng chữ đã render, so với chữ gốc để bắt lỗi dấu.

Chạy: python3 -I scripts/phan3/check_stage2.py
"""
from __future__ import annotations

import json
import os
import re
import subprocess
import sys
import unicodedata
from difflib import SequenceMatcher
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from common import CLEAN_VIDEO, DOCS, QA, ROOT  # noqa: E402

PLAN = next(DOCS.glob("MASTER_VIDEO_PLAN*.md"))
OUT = QA / "style" / "check_report.txt"
lines_out: list[str] = []


def say(s: str = "") -> None:
    lines_out.append(s)
    print(s)


def nfc(s: str) -> str:
    return unicodedata.normalize("NFC", s)


def hit(a, b) -> bool:
    return a["x1"] < b["x2"] and b["x1"] < a["x2"] and a["y1"] < b["y2"] and b["y1"] < a["y2"]


# ------------------------------------------------------------------ A. chữ
def check_strings() -> int:
    say("A. CHỮ TRÊN MÀN HÌNH so với nguồn")
    plan = nfc(PLAN.read_text(encoding="utf-8")).replace("==", "").replace("**", "")
    cues = json.loads((DOCS / "cues.json").read_text(encoding="utf-8"))
    srt = nfc((DOCS / "phan3_vo_draft.srt").read_text(encoding="utf-8"))
    labels = {c["label"] for c in cues["callouts"]}
    strings = json.loads((ROOT / "work/test/strings.json").read_text(encoding="utf-8"))
    bad = 0
    for s in strings:
        k, t = s["kind"], s["text"]
        problems = []
        if t != nfc(t):
            problems.append("không ở dạng NFC")
        if "  " in t or t != t.strip():
            problems.append("thừa khoảng trắng")
        if k == "callout":
            if t not in labels:
                problems.append("không có trong cues.json")
        elif k == "vo":
            if t not in srt:
                problems.append("không có trong srt")
        elif k == "subtitle-line":
            pass  # đã kiểm ở timeline_test: ghép các dòng = nguyên câu lời đọc
        elif t not in plan:
            problems.append("không có nguyên văn trong plan")
        if problems:
            bad += 1
            say(f"   LỖI [{k}] “{t}”: {', '.join(problems)}")
    say(f"   {len(strings)} chuỗi, {bad} lỗi")
    return bad


# ------------------------------------------------------------------ B. glyph
def check_glyph(probes) -> int:
    say("B. GLYPH (Be Vietnam Pro)")
    g = next(p["glyph"] for p in probes if p.get("glyph"))
    say(f"   {g['chars']} ký tự khác nhau; font nạp đủ 4 độ đậm: {all(g['fontsCheck'])}; chuỗi không NFC: {len(g['nonNFC'])}")
    replaced = {"→", "✓"}
    bad = 0
    for c, ws in sorted(g["missing"].items()):
        tag = "vẽ bằng SVG, OK" if c in replaced else "LỖI: rơi sang font khác"
        bad += c not in replaced
        say(f"   thiếu “{c}” (U+{ord(c):04X}) ở độ đậm {','.join(ws)} → {tag}")
    if not g["missing"]:
        say("   không thiếu ký tự nào")
    return bad


# ------------------------------------------------------------------ C. bố cục
def check_layout(probes) -> int:
    say("C. BỐ CỤC")
    bad = 0
    seen = set()
    for p in probes:
        items = p["qa"]["items"]
        by = lambda q: [i for i in items if i["qa"] == q and i["opacity"] > 0.01]  # noqa: E731
        hl = [i for i in items if i["qa"] == "headline" and i["opacity"] > 0.5]
        for i in (by("headline-q") + by("headline-a") + by("headline-sub")) if hl else []:
            r = i["textRect"]
            key = (i["qa"], i["text"])
            if r is None or key in seen:
                continue
            seen.add(key)
            msgs = []
            if r["x1"] < 96 - 0.5 or r["x2"] > 720 + 0.5:
                msgs.append(f"tràn khối 96–720 (x {r['x1']:.0f}–{r['x2']:.0f})")
            if i["qa"] == "headline-sub":
                if r["x2"] > 96 + 600 + 0.5:
                    msgs.append(f"sub rộng hơn 600px (x2 {r['x2']:.0f})")
                if i["textLines"] > 2:
                    msgs.append(f"sub {i['textLines']} dòng")
            elif i["textLines"] != 1:
                msgs.append(f"{i['textLines']} dòng")
            size = f", {i['size']}px" if i["size"] else ""
            state = "LỖI " + "; ".join(msgs) if msgs else "OK"
            bad += bool(msgs)
            say(f"   {i['qa']:13s} x {r['x1']:4.0f}–{r['x2']:4.0f}{size:7s} {i['textLines']} dòng  {state}  “{i['text']}”")
        for i in by("subtitle"):
            r = i["rect"]
            if i["textLines"] > 2 or r["x2"] - r["x1"] > 1400:
                bad += 1
                say(f"   LỖI phụ đề t={p['t']}: {i['textLines']} dòng, rộng {r['x2']-r['x1']:.0f}px")
        pill = next((i["rect"] for i in by("pill")), None)
        sub = next((i["rect"] for i in by("subtitle")), None)
        labs = by("callout-label")
        for a in labs:
            r = a["rect"]
            msgs = []
            if r["x1"] < 0 or r["x2"] > 1920 or r["y1"] < 0 or r["y2"] > 1080:
                msgs.append("ra ngoài khung hình")
            if pill and hit(r, pill):
                msgs.append("đè pill")
            if sub and hit(r, sub):
                msgs.append("đè phụ đề")
            if any(b is not a and hit(r, b["rect"]) for b in labs):
                msgs.append("đè nhãn khác")
            if a["side"] == "inside":
                msgs.append("không còn chỗ, đặt trong box")
            if msgs:
                bad += 1
                say(f"   LỖI nhãn t={p['t']} “{a['text']}”: {', '.join(msgs)}")
        for ch in by("chip"):
            covers = [b["text"] for b in by("callout-box") + labs if hit(ch["rect"], b["rect"])]
            if covers:
                bad += 1
                say(f"   LỖI chip t={p['t']} “{ch['text']}” che khung khoanh: {', '.join(covers)}")
    cues = json.loads((DOCS / "cues.json").read_text(encoding="utf-8"))["callouts"]
    short = [c for c in cues if c["t_out"] - c["t_in"] < 2 - 1e-6]
    for c in short:
        say(f"   LỖI khung “{c['label']}” chỉ đứng {c['t_out']-c['t_in']:.1f}s (< 2s)")
    worst = 0
    for k in range(0, 1700):
        t = k / 10
        worst = max(worst, sum(c["t_in"] <= t <= c["t_out"] for c in cues))
    say(f"   khung khoanh: {len(cues)}, ngắn hơn 2s: {len(short)}, nhiều nhất cùng lúc: {worst}")
    return bad + len(short) + (worst > 2)


# ------------------------------------------------------------------ D. khung khoanh đúng chỗ
def source_frames(nums: set[int]) -> dict[int, np.ndarray]:
    cap = cv2.VideoCapture(str(CLEAN_VIDEO))
    out, i, last = {}, 0, max(nums)
    while i <= last:
        ok, f = cap.read()
        if not ok:
            break
        if i in nums:
            out[i] = f
        i += 1
    return out


def check_alignment(probes) -> int:
    say("D. KHUNG KHOANH ĐÚNG CHỖ (so ảnh render với vùng box_src của khung gốc)")
    jobs = []
    for p in probes:
        items = p["qa"]["items"]
        cards = [i for i in items if i["qa"] == "card"]
        for b in (i for i in items if i["qa"] == "callout-box"):
            r = b["rect"]
            card = next((c for c in cards if c["rect"]["x1"] - 1 <= r["x1"] and r["x2"] <= c["rect"]["x2"] + 1), None)
            if card:
                jobs.append((p, b, card))
    frames = source_frames({c["srcFrame"] for _, _, c in jobs})
    done, bad = set(), 0
    for p, b, card in jobs:
        key = b["text"]
        if key in done:
            continue
        done.add(key)
        img = cv2.imread(str(ROOT / p["file"]))
        r = b["rect"]
        x1, y1, x2, y2 = (int(round(v)) for v in (r["x1"], r["y1"], r["x2"], r["y2"]))
        sx1, sy1, sx2, sy2 = b["src"]
        src = frames[card["srcFrame"]][sy1:sy2, sx1:sx2]
        w, h = x2 - x1, y2 - y1
        tpl_full = cv2.resize(src, (w, h), interpolation=cv2.INTER_AREA if w < src.shape[1] else cv2.INTER_CUBIC)
        m = max(3, min(10, w // 6, h // 6))
        tpl = cv2.cvtColor(tpl_full[m:h - m, m:w - m], cv2.COLOR_BGR2GRAY)
        region = cv2.cvtColor(img[y1:y2, x1:x2], cv2.COLOR_BGR2GRAY)
        res = cv2.matchTemplate(region, tpl, cv2.TM_CCOEFF_NORMED)
        _, score, _, loc = cv2.minMaxLoc(res)
        dx, dy = loc[0] - m, loc[1] - m
        scale = card["view"]["k"]
        flat = float(tpl.std()) < 4
        ok = (score >= 0.8 and abs(dx) <= 2 and abs(dy) <= 2) or flat
        bad += not ok
        note = " (vùng gần như trơn, khó đo)" if flat else ""
        say(f"   {'OK ' if ok else 'LỆCH'} t={p['t']:6.1f} khớp {score:.3f}  lệch ({dx:+d},{dy:+d})px màn = ({dx/scale:+.1f},{dy/scale:+.1f})px gốc  zoom {scale:.2f}  “{key}”{note}")
    say(f"   {len(done)} khung khoanh đã đo, {bad} lệch")
    return bad


# ------------------------------------------------------------------ E. OCR
def ocr(img: np.ndarray, psm: int) -> str:
    png = cv2.imencode(".png", img)[1].tobytes()
    r = subprocess.run(["tesseract", "stdin", "stdout", "-l", "vie", "--psm", str(psm)], input=png, capture_output=True,
                       env={**os.environ, "OMP_THREAD_LIMIT": "1"}, timeout=60)
    return nfc(" ".join(r.stdout.decode("utf-8", "replace").split()))


def norm_words(s: str) -> list[str]:
    return [w for w in re.sub(r"[^\w\s/=×]", " ", nfc(s)).split() if w]


def check_ocr(probes) -> int:
    say("E. OCR DẤU TIẾNG VIỆT (tesseract vie trên chữ đã render)")
    kinds = {"headline-q": 7, "headline-a": 7, "headline-sub": 6, "chapter-line": 7, "chapter-sub": 7,
             "subtitle-line": 7, "callout-label": 7, "chip": 7, "bigcard": 7, "flow-node": 6}
    done, flagged, n = set(), 0, 0
    tiles: list[np.ndarray] = []
    for p in probes:
        img = None
        headline_shown = any(i["qa"] == "headline" and i["opacity"] >= 0.99 for i in p["qa"]["items"])
        for i in p["qa"]["items"]:
            if i["qa"] not in kinds or not i["text"] or i["opacity"] < 0.99 or i["textRect"] is None:
                continue
            if i["qa"].startswith("headline") and not headline_shown:
                continue  # khối chữ đang ẩn (punchIn): vùng đó là video
            key = (i["qa"], i["text"])
            if key in done:
                continue
            if img is None:
                img = cv2.imread(str(ROOT / p["file"]))
            r = i["rect"] if i["qa"] in ("callout-label", "chip", "bigcard", "flow-node") else i["textRect"]
            x1, y1 = max(0, int(r["x1"]) - 8), max(0, int(r["y1"]) - 8)
            x2, y2 = min(1920, int(r["x2"]) + 8), min(1080, int(r["y2"]) + 8)
            crop = cv2.cvtColor(img[y1:y2, x1:x2], cv2.COLOR_BGR2GRAY)
            if i["qa"] in ("callout-label", "bigcard") or (i["qa"] == "flow-node" and crop.mean() < 128):
                crop = 255 - crop  # chữ trắng trên nền màu → đảo cho tesseract
            crop = cv2.resize(crop, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
            exp = i["text"].replace("→", "").replace("✓", "")
            got = ocr(crop, kinds[i["qa"]])
            done.add(key)
            n += 1
            ew, gw = norm_words(exp.lower()), norm_words(got.lower())
            miss = [w for w in ew if w not in gw]
            ratio = SequenceMatcher(None, " ".join(ew), " ".join(gw)).ratio()
            if miss:
                flagged += 1
                say(f"   ? {ratio:.2f} [{i['qa']}] “{i['text']}”  → OCR đọc: “{got}”  (chữ không khớp: {' '.join(miss)})")
                tile = img[y1:y2, x1:x2]
                k = min(1.0, 1200 / tile.shape[1])
                tiles.append(cv2.resize(tile, None, fx=k, fy=k, interpolation=cv2.INTER_AREA))
    say(f"   {n} dòng chữ đã OCR, {flagged} dòng OCR đọc lệch (cần xem bằng mắt)")
    if tiles:
        wmax = max(t.shape[1] for t in tiles)
        sheet = np.vstack([cv2.copyMakeBorder(t, 6, 6, 6, wmax - t.shape[1] + 6, cv2.BORDER_CONSTANT, value=(255, 255, 255)) for t in tiles])
        cv2.imwrite(str(QA / "style" / "check" / "ocr_flagged.png"), sheet)
        say("   ảnh các dòng bị OCR đọc lệch: qa/style/check/ocr_flagged.png")
    return flagged


def main() -> None:
    probes = []
    for f in (QA / "style" / "qa_probe.json", QA / "style" / "check" / "qa_probe.json"):
        probes += json.loads(f.read_text(encoding="utf-8"))
    say("TỰ KIỂM CHẶNG 2 · Phần 3 · " + ", ".join(sorted({p['file'].split('/')[-2] for p in probes})))
    say()
    res = {"A": check_strings()}
    say()
    res["B"] = check_glyph(probes)
    say()
    res["C"] = check_layout(probes)
    say()
    res["D"] = check_alignment(probes)
    say()
    res["E"] = check_ocr(probes)
    say()
    say("TÓM TẮT: " + ", ".join(f"{k}={v}" for k, v in res.items()) + " (số mục cần xem)")
    OUT.write_text("\n".join(lines_out) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
