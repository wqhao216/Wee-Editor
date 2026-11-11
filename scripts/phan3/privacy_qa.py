"""QA che thông tin (mục 6.5 + quy tắc OCR mục 10) cho work/hai_clean.mp4.

- qa/privacy_sheet.png: khung mỗi 0.5s ở các đoạn 40–100, 200–240, 250–321
  giây gốc (ảnh tổng quan), kèm qa/privacy_detail/*.png (ảnh lớn hơn, để soi).
- OCR (tesseract vie+eng) lên chính các khung đó, gắn cờ:
    sdt-mau    chuỗi 10 số bắt đầu bằng 0
    12-so      chuỗi 12 số
    at         ký tự @
    ngay-sinh  ngày dd/mm/yyyy có năm trước 2015
    blocklist:<loại>  khớp gần đúng (bỏ dấu) một dòng trong input/blocklist.txt
- qa/ocr_hai_clean_report.txt CHỈ ghi giây và loại cờ. Không ghi, không in chữ OCR
  đọc được, không in nội dung blocklist.

Chạy:  python3 -I scripts/phan3/privacy_qa.py
Tự kiểm bộ dò trên video GỐC (chỉ in số cờ, không lưu gì):
       python3 -I scripts/phan3/privacy_qa.py --selftest-raw 212.5 291.2
"""
from __future__ import annotations

import argparse
import os
import re
import subprocess
import sys
import unicodedata
from difflib import SequenceMatcher
from multiprocessing import Pool
from pathlib import Path

import cv2
import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from common import CLEAN_VIDEO, INPUT, QA, RAW_VIDEO, frame_index  # noqa: E402

SEGMENTS = [(40.0, 100.0), (200.0, 240.0), (250.0, 321.0)]
STEP = 0.5
BLOCKLIST = INPUT / "blocklist.txt"
FUZZY = 0.85
ADMIN_PREFIXES = ("thanh pho", "tinh", "phuong", "xa", "quan", "huyen", "tp")

# ---------------------------------------------------------------- dò chữ


def strip_accents(s: str) -> str:
    s = s.lower().replace("đ", "d")
    s = unicodedata.normalize("NFD", s)
    return "".join(c for c in s if not unicodedata.combining(c))


def compact(s: str) -> str:
    return re.sub(r"[^a-z0-9]", "", strip_accents(s))


def load_blocklist() -> list[tuple[str, str]]:
    """[(loại, mẫu đã chuẩn hóa)]. Loại là tên trường (phần trước dấu ':')
    hoặc 'dong-N'. Không bao giờ in phần giá trị."""
    if not BLOCKLIST.exists():
        return []
    entries = []
    for n, line in enumerate(BLOCKLIST.read_text(encoding="utf-8").splitlines(), 1):
        line = line.strip()
        if not line:
            continue
        if ":" in line:
            key, val = line.split(":", 1)
            kind = compact(key) or f"dong-{n}"
        else:
            kind, val = f"dong-{n}", line
        words = strip_accents(val).split()
        while words and any(" ".join(words[:len(p.split())]) == p for p in ADMIN_PREFIXES):
            for p in ADMIN_PREFIXES:
                if " ".join(words[:len(p.split())]) == p:
                    words = words[len(p.split()):]
                    break
        pat = compact(" ".join(words))
        if len(pat) >= 4:
            entries.append((kind, pat))
            alpha_words = [w for w in words if w.isalpha()]
            if len(alpha_words) >= 3 and len(alpha_words) == len(words):
                entries.append((kind + "(mot-phan)", compact(" ".join(words[-2:]))))
    return entries


def fuzzy_in(pat: str, text: str) -> bool:
    if not pat or not text:
        return False
    if pat in text:
        return True
    L = len(pat)
    for wl in (L - 1, L, L + 1):
        if wl < 3 or wl > len(text):
            continue
        for s in range(0, len(text) - wl + 1):
            win = text[s:s + wl]
            sm = SequenceMatcher(None, pat, win, autojunk=False)
            if sm.real_quick_ratio() >= FUZZY and sm.quick_ratio() >= FUZZY \
                    and sm.ratio() >= FUZZY:
                return True
    return False


