// Render ảnh tĩnh của composition Phan3 + thu log QA (QaProbe) ra JSON.
// Chạy: node scripts/phan3/render_stills.mjs <outDir> <giây> [<giây> ...]   (giây = thời gian RA)
// Trình duyệt: Remotion không tải được trình duyệt của nó (mạng chặn remotion.media), nên dùng
// chrome-headless-shell có sẵn trên máy; đặt REMOTION_BROWSER để đổi.
import { bundle } from "@remotion/bundler";
import { renderStill, selectComposition } from "@remotion/renderer";
import { existsSync, linkSync, mkdirSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const [outDir, ...secs] = process.argv.slice(2);
if (!outDir || secs.length === 0) throw new Error("cách dùng: render_stills.mjs <outDir> <giây>...");
const browserExecutable = process.env.REMOTION_BROWSER ??
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";

// public/hai_clean.mp4 phải trỏ đúng bản mới nhất của work/hai_clean.mp4 (hard link, không commit).
const clean = path.join(root, "work/hai_clean.mp4");
const pub = path.join(root, "public/hai_clean.mp4");
if (!existsSync(pub) || statSync(pub).ino !== statSync(clean).ino) {
  if (existsSync(pub)) unlinkSync(pub);
  linkSync(clean, pub);
}

const fmt = (s) => {
  // 0m13s8 khi mốc tròn tới 0.1s; còn lại giữ mili giây (0m13s467) để hai mốc gần nhau không trùng tên file
  const m = Math.floor(s / 60), r = s - m * 60;
  const tenth = Math.abs(r * 10 - Math.round(r * 10)) < 1e-6;
  return `${m}m${(tenth ? r.toFixed(1) : r.toFixed(3)).padStart(tenth ? 4 : 6, "0").replace(".", "s")}`;
};

const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
const inputProps = { qa: true };
const composition = await selectComposition({ serveUrl, id: "Phan3", inputProps, browserExecutable, chromeMode: "headless-shell" });
mkdirSync(outDir, { recursive: true });
const report = [];
for (const s of secs.map(Number)) {
  const frame = Math.round(s * composition.fps);
  const logs = [];
  const output = path.join(outDir, `phan3_${fmt(s)}.png`);
  await renderStill({
    composition, serveUrl, output, frame, inputProps, imageFormat: "png", browserExecutable, chromeMode: "headless-shell",
    overwrite: true,
    onBrowserLog: (l) => { if (l.text.startsWith("QA_")) logs.push(l.text); },
  });
  const pick = (k) => { const x = logs.filter((l) => l.startsWith(k)).pop(); return x ? JSON.parse(x.slice(k.length + 1)) : null; };
  report.push({ t: s, frame, file: path.relative(root, output), qa: pick("QA_FRAME"), glyph: pick("QA_GLYPH") });
  console.log(`  ${fmt(s)} -> ${path.relative(root, output)}`);
}
writeFileSync(path.join(outDir, "qa_probe.json"), JSON.stringify(report, null, 1));
console.log(`Xong ${secs.length} ảnh. Log QA: ${path.relative(root, path.join(outDir, "qa_probe.json"))}`);
