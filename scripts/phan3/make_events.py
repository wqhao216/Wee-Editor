"""Sinh audio/sfx_events.json từ work/timeline_cues.json (mốc RA tính bằng chính code dựng video,
nguồn edl.json + cues.json). Không gõ tay mốc nào.

Mức (dB) theo plan 4.3, so với mức tham chiếu 0 dB = mức giọng đọc (xem BUILD_NOTES).
Gỡ va chạm:
  - "chuỗi" (group) tính như MỘT âm và xếp nguyên khối: cặp pop + tick_ok của một khung khoanh,
    8 tick dấu tích B8, 8 badge B2, sơ đồ cuối (nút + đường vẽ).
  - hai sự kiện lệch nhau < 40ms (trừ trong cùng một chuỗi):
    sự kiện ưu tiên thấp hơn lùi 60ms một lần, tối đa 150ms; không được thì bỏ.
  - plan 4.3: tối đa 2 SFX vang cùng lúc (tính theo độ dài nghe rõ, tới khi tắt dưới -24 dB):
    sự kiện thứ ba lùi như trên, không được thì bỏ.
Chạy: python3 -I scripts/phan3/make_events.py
"""
from __future__ import annotations

import json
import sys
from pathlib import Path

import numpy as np

sys.path.insert(0, str(Path(__file__).parent))
from audio_lib import SR, read_wav24  # noqa: E402
from common import ROOT  # noqa: E402

CUES = ROOT / "work" / "timeline_cues.json"
SFX_DIR = ROOT / "audio" / "sfx"
OUT = ROOT / "audio" / "sfx_events.json"

MIN_GAP = 0.040
SHIFT_STEP, SHIFT_MAX = 0.060, 0.150

# loại -> (file, mức dB, ưu tiên: càng lớn càng quan trọng)
KIND = {
    "error_buzz": ("error_buzz", -18, 100),
    "riser": ("riser", -20, 95),
    "ding_end": ("ding_end", -18, 95),
    "wipe": ("whoosh_wipe", -18, 90),
    "click": ("click", -22, 80),
    "callout_danger": ("blip_danger", -20, 75),
    "callout_warn": ("blip_warn", -22, 74),
    "callout_ok_pop": ("pop", -26, 73),  # cặp pop + tick_ok cộng đỉnh: mỗi âm -2 dB so với plan (pop -24, tick_ok -20)
    "callout_ok_tick": ("tick_ok", -22, 72),
    "check_b8": ("tick_ok", -30, 70),
    "card_in": ("whoosh", -22, 60),
    "card_swap": ("whoosh", -22, 60),
    "card_out": ("whoosh", -22, 60),
    "punch_in": ("whoosh", -22, 55),
    "flow_node": ("pop_node", -24, 50),
    "text_in": ("tick", -30, 47),  # mỗi khối chữ một tick: ưu tiên hơn chip/tua để không bị bỏ
    "chip": ("pop", -24, 45),
    "badge": ("pop", -24, 44),
    "flow_line": ("draw_line", -30, 40),
    "tua": ("tua", -28, 35),
}


def audible_len(name: str) -> float:
    x = np.abs(read_wav24(SFX_DIR / f"{name}.wav")).max(axis=1)
    thr = x.max() * 10 ** (-24 / 20)
    idx = np.nonzero(x > thr)[0]
    return (idx[-1] + 1) / SR if len(idx) else 0.0