RE_PHONE = re.compile(r"(?<!\d)0(?:[ .\-]?\d){9}(?![\d])")
RE_12 = re.compile(r"(?<!\d)\d(?:[ .\-]?\d){11}(?!\d)")
RE_DATE = re.compile(r"(?<!\d)(\d{1,2})\s?[/\-.]\s?(\d{1,2})\s?[/\-.]\s?(\d{4})(?!\d)")


def detect(text: str, blocklist) -> list[str]:
    flags = []
    if RE_PHONE.search(text):
        flags.append("sdt-mau")
    if RE_12.search(text):
        flags.append("12-so")
    if "@" in text:
        flags.append("at")
    for d, mth, y in RE_DATE.findall(text):
        if 1 <= int(d) <= 31 and 1 <= int(mth) <= 12 and int(y) < 2015:
            flags.append("ngay-sinh")
            break
    comp = compact(text)
    digits = re.sub(r"\D", "", text)
    for kind, pat in blocklist:
        hay = digits if pat.isdigit() else comp
        if fuzzy_in(pat, hay):
            flags.append(f"blocklist:{kind}")
    return sorted(set(flags))


def ocr(img_bgr: np.ndarray) -> str:
    """Gọi tesseract qua stdin/stdout: không ghi ảnh tạm nào ra đĩa.
    OMP_THREAD_LIMIT=1: nhiều tiến trình song song không tranh luồng."""
    g = cv2.cvtColor(img_bgr, cv2.COLOR_BGR2GRAY)
    g = cv2.resize(g, None, fx=2, fy=2, interpolation=cv2.INTER_CUBIC)
    png = cv2.imencode(".png", g)[1].tobytes()
    r = subprocess.run(["tesseract", "stdin", "stdout", "-l", "vie+eng", "--psm", "11"],
                       input=png, capture_output=True, timeout=120,
                       env={**os.environ, "OMP_THREAD_LIMIT": "1"})
    return r.stdout.decode("utf-8", "replace")


def _work(args):
    t, img, blocklist = args
    return t, detect(ocr(img), blocklist)

# ---------------------------------------------------------------- khung


def wanted_times() -> list[float]:
    ts = []
    for a, b in SEGMENTS:
        n = int(round((b - a) / STEP))
        ts += [round(a + k * STEP, 2) for k in range(n + 1)]
    return ts


def grab(video: Path, times: list[float]) -> dict[float, np.ndarray]:
    want = {frame_index(t): t for t in times}
    last = max(want)
    cap = cv2.VideoCapture(str(video))
    out, i = {}, 0
    while i <= last:
        ok, frame = cap.read()
        if not ok:
            break
        if i in want:
            out[want[i]] = frame
        i += 1
    cap.release()
    return out


def label(img: np.ndarray, text: str, flagged: bool) -> np.ndarray:
    bar = np.full((26, img.shape[1], 3), (40, 40, 200) if flagged else (30, 30, 30), np.uint8)
    cv2.putText(bar, text, (6, 19), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (255, 255, 255), 1, cv2.LINE_AA)
    return np.vstack([bar, img])


