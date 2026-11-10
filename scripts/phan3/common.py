"""Shared helpers for Phần 3 build scripts (Bước A: làm sạch video gốc).

Mọi tọa độ theo pixel video gốc 1972x1080, dạng [x1, y1, x2, y2].
Thời gian: khung thứ i ứng với giây i / FPS (video gốc CFR 30 fps, start 0).
"""
from __future__ import annotations

import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
DOCS = ROOT / "docs" / "phan3"
INPUT = ROOT / "input"
WORK = ROOT / "work"
QA = ROOT / "qa"

RAW_VIDEO = INPUT / "hai_raw.mp4"
CLEAN_VIDEO = WORK / "hai_clean.mp4"
DY_FILE = WORK / "dy_measured.json"

W, H, FPS = 1972, 1080, 30

# Mục 6.4: mẫu nhãn bên trái, đo ở khung tham chiếu.
DY_TEMPLATES = {
    "M2": {"ref": 44.5, "box": [658, 566, 800, 586]},
    "M4": {"ref": 211.4, "box": [653, 474, 703, 494]},
    "M5": {"ref": 278.8, "box": [668, 624, 800, 642]},
    "M6": {"ref": 298.6, "box": [655, 594, 705, 612]},
}
MATCH_MIN_SCORE = 0.8   # 6.4.3: độ tin < 0.8 thì giữ dy khung trước
DY_TOLERANCE = 6        # 6.4.3: lệch > 6px thì dùng số đo mới
SEARCH_X_MARGIN = 20    # 6.4.2: dải x của nhãn ± 20px


def load_cues() -> dict:
    return json.loads((DOCS / "cues.json").read_text(encoding="utf-8"))


def frame_time(i: int) -> float:
    return i / FPS


def frame_index(t: float) -> int:
    return int(round(t * FPS))


def in_range(t: float, a: float, b: float) -> bool:
    """Khoảng nửa mở [a, b) để hai khoảng liền nhau không chồng khung."""
    return a <= t < b


def plan_dy(mask: dict, t: float) -> int | None:
    for step in mask["dy_steps"]:
        if in_range(t, step["src_from"], step["src_to"]):
            return int(step["dy"])
    return None


def shift_box(box, dy):
    x1, y1, x2, y2 = box
    return [x1, max(0, min(H, y1 + dy)), x2, max(0, min(H, y2 + dy))]
