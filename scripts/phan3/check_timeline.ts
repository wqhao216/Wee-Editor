// Tự kiểm timeline Phần 3 (chặng 3) trên chính code dựng, duyệt từng khung ra (30 fps).
// Chạy:
//   npx esbuild scripts/phan3/check_timeline.ts --bundle --platform=node --format=esm \
//     --outfile=work/check_timeline.mjs --alias:remotion=./scripts/phan3/remotion-stub.ts
//   node work/check_timeline.mjs
import { writeFileSync, mkdirSync } from "node:fs";
import { CALLOUTS, CARD_GROUPS, CLICKS, EDL, FORBIDDEN, PULSES, WIPES } from "../../src/phan3/data";
import {
  cardInstances, isForbiddenSrc, jumpCuts, rectH, rectW, segmentAt, segSrcTime, speedLabel, srcRectToScreen, srcToOut, viewAt,
} from "../../src/phan3/timeline";
import { DUR, FPS } from "../../src/phan3/tokens";

const out: string[] = [];
const say = (s = "") => { out.push(s); console.log(s); };
let fails = 0;
const check = (ok: boolean, msg: string) => { if (!ok) fails++; say(`  ${ok ? "OK  " : "LỖI"} ${msg}`); };
const EPS = 1e-6;
const N = Math.round(EDL[EDL.length - 1].end * FPS);

say("TỰ KIỂM TIMELINE · Phần 3 · chặng 3");
// 1. Tổng thời lượng, đoạn liền nhau
say("1. Thời lượng");
const total = EDL[EDL.length - 1].end;
let contiguous = true, sumOk = true;
EDL.forEach((s, i) => {
  if (i && Math.abs(s.start - EDL[i - 1].end) > EPS) contiguous = false;
  let t = s.start;
  for (const g of s.segments) { if (Math.abs(g.out_in - t) > EPS) contiguous = false; t = g.out_out; }
  if (Math.abs(t - s.end) > EPS || Math.abs(s.end - s.start - s.dur) > EPS) sumOk = false;
});
check(Math.abs(total - 170) < EPS && N === 5100, `tổng ${total}s = ${N} khung (cần 170s, trần 180s)`);
check(contiguous && sumOk, "các cảnh và đoạn nối liền, không hở, không chồng; tổng từng cảnh khớp dur");

// 2. Đoạn cấm
say("2. Đoạn cấm (forbidden_src)");
let forb = 0, minGap = Infinity, maxSrc = 0;
for (let f = 0; f < N; f++) {
  for (const c of cardInstances(f / FPS)) {
    if (isForbiddenSrc(c.srcFrame)) forb++;
    maxSrc = Math.max(maxSrc, c.srcFrame);
    for (const z of FORBIDDEN) {
      const s = c.srcFrame / FPS;
      minGap = Math.min(minGap, s < z.src_from ? z.src_from - s : s >= z.src_to ? s - z.src_to : 0);
    }
  }
}
check(forb === 0, `${forb} khung lấy từ đoạn cấm (duyệt mọi card, kể cả card đang trượt ra/vào)`);
say(`       khung gốc gần đoạn cấm nhất cách ${(minGap * FPS).toFixed(0)} khung (${minGap.toFixed(3)}s)`);
check(maxSrc / FPS <= 340.5 + EPS, `khung gốc muộn nhất dùng là ${(maxSrc / FPS).toFixed(2)}s (trang xác nhận 340.5, không dựng cảnh bấm Nộp)`);

