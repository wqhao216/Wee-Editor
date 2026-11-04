// Voiceover tiếng Việt bằng ElevenLabs.
//
//   node scripts/voiceover/voiceover.mjs voices                    liệt kê giọng hỗ trợ tiếng Việt
//   node scripts/voiceover/voiceover.mjs preview <voiceA> <voiceB> đọc thử BLOCK_08 bằng 2 giọng
//   node scripts/voiceover/voiceover.mjs generate <voiceId>        tạo 01..08.mp3 + vo_full.mp3 + bảng thời lượng
//   node scripts/voiceover/voiceover.mjs build                     chỉ nối lại vo_full.mp3 và in bảng
//   node scripts/voiceover/voiceover.mjs check                     nghe lại bằng speech-to-text, so với kịch bản
//   (thêm --tags --model eleven_v3 vào preview/generate/paste để dùng bản có audio tag)
//   node scripts/voiceover/voiceover.mjs paste                     in 8 block thành một đoạn để dán 1 lần vào web ElevenLabs
//   node scripts/voiceover/voiceover.mjs split <file.mp3>          tách file 1 lần đọc thành vo/01..08.mp3 theo khoảng lặng
//                                                                  (tuỳ chọn --min-silence 1.0 --noise -40)
//
// Tuỳ chọn: --model eleven_multilingual_v2 (mặc định) hoặc eleven_v3
// Cần biến môi trường ELEVENLABS_API_KEY.
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import ffmpegPath from "ffmpeg-static";
import { ALL_FORMATS, BufferSource, Input } from "mediabunny";
import { BLOCKS, NUMBER_PHRASES, TAGGED } from "./script.mjs";

const API = "https://api.elevenlabs.io";
const OUT = join(process.cwd(), "vo");
const GAP_SECONDS = 0.4;
const MAX_TOTAL_SECONDS = 95;
// Giữ mặc định của ElevenLabs cho tốc độ (speed = 1.0): không tự tăng tốc.
const VOICE_SETTINGS = { stability: 0.5, similarity_boost: 0.75, style: 0.2, use_speaker_boost: true };

const args = process.argv.slice(2);
const flag = (name, def) => { const i = args.indexOf(`--${name}`); return i >= 0 ? args.splice(i, 2)[1] : def; };
const MODEL = flag("model", "eleven_multilingual_v2");
const TAGS = (() => { const i = args.indexOf("--tags"); if (i < 0) return false; args.splice(i, 1); return true; })();
const [cmd, ...rest] = args;
const textFor = (b) => (TAGS ? TAGGED[b.id] : b.text);
if (TAGS && ["generate", "preview"].includes(cmd) && MODEL !== "eleven_v3") {
  console.error("--tags chỉ dùng với Eleven v3. Thêm: --model eleven_v3"); process.exit(1);
}

function key() {
  const k = process.env.ELEVENLABS_API_KEY;
  if (!k) { console.error("Thiếu ELEVENLABS_API_KEY."); process.exit(1); }
  return k;
}

async function api(path, init = {}) {
  const res = await fetch(API + path, { ...init, headers: { "xi-api-key": key(), ...init.headers } });
  if (!res.ok) throw new Error(`${init.method ?? "GET"} ${path} -> ${res.status}: ${(await res.text()).slice(0, 400)}`);
  return res;
}

