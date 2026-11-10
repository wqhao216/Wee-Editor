"""OCR bản render (plan mục 10): tesseract vie+eng mỗi 3 khung, gắn cờ khi gặp chuỗi 10 số bắt đầu
bằng 0, chuỗi 12 số, ký tự @, ngày dd/mm/yyyy có năm trước 2015, hoặc dòng của blocklist.txt
(khớp gần đúng, bỏ dấu). Ngày 30/11/2026 hợp lệ (năm ≥ 2015 nên không bị gắn cờ).

Ghi: qa/ocr_animatic_report.txt (tổng hợp) và qa/ocr_animatic_frames.txt (từng khung):
CHỈ giây, loại cờ, box dòng chữ. Không ghi chữ OCR đọc được, không in blocklist.

Chạy: python3 -I scripts/phan3/ocr_render.py out/phan3_v2_animatic.mp4
"""
from __future__ import annotations

import sys
from collections import defaultdict
from multiprocessing import Pool
from pathlib import Path

import cv2

sys.path.insert(0, str(Path(__file__).parent))
from common import QA, ROOT  # noqa: E402
from locate_flags import lines_with_boxes  # noqa: E402
from privacy_qa import detect, load_blocklist  # noqa: E402

EVERY = 3
BATCH = 48


def _work(args):
    i, img, bl = args
    hits = []
    for ln in lines_with_boxes(img):
        f = detect(" ".join(ln["text"]), bl)
        if f:
            hits.append((ln["box"], f))
    return i, hits


def main() -> None:
    video = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "out/phan3_v2_animatic.mp4")
    bl = load_blocklist()
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS)
    results: dict[int, list] = {}
    batch, i, scanned = [], 0, 0
    with Pool() as pool:
        def flush():
            nonlocal batch
            for fi, hits in pool.map(_work, batch):
                results[fi] = hits
            batch = []
        while True:
            ok, f = cap.read()
            if not ok:
                break
            if i % EVERY == 0:
                batch.append((i, f, bl))
                scanned += 1
                if len(batch) >= BATCH:
                    flush()
                    print(f"  {scanned} khung", flush=True)
            i += 1
        if batch:
            flush()

    per_type: dict[str, list[float]] = defaultdict(list)
    lines = []
    for fi in sorted(results):
        for box, flags in results[fi]:
            lines.append(f"{fi / fps:8.3f} | {','.join(flags)} | {box}")
            for fl in flags:
                per_type[fl].append(fi / fps)

    def ranges(ts: list[float]) -> str:
        ts = sorted(set(round(t, 3) for t in ts))
        out, a, b = [], ts[0], ts[0]
        for t in ts[1:]:
            if t - b <= EVERY / fps + 1e-6:
                b = t
            else:
                out.append((a, b))
                a = b = t
        out.append((a, b))
        return ", ".join(f"{x:.1f}" if x == y else f"{x:.1f}–{y:.1f}" for x, y in out)

    flagged = sorted({round(fi / fps, 3) for fi, h in results.items() if h})
    rep = [
        "OCR BẢN RENDER · Phần 3 · " + video.name,
        "Chỉ ghi GIÂY RA, LOẠI CỜ, box. Không ghi nội dung dò được.",
        f"Khung quét: {scanned} (mỗi {EVERY} khung / {i} khung, {i / fps:.2f}s); tesseract vie+eng psm 11, phóng 2×",
        f"Blocklist: {'có, ' + str(len(bl)) + ' mẫu' if bl else 'CHƯA CÓ'}",
        f"Khung có cờ: {len(flagged)}",
        "",
        "Theo loại cờ (số khung | đoạn giây ra):",
    ]
    for k in sorted(per_type):
        rep.append(f"  {k}: {len(set(per_type[k]))} khung | {ranges(per_type[k])}")
    if not per_type:
        rep.append("  (không có)")
    QA.mkdir(exist_ok=True)
    (QA / "ocr_animatic_report.txt").write_text("\n".join(rep) + "\n", encoding="utf-8")
    (QA / "ocr_animatic_frames.txt").write_text("giây ra | loại cờ | box dòng chữ (px)\n" + "\n".join(lines) + "\n", encoding="utf-8")
    print("\n".join(rep))


if __name__ == "__main__":
    main()
