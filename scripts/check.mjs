// Kiểm tra 20 công cụ đã cài đúng chưa: node scripts/check.mjs
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";

const require = createRequire(import.meta.url);
const pkgs = [
  ["SVGO", "svgo"], ["Satori", "satori"], ["GSAP", "gsap"], ["Anime.js", "animejs"],
  ["Motion", "motion"], ["Rive", "@rive-app/canvas"], ["dotLottie", "@lottiefiles/dotlottie-web"],
  ["Remotion", "remotion"], ["Motion Canvas", "@motion-canvas/core"], ["Three.js", "three"],
  ["React Three Fiber", "@react-three/fiber"], ["Drei", "@react-three/drei"],
  ["React Three Rapier", "@react-three/rapier"], ["React Postprocessing", "@react-three/postprocessing"],
  ["Howler.js", "howler"], ["Mediabunny", "mediabunny"],
];
function version(name) {
  let dir = dirname(require.resolve(name));
  while (!existsSync(join(dir, "package.json")) || JSON.parse(readFileSync(join(dir, "package.json"))).name !== name) dir = dirname(dir);
  return JSON.parse(readFileSync(join(dir, "package.json"))).version;
}
let ok = true;
for (const [label, name] of pkgs) {
  try { console.log(`OK   ${label.padEnd(22)} ${name}@${version(name)}`); }
  catch (e) { ok = false; console.log(`FAIL ${label.padEnd(22)} ${name}: ${e.message}`); }
}
for (const [label, dir] of [["Remotion Skills", "remotion-best-practices"], ["Motion AI Kit", "motion"], ["GSAP Skills", "gsap-core"],
  ["Social Media Research", "outlier-post-finder"], ["OpenCreator Skills", "krillinai-cli"]]) {
  const p = join(import.meta.dirname, "../.claude/skills", dir, "SKILL.md");
  console.log(`${existsSync(p) ? "OK  " : (ok = false, "FAIL")} ${label.padEnd(22)} .claude/skills/${dir}`);
}
for (const [label, bin] of [["FFmpeg (hệ thống)", "ffmpeg"], ["FFmpeg (npm)", require("ffmpeg-static")]]) {
  try { console.log(`OK   ${label.padEnd(22)} ${execFileSync(bin, ["-version"]).toString().split("\n")[0]}`); }
  catch { console.log(`--   ${label.padEnd(22)} không tìm thấy`); }
}
process.exit(ok ? 0 : 1);