// ---------- voices ----------
async function listVoices() {
  const own = (await (await api("/v2/voices?page_size=100")).json()).voices ?? [];
  const mine = own
    .filter((v) => (v.verified_languages ?? []).some((l) => l.language === "vi") || v.labels?.language === "vi")
    .map((v) => ({ voice_id: v.voice_id, name: v.name, gender: v.labels?.gender ?? "", accent: v.labels?.accent ?? "", desc: v.labels?.descriptive ?? v.labels?.description ?? "", use_case: v.labels?.use_case ?? "", source: "thư viện của em", preview_url: v.preview_url }));
  const shared = (await (await api("/v1/shared-voices?language=vi&gender=female&page_size=100")).json()).voices ?? [];
  const lib = shared.map((v) => ({ voice_id: v.voice_id, name: v.name, gender: v.gender, accent: v.accent ?? "", desc: v.descriptive ?? "", use_case: v.use_case ?? "", source: "Voice Library", public_owner_id: v.public_owner_id, preview_url: v.preview_url }));
  const all = [...mine, ...lib.filter((v) => !mine.some((m) => m.voice_id === v.voice_id))];
  mkdirSync(OUT, { recursive: true });
  writeFileSync(join(OUT, "voices.json"), JSON.stringify(all, null, 2));
  console.log(`${all.length} giọng hỗ trợ tiếng Việt (giọng nữ từ Voice Library + giọng tiếng Việt trong thư viện của em):\n`);
  console.log("voice_id                 | tên                          | giới tính | giọng vùng   | mô tả        | dùng cho          | nguồn");
  for (const v of all) console.log([v.voice_id.padEnd(24), v.name.slice(0, 28).padEnd(28), String(v.gender).padEnd(9), String(v.accent).slice(0, 12).padEnd(12), String(v.desc).slice(0, 12).padEnd(12), String(v.use_case).slice(0, 17).padEnd(17), v.source].join(" | "));
  console.log(`\nĐã lưu chi tiết (kèm link nghe mẫu) vào vo/voices.json`);
}

// Giọng trong Voice Library phải được thêm vào thư viện trước khi dùng qua API.
async function ensureVoice(voiceId) {
  const res = await fetch(`${API}/v1/voices/${voiceId}`, { headers: { "xi-api-key": key() } });
  if (res.ok) return;
  const cache = existsSync(join(OUT, "voices.json")) ? JSON.parse(readFileSync(join(OUT, "voices.json"))) : [];
  const v = cache.find((x) => x.voice_id === voiceId && x.public_owner_id);
  if (!v) throw new Error(`Không tìm thấy giọng ${voiceId}. Chạy lệnh "voices" trước.`);
  await api(`/v1/voices/add/${v.public_owner_id}/${voiceId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ new_name: v.name }) });
  console.log(`Đã thêm giọng "${v.name}" vào thư viện.`);
}

async function tts(voiceId, text, file) {
  const res = await api(`/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "audio/mpeg" },
    body: JSON.stringify({ text, model_id: MODEL, language_code: "vi", voice_settings: VOICE_SETTINGS }),
  });
  writeFileSync(file, Buffer.from(await res.arrayBuffer()));
}

// ---------- audio ----------
async function duration(file) {
  const input = new Input({ source: new BufferSource(readFileSync(file)), formats: ALL_FORMATS });
  return input.computeDuration();
}

function concat() {
  const files = BLOCKS.map((b) => join(OUT, `${b.id}.mp3`));
  const missing = files.filter((f) => !existsSync(f));
  if (missing.length) throw new Error(`Thiếu file: ${missing.join(", ")}`);
  const inputs = [];
  const labels = [];
  files.forEach((f, i) => {
    inputs.push("-i", f);
    labels.push(`[${i}:a]`);
  });
  for (let i = 0; i < files.length - 1; i++) inputs.push("-f", "lavfi", "-t", String(GAP_SECONDS), "-i", "anullsrc=r=44100:cl=mono");
  const parts = [];
  files.forEach((_, i) => {
    parts.push(`[${i}:a]aformat=sample_rates=44100:channel_layouts=mono[b${i}]`);
    if (i < files.length - 1) parts.push(`[${files.length + i}:a]aformat=sample_rates=44100:channel_layouts=mono[s${i}]`);
  });
  const seq = files.map((_, i) => (i < files.length - 1 ? `[b${i}][s${i}]` : `[b${i}]`)).join("");
  const n = files.length * 2 - 1;
  const filter = `${parts.join(";")};${seq}concat=n=${n}:v=0:a=1[out]`;
  execFileSync(ffmpegPath, ["-y", "-loglevel", "error", ...inputs, "-filter_complex", filter, "-map", "[out]", "-c:a", "libmp3lame", "-b:a", "128k", join(OUT, "vo_full.mp3")]);
}

