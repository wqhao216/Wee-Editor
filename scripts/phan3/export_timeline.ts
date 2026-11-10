// Xuất mọi mốc hình (giây RA) mà âm thanh cần bám, tính bằng CHÍNH code dựng video
// (src/phan3/timeline.ts + data.ts, nguồn là edl.json + cues.json). Không mốc nào gõ tay ở đây.
// Chạy:
//   npx esbuild scripts/phan3/export_timeline.ts --bundle --platform=node --format=esm \
//     --outfile=work/export_timeline.mjs --alias:remotion=./scripts/phan3/remotion-stub.ts
//   node work/export_timeline.mjs        -> work/timeline_cues.json
import { mkdirSync, writeFileSync } from "node:fs";
import {
  BADGES, CALLOUTS, CAMERA, CARD_GROUPS, CHIPS, CLICKS, COUNTER, EDL, ERROR_LINE_SRC, FLOW, FLOW_TIMING, PULSES, VO, WIPES,
} from "../../src/phan3/data";
import { jumpCuts, speedLabel, srcToOut, swapStart } from "../../src/phan3/timeline";
import { DUR } from "../../src/phan3/tokens";

const scene = (id: string) => EDL.find((s) => s.id === id)!;
const B8_LAYOUT = 143.0; // = CARD_GROUPS G7.enter (Phan3.tsx)
const headlineIn = EDL.filter((s) => /^B[1-8]$/.test(s.id)).map((s) => ({ scene: s.id, t: s.id === "B8" ? B8_LAYOUT : s.start }));

const swaps = CARD_GROUPS.slice(0, -1).flatMap((g) => (g.exitKind === "swap" ? [{ from: g.id, t: swapStart(g.exit) }] : []));
const cardIns = CARD_GROUPS.filter((g, i) => i === 0 || CARD_GROUPS[i - 1].exitKind !== "swap").map((g) => ({ group: g.id, t: g.enter }));
const cardOuts = CARD_GROUPS.filter((g) => g.exitKind === "shrink").map((g) => ({ group: g.id, t: g.exit }));

const fast = EDL.flatMap((s) => s.segments.map((g) => ({ s, g }))).filter(({ g }) => speedLabel(g) !== null)
  .map(({ s, g }) => ({ scene: s.id, t: g.out_in, t_out: g.out_out, label: speedLabel(g) }));

const freezes = EDL.flatMap((s) => s.segments.map((g) => ({ s, g }))).filter(({ g }) => g.type === "freeze")
  .map(({ s, g }) => ({ scene: s.id, t: g.out_in, t_out: g.out_out, src_at: (g as { src_at: number }).src_at }));

const err = srcToOut(ERROR_LINE_SRC)!;
// "nút tròn ✓": đoạn dừng hình ở khung gốc 331.0 (plan 8: 2:35.7, mở lại low-pass)
const roundBtn = freezes.find((f) => f.scene === "B8" && Math.abs(f.src_at - 331.0) < 1e-6)!;

const out = {
  total: EDL[EDL.length - 1].end,
  scenes: EDL.map((s) => ({ id: s.id, start: s.start, end: s.end, segments: s.segments.map((g) => ({ type: g.type, out_in: g.out_in, out_out: g.out_out })) })),
  headlineIn,
  chapterIn: [{ id: "S00", t: 0.3 }, { id: "B8", t: 141.0 }, { id: "R", t: scene("R").start + 0.1 }],
  cardIns, swaps, cardOuts,
  swapTiming: { out: DUR.cardSwapOut, overlap: DUR.cardSwapOverlap, cardIn: DUR.cardIn },
  punchIns: CAMERA.map((c) => ({ t: c.t_in, t_out: c.t_out })),
  callouts: CALLOUTS.map((c) => ({ t: c.t_in, t_out: c.t_out, variant: c.variant, scene: c.scene, label: c.label })),
  clicks: CLICKS.map((c) => ({ what: c.what, src: c.src, ...srcToOut(c.src)! })),
  pulsesB8: PULSES.filter((p) => p.scene === "B8").map((p) => p.t),
  badges: BADGES.ys.map((_, i) => BADGES.t_in + i * DUR.badgeStagger),
  chips: CHIPS.map((c) => ({ t: c.t_in, where: c.where })),
  counter: COUNTER.t_in,
  wipes: WIPES,
  fast, freezes,
  jumpCuts: jumpCuts(),
  flow: { nodes: FLOW.nodes.map((_, i) => FLOW_TIMING.drawStart + i * FLOW_TIMING.seg), lines: FLOW.nodes.slice(1).map((_, i) => ({ t: FLOW_TIMING.drawStart + i * FLOW_TIMING.seg, dur: FLOW_TIMING.seg })) },
  vo: VO.map((v) => ({ t: v.t, t_end: v.est_end, text_len: v.text.length })),
  music: {
    s00End: scene("S00").end,
    b7MgStart: scene("B7").segments.find((g) => g.type === "mg")!.out_in,
    b8Start: scene("B8").start,
    riserStart: scene("B8").start - 1.4, // plan 4.2/4.3: riser 1.4s dẫn vào B8 (2:19.6)
    errorLine: err.t, // plan ghi 2:27.7; đo khung: dòng đỏ hiện ở gốc 322.067
    cutEnd: err.t + 0.5,
    lowpassOpen: roundBtn.t, // 2:35.7
    rStart: scene("R").start, // 2:47.0
    end: EDL[EDL.length - 1].end,
  },
};
mkdirSync("work", { recursive: true });
writeFileSync("work/timeline_cues.json", JSON.stringify(out, null, 1));
console.log("work/timeline_cues.json:", Object.entries(out).map(([k, v]) => `${k}=${Array.isArray(v) ? v.length : typeof v === "object" ? "{…}" : v}`).join(" "));
console.log("music:", JSON.stringify(out.music));
