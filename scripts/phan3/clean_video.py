"""Bước A (mục 6): làm sạch video gốc -> work/hai_clean.mp4.

- Che M0–M6 theo cues.json["masks"]: box ở khung tham chiếu, dịch dọc dy.
  dy lấy theo bảng của plan; khung nào số đo (work/dy_measured.json, mục 6.4)
  lệch > 6px so với plan thì dùng số đo.
- Chừa lỗ H4 (cues.json["mask_holes"]).
- Che: pixelate mosaic 18px + lớp #F3F6FA độ mờ 0.35.
- Đoạn cấm (cues.json["forbidden_src"]) không bao giờ được dùng: che kín
  cả khung (không cắt) để timeline giữ nguyên độ dài. Tắt bằng
  --no-forbidden-cover.
- Bỏ track âm thanh. Giữ 1972x1080, 30 fps, đủ số khung.

Chạy: python3 -I scripts/phan3/clean_video.py
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from common import (CLEAN_VIDEO, DY_FILE, DY_TOLERANCE, FPS, H, RAW_VIDEO,  # noqa: E402
                    W, WORK, frame_time, in_range, load_cues, plan_dy,
                    shift_box)

# Nới thời gian che so với cues.json khi QA thấy khung lộ (mục 6.5:
# "có một khung lộ là nới box, chạy lại"). Mỗi dòng phải có trong BUILD_NOTES.
# Nới src_to thì bước dy cuối cùng cũng được kéo dài tới cùng mốc.
MASK_END_OVERRIDES = {
    # 237.500 và 237.533 (khung 7125–7126) vẫn là trang chủ hộ, lộ họ tên;
    # trang đổi ở 237.567. Không ảnh hưởng EDL (B6 phát từ 237.6).
    "M4": 237.6,
}

MOSAIC = 18
TINT_BGR = np.array([0xFA, 0xF6, 0xF3], dtype=np.float32)  # #F3F6FA
TINT_ALPHA = 0.35


def pixelate(img: np.ndarray, box) -> None:
    x1, y1, x2, y2 = (int(v) for v in box)
    x1, x2 = max(0, x1), min(W, x2)
    y1, y2 = max(0, y1), min(H, y2)
    if x2 - x1 < 1 or y2 - y1 < 1:
        return
    roi = img[y1:y2, x1:x2]
    h, w = roi.shape[:2]
    small = cv2.resize(roi, (max(1, -(-w // MOSAIC)), max(1, -(-h // MOSAIC))),
                       interpolation=cv2.INTER_AREA)
    mos = cv2.resize(small, (small.shape[1] * MOSAIC, small.shape[0] * MOSAIC),
                     interpolation=cv2.INTER_NEAREST)[:h, :w]
    out = mos.astype(np.float32) * (1 - TINT_ALPHA) + TINT_BGR * TINT_ALPHA
    img[y1:y2, x1:x2] = np.clip(out + 0.5, 0, 255).astype(np.uint8)


def build_dy_lookup() -> dict[str, dict[int, int]]:
    """Khung -> dy dùng thật, cho các khối có số đo."""
    data = json.loads(DY_FILE.read_text(encoding="utf-8"))
    lookup: dict[str, dict[int, int]] = {}
    for k, rows in data["blocks"].items():
        lookup[k] = {}
        for r in rows:
            use = r["meas"] if abs(r["meas"] - r["plan"]) > DY_TOLERANCE else r["plan"]
            lookup[k][r["f"]] = use
    return lookup


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--no-forbidden-cover", action="store_true",
                    help="không che kín cả khung trong đoạn cấm")
    ap.add_argument("--crf", type=int, default=14)
    args = ap.parse_args()

    cues = load_cues()
    masks = cues["masks"]
    for m in masks:
        new_end = MASK_END_OVERRIDES.get(m["id"])
        if new_end is not None and new_end > m["src_to"]:
            last = max(m["dy_steps"], key=lambda s: s["src_to"])
            if last["src_to"] == m["src_to"]:
                last["src_to"] = new_end
            m["src_to"] = new_end
            print(f"  nới {m['id']} tới {new_end}s (MASK_END_OVERRIDES)")
    holes = cues["mask_holes"]
    forbidden = [] if args.no_forbidden_cover else cues["forbidden_src"]
    dy_lookup = build_dy_lookup()

    WORK.mkdir(exist_ok=True)
    tmp = CLEAN_VIDEO.with_suffix(".tmp.mp4")
    enc = subprocess.Popen([
        "ffmpeg", "-v", "error", "-y",
        "-f", "rawvideo", "-pix_fmt", "bgr24", "-s", f"{W}x{H}", "-r", str(FPS),
        "-i", "-",
        "-an", "-c:v", "libx264", "-preset", "medium", "-crf", str(args.crf),
        "-pix_fmt", "yuv420p", "-g", "15", "-movflags", "+faststart",
        str(tmp),
    ], stdin=subprocess.PIPE)

    cap = cv2.VideoCapture(str(RAW_VIDEO))
    i = 0
    stats = {"masked": 0, "forbidden": 0, "hole": 0}
    while True:
        ok, frame = cap.read()
        if not ok:
            break
        assert frame.shape[:2] == (H, W), "kích thước video gốc khác 1972x1080"
        t = frame_time(i)

        if any(in_range(t, f["src_from"], f["src_to"]) for f in forbidden):
            pixelate(frame, [0, 0, W, H])
            stats["forbidden"] += 1
        else:
            orig = frame.copy()
            any_mask = False
            for m in masks:
                if not in_range(t, m["src_from"], m["src_to"]):
                    continue
                dy = dy_lookup.get(m["id"], {}).get(i)
                if dy is None:
                    dy = plan_dy(m, t)
                if dy is None:
                    dy = 0
                pixelate(frame, shift_box(m["box_src_at_ref"], dy))
                any_mask = True
            for hole in holes:
                if in_range(t, hole["src_from"], hole["src_to"]):
                    x1, y1, x2, y2 = hole["box_src"]
                    frame[y1:y2, x1:x2] = orig[y1:y2, x1:x2]
                    stats["hole"] += 1
            stats["masked"] += any_mask

        enc.stdin.write(frame.tobytes())
        i += 1
        if i % 1500 == 0:
            print(f"  {i} khung ({t:.0f}s)", flush=True)

    cap.release()
    enc.stdin.close()
    if enc.wait() != 0:
        raise SystemExit("ffmpeg lỗi khi mã hóa")
    tmp.replace(CLEAN_VIDEO)
    print(f"Xong {i} khung -> {CLEAN_VIDEO.relative_to(CLEAN_VIDEO.parents[1])}")
    print(f"  khung có vùng che: {stats['masked']}, khung đoạn cấm che kín: "
          f"{stats['forbidden']}, khung có lỗ H4: {stats['hole']}")


if __name__ == "__main__":
    main()