async function table() {
  console.log("\ntên file     | thời lượng (s) | tổng dồn (s)");
  console.log("-------------|----------------|-------------");
  let t = 0;
  for (const [i, b] of BLOCKS.entries()) {
    const d = await duration(join(OUT, `${b.id}.mp3`));
    t += d;
    console.log(`${b.id}.mp3       | ${d.toFixed(2).padStart(14)} | ${t.toFixed(2).padStart(11)}`);
    if (i < BLOCKS.length - 1) t += GAP_SECONDS;
  }
  const full = await duration(join(OUT, "vo_full.mp3"));
  console.log(`vo_full.mp3  | ${full.toFixed(2).padStart(14)} |`);
  console.log(`\n"Tổng dồn" = thời điểm block đó KẾT THÚC trong vo_full.mp3 (đã tính ${GAP_SECONDS}s lặng giữa các block). Sai số khoảng ±0.1s do đệm MP3.`);
  if (full > MAX_TOTAL_SECONDS) console.log(`\nCẢNH BÁO: tổng ${full.toFixed(2)}s vượt ${MAX_TOTAL_SECONDS}s, cần cắt bớt chữ (không tăng tốc độ đọc).`);
  else console.log(`\nTổng ${full.toFixed(2)}s, trong giới hạn ${MAX_TOTAL_SECONDS}s.`);
}

// ---------- check bằng speech-to-text ----------
const norm = (s) => s.normalize("NFC").toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, " ").split(/\s+/).filter(Boolean);

async function check() {
  console.log("Nghe lại bằng ElevenLabs Speech-to-Text (scribe_v1), so với kịch bản:\n");
  for (const b of BLOCKS) {
    const form = new FormData();
    form.append("model_id", "scribe_v1");
    form.append("language_code", "vi");
    form.append("file", new Blob([readFileSync(join(OUT, `${b.id}.mp3`))], { type: "audio/mpeg" }), `${b.id}.mp3`);
    const heard = (await (await api("/v1/speech-to-text", { method: "POST", body: form })).json()).text ?? "";
    const want = norm(b.text), got = norm(heard);
    const missing = want.filter((w) => !got.includes(w));
    const extra = got.filter((w) => !want.includes(w));
    const hasDigits = /\d/.test(heard);
    const numIssues = (NUMBER_PHRASES[b.id] ?? []).filter((p) => !norm(heard).join(" ").includes(norm(p).join(" ")));
    const ok = !missing.length && !extra.length;
    console.log(`BLOCK_${b.id}: ${ok ? "khớp kịch bản" : "CÓ KHÁC BIỆT"}`);
    console.log(`  nghe được: ${heard}`);
    if (missing.length) console.log(`  thiếu/sai từ: ${missing.join(", ")}`);
    if (extra.length) console.log(`  từ lạ: ${extra.join(", ")}`);
    if (numIssues.length) console.log(`  cụm số cần nghe lại: ${numIssues.join("; ")}${hasDigits ? " (STT ghi thành chữ số, có thể vẫn đọc đúng)" : ""}`);
    console.log();
  }
  console.log("Lưu ý: đây là máy nghe lại. Sai dấu tiếng Việt kiểu nhẹ (ví dụ ngã/hỏi) vẫn nên nghe tai để chắc.");
}

// ---------- paste / split: dùng khi tạo 1 lần trên web ElevenLabs ----------
// Giữa các block chèn một thẻ ngắt <break time="1.5s" />. Đây là thẻ điều khiển, không được đọc ra thành chữ.
const BREAK = '<break time="1.5s" />';

function pasteText() {
  // v3 không hiểu <break>, dùng [pause]. Khoảng lặng v3 không chỉnh được độ dài, nên split có thể cần --min-silence thấp hơn.
  return BLOCKS.map(textFor).join(`\n\n${TAGS ? "[pause]" : BREAK}\n\n`);
}

function detectSilences(file, noise, minSilence) {
  const r = spawnSync(ffmpegPath, ["-hide_banner", "-i", file, "-af", `silencedetect=noise=${noise}dB:d=${minSilence}`, "-f", "null", "-"], { encoding: "utf8" });
  const starts = [...r.stderr.matchAll(/silence_start: (-?[\d.]+)/g)].map((m) => Math.max(0, parseFloat(m[1])));
  const ends = [...r.stderr.matchAll(/silence_end: ([\d.]+)/g)].map((m) => parseFloat(m[1]));
  return starts.map((s, i) => ({ start: s, end: ends[i] ?? Infinity }));
}

