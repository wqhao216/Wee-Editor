"""Quét OCR TỪNG KHUNG của work/hai_clean.mp4 trong các đoạn QA (mục 6.5),
ghi qa/ocr_allframes.txt: giây | loại cờ | box dòng chữ (pixel gốc).
Không ghi chữ OCR đọc được.

Chạy: python3 -I scripts/phan3/scan_all_frames.py
"""
from __future__ import annotations

import sys
from multiprocessing import Pool
from pathlib import Path

import cv2

sys.path.insert(0, str(Path(__file__).parent))
from common import CLEAN_VIDEO, QA, frame_index, frame_time  # noqa: E402
from locate_flags import lines_with_boxes  # noqa: E402
from privacy_qa import SEGMENTS, detect, load_blocklist  # noqa: E402

BATCH = 64


def _work(args):
    i, img, bl = args
    hits = []
    for ln in lines_with_boxes(img):
        f = detect(" ".join(ln["text"]), bl)
        if f:
            hits.append((ln["box"], f))
    return i, hits


def main():
    bl = load_blocklist()
    want = set()
    for a, b in SEGMENTS:
        want.update(range(frame_index(a), frame_index(b) + 1))
    last = max(want)
    out_lines = []
    cap = cv2.VideoCapture(str(CLEAN_VIDEO))
    batch, i, done = [], 0, 0
    with Pool() as pool:
        def flush():
            nonlocal batch, done
            for fi, hits in sorted(pool.map(_work, batch)):
                for box, f in hits:
                    out_lines.append(f"{frame_time(fi):8.3f} | {','.join(f)} | {box}")
            done += len(batch)
            batch = []
            print(f"  {done}/{len(want)} khung", flush=True)
        while i <= last:
            ok, frame = cap.read()
            if not ok:
                break
            if i in want:
                batch.append((i, frame, bl))
                if len(batch) >= BATCH:
                    flush()
            i += 1
        if batch:
            flush()
    cap.release()
    QA.mkdir(exist_ok=True)
    header = ["OCR TỪNG KHUNG · work/hai_clean.mp4 · chỉ giây, loại cờ, box (không ghi nội dung)",
              f"Khung quét: {len(want)}", ""]
    (QA / "ocr_allframes.txt").write_text("\n".join(header + out_lines) + "\n", encoding="utf-8")
    print(f"Xong. {len(out_lines)} dòng cờ -> qa/ocr_allframes.txt")


if __name__ == "__main__":
    main()
