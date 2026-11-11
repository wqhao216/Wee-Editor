// Xuất out/phan3_v2.srt: đúng các trang phụ đề burn-in trên hình (subtitlePages: ≤ 2 dòng, mỗi dòng ≤ 42 ký tự,
// tách ở dấu câu; thời gian theo lời đọc trong cues.json = phan3_vo_draft.srt).
// Chạy: npx esbuild scripts/phan3/export_srt.ts --bundle --platform=node --format=esm \
//   --outfile=work/export_srt.mjs --alias:remotion=./scripts/phan3/remotion-stub.ts && node work/export_srt.mjs
import { mkdirSync, writeFileSync } from "node:fs";
import { subtitlePages } from "../../src/phan3/timeline";

const ts = (s: number) => {
  const ms = Math.round(s * 1000);
  const h = Math.floor(ms / 3600000), m = Math.floor((ms % 3600000) / 60000), sec = Math.floor((ms % 60000) / 1000);
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")},${String(ms % 1000).padStart(3, "0")}`;
};
const pages = subtitlePages();
const body = pages.map((p, i) => `${i + 1}\n${ts(p.t_in)} --> ${ts(p.t_out)}\n${p.lines.join("\n")}\n`).join("\n");
mkdirSync("out", { recursive: true });
writeFileSync("out/phan3_v2.srt", body);
console.log(`out/phan3_v2.srt: ${pages.length} khối`);
