"""Đo lại dy của các khối che M2, M4, M5, M6 (mục 6.4 của plan).

Với mỗi khung trong khoảng của khối: cv2.matchTemplate (TM_CCOEFF_NORMED)
mẫu nhãn bên trái trên dải x của nhãn ± 20px, dy = y_tìm_được - y_mẫu.
Độ tin < 0.8 thì giữ dy khung trước.

Đầu ra: work/dy_measured.json (chỉ số liệu: khung, giây, dy kế hoạch,
dy đo, độ tin). Không lưu ảnh hay chữ nào của video.

Chạy: python3 -I scripts/phan3/measure_dy.py
"""
from __future__ import annotations

import json
import sys

import cv2
import numpy as np

sys.path.insert(0, str(__import__("pathlib").Path(__file__).parent))
from common import (DY_FILE, DY_TEMPLATES, H, MATCH_MIN_SCORE, RAW_VIDEO,  # noqa: E402
                    SEARCH_X_MARGIN, WORK, frame_index, frame_time, load_cues,
                    plan_dy)


def second_peak(res: np.ndarray, best_y: int, exclude: int = 8) -> float:
    col = res.max(axis=1)
    lo, hi = max(0, best_y - exclude), min(len(col), best_y + exclude + 1)
    col = col.copy()
    col[lo:hi] = -1
    return float(col.max()) if len(col) else -1.0


def main() -> None:
    cues = load_cues()
    masks = {m["id"]: m for m in cues["masks"]}
    blocks = {k: masks[k] for k in DY_TEMPLATES}

    ref_frames = {frame_index(v["ref"]): k for k, v in DY_TEMPLATES.items()}
    first = min(frame_index(m["src_from"]) for m in blocks.values())
    last = max(frame_index(m["src_to"]) for m in blocks.values())

    cap = cv2.VideoCapture(str(RAW_VIDEO))
    templates: dict[str, np.ndarray] = {}
    grays: dict[int, np.ndarray] = {}
    # Lượt 1: lấy mẫu ở khung tham chiếu, và giữ ảnh xám các khung cần đo.
    i = 0
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        if i in ref_frames:
            k = ref_frames[i]
            x1, y1, x2, y2 = DY_TEMPLATES[k]["box"]
            templates[k] = cv2.cvtColor(frame[y1:y2, x1:x2], cv2.COLOR_BGR2GRAY)
        if first <= i <= last:
            t = frame_time(i)
            if any(m["src_from"] <= t < m["src_to"] for m in blocks.values()):
                grays[i] = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        i += 1
    cap.release()
    total_frames = i

    out = {"total_frames": total_frames, "blocks": {}}
    for k, m in blocks.items():
        x1, y1, x2, y2 = DY_TEMPLATES[k]["box"]
        sx1 = max(0, x1 - SEARCH_X_MARGIN)
        sx2 = x2 + SEARCH_X_MARGIN
        tpl = templates[k]
        rows = []
        prev = plan_dy(m, m["src_from"])
        f0, f1 = frame_index(m["src_from"]), frame_index(m["src_to"])
        for fi in range(f0, f1 + 1):
            t = frame_time(fi)
            if not (m["src_from"] <= t < m["src_to"]) or fi not in grays:
                continue
            strip = grays[fi][0:H, sx1:sx2]
            res = cv2.matchTemplate(strip, tpl, cv2.TM_CCOEFF_NORMED)
            _, score, _, loc = cv2.minMaxLoc(res)
            found_y = loc[1]
            dy_raw = found_y - y1
            confident = score >= MATCH_MIN_SCORE
            if confident:
                prev = dy_raw
            rows.append({
                "f": fi, "t": round(t, 4),
                "plan": plan_dy(m, t),
                "meas": prev, "raw": dy_raw,
                "score": round(float(score), 4),
                "second": round(second_peak(res, found_y), 4),
                "confident": confident,
            })
        out["blocks"][k] = rows
        n_conf = sum(r["confident"] for r in rows)
        print(f"{k}: {len(rows)} khung, {n_conf} khung đủ độ tin")

    WORK.mkdir(exist_ok=True)
    DY_FILE.write_text(json.dumps(out), encoding="utf-8")
    print(f"Đã ghi {DY_FILE.relative_to(DY_FILE.parents[1])}")


if __name__ == "__main__":
    main()
