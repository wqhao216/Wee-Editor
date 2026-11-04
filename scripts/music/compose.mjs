// Nhạc nền gốc cho video BloomMate, tự tổng hợp bằng code (không dùng mẫu có bản quyền).
// Lo-fi ấm, 92 BPM, vòng Fmaj7 - Em7 - Dm7 - Cmaj7.
//   node scripts/music/compose.mjs <out.wav> [seconds]
import { writeFileSync } from "node:fs";

const SR = 44100;
const OUT = process.argv[2] ?? "music.wav";
const SECONDS = Number(process.argv[3] ?? 110);
const BPM = 92;
const BEAT = 60 / BPM;
const BAR = BEAT * 4;
const N = Math.ceil(SECONDS * SR);
const L = new Float32Array(N);
const R = new Float32Array(N);
// Bus riêng cho phần cần reverb
const RL = new Float32Array(N);
const RR = new Float32Array(N);
// Bus bị "nén theo trống" (pad, keys)
const DL = new Float32Array(N);
const DR = new Float32Array(N);
const duck = new Float32Array(N).fill(1);

let seed = 7;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296);
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);

// Cấu trúc theo ô nhịp
const totalBars = Math.ceil(SECONDS / BAR);
const section = (bar) => {
  if (bar < 4) return "intro";
  if (bar < 12) return "a";
  if (bar < 20) return "b";
  if (bar < 28) return "a2";
  if (bar < 30) return "break";
  return "outro";
};

const CHORDS = [
  { root: 41, notes: [53, 57, 60, 64] }, // Fmaj7
  { root: 40, notes: [52, 55, 59, 62] }, // Em7
  { root: 38, notes: [50, 53, 57, 60] }, // Dm7
  { root: 36, notes: [48, 52, 55, 59] }, // Cmaj7
];

function add(buf, i, v) { if (i >= 0 && i < N) buf[i] += v; }

// Piano điện: vài hoạ âm, tắt dần, rung nhẹ
function ep(t0, midi, dur, vel, pan = 0) {
  const f = mtof(midi);
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor((dur + 1.2) * SR);
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const att = Math.min(1, t / 0.006);
    const rel = t > dur ? Math.exp(-(t - dur) * 6) : 1;
    const env = att * rel * Math.exp(-t * 1.6);
    const trem = 1 + 0.06 * Math.sin(2 * Math.PI * 4.5 * t);
    const bell = Math.exp(-t * 9);
    const v = (Math.sin(2 * Math.PI * f * t) + 0.25 * Math.sin(2 * Math.PI * 2 * f * t) * bell + 0.08 * Math.sin(2 * Math.PI * 3.01 * f * t) * bell) * env * trem * vel;
    add(DL, s0 + k, v * gl); add(DR, s0 + k, v * gr);
    add(RL, s0 + k, v * gl * 0.35); add(RR, s0 + k, v * gr * 0.35);
  }
}

// Pad mềm: sóng sin lệch tần nhẹ, vào/ra chậm
function pad(t0, notes, dur, vel) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor((dur + 0.8) * SR);
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const env = Math.min(1, t / 0.8) * (t > dur ? Math.max(0, 1 - (t - dur) / 0.8) : 1);
    let l = 0, r = 0;
    for (const m of notes) {
      const f = mtof(m + 12);
      l += Math.sin(2 * Math.PI * f * 0.997 * t) + 0.3 * Math.sin(2 * Math.PI * f * 2 * t);
      r += Math.sin(2 * Math.PI * f * 1.003 * t) + 0.3 * Math.sin(2 * Math.PI * f * 2.004 * t);
    }
    add(DL, s0 + k, l * env * vel); add(DR, s0 + k, r * env * vel);
    add(RL, s0 + k, l * env * vel * 0.5); add(RR, s0 + k, r * env * vel * 0.5);
  }
}