def make_sheet(frames, flagged, crop, scale, cols) -> np.ndarray:
    x1, y1, x2, y2 = crop
    tiles = []
    for t in sorted(frames):
        th = cv2.resize(frames[t][y1:y2, x1:x2], None, fx=scale, fy=scale,
                        interpolation=cv2.INTER_AREA)
        tag = f"{t:.1f}s" + ("  CO" if t in flagged else "")
        tiles.append(cv2.copyMakeBorder(label(th, tag, t in flagged), 3, 3, 3, 3,
                                        cv2.BORDER_CONSTANT, value=(255, 255, 255)))
    h, w = tiles[0].shape[:2]
    rows = -(-len(tiles) // cols)
    sheet = np.full((rows * h, cols * w, 3), 255, np.uint8)
    for k, tile in enumerate(tiles):
        r, c = divmod(k, cols)
        sheet[r * h:(r + 1) * h, c * w:(c + 1) * w] = tile
    return sheet

# ---------------------------------------------------------------- main


def run_ocr(frames, blocklist):
    with Pool() as pool:
        return dict(pool.map(_work, [(t, frames[t], blocklist) for t in sorted(frames)]))


def main() -> None:
    ap = argparse.ArgumentParser()
    ap.add_argument("--selftest-raw", type=float, nargs="*",
                    help="chạy bộ dò trên khung video GỐC ở các giây này, chỉ in loại cờ")
    args = ap.parse_args()
    blocklist = load_blocklist()

    if args.selftest_raw:
        frames = grab(RAW_VIDEO, args.selftest_raw)
        for t, flags in sorted(run_ocr(frames, blocklist).items()):
            print(f"[gốc] {t:7.2f}s  {len(flags)} cờ: {', '.join(flags) or '-'}")
        return

    times = wanted_times()
    frames = grab(CLEAN_VIDEO, times)
    missing = [t for t in times if t not in frames]
    if missing:
        raise SystemExit(f"thiếu {len(missing)} khung khi đọc hai_clean.mp4")
    print(f"Đã lấy {len(frames)} khung, chạy OCR...", flush=True)
    results = run_ocr(frames, blocklist)
    flagged = {t for t, f in results.items() if f}

    QA.mkdir(exist_ok=True)
    lines = [
        "OCR REPORT · Phần 3 · Bước A · work/hai_clean.mp4",
        "Chỉ ghi GIÂY GỐC và LOẠI CỜ. Không ghi nội dung dò được.",
        f"Khung quét: {len(frames)} (mỗi {STEP}s; đoạn "
        + ", ".join(f"{a:g}–{b:g}" for a, b in SEGMENTS) + ")",
        "OCR: tesseract vie+eng, psm 11, ảnh xám phóng 2x, toàn khung 1972x1080",
        f"Blocklist: {'có, ' + str(len(blocklist)) + ' mẫu' if blocklist else 'CHƯA CÓ (chỉ dò theo mẫu)'}",
        f"Khung có cờ: {len(flagged)}",
        "",
    ]
    counts: dict[str, int] = {}
    for t in sorted(results):
        for f in results[t]:
            counts[f] = counts.get(f, 0) + 1
    lines.append("Tổng theo loại cờ:")
    lines += [f"  {k}: {v} khung" for k, v in sorted(counts.items())] or ["  (không có)"]
    lines.append("")
    lines.append("Chi tiết (giây gốc | loại cờ):")
    lines += [f"  {t:7.2f} | {', '.join(results[t])}" for t in sorted(flagged)] or ["  (không có)"]
    (QA / "ocr_hai_clean_report.txt").write_text("\n".join(lines) + "\n", encoding="utf-8")

    overview = make_sheet(frames, flagged, (370, 0, 1610, 1080), 0.3, 12)
    cv2.imwrite(str(QA / "privacy_sheet.png"), overview, [cv2.IMWRITE_PNG_COMPRESSION, 9])
    detail_dir = QA / "privacy_detail"
    detail_dir.mkdir(exist_ok=True)
    for old in detail_dir.glob("*.png"):
        old.unlink()
    ts = sorted(frames)
    per = 12
    for p in range(0, len(ts), per):
        chunk = {t: frames[t] for t in ts[p:p + per]}
        page = make_sheet(chunk, flagged, (600, 0, 1620, 1080), 0.6, 4)
        name = f"{ts[p]:06.1f}-{ts[min(p + per, len(ts)) - 1]:06.1f}.png"
        cv2.imwrite(str(detail_dir / name), page)
    print(f"Khung có cờ: {len(flagged)}/{len(frames)}. Đã ghi qa/ocr_hai_clean_report.txt, "
          f"qa/privacy_sheet.png, qa/privacy_detail/")


if __name__ == "__main__":
    main()