def build() -> dict:
    c = json.loads(CUES.read_text(encoding="utf-8"))
    ev: list[dict] = []

    def add(t, kind, src, **kw):
        f, g, p = KIND[kind]
        ev.append({"t": round(float(t), 4), "kind": kind, "file": f, "gain_db": g, "prio": p, "src": src, **kw})

    for x in c["cardIns"]:
        add(x["t"], "card_in", f"cardIn {x['group']}")
    for x in c["swaps"]:
        add(x["t"], "card_swap", f"cardSwap sau {x['from']}")
    for x in c["cardOuts"]:
        add(x["t"], "card_out", f"cardOut {x['group']} (thu nhỏ trước FlowDiagram)")
    for x in c["punchIns"]:
        add(x["t"], "punch_in", "punchIn (plan 4.3 whoosh_soft)")
    for x in c["headlineIn"]:
        add(x["t"], "text_in", f"textIn H1 {x['scene']}")
    for x in c["chapterIn"]:
        if x["id"] != "R":  # R đã có ding_end ở 2:47.0
            add(x["t"], "text_in", f"textIn chương {x['id']}")
    seq_starts = [c["pulsesB8"][0], c["badges"][0]]
    for i, x in enumerate(c["callouts"]):
        lab = f"callout {x['scene']} “{x['label']}”"
        if any(abs(x["t"] - s0) <= 0.15 for s0 in seq_starts):
            # Khung khoanh trùng một chuỗi đã thiết kế (8 tick B8, 8 badge B2): chuỗi đó thay tiếng của khung.
            continue
        if x["variant"] == "ok":
            add(x["t"], "callout_ok_pop", lab, group=f"callout{i}")
            add(x["t"], "callout_ok_tick", lab, group=f"callout{i}")
        elif x["variant"] == "danger":
            add(x["t"], "callout_danger", lab)
        else:
            add(x["t"], "callout_warn", lab)
    for x in c["clicks"]:
        add(x["t"], "click", f"clickRipple “{x['what']}”")
    for i, t in enumerate(c["pulsesB8"]):
        add(t, "check_b8", f"dấu tích B8 #{i + 1}", pitch_semitones=[0, 2, 4, 5, 7, 9, 11, 12][i], group="b8checks")
    for i, t in enumerate(c["badges"]):
        add(t, "badge", f"badge {i + 1}", extra_db=0 if i == 0 else -3, group="badges")
    for x in c["chips"]:
        add(x["t"], "chip", f"chip ({x['where']})")
    for w in c["wipes"]:
        add(w["t_in"], "wipe", "chapterWipe")
    for x in c["fast"]:
        add(x["t"], "tua", f"đầu đoạn tua {x['label']} ({x['scene']})")
    for i, t in enumerate(c["flow"]["nodes"]):
        add(t, "flow_node", f"FlowDiagram nút {i + 1}", group="flow")
    for i, x in enumerate(c["flow"]["lines"]):
        add(x["t"] + 0.05, "flow_line", f"FlowDiagram đường {i + 1}", group="flow")
    m = c["music"]
    add(m["riserStart"], "riser", "riser 1.4s vào B8 (plan 4.2)")
    add(m["errorLine"], "error_buzz", "dòng báo lỗi B8 (khung gốc 322.067)")
    add(m["rStart"], "ding_end", "thẻ chốt R (plan 4.2 2:47.0)")
    return {"cues": c, "events": ev}


def resolve(ev: list[dict]) -> tuple[list[dict], list[dict]]:
    lens = {f: audible_len(f) for f in {e["file"] for e in ev}}
    for e in ev:
        e["audible_s"] = round(lens[e["file"]] * (2 ** (-e.get("pitch_semitones", 0) / 12)), 4)
    kept: list[dict] = []
    dropped: list[dict] = []

    def same_group(a, b):
        return "group" in a and a.get("group") == b.get("group")

    def voices(items):
        return len({k.get("group", id(k)) for k in items})

    def conflict(e, t):
        near = [k for k in kept if abs(k["t"] - t) < MIN_GAP and not same_group(k, e)]
        sounding = [k for k in kept if not same_group(k, e)
                    and (k["t"] <= t < k["t"] + k["audible_s"] or t <= k["t"] < t + e["audible_s"])]
        return near or voices(sounding) >= 2

    # Chuỗi (group) được xếp nguyên khối theo sự kiện ưu tiên cao nhất của chuỗi, giữ nhịp bên trong.
    groups: dict[str, list[dict]] = {}
    for e in ev:
        if "group" in e:
            groups.setdefault(e["group"], []).append(e)

    units = [[e] for e in ev if "group" not in e] + list(groups.values())
    for unit in sorted(units, key=lambda u: (-max(e["prio"] for e in u), min(e["t"] for e in u))):
        placed = False
        for k in range(int(SHIFT_MAX / SHIFT_STEP) + 1):
            dt = round(k * SHIFT_STEP, 4)
            if not any(conflict(e, round(e["t"] + dt, 4)) for e in unit):
                for e in unit:
                    if dt:
                        e["shifted_from"] = e["t"]
                    e["t"] = round(e["t"] + dt, 4)
                    kept.append(e)
                placed = True
                break
        if not placed:
            for e in unit:
                e["drop_reason"] = "trùng < 40ms hoặc đã đủ 2 SFX đang vang, lùi tới 150ms vẫn không có chỗ"
                dropped.append(e)
    kept.sort(key=lambda e: e["t"])
    return kept, dropped


def main() -> None:
    b = build()
    kept, dropped = resolve(b["events"])
    for e in kept + dropped:
        e.pop("prio", None)
    out = {
        "note": "Mốc t là giây RA của video. gain_db so với mức tham chiếu 0 dB = mức giọng đọc; extra_db cộng thêm.",
        "sample_rate": SR,
        "events": kept,
        "dropped": dropped,
    }
    OUT.parent.mkdir(exist_ok=True)
    OUT.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    kinds: dict[str, int] = {}
    for e in kept:
        kinds[e["kind"]] = kinds.get(e["kind"], 0) + 1
    print(f"{len(kept)} sự kiện giữ, {len(dropped)} bỏ, {sum('shifted_from' in e for e in kept)} lùi")
    print("  " + ", ".join(f"{k}={v}" for k, v in sorted(kinds.items())))
    for e in dropped:
        print(f"  BỎ   {e['t']:7.3f} {e['kind']:16s} {e['src']}")
    for e in kept:
        if "shifted_from" in e:
            print(f"  LÙI  {e['shifted_from']:7.3f} → {e['t']:7.3f} {e['kind']:16s} {e['src']}")


if __name__ == "__main__":
    main()
