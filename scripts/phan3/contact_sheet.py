"""qa/contact_sheet.png: mỗi 2 giây một khung của bản render (plan mục 10).

Chạy: python3 -I scripts/phan3/contact_sheet.py out/phan3_v2_animatic.mp4
"""
from __future__ import annotations

import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from common import QA, ROOT  # noqa: E402

STEP_S, COLS, TW, TH = 2.0, 10, 384, 216


def main() -> None:
    video = ROOT / (sys.argv[1] if len(sys.argv) > 1 else "out/phan3_v2_animatic.mp4")
    cap = cv2.VideoCapture(str(video))
    fps = cap.get(cv2.CAP_PROP_FPS)
    n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
    want = {int(round(k * STEP_S * fps)) for k in range(int(n / fps / STEP_S) + 1)}
    tiles, i = [], 0
    while True:
        ok, f = cap.read()
        if not ok:
            break
        if i in want:
            t = i / fps
            tile = cv2.resize(f, (TW, TH), interpolation=cv2.INTER_AREA)
            label = f"{int(t // 60)}:{t % 60:04.1f}"
            cv2.rectangle(tile, (0, 0), (78, 24), (23, 23, 23), -1)
            cv2.putText(tile, label, (6, 18), cv2.FONT_HERSHEY_SIMPLEX, 0.55, (255, 255, 255), 1, cv2.LINE_AA)
            tiles.append(cv2.copyMakeBorder(tile, 3, 3, 3, 3, cv2.BORDER_CONSTANT, value=(255, 255, 255)))
        i += 1
    rows = []
    for r in range(0, len(tiles), COLS):
        row = tiles[r:r + COLS]
        row += [np.full_like(tiles[0], 255)] * (COLS - len(row))
        rows.append(np.hstack(row))
    QA.mkdir(exist_ok=True)
    cv2.imwrite(str(QA / "contact_sheet.png"), np.vstack(rows))
    print(f"{len(tiles)} khung ({n} khung, {n / fps:.2f}s) -> qa/contact_sheet.png")


if __name__ == "__main__":
    main()
