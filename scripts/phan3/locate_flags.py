"""Chẩn đoán cờ OCR: in VỊ TRÍ (box pixel gốc) của dòng chữ gây cờ, không in chữ.

Chạy: python3 -I scripts/phan3/locate_flags.py 45.0 237.5 251.5
      python3 -I scripts/phan3/locate_flags.py --raw 237.5   (khung video gốc)
"""
from __future__ import annotations

import argparse
import os
import subprocess
import sys
from pathlib import Path

import cv2

sys.path.insert(0, str(Path(__file__).parent))
from common import CLEAN_VIDEO, RAW_VIDEO  # noqa: E402
from privacy_qa import detect, grab, load_blocklist  # noqa: E402


def lines_with_boxes(img):
    g = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
    g = cv2.resize(g, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    png = cv2.imencode(".png", g)[1].tobytes()
    r = subprocess.run(["tesseract", "stdin", "stdout", "-l", "vie+eng", "--psm", "11", "tsv"],
                       input=png, capture_output=True, timeout=120,
                       env={**os.environ, "OMP_THREAD_LIMIT": "1"})
    lines: dict[tuple, dict] = {}
    for row in r.stdout.decode("utf-8", "replace").splitlines()[1:]:
        c = row.split("\t")
        if len(c) < 12 or not c[11].strip():
            continue
        key = (c[2], c[3], c[4])
        x, y, w, h = (int(v) // 2 for v in c[6:10])
        ln = lines.setdefault(key, {"text": [], "box": [x, y, x + w, y + h]})
        ln["text"].append(c[11])
        b = ln["box"]
        ln["box"] = [min(b[0], x), min(b[1], y), max(b[2], x + w), max(b[3], y + h)]
    return list(lines.values())


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("times", type=float, nargs="+")
    ap.add_argument("--raw", action="store_true")
    a = ap.parse_args()
    bl = load_blocklist()
    frames = grab(RAW_VIDEO if a.raw else CLEAN_VIDEO, a.times)
    for t in sorted(frames):
        hits = []
        for ln in lines_with_boxes(frames[t]):
            f = detect(" ".join(ln["text"]), bl)
            if f:
                hits.append((ln["box"], f))
        print(f"{t:7.2f}s: " + ("; ".join(f"{','.join(f)} @ {b}" for b, f in hits) or "không có cờ ở mức dòng"))


if __name__ == "__main__":
    main()