// 3. Khung khoanh
say("3. Khung khoanh (callout)");
let onMg = 0, offCard = 0, outOfView = 0;
for (const c of CALLOUTS) {
  const group = CARD_GROUPS.find((g) => g.scenes.includes(c.scene))!;
  for (let f = Math.ceil(c.t_in * FPS - EPS); f <= Math.floor(c.t_out * FPS + EPS); f++) {
    const t = f / FPS;
    const { scene, seg } = segmentAt(t);
    if (seg.type === "mg" || scene.id !== c.scene) { onMg++; continue; }
    const main = cardInstances(t).find((k) => k.main && k.group === group.id);
    if (!main) { offCard++; continue; }
    const v = viewAt(t, (x) => x);
    const r = srcRectToScreen(v, { x1: c.box_src[0], y1: c.box_src[1], x2: c.box_src[2], y2: c.box_src[3] });
    if (r.x1 < v.container.x1 - 0.5 || r.y1 < v.container.y1 - 0.5 || r.x2 > v.container.x2 + 0.5 || r.y2 > v.container.y2 + 0.5) outOfView++;
  }
}
check(onMg === 0, `mọi khung khoanh nằm trên đoạn có video của đúng bước (${onMg} khung ra vi phạm)`);
check(offCard === 0, `mọi khung khoanh nằm trên card chính đang hiện (${offCard} khung ra vi phạm)`);
check(outOfView === 0, `box luôn nằm trọn trong vùng video đang thấy, kể cả lúc zoom (${outOfView} khung ra vi phạm)`);
let srcMismatch = 0;
for (const c of CALLOUTS) {
  const want = (c as unknown as { src_visible_at_t_in: [string, number] }).src_visible_at_t_in;
  const { seg } = segmentAt(c.t_in);
  const got = segSrcTime(seg, c.t_in);
  if (seg.type !== want[0] || got === null || Math.abs(got - want[1]) > 0.05) {
    srcMismatch++;
    say(`       lệch src_visible_at_t_in: “${c.label}” cues ${want[0]} ${want[1]} / dựng ${seg.type} ${got?.toFixed(2)}`);
  }
}
check(srcMismatch === 0, `khung gốc tại t_in khớp src_visible_at_t_in của cues.json (${CALLOUTS.length - srcMismatch}/${CALLOUTS.length})`);
const short = CALLOUTS.filter((c) => c.t_out - c.t_in < 2 - EPS);
check(short.length === 0, `mỗi khung khoanh đứng ≥ 2s (ngắn nhất ${Math.min(...CALLOUTS.map((c) => c.t_out - c.t_in)).toFixed(1)}s)`);
let maxAt = 0, maxT = 0;
for (let f = 0; f < N; f++) {
  const k = CALLOUTS.filter((c) => f / FPS >= c.t_in - EPS && f / FPS <= c.t_out + EPS).length;
  if (k > maxAt) { maxAt = k; maxT = f / FPS; }
}
check(maxAt <= 2, `không quá 2 khung cùng lúc (nhiều nhất ${maxAt}, lần đầu ở ${maxT.toFixed(2)}s)`);

// 4. speedTag
say("4. speedTag");
const plays = EDL.flatMap((s) => s.segments).filter((g) => g.type === "play");
const fast = plays.filter((g) => g.type === "play" && (g.src_out - g.src_in) / (g.out_out - g.out_in) > 1.2 + EPS);
check(fast.every((g) => speedLabel(g) !== null), `${fast.length} đoạn tua > 1.2× đều có speedTag`);
check(plays.filter((g) => !fast.includes(g)).every((g) => speedLabel(g) === null), `đoạn ≤ 1.2× không có nhãn (${plays.length - fast.length} đoạn)`);

// 5. Hiệu ứng chương, jumpCut, cardSwap
say("5. Chuyển cảnh");
check(WIPES.length === 2, `chapterWipe: ${WIPES.length} (S00→B1 ${WIPES[0].t_in}–${WIPES[0].t_out}, B7→B8 ${WIPES[1].t_in}–${WIPES[1].t_out})`);
check(Math.abs(DUR.jumpCut - 0.12) < EPS, `jumpCut ${DUR.jumpCut * 1000}ms × ${jumpCuts().length} chỗ, không SFX`);

// 6. Ripple, pulse
say("6. clickRipple, pulse");
for (const c of CLICKS) {
  const o = srcToOut(c.src);
  check(o !== null, `ripple “${c.what}”: gốc ${c.src}s → ra ${o ? o.t.toFixed(2) + "s (" + o.scene + ")" : "KHÔNG được phát"}`);
}
for (const p of PULSES) {
  const { scene, seg } = segmentAt(p.t);
  check(seg.type !== "mg" && scene.id === p.scene, `pulse ${p.t.toFixed(2)}s (${p.scene}) nằm trên đoạn ${seg.type}`);
}

say();
say(fails ? `KẾT QUẢ: ${fails} mục LỖI` : "KẾT QUẢ: đạt hết");
mkdirSync("qa", { recursive: true });
writeFileSync("qa/stage3_timeline_check.txt", out.join("\n") + "\n");
void rectW; void rectH;