// Đàn gảy Karplus-Strong + tiếng vọng nốt chấm dôi
function pluck(t0, midi, vel, pan = 0) {
  const f = mtof(midi);
  const period = Math.round(SR / f);
  const line = new Float32Array(period);
  for (let i = 0; i < period; i++) line[i] = (rnd() * 2 - 1);
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor(1.6 * SR);
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  let idx = 0, prev = 0;
  const echo = Math.floor(BEAT * 0.75 * SR);
  for (let k = 0; k < len; k++) {
    const cur = line[idx];
    const nxt = 0.5 * (cur + prev) * 0.996;
    prev = cur; line[idx] = nxt; idx = (idx + 1) % period;
    const v = cur * vel * Math.min(1, k / 40);
    add(L, s0 + k, v * gl); add(R, s0 + k, v * gr);
    add(L, s0 + k + echo, v * gr * 0.35); add(R, s0 + k + echo, v * gl * 0.35);
    add(L, s0 + k + 2 * echo, v * gl * 0.15); add(R, s0 + k + 2 * echo, v * gr * 0.15);
    add(RL, s0 + k, v * 0.4); add(RR, s0 + k, v * 0.4);
  }
}

function bass(t0, midi, dur, vel) {
  const f = mtof(midi);
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor((dur + 0.1) * SR);
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const env = Math.min(1, t / 0.01) * (t > dur ? Math.exp(-(t - dur) * 30) : 1) * (0.7 + 0.3 * Math.exp(-t * 3));
    const v = (Math.sin(2 * Math.PI * f * t) + 0.15 * Math.sin(2 * Math.PI * 2 * f * t)) * env * vel;
    add(L, s0 + k, v); add(R, s0 + k, v);
  }
}

function kick(t0, vel) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor(0.35 * SR);
  let ph = 0;
  for (let k = 0; k < len; k++) {
    const t = k / SR;
    const f = 45 + 75 * Math.exp(-t * 28);
    ph += 2 * Math.PI * f / SR;
    const v = Math.sin(ph) * Math.exp(-t * 9) * vel;
    add(L, s0 + k, v); add(R, s0 + k, v);
  }
  // nén pad/keys nhẹ theo trống cho có nhịp thở
  const dlen = Math.floor(0.3 * SR);
  for (let k = 0; k < dlen; k++) { const i = s0 + k; if (i < N) duck[i] = Math.min(duck[i], 1 - 0.35 * Math.exp(-k / SR * 10)); }
}

function noiseHit(t0, decay, vel, hp, pan = 0) {
  const s0 = Math.floor(t0 * SR);
  const len = Math.floor(decay * 6 * SR);
  let x1 = 0, y1 = 0;
  const gl = Math.cos((pan + 1) * Math.PI / 4), gr = Math.sin((pan + 1) * Math.PI / 4);
  for (let k = 0; k < len; k++) {
    const x = rnd() * 2 - 1;
    const y = hp * (y1 + x - x1); x1 = x; y1 = y;
    const v = y * Math.exp(-(k / SR) / decay) * vel;
    add(L, s0 + k, v * gl); add(R, s0 + k, v * gr);
    add(RL, s0 + k, v * 0.2); add(RR, s0 + k, v * 0.2);
  }
}

// Giai điệu ngũ cung, mỗi 2 ô nhịp một câu
const MOTIFS = [
  [[0, 72], [0.75, 74], [1.5, 76], [2.5, 79], [3.5, 76], [5, 74], [6, 72], [7, 69]],
  [[0, 76], [1, 74], [1.5, 72], [2.5, 69], [4, 72], [5, 74], [5.75, 76], [6.5, 74]],
  [[0, 81], [0.75, 79], [1.5, 76], [3, 74], [4, 76], [4.75, 79], [6, 76], [7, 72]],
  [[0, 74], [1, 76], [2, 79], [3, 81], [4.5, 79], [5.5, 76], [6.5, 74], [7.25, 72]],
];