async function split(file, noise, minSilence) {
  if (!file || !existsSync(file)) throw new Error(`Không thấy file: ${file ?? "(chưa nhập)"}`);
  const total = await duration(file);
  const silences = detectSilences(file, noise, minSilence);
  const segments = [];
  let cursor = 0;
  for (const s of silences) {
    if (s.start - cursor > 0.2) segments.push([cursor, s.start]);
    cursor = Math.min(s.end, total);
  }
  if (total - cursor > 0.2) segments.push([cursor, total]);

  if (segments.length !== BLOCKS.length) {
    console.error(`Tìm thấy ${segments.length} đoạn, cần ${BLOCKS.length}. Không tách để tránh cắt sai.`);
    console.error(`Các khoảng lặng dài ≥ ${minSilence}s đã phát hiện:`);
    for (const s of silences) console.error(`  ${s.start.toFixed(2)}s -> ${Number.isFinite(s.end) ? s.end.toFixed(2) : "hết file"}s`);
    console.error(`\nThử: --min-silence ${(minSilence * 0.7).toFixed(1)} (nếu thiếu đoạn) hoặc --min-silence ${(minSilence * 1.5).toFixed(1)} (nếu thừa đoạn).`);
    process.exit(1);
  }
  const PAD = 0.05;
  for (const [i, [a, b]] of segments.entries()) {
    const out = join(OUT, `${BLOCKS[i].id}.mp3`);
    execFileSync(ffmpegPath, ["-y", "-loglevel", "error", "-i", file, "-ss", String(Math.max(0, a - PAD)), "-to", String(Math.min(total, b + PAD)), "-c:a", "libmp3lame", "-b:a", "128k", out]);
    console.log(`Đã tạo vo/${BLOCKS[i].id}.mp3  (${a.toFixed(2)}s -> ${b.toFixed(2)}s trong file gốc)`);
  }
  concat();
  await table();
  console.log("\nĐoạn nào trong vo/ nghe bị cắt cụt hoặc lẫn tiếng block khác thì báo lại, đừng dùng.");
}

// ---------- commands ----------
mkdirSync(OUT, { recursive: true });
if (cmd === "voices") await listVoices();
else if (cmd === "preview") {
  if (rest.length !== 2) { console.error("Cần đúng 2 voice_id: preview <voiceA> <voiceB>"); process.exit(1); }
  mkdirSync(join(OUT, "preview"), { recursive: true });
  const b8 = BLOCKS.find((b) => b.id === "08");
  for (const v of rest) {
    await ensureVoice(v);
    const f = join(OUT, "preview", `08_${v}.mp3`);
    await tts(v, textFor(b8), f);
    console.log(`Đã tạo ${f} (${(await duration(f)).toFixed(2)}s)`);
  }
  console.log("\nNghe 2 file trên rồi chọn giọng. Chưa chạy hàng loạt.");
} else if (cmd === "generate") {
  const [v] = rest;
  if (!v) { console.error("Cần voice_id: generate <voiceId>"); process.exit(1); }
  await ensureVoice(v);
  for (const b of BLOCKS) { await tts(v, textFor(b), join(OUT, `${b.id}.mp3`)); console.log(`Đã tạo vo/${b.id}.mp3`); }
  writeFileSync(join(OUT, "settings.json"), JSON.stringify({ voice_id: v, model_id: MODEL, voice_settings: VOICE_SETTINGS, created: new Date().toISOString() }, null, 2));
  concat();
  await table();
} else if (cmd === "build") { concat(); await table(); }
else if (cmd === "paste") { console.log(pasteText()); }
else if (cmd === "split") await split(rest[0], flag("noise", "-40"), parseFloat(flag("min-silence", "1.0")));
else if (cmd === "check") await check();
else { console.log(readFileSync(new URL(import.meta.url)).toString().split("\n").slice(0, 10).join("\n")); process.exit(cmd ? 1 : 0); }
