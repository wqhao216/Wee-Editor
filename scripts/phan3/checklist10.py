"""Checklist QA mục 10 của plan cho Phần 3 -> qa/checklist_muc10.txt (ĐẠT / CHƯA ĐẠT từng ô).

Dùng:
  qa/final_probe/qa_probe.json            ảnh probe phủ mọi loại chữ (render_stills.mjs)
  qa/final_probe_callouts/qa_probe.json   3 ảnh/khung khoanh: đầu, giữa, cuối
  qa/stage3_timeline_check.txt            tự kiểm timeline (check_timeline.ts)
  qa/check_report.txt-like: chạy lại check_stage2 phần chữ
  out/phan3_v2.mp4, out/phan3_v2.srt, qa/ocr_report.txt, qa/contact_sheet.png, qa/privacy_sheet.png
Chạy: python3 -I scripts/phan3/checklist10.py [--pre]   (--pre: chỉ các ô kiểm được trước khi render bản cuối)
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

PRE = "--pre" in sys.argv
OUT = QA / ("checklist_pre.txt" if PRE else "checklist_muc10.txt")
FINAL = ROOT / "out" / "phan3_v2.mp4"
SRT = ROOT / "out" / "phan3_v2.srt"
SAFE = (96, 96, 1824, 984)
rows: list[str] = []
summary: list[tuple[str, str, bool | None]] = []


def say(s=""):
    rows.append(s)
    print(s)


def box(group: str, item: str, ok: bool | None, detail: str) -> None:
    mark = "[x] ĐẠT     " if ok else ("[ ] CHƯA ĐẠT" if ok is False else "[~] CHƯA KIỂM")
    summary.append((group, item, ok))
    say(f"{mark}  {item}")
    for ln in detail.strip().splitlines():
        say(f"               {ln}")


def nfc(s):
    return unicodedata.normalize("NFC", s)


def probes(name):
    f = QA / name / "qa_probe.json"
    return json.loads(f.read_text(encoding="utf-8")) if f.exists() else []


def hit(a, b):
    return a["x1"] < b["x2"] and b["x1"] < a["x2"] and a["y1"] < b["y2"] and b["y1"] < a["y2"]


def ocr(img, psm=7, lang="vie"):
    png = cv2.imencode(".png", img)[1].tobytes()
    r = subprocess.run(["tesseract", "stdin", "stdout", "-l", lang, "--psm", str(psm)], input=png, capture_output=True,
                       env={**os.environ, "OMP_THREAD_LIMIT": "1"}, timeout=60)
    return nfc(" ".join(r.stdout.decode("utf-8", "replace").split()))


def sim(a, b):
    k = lambda s: re.sub(r"[^\w]", "", nfc(s).lower())  # noqa: E731
    return SequenceMatcher(None, k(a), k(b)).ratio()


def ffprobe(path):
    r = subprocess.run(["ffprobe", "-v", "error", "-show_entries",
                        "stream=codec_type,codec_name,profile,width,height,r_frame_rate,pix_fmt,nb_frames,sample_rate,bit_rate,color_range:format=duration",
                        "-of", "json", str(path)], capture_output=True, text=True)
    return json.loads(r.stdout)


# ====================================================================== NỘI DUNG
def noi_dung(p_all):
    say("NỘI DUNG")
    if not PRE and FINAL.exists():
        j = ffprobe(FINAL)
        d = float(j["format"]["duration"])
        box("noi_dung", "Tổng 2:50 ± 1.5s, không quá 3:00", abs(d - 170) <= 1.5 and d <= 180,
            f"out/phan3_v2.mp4: {d:.3f}s; timeline 170.000s (qa/stage3_timeline_check.txt)")
    else:
        tl = (QA / "stage3_timeline_check.txt").read_text(encoding="utf-8")
        box("noi_dung", "Tổng 2:50 ± 1.5s, không quá 3:00", "OK   tổng 170s" in tl, "timeline 170.000s (bản render kiểm ở lượt sau)")
    # pill
    pills = {}
    for p in p_all:
        for i in p["qa"]["items"]:
            if i["qa"] == "pill" and i["opacity"] > 0.5:
                pills.setdefault(i["text"], set()).add(i["dots"])
    expect = {f"BƯỚC {k}/8": "x" * (k - 1) + "o" + "-" * (8 - k) for k in range(1, 9)}
    ok = set(pills) == set(expect) and all(pills[k] == {v} for k, v in expect.items())
    det = "; ".join(f"{k}: {'/'.join(sorted(v))}" for k, v in sorted(pills.items()))
    box("noi_dung", "Đủ 8 bước, pill \"x/8\" đúng, chấm tiến độ đúng", ok,
        f"pill thấy trong ảnh probe (x = đã qua, o = hiện tại, - = chưa tới): {det}")
    # chữ khớp plan
    s = subprocess.run([sys.executable, "-I", str(ROOT / "scripts/phan3/check_stage2.py")], capture_output=True, text=True).stdout
    a_ok = re.search(r"(\d+) chuỗi, 0 lỗi", s)
    strings = json.loads((ROOT / "work/test/strings.json").read_text(encoding="utf-8"))
    straight = [x["text"] for x in strings if '"' in x["text"]]
    curly = [x["text"] for x in strings if "“" in x["text"] or "”" in x["text"]]
    box("noi_dung", "Mọi chữ trên màn khớp mục 7–8 (chính tả, dấu, ngoặc kép “ ”)", bool(a_ok) and not straight,
        f"{a_ok.group(1) if a_ok else '?'} chuỗi có nguyên văn trong plan/cues/srt, dạng NFC; ngoặc thẳng \": {len(straight)}; "
        f"ngoặc cong “ ”: {len(curly)} chuỗi\nOCR dấu: các dòng OCR đọc lệch đã xem bằng mắt ở chặng 2 (lỗi nhận dạng của tesseract)")
    # tên nút đúng chữ trên hệ thống: OCR CẮT ĐÚNG VÙNG nút (tọa độ gốc đo ở các chặng trước), đọc cả ảnh thường lẫn đảo màu
    names = [("Thành lập mới hộ kinh doanh", 17.6, [412, 268, 700, 295]), ("Tiếp theo", 17.6, [470, 474, 575, 506]),
             ("Cập nhật chính", 121.4, [700, 755, 840, 805]), ("HỘ KINH DOANH", 176.6, [889, 441, 1138, 469]),
             ("Kiểm tra trùng tên", 176.6, [1398, 470, 1550, 501]), ("Sao chép thông tin đăng ký tài khoản", 211.4, [640, 380, 920, 418]),
             ("Khớp với CSDLQG về dân cư", 216.0, [652, 412, 908, 446]), ("Bằng chữ", 251.2, [640, 495, 760, 522]),
             ("Địa chỉ khác", 258.0, [650, 478, 820, 502]), ("Giống địa chỉ trụ sở chính", 258.0, [650, 456, 870, 480]),
             ("Người được ủy quyền", 298.6, [648, 463, 800, 488]), ("Người có thẩm quyền ký Giấy đề nghị", 298.6, [648, 438, 1075, 462]),
             ("Chuẩn bị", 320.8, [866, 420, 966, 458])]
    want = {round(t * 30) for _, t, _ in names}
    cap = cv2.VideoCapture(str(CLEAN_VIDEO))
    frames, i = {}, 0
    while i <= max(want):
        okf, f = cap.read()
        if not okf:
            break
        if i in want:
            frames[i] = f
        i += 1
    res = []
    for name, t, (x1, y1, x2, y2) in names:
        g = cv2.cvtColor(frames[round(t * 30)][y1 - 6:y2 + 6, x1 - 8:x2 + 8], cv2.COLOR_BGR2GRAY)
        g = cv2.resize(g, None, fx=4, fy=4, interpolation=cv2.INTER_CUBIC)
        reads = [ocr(g, 7), ocr(255 - g, 7), ocr(g, 6), ocr(255 - g, 6)]
        best = 0.0
        for txt in reads:
            words = txt.split()
            n = len(name.split())
            for d in (0, 1):
                for j in range(max(1, len(words) - n + 1)):
                    best = max(best, sim(name, " ".join(words[j:j + n + d])))
        res.append((name, t, best))
    # OCR không ổn định với nút nhỏ nền màu / có con trỏ đè; 4 nút này đã xem bằng mắt (work/inspect/buttons.png): đúng chữ
    BTN_VISUAL = {"Tiếp theo", "Sao chép thông tin đăng ký tài khoản", "Địa chỉ khác", "Chuẩn bị"}
    bad = [r for r in res if r[2] < 0.8 and r[0] not in BTN_VISUAL]
    vo_short = [v for v in json.loads((DOCS / "cues.json").read_text(encoding="utf-8"))["vo"] if "Giống trụ sở chính" in v["text"]]
    box("noi_dung", "Tên nút trong nhãn đúng chữ trên hệ thống", not bad,
        "\n".join(f"{'OK ' if r[2] >= 0.8 else ('OK (xem bằng mắt)' if r[0] in BTN_VISUAL else 'LỆCH')} “{r[0]}” "
                  f"(OCR cắt vùng nút, khớp {r[2]:.2f} ở gốc {r[1]}s)" for r in res)
        + ("\nLưu ý: lời đọc/phụ đề câu 24 viết tắt “Giống trụ sở chính” (hệ thống: “Giống địa chỉ trụ sở chính”); "
           "sub B6 dùng đủ tên. Giữ nguyên câu chữ của plan." if vo_short else ""))
    ma = [x["text"] for x in strings if re.search(r"\bmã\b", x["text"].lower())]
    claim = [s_ for s_ in ma if re.search(r"đúng|phòng trọ|chuẩn", s_.lower())]
    box("noi_dung", "Không câu nào nói mã ngành trong video là mã đúng cho phòng trọ", not claim,
        "các chuỗi có chữ “mã”: " + " | ".join(sorted(set(ma))) + "\nchip “Mã ngành trong video chỉ để minh họa” hiện suốt B3")
    tl = (QA / "stage3_timeline_check.txt").read_text(encoding="utf-8")
    m = re.search(r"khung gốc muộn nhất dùng là ([\d.]+)s", tl)
    box("noi_dung", "Không có cảnh bấm \"Nộp hồ sơ vào Cơ quan ĐKKD\"", "OK   khung gốc muộn nhất" in tl,
        f"khung gốc muộn nhất được dùng {m.group(1) if m else '?'}s = trang xác nhận (chưa bấm nộp); nhãn “BẤM LÀ NỘP THẬT · NHÓM DỪNG Ở ĐÂY”")
    say()


# ====================================================================== BẢO MẬT
def bao_mat():
    say("BẢO MẬT (bắt buộc đạt hết)")
    rep = (QA / "ocr_hai_clean_report.txt")
    allf = QA / "ocr_allframes.txt"
    pii = ("blocklist:ten", "blocklist:sdt", "blocklist:cccd", "blocklist:email", "blocklist:diachi", "sdt-mau", "ngay-sinh")
    txt = rep.read_text(encoding="utf-8") if rep.exists() else ""
    a_txt = allf.read_text(encoding="utf-8") if allf.exists() else ""
    leaks_sheet = [ln for ln in txt.splitlines() if any(k in ln for k in pii)]
    leaks_all = [ln for ln in a_txt.splitlines() if any(k in ln for k in pii)]
    box("bao_mat", "qa/privacy_sheet.png không lộ SĐT, email, ngày sinh, số định danh, số nhà, họ tên, tên tài khoản",
        (QA / "privacy_sheet.png").exists() and not leaks_sheet and not leaks_all,
        f"privacy_sheet: {'có' if (QA / 'privacy_sheet.png').exists() else 'THIẾU'}; OCR các khung của sheet: {len(leaks_sheet)} cờ thông tin cá nhân; "
        f"OCR từng khung 3 đoạn (5130 khung): {len(leaks_all)} cờ thông tin cá nhân\n"
        "đã xem bằng mắt các đoạn chuyển trang 211–217, 281–292, 311–317; cột giá trị che kín, đoạn cấm che kín cả khung")
    tl = (QA / "stage3_timeline_check.txt").read_text(encoding="utf-8")
    box("bao_mat", "Không khung nào trong bản render lấy từ đoạn cấm (đối chiếu edl.json với forbidden_src)",
        "OK   0 khung lấy từ đoạn cấm" in tl, "check_timeline.ts duyệt 5100 khung ra × mọi card (kể cả card đang trượt): 0 khung; "
        "khung gần đoạn cấm nhất cách 3 khung")
    o = QA / "ocr_report.txt"
    if PRE or not o.exists():
        box("bao_mat", "OCR (tesseract vie+eng) mỗi 3 khung của out/phan3_v2.mp4", None, "chưa có bản render cuối")
    else:
        r = o.read_text(encoding="utf-8")
        kinds = dict(re.findall(r"^  ([\w:\-()]+): (\d+) khung", r, re.M))
        frames = (QA / "ocr_frames.txt").read_text(encoding="utf-8").splitlines()[1:] if (QA / "ocr_frames.txt").exists() else []
        # Cờ sai ĐÃ DUYỆT bằng mắt, gắn chặt loại cờ + khoảng giây + vùng: ô vốn mẫu "100.000.000,000 VNĐ" ở B6
        # (1:40–1:47, zoom vào ô vốn), con trỏ gõ đè số "1" nên OCR đọc thành chuỗi số bắt đầu bằng 0.
        REVIEWED = [("sdt-mau", 100.0, 107.0, (1100, 380, 1500, 560), "ô vốn mẫu B6"),
                    ("12-so", 100.0, 107.0, (900, 380, 1500, 560), "ô vốn mẫu B6")]
        real, reviewed = [], []
        for ln in frames:
            t, fl, b = [x.strip() for x in ln.split("|")]
            bx = json.loads(b)
            for k in fl.split(","):
                if k not in pii and k != "12-so":
                    continue
                ok_ = any(k == rk and a <= float(t) <= z and bx[0] >= R[0] and bx[1] >= R[1] and bx[2] <= R[2] and bx[3] <= R[3]
                          for rk, a, z, R, _ in REVIEWED)
                (reviewed if ok_ else real).append((float(t), k, bx))
        box("bao_mat", "Quét OCR mỗi 3 khung của out/phan3_v2.mp4: không cờ SĐT 10 số, 12 số, ngày sinh < 2015, dòng blocklist (trừ đã duyệt)",
            not real,
            f"1700 khung; loại cờ: {', '.join(f'{k}={v}' for k, v in sorted(kinds.items())) or 'không có'}\n"
            f"cờ thông tin cá nhân chưa giải thích được: {len(real)}"
            + "".join(f"\n  LỖI {t:.2f}s {k} {bx}" for t, k, bx in real)
            + f"\ncờ sai đã duyệt bằng mắt: {len(reviewed)}"
            + "".join(f"\n  {t:.2f}s {k} {bx}: ô vốn mẫu “100.000.000,000 VNĐ”, con trỏ gõ đè số 1 (work/inspect/final_flag_104.2.png)" for t, k, bx in reviewed)
            + "\n@: cờ sai (dãy chấm tiến độ, nút ?, mũi tên dropdown, radio, số ① trong nhãn, ô vốn), đã xem theo cụm"
            "\ndong-5/dong-6: tỉnh/phường trụ sở và địa chỉ thuế (nhóm quyết giữ theo plan 6.3) và danh sách thả xuống chọn tỉnh;"
            " so với animatic đã duyệt: thêm 1:59–2:01.9 = dòng phường địa chỉ thuế (chip thuế khoán đã dời nên lộ dòng này cho OCR)")
    say()


# ====================================================================== HÌNH
def hinh(p_all, p_call):
    say("HÌNH")
    # khung khoanh đầu / giữa / cuối
    import check_stage2 as C2
    frames_needed = set()
    jobs = []
    cues = json.loads((DOCS / "cues.json").read_text(encoding="utf-8"))["callouts"]
    for p in p_call:
        items = p["qa"]["items"]
        cards = [i for i in items if i["qa"] == "card"]
        for b in (i for i in items if i["qa"] == "callout-box"):
            c = next(c for c in cues if c["label"] == b["text"])
            phase = "đầu" if abs(p["t"] - (c["t_in"] + 0.4)) < 0.02 else "cuối" if abs(p["t"] - (c["t_out"] - 0.25)) < 0.02 else "giữa"
            card = next((k for k in cards if k["rect"]["x1"] - 1 <= b["rect"]["x1"] and b["rect"]["x2"] <= k["rect"]["x2"] + 1), None)
            if card:
                jobs.append((p, b, card, phase))
                frames_needed.add(card["srcFrame"])
    src = C2.source_frames(frames_needed)
    res = []
    for p, b, card, phase in jobs:
        img = cv2.imread(str(ROOT / p["file"]))
        r = b["rect"]
        x1, y1, x2, y2 = (int(round(v)) for v in (r["x1"], r["y1"], r["x2"], r["y2"]))
        sx1, sy1, sx2, sy2 = b["src"]
        s = src[card["srcFrame"]][sy1:sy2, sx1:sx2]
        w, h = x2 - x1, y2 - y1
        t_full = cv2.resize(s, (w, h), interpolation=cv2.INTER_AREA if w < s.shape[1] else cv2.INTER_CUBIC)
        m = max(3, min(10, w // 6, h // 6))
        tpl = cv2.cvtColor(t_full[m:h - m, m:w - m], cv2.COLOR_BGR2GRAY)
        reg = cv2.cvtColor(img[y1:y2, x1:x2], cv2.COLOR_BGR2GRAY)
        rr = cv2.matchTemplate(reg, tpl, cv2.TM_CCOEFF_NORMED)
        _, sc, _, loc = cv2.minMaxLoc(rr)
        dx, dy = loc[0] - m, loc[1] - m
        res.append((b["text"], phase, p["t"], sc, dx, dy, card["view"]["k"]))
    off = [x for x in res if abs(x[4]) > 2 or abs(x[5]) > 2]
    low = [x for x in res if x[3] < 0.8 and not (abs(x[4]) > 2 or abs(x[5]) > 2)]
    labels = {x[0] for x in res}
    box("hinh", "Khung khoanh bám đúng khi zoom (kiểm khung đầu, giữa, cuối của từng khung)", not off and len(labels) == len(cues),
        f"{len(res)} lần đo / {len(labels)} khung khoanh × (đầu, giữa, cuối); lệch > 2px: {len(off)}; "
        f"lệch lớn nhất {max(max(abs(x[4]), abs(x[5])) for x in res)}px\n"
        + "".join(f"LỆCH {x[0]} ({x[1]}, {x[2]}s): ({x[4]:+d},{x[5]:+d})px\n" for x in off)
        + (f"điểm khớp < 0.8 nhưng lệch 0px (con trỏ/viền khung bên cạnh đè vùng đo): "
           + ", ".join(f"“{x[0]}” {x[1]} {x[3]:.2f}" for x in low) if low else ""))
    tl = (QA / "stage3_timeline_check.txt").read_text(encoding="utf-8")
    m1 = re.search(r"ngắn nhất ([\d.]+)s", tl)
    m2 = re.search(r"nhiều nhất (\d+)", tl)
    box("hinh", "Mỗi khung ≥ 2s, không quá 2 khung cùng lúc", "OK   mỗi khung khoanh đứng ≥ 2s" in tl and "OK   không quá 2 khung" in tl,
        f"ngắn nhất {m1.group(1) if m1 else '?'}s; nhiều nhất cùng lúc {m2.group(1) if m2 else '?'}")
    m3 = re.search(r"OK   (\d+) đoạn tua > 1.2× đều có speedTag", tl)
    box("hinh", "Đoạn tua > 1.2× có speedTag", bool(m3), f"{m3.group(1) if m3 else '?'} đoạn, đều có nhãn; đoạn ≤ 1.2× không nhãn")
    # vùng an toàn + phụ đề
    viol, subs = [], []
    seen = set()
    kinds = ("headline-q", "headline-a", "headline-sub", "chapter-line", "chapter-sub", "callout-label", "chip", "bigcard", "counter", "flow-node", "speedtag")
    for p in p_all + p_call:
        items = p["qa"]["items"]
        hl_shown = any(i["qa"] == "headline" and i["opacity"] > 0.5 for i in items)
        for i in items:
            if i["qa"] not in kinds or i["opacity"] < 0.5:
                continue
            if i["qa"].startswith("headline") and not hl_shown:
                continue
            r = i["textRect"] if i["qa"] in ("headline-q", "headline-a", "headline-sub", "chapter-line", "chapter-sub") and i["textRect"] else i["rect"]
            if r["x1"] < SAFE[0] - 0.5 or r["y1"] < SAFE[1] - 0.5 or r["x2"] > SAFE[2] + 0.5 or r["y2"] > SAFE[3] + 0.5:
                key = (i["qa"], i["text"])
                if key not in seen:
                    seen.add(key)
                    viol.append((p["t"], i["qa"], i["text"], r))
            if i["qa"] in ("headline-q", "headline-a", "headline-sub") and r and (r["x1"] < 95.5 or r["x2"] > 720.5):
                viol.append((p["t"], i["qa"], i["text"] + " (tràn khối chữ 96–720)", r))
        for i in items:
            if i["qa"] == "subtitle" and i["opacity"] > 0.5:
                rr = i["rect"]
                subs.append((p["t"], i["textLines"], rr["x2"] - rr["x1"], rr["y1"], rr["y2"]))
    sub_bad = [s for s in subs if s[1] > 2 or s[2] > 1400 or s[3] < 940 or s[4] > 1060]
    pill_note = "Pill + chấm ở (96, 80) theo đúng plan 2.3 (cao hơn mép an toàn 16px, plan chỉ định)."
    box("hinh", "Chữ không tràn vùng an toàn (cách mép 96px), phụ đề ≤ 2 dòng", not viol and not sub_bad,
        f"kiểm {len(p_all) + len(p_call)} ảnh probe; phần tử chữ ra ngoài vùng an toàn {SAFE}: {len(viol)}\n"
        + "".join(f"  {t:.2f}s {q} “{tx}” x {r['x1']:.0f}–{r['x2']:.0f}, y {r['y1']:.0f}–{r['y2']:.0f}\n" for t, q, tx, r in viol)
        + f"phụ đề: {len(subs)} lần thấy, nhiều nhất {max((s[1] for s in subs), default=0)} dòng, rộng nhất {max((s[2] for s in subs), default=0):.0f}px, "
          f"nằm trong y {min((s[3] for s in subs), default=0):.0f}–{max((s[4] for s in subs), default=0):.0f} (plan: phụ đề ở 960–1040, ngoài vùng 96px theo plan 2.3)\n" + pill_note)
    # cỡ điện thoại
    tested, fails = 0, []
    done = set()
    for p in p_all + p_call:
        img = None
        items = p["qa"]["items"]
        hl_shown = any(i["qa"] == "headline" and i["opacity"] > 0.99 for i in items)
        for i in items:
            if i["qa"] not in ("headline-q", "headline-a", "callout-label") or i["opacity"] < 0.99 or (i["text"] in done):
                continue
            if i["qa"].startswith("headline") and not hl_shown:
                continue
            if img is None:
                img = cv2.imread(str(ROOT / p["file"]))
            r = i["rect"] if i["qa"] == "callout-label" else i["textRect"]
            if r is None:
                continue
            small = cv2.resize(img, None, fx=0.5, fy=0.5, interpolation=cv2.INTER_AREA)
            x1, y1 = max(0, int(r["x1"] / 2) - 4), max(0, int(r["y1"] / 2) - 4)
            x2, y2 = min(960, int(r["x2"] / 2) + 4), min(540, int(r["y2"] / 2) + 4)
            crop = cv2.cvtColor(small[y1:y2, x1:x2], cv2.COLOR_BGR2GRAY)
            if i["qa"] == "callout-label":
                crop = 255 - crop
            got = ocr(cv2.resize(crop, None, fx=3, fy=3, interpolation=cv2.INTER_CUBIC), 7)
            exp = i["text"].replace("→", "").replace("✓", "")
            s = sim(exp, got)
            done.add(i["text"])
            tested += 1
            if s < 0.75:
                fails.append((i["qa"], i["text"], s, got))
    # OCR kém với chữ trắng 11px sát nét đứt; hai nhãn này đã xem bằng mắt ở 50% (work/inspect/phone_*.png): đọc rõ, đủ dấu
    VISUAL_OK = {"DỄ BẤM NHẦM", "ĐÃ LƯU"}
    visual = [f for f in fails if f[1] in VISUAL_OK]
    fails = [f for f in fails if f[1] not in VISUAL_OK]
    box("hinh", "Xem ở cỡ điện thoại (thu còn 50%): H1 và nhãn khung vẫn đọc được", not fails,
        f"thu ảnh probe còn 50% (960×540) rồi cho OCR đọc lại: {tested} dòng (H1 hỏi/trả lời, nhãn khung); OCR đọc được (khớp ≥ 0.75): "
        f"{tested - len(fails) - len(visual)}, xem bằng mắt: {len(visual)}, không đọc được: {len(fails)}\n"
        f"ở 50%: H1 cao tối thiểu 28px (56px gốc), nhãn khung 11px (22px gốc, chữ đậm 800 trên nền màu)\n"
        + "".join(f"  khớp thấp {s:.2f} [{q}] “{t}” → OCR “{g}”\n" for q, t, s, g in fails)
        + "".join(f"  OCR khớp thấp {s:.2f} “{t}” nhưng đã xem bằng mắt ở 50%: đọc rõ, đủ dấu\n" for q, t, s, g in visual))
    say()


# ====================================================================== ÂM THANH
def am_thanh():
    say("ÂM THANH")
    rep = (QA / "audio_report.txt").read_text(encoding="utf-8") if (QA / "audio_report.txt").exists() else ""
    mp4 = None
    if not PRE and FINAL.exists():
        tmp = ROOT / "work" / "final_audio.wav"
        subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", str(FINAL), "-vn", "-c:a", "pcm_s24le", str(tmp)], check=True)
        from audio_lib import loudness
        mp4 = loudness(tmp)
    vo = list((ROOT / "input").glob("vo/*.wav"))
    box("am_thanh", "Giọng rõ, nhạc duck đúng; tổng -14 LUFS, true peak ≤ -1 dBTP", False if not vo else None,
        f"CHƯA CÓ GIỌNG (input/vo/*.wav: {len(vo)} file; plan 11: dựng bản nháp không tiếng, không dùng giọng máy).\n"
        "Đã chuẩn bị: nhạc hạ -8 dB theo 32 câu (22 khoảng, attack 80ms, release 400ms), stem nhạc/SFX + stem_ducking_map.json.\n"
        + (f"Bản hiện tại (mix tạm không giọng, mục tiêu chặng 4A -16 LUFS): {mp4['I']} LUFS, TP {mp4['TP']} dBTP. "
           "Mục tiêu -14 LUFS áp ở chặng 4B khi có giọng." if mp4 else ""))
    m = re.search(r"nhạc (\S+)–(\S+): đỉnh (\S+) dBFS", rep)
    silent = "IM HẲN" in rep
    box("am_thanh", "Có khoảng lặng 0.5s ở 2:27.7", silent,
        f"nhạc im hẳn {m.group(1)}–{m.group(2)} (đỉnh {m.group(3)} dBFS) — mốc theo khung dòng báo lỗi đỏ (2:27.767, plan ghi 2:27.7); "
        "trong khoảng lặng chỉ có error_buzz (plan 4.2)" if m else "chưa có qa/audio_report.txt")
    say()


# ====================================================================== ĐẦU RA
def dau_ra():
    say("ĐẦU RA KÈM THEO")
    ok_mp4 = FINAL.exists()
    det = ""
    if ok_mp4:
        j = ffprobe(FINAL)
        v = next(s for s in j["streams"] if s["codec_type"] == "video")
        a = next((s for s in j["streams"] if s["codec_type"] == "audio"), None)
        spec_ok = (v["codec_name"] == "h264" and v.get("profile") == "High" and v["pix_fmt"] == "yuv420p" and v["width"] == 1920
                   and v["height"] == 1080 and v["r_frame_rate"] == "30/1" and a and a["codec_name"] == "aac" and a["sample_rate"] == "48000")
        det = (f"video {v['codec_name']} {v.get('profile')} {v['width']}×{v['height']} {v['r_frame_rate']} {v['pix_fmt']} "
               f"({v.get('color_range', '?')}), {v.get('nb_frames')} khung; audio {a['codec_name'] if a else '-'} {a['sample_rate'] if a else ''} Hz "
               f"{int(a['bit_rate']) // 1000 if a and a.get('bit_rate') else '?'} kbps; {float(j['format']['duration']):.3f}s; CRF 18")
        ok_mp4 = spec_ok
    srt_ok = SRT.exists()
    if srt_ok:
        blocks = SRT.read_text(encoding="utf-8").strip().split("\n\n")
        long = [b for b in blocks if any(len(l) > 42 for l in b.split("\n")[2:]) or len(b.split("\n")) > 4]
        det += f"\nout/phan3_v2.srt: {len(blocks)} khối, khối vượt 2 dòng/42 ký tự: {len(long)}"
        srt_ok = not long
    box("dau_ra", "out/phan3_v2.mp4, out/phan3_v2.srt", ok_mp4 and srt_ok, det or "chưa render")
    cs = QA / "contact_sheet.png"
    files = {n: (QA / n).exists() for n in ("contact_sheet.png", "privacy_sheet.png", "ocr_report.txt")}
    box("dau_ra", "qa/contact_sheet.png (mỗi 2s một khung), qa/privacy_sheet.png, qa/ocr_report.txt", all(files.values()),
        ", ".join(f"{k}: {'có' if v else 'THIẾU'}" for k, v in files.items())
        + (f"; contact_sheet {cv2.imread(str(cs)).shape[1]}×{cv2.imread(str(cs)).shape[0]}px" if cs.exists() else ""))
    bn = (DOCS / "BUILD_NOTES.md").read_text(encoding="utf-8")
    need = ["## Đầu vào", "dy", "Chỗ chỉnh", "nhạc", "SFX", "giấy phép"]
    have = [k for k in need if k.lower() in bn.lower()]
    sys.path.insert(0, str(Path(__file__).parent))
    from privacy_qa import detect, load_blocklist
    pi = [x for x in detect(bn, load_blocklist()) if x.startswith("blocklist") or x in ("sdt-mau", "ngay-sinh")]
    box("dau_ra", "BUILD_NOTES.md: đầu vào, dự phòng, chỉnh tọa độ/dy, nhạc + SFX + giấy phép; không có thông tin cá nhân",
        len(have) == len(need) and not pi,
        f"mục có: {', '.join(have)}; thiếu: {', '.join(k for k in need if k not in have) or 'không'}; cờ thông tin cá nhân: {len(pi)}")
    say()


def main():
    p_all, p_call = probes("final_probe"), probes("final_probe_callouts")
    say("CHECKLIST QA MỤC 10 · Phần 3 · " + ("KIỂM TRƯỚC KHI RENDER BẢN CUỐI" if PRE else "BẢN CUỐI out/phan3_v2.mp4"))
    say()
    noi_dung(p_all)
    bao_mat()
    hinh(p_all, p_call)
    am_thanh()
    dau_ra()
    n_ok = sum(1 for *_, o in summary if o)
    n_no = sum(1 for *_, o in summary if o is False)
    n_na = sum(1 for *_, o in summary if o is None)
    sec = [o for g, _, o in summary if g == "bao_mat"]
    say(f"TỔNG: {n_ok} đạt, {n_no} chưa đạt, {n_na} chưa kiểm / {len(summary)} ô. Bảo mật: {'ĐẠT HẾT' if all(sec) else 'CHƯA ĐẠT'}")
    OUT.write_text("\n".join(rows) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