for (let bar = 0; bar < totalBars; bar++) {
  const sec = section(bar);
  const t = bar * BAR;
  const ch = CHORDS[bar % 4];
  const swing = (b) => b + (b % 1 === 0.5 ? 0.06 : 0); // swing nhẹ cho nốt móc
  const hum = () => (rnd() - 0.5) * 0.012;

  // keys: nhịp 1 (dài), 2.5 và 3.75 (ngắn)
  const kv = sec === "intro" ? 0.13 : sec === "break" ? 0.12 : 0.15;
  for (const m of ch.notes) {
    ep(t + hum(), m, BEAT * 1.4, kv, (m - 56) / 20);
    if (sec !== "intro") ep(t + swing(1.5) * BEAT + hum(), m, BEAT * 0.4, kv * 0.6, (m - 56) / 20);
    ep(t + swing(2.5) * BEAT + hum(), m, BEAT * 0.9, kv * 0.75, (m - 56) / 20);
  }
  pad(t, ch.notes, BAR, sec === "break" ? 0.028 : 0.02);

  if (sec !== "intro" && sec !== "break") {
    bass(t, ch.root, BEAT * 1.6, 0.33);
    bass(t + 2.5 * BEAT, ch.root, BEAT * 0.4, 0.22);
    bass(t + 3 * BEAT, ch.root + (bar % 2 ? 7 : 12), BEAT * 0.8, 0.26);
    kick(t, 0.75); kick(t + 2.5 * BEAT, 0.5);
    if (bar % 2 === 1) kick(t + 3.25 * BEAT, 0.35);
    for (const b of [1, 3]) noiseHit(t + b * BEAT, 0.045, 0.22, 0.6, 0.1);
    for (let e = 0; e < 8; e++) noiseHit(t + swing(e / 2) * BEAT + hum(), 0.012, e % 2 ? 0.1 : 0.055, 0.95, 0.3);
  }
  if (sec === "intro" && bar >= 2) for (let e = 0; e < 8; e++) noiseHit(t + swing(e / 2) * BEAT, 0.012, 0.04, 0.95, 0.3);

  // giai điệu đàn gảy ở đoạn b, a2, outro
  if ((sec === "b" || sec === "a2" || sec === "outro") && bar % 2 === 0) {
    const motif = MOTIFS[(bar / 2) % MOTIFS.length];
    for (const [b, m] of motif) pluck(t + b * BEAT + hum(), m, sec === "b" ? 0.22 : 0.18, ((m % 5) - 2) / 4);
  }
}

// Reverb Schroeder đơn giản cho bus reverb
function reverb(inp, delays, fb) {
  const out = new Float32Array(N);
  for (const d of delays) {
    const buf = new Float32Array(d); let i = 0, lp = 0;
    for (let n = 0; n < N; n++) {
      const y = buf[i]; lp = lp * 0.4 + y * 0.6;
      buf[i] = inp[n] + lp * fb; i = (i + 1) % d; out[n] += y / delays.length;
    }
  }
  for (const d of [556, 441]) {
    const buf = new Float32Array(d); let i = 0;
    for (let n = 0; n < N; n++) { const b = buf[i]; const y = -out[n] + b; buf[i] = out[n] + b * 0.5; i = (i + 1) % d; out[n] = y; }
  }
  return out;
}
const revL = reverb(RL, [1557, 1617, 1491, 1422], 0.82);
const revR = reverb(RR, [1580, 1640, 1514, 1445], 0.82);

// Trộn, lọc thông thấp nhẹ cho ấm, fade in/out, chuẩn hoá
let lpL = 0, lpR = 0, peak = 0;
const fadeIn = 1.5 * SR, fadeOut = 4 * SR;
for (let n = 0; n < N; n++) {
  let l = L[n] + DL[n] * duck[n] + revL[n] * 0.5;
  let r = R[n] + DR[n] * duck[n] + revR[n] * 0.5;
  lpL += 0.55 * (l - lpL); lpR += 0.55 * (r - lpR);
  const g = Math.min(1, n / fadeIn) * Math.min(1, (N - n) / fadeOut);
  L[n] = Math.tanh(lpL * 1.1) * g; R[n] = Math.tanh(lpR * 1.1) * g;
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
const norm = 0.89 / peak;
const data = Buffer.alloc(44 + N * 4);
data.write("RIFF", 0); data.writeUInt32LE(36 + N * 4, 4); data.write("WAVE", 8);
data.write("fmt ", 12); data.writeUInt32LE(16, 16); data.writeUInt16LE(1, 20); data.writeUInt16LE(2, 22);
data.writeUInt32LE(SR, 24); data.writeUInt32LE(SR * 4, 28); data.writeUInt16LE(4, 32); data.writeUInt16LE(16, 34);
data.write("data", 36); data.writeUInt32LE(N * 4, 40);
for (let n = 0; n < N; n++) {
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, L[n] * norm)) * 32767), 44 + n * 4);
  data.writeInt16LE(Math.round(Math.max(-1, Math.min(1, R[n] * norm)) * 32767), 46 + n * 4);
}
writeFileSync(OUT, data);
console.log(`Đã tạo ${OUT}: ${SECONDS}s, ${BPM} BPM, ${totalBars} ô nhịp`);
