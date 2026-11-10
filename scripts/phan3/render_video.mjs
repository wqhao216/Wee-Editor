// Render composition Phan3 ra MP4 (plan mục 1: H.264 High, yuv420p, CRF 18).
// Chạy: node scripts/phan3/render_video.mjs out/phan3_v2_animatic.mp4
// Animatic chưa có giọng đọc và nhạc: không có track âm thanh.
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import { existsSync, linkSync, mkdirSync, statSync, unlinkSync } from "node:fs";
import os from "node:os";
import path from "node:path";

const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const output = path.resolve(root, process.argv[2] ?? "out/phan3_v2_animatic.mp4");
const browserExecutable = process.env.REMOTION_BROWSER ??
  "/opt/pw-browsers/chromium_headless_shell-1243/chrome-headless-shell-linux64/chrome-headless-shell";

const clean = path.join(root, "work/hai_clean.mp4");
const pub = path.join(root, "public/hai_clean.mp4");
if (!existsSync(pub) || statSync(pub).ino !== statSync(clean).ino) {
  if (existsSync(pub)) unlinkSync(pub);
  linkSync(clean, pub);
}

const serveUrl = await bundle({ entryPoint: path.join(root, "src/index.ts"), publicDir: path.join(root, "public") });
const composition = await selectComposition({ serveUrl, id: "Phan3", inputProps: {}, browserExecutable, chromeMode: "headless-shell" });
mkdirSync(path.dirname(output), { recursive: true });
const t0 = Date.now();
let last = -1;
await renderMedia({
  composition, serveUrl, outputLocation: output, codec: "h264", crf: 18, pixelFormat: "yuv420p",
  x264Preset: "medium", imageFormat: "jpeg", jpegQuality: 95, muted: true, enforceAudioTrack: false,
  browserExecutable, chromeMode: "headless-shell", concurrency: Math.max(1, os.cpus().length),
  onProgress: ({ progress }) => {
    const p = Math.floor(progress * 20);
    if (p !== last) { last = p; console.log(`  ${(progress * 100).toFixed(0)}%  ${((Date.now() - t0) / 1000).toFixed(0)}s`); }
  },
});
console.log(`Xong: ${path.relative(root, output)} (${((Date.now() - t0) / 1000).toFixed(0)}s)`);
