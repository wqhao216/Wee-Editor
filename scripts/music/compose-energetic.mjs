// Energetic commercial track for the BloomMate demo, synthesised from scratch (no samples, no licences).
// 120 BPM, D major, I–V–vi–IV. Reads the video timeline so impacts, whooshes and drops hit the cuts.
//   node scripts/music/compose-energetic.mjs public/music.wav
import { writeFileSync } from "node:fs";
import { BPM, SEG_STARTS, TIMELINE, TOTAL_BEATS } from "../../src/bloommate/edl.ts";

const SR = 44100;
const OUT = process.argv[2] ?? "music.wav";
const BEAT = 60 / BPM;
const TAIL = 3; // seconds after the last beat
const N = Math.ceil((TOTAL_BEATS * BEAT + TAIL) * SR);
const bt = (b) => b * BEAT; // beat -> seconds

// ---- song map taken from the video timeline ----
const titles = TIMELINE.map((s, i) => (s.kind === "title" ? SEG_STARTS[i] : null)).filter((b) => b !== null);
const END = SEG_STARTS[TIMELINE.findIndex((s) => s.kind === "end")];
const DROP = titles[0]; // full drop when step 1 starts
const SCENE5 = titles[4];
const BREAK = [titles[3] + 2, titles[3] + 6]; // short breath on the "original photo" card
const FINAL_HIT = TOTAL_BEATS - 4;

const energy = (b) => {
  if (b < 8) return 0; // filtered intro
  if (b < DROP) return 1; // groove-lite
  if (b >= BREAK[0] && b < BREAK[1]) return 1.5; // breakdown (no kick)
  if (b >= FINAL_HIT) return 0;
  return 2; // full
};

// ---- buffers ----
const mk = () => [new Float32Array(N), new Float32Array(N)];
const drums = mk(), bass = mk(), chords = mk(), leads = mk(), fx = mk(), send = mk();
const duck = new Float32Array(N).fill(1);
let seed = 11;
const rnd = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296) * 2 - 1;
const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
const put = (bus, i, l, r) => { if (i >= 0 && i < N) { bus[0][i] += l; bus[1][i] += r; } };
const panLR = (p) => [Math.cos(((p + 1) * Math.PI) / 4), Math.sin(((p + 1) * Math.PI) / 4)];

// band-limited saw (polyBLEP)
function blep(t, dt) {
  if (t < dt) { t /= dt; return t + t - t * t - 1; }
  if (t > 1 - dt) { t = (t - 1) / dt; return t * t + t + t + 1; }
  return 0;
}
function saw(phase, dt) { return 2 * phase - 1 - blep(phase, dt); }

// simple state-variable low-pass, mutable cutoff
function svf() {
  let lp = 0, bp = 0;
  return (x, fc, q = 0.7) => {
    const f = 2 * Math.sin((Math.PI * Math.min(fc, SR / 6)) / SR);
    lp += f * bp; const hp = x - lp - q * bp; bp += f * hp; return lp;
  };
}

// ---- instruments ----
function kick(t0, vel = 1) {
  const s0 = Math.floor(t0 * SR), len = Math.floor(0.42 * SR); let ph = 0;
  for (let k = 0; k < len; k++) {
    const t = k / SR, f = 48 + 110 * Math.exp(-t * 30);
    ph += (2 * Math.PI * f) / SR;
    const v = (Math.sin(ph) * Math.exp(-t * 7) + (k < 90 ? rnd() * 0.25 * (1 - k / 90) : 0)) * vel;
    put(drums, s0 + k, v, v);
  }
  const d = Math.floor(0.26 * SR);
  for (let k = 0; k < d; k++) { const i = s0 + k; if (i < N) duck[i] = Math.min(duck[i], 1 - 0.72 * Math.pow(1 - k / d, 1.6)); }
}
function noiseHit(t0, decay, vel, hpA, pan = 0, toSend = 0) {
  const s0 = Math.floor(t0 * SR), len = Math.floor(decay * 7 * SR); const [gl, gr] = panLR(pan);
  let x1 = 0, y1 = 0;
  for (let k = 0; k < len; k++) {
    const x = rnd(); const y = hpA * (y1 + x - x1); x1 = x; y1 = y;
    const v = y * Math.exp(-k / SR / decay) * vel;
    put(drums, s0 + k, v * gl, v * gr); if (toSend) put(send, s0 + k, v * toSend, v * toSend);
  }
}
function clap(t0, vel = 1) {
  for (const [o, g] of [[0, 0.7], [0.011, 0.8], [0.022, 1]]) noiseHit(t0 + o, o < 0.02 ? 0.012 : 0.09, 0.55 * vel * g, 0.75, 0, 0.5);
}
function snare(t0, vel = 1) {
  noiseHit(t0, 0.06, 0.45 * vel, 0.7, 0, 0.25);
  const s0 = Math.floor(t0 * SR);
  for (let k = 0; k < 0.08 * SR; k++) { const v = Math.sin((2 * Math.PI * 190 * k) / SR) * Math.exp(-k / SR / 0.03) * 0.35 * vel; put(drums, s0 + k, v, v); }
}
function crash(t0, vel = 1) {
  const s0 = Math.floor(t0 * SR), len = Math.floor(2.2 * SR); let x1 = 0, y1 = 0;
  for (let k = 0; k < len; k++) {
    const x = rnd(); const y = 0.92 * (y1 + x - x1); x1 = x; y1 = y;
    const e = Math.exp(-k / SR / 0.55) * vel * 0.32;
    put(fx, s0 + k, y * e * (1 + rnd() * 0.1), y * e); put(send, s0 + k, y * e * 0.3, y * e * 0.3);
  }
}
function impact(t0, vel = 1) {
  const s0 = Math.floor(t0 * SR), len = Math.floor(1.4 * SR); let ph = 0;
  for (let k = 0; k < len; k++) {
    const t = k / SR, f = 32 + 60 * Math.exp(-t * 6); ph += (2 * Math.PI * f) / SR;
    const v = Math.tanh(Math.sin(ph) * 1.6) * Math.exp(-t * 2.6) * 0.7 * vel;
    put(fx, s0 + k, v, v);
  }
  crash(t0, vel);
}
// reverse cymbal / whoosh that ends exactly on t1
function whoosh(t1, dur, vel = 1) {
  const len = Math.floor(dur * SR), s0 = Math.floor(t1 * SR) - len; const f = svf(), g = svf();
  for (let k = 0; k < len; k++) {
    const p = k / len, x = rnd();
    const fc = 400 + 9000 * p * p;
    const y = f(x, fc, 0.3) - g(x, fc * 0.25, 0.7) * 0.6;
    const v = y * Math.pow(p, 2.2) * 0.55 * vel;
    put(fx, s0 + k, v * (1 - 0.3 * Math.sin(p * 9)), v * (1 + 0.3 * Math.sin(p * 9)));
  }
}
function riser(t1, dur, vel = 1) {
  const len = Math.floor(dur * SR), s0 = Math.floor(t1 * SR) - len; const f = svf(); let ph = 0;
  for (let k = 0; k < len; k++) {
    const p = k / len; const fc = 300 + 7000 * p * p;
    ph += (2 * Math.PI * (220 + 660 * p * p)) / SR;
    const v = (f(rnd(), fc, 0.2) * 0.5 + Math.sin(ph) * 0.12) * p * p * 0.5 * vel;
    put(fx, s0 + k, v, v); put(send, s0 + k, v * 0.3, v * 0.3);
  }
}
function snareRoll(b0, b1, vel = 1) {
  let b = b0;
  while (b < b1 - 1e-6) {
    const p = (b - b0) / (b1 - b0);
    const step = p < 0.5 ? 0.5 : p < 0.75 ? 0.25 : 0.125;
    snare(bt(b), (0.35 + 0.65 * p) * vel); b += step;
  }
}

// Supersaw chord pad with pump (sidechain) and an automatable low-pass
const CHORDS = [
  { root: 38, notes: [57, 62, 66, 69, 74] }, // D
  { root: 33, notes: [57, 61, 64, 69, 73] }, // A
  { root: 35, notes: [59, 62, 66, 71, 74] }, // Bm
  { root: 31, notes: [59, 62, 67, 71, 74] }, // G
];
const chordAt = (b) => CHORDS[Math.floor(b / 4) % 4];

function renderChords() {
  const lpL = svf(), lpR = svf();
  const voices = [];
  const DET = [-0.11, 0, 0.11];
  for (let n = 0; n < 5; n++) for (const d of DET) voices.push({ n, d, ph: (rnd() + 1) / 2 });
  for (let i = 0; i < N; i++) {
    const t = i / SR, b = t / BEAT;
    if (b >= TOTAL_BEATS) break;
    const ch = chordAt(b);
    const e = energy(b);
    let l = 0, r = 0;
    for (let v = 0; v < voices.length; v++) {
      const vo = voices[v]; const f = mtof(ch.notes[vo.n] + vo.d); const dt = f / SR;
      vo.ph += dt; if (vo.ph >= 1) vo.ph -= 1;
      const s = saw(vo.ph, dt);
      if (vo.d < 0) l += s; else if (vo.d > 0) r += s; else { l += s * 0.7; r += s * 0.7; }
    }
    // cutoff: closed in intro, opening into the drop; darker in breakdown
    let fc = 5200;
    if (b < 8) fc = 350 + 1400 * (b / 8) ** 2;
    else if (b < DROP) fc = 1800 + 2600 * ((b - 8) / (DROP - 8));
    else if (e === 1.5) fc = 1500;
    const gate = e === 0 && b >= FINAL_HIT ? Math.exp(-(t - bt(FINAL_HIT)) * 1.2) : 1;
    const g = 0.035 * gate * (e === 1.5 ? 0.8 : 1);
    const pump = b < 8 || e === 1.5 ? 1 : duck[i];
    const L = lpL(l, fc, 0.6) * g * pump, R = lpR(r, fc, 0.6) * g * pump;
    chords[0][i] += L; chords[1][i] += R; send[0][i] += L * 0.35; send[1][i] += R * 0.35;
  }
}

function bassNote(t0, midi, dur, vel = 1) {
  const s0 = Math.floor(t0 * SR), len = Math.floor((dur + 0.03) * SR); const f = mtof(midi), dt = f / SR; const lp = svf(); let ph = 0;
  for (let k = 0; k < len; k++) {
    ph += dt; if (ph >= 1) ph -= 1;
    const t = k / SR; const env = Math.min(1, t / 0.004) * (t > dur ? Math.exp(-(t - dur) * 60) : 1);
    const y = lp(saw(ph, dt), 300 + 1500 * Math.exp(-t * 18), 0.5) * 0.6 + Math.sin(2 * Math.PI * ph) * 0.55;
    const v = y * env * 0.42 * vel; put(bass, s0 + k, v, v);
  }
}

function pluck(t0, midi, vel, pan, decay = 0.16) {
  const s0 = Math.floor(t0 * SR), len = Math.floor((decay * 5 + 0.05) * SR); const f = mtof(midi), dt = f / SR; const lp = svf(); let ph = 0, ph2 = 0;
  const [gl, gr] = panLR(pan); const echo = Math.floor(BEAT * 0.75 * SR);
  for (let k = 0; k < len; k++) {
    ph += dt; if (ph >= 1) ph -= 1; ph2 += dt * 1.004; if (ph2 >= 1) ph2 -= 1;
    const t = k / SR; const env = Math.min(1, t / 0.002) * Math.exp(-t / decay);
    const y = lp(saw(ph, dt) + saw(ph2, dt * 1.004), 1200 + 6000 * Math.exp(-t * 22), 0.5) * env * vel;
    put(leads, s0 + k, y * gl, y * gr); put(leads, s0 + k + echo, y * gr * 0.3, y * gl * 0.3);
    put(send, s0 + k, y * 0.3, y * 0.3);
  }
}
function leadNote(t0, midi, dur, vel) {
  const s0 = Math.floor(t0 * SR), len = Math.floor((dur + 0.25) * SR); const f0 = mtof(midi); const lp = svf(); let ph = 0, ph2 = 0;
  for (let k = 0; k < len; k++) {
    const t = k / SR; const vib = 1 + 0.004 * Math.sin(2 * Math.PI * 5.5 * t) * Math.min(1, t / 0.2);
    const dt = (f0 * vib) / SR; ph += dt; if (ph >= 1) ph -= 1; ph2 += dt * 1.006; if (ph2 >= 1) ph2 -= 1;
    const env = Math.min(1, t / 0.01) * (t > dur ? Math.exp(-(t - dur) * 14) : 1) * (0.75 + 0.25 * Math.exp(-t * 4));
    const y = lp(saw(ph, dt) + 0.8 * saw(ph2, dt * 1.006), 4200, 0.6) * env * vel;
    put(leads, s0 + k, y * 0.9, y); put(send, s0 + k, y * 0.45, y * 0.45);
  }
}

// ---- arrangement ----
for (let b = 0; b < TOTAL_BEATS; b++) {
  const e = energy(b);
  const t = bt(b);
  const ch = chordAt(b);
  const kickOn = (e === 1 || e === 2) && b >= 8;
  const stopBeat = titles.some((x) => b === x - 1) && b > DROP; // one-beat drop-out before each title
  if (kickOn && !stopBeat) kick(t, b % 4 === 0 ? 1 : 0.9);
  if (e === 2 && !stopBeat && (b % 2 === 1)) clap(t);
  if (e >= 1 && !stopBeat) {
    for (let s = 0; s < 4; s++) noiseHit(t + s * BEAT / 4, 0.012, (s === 2 ? 0.16 : 0.08) * (e === 2 ? 1 : 0.7), 0.97, 0.35);
    if (e !== 1.5) noiseHit(t + BEAT / 2, 0.11, 0.13, 0.95, -0.3);
  }
  // bass: offbeat 8ths (house), plus downbeat in full sections
  if ((e === 1 || e === 2) && b >= 8 && !stopBeat) {
    bassNote(t + BEAT / 2, ch.root + 12, BEAT * 0.38, 1);
    if (e === 2 && b % 4 === 0) bassNote(t, ch.root, BEAT * 0.35, 0.9);
  }
  // arp: 16ths over chord tones, in full + breakdown
  if ((e === 2 || e === 1.5) && !stopBeat) {
    const pat = [0, 2, 1, 3, 2, 4, 3, 1];
    for (let s = 0; s < 4; s++) {
      const idx = pat[(b * 4 + s) % pat.length];
      pluck(t + (s * BEAT) / 4, ch.notes[idx] + 12, e === 1.5 ? 0.06 : 0.05, ((s % 2) - 0.5) * 0.6);
    }
  }
}
renderChords();

// hook melody: in the report step and on the end card
const HOOK = [ // [beat offset in 8-beat phrase, midi, length in beats]
  [0, 78, 1], [1, 76, 0.5], [1.5, 74, 1], [2.5, 76, 0.5], [3, 78, 1.5],
  [4.5, 81, 0.5], [5, 78, 1], [6, 76, 0.5], [6.5, 74, 1.5],
];
for (const start of [titles[5] + 2, titles[5] + 10, END, END + 8]) {
  if (start + 8 > FINAL_HIT + 1) continue;
  for (const [o, m, l] of HOOK) leadNote(bt(start + o), m, bt(l) * 0.9, 0.055);
}

// FX on the edit points
impact(bt(8), 0.7);
riser(bt(8), bt(4), 0.6); snareRoll(6, 8, 0.6);
riser(bt(DROP), bt(8), 0.9); snareRoll(DROP - 4, DROP, 0.9);
impact(bt(DROP), 1.1);
for (const tb of titles.slice(1)) { whoosh(bt(tb), bt(1.5), 1); impact(bt(tb), 0.75); }
riser(bt(BREAK[1]), bt(BREAK[1] - BREAK[0]), 0.8); snareRoll(BREAK[1] - 2, BREAK[1], 0.8); impact(bt(BREAK[1]), 0.8);
riser(bt(END), bt(6), 1); snareRoll(END - 4, END, 1); impact(bt(END), 1.2);
// final chord hit + ring out
impact(bt(FINAL_HIT), 1);
for (const m of [50, 57, 62, 66, 69, 74]) leadNote(bt(FINAL_HIT), m, bt(3), 0.03);
bassNote(bt(FINAL_HIT), 26, bt(3), 1.2);

// ---- reverb on the send bus ----
function reverb(inp, delays, fb) {
  const out = new Float32Array(N);
  for (const d of delays) {
    const buf = new Float32Array(d); let i = 0, lp = 0;
    for (let n = 0; n < N; n++) { const y = buf[i]; lp = lp * 0.35 + y * 0.65; buf[i] = inp[n] + lp * fb; i = (i + 1) % d; out[n] += y / delays.length; }
  }
  for (const d of [556, 441, 341]) {
    const buf = new Float32Array(d); let i = 0;
    for (let n = 0; n < N; n++) { const b = buf[i]; const y = -out[n] + b; buf[i] = out[n] + b * 0.5; i = (i + 1) % d; out[n] = y; }
  }
  return out;
}
const rvL = reverb(send[0], [1557, 1617, 1491, 1422], 0.8);
const rvR = reverb(send[1], [1580, 1640, 1514, 1445], 0.8);

// ---- master: mix, glue compression via tanh, normalise ----
const L = new Float32Array(N), R = new Float32Array(N);
let peak = 0;
for (let n = 0; n < N; n++) {
  const pump = duck[n];
  let l = drums[0][n] + bass[0][n] * pump + chords[0][n] + leads[0][n] * (0.6 + 0.4 * pump) + fx[0][n] + rvL[n] * 0.35;
  let r = drums[1][n] + bass[1][n] * pump + chords[1][n] + leads[1][n] * (0.6 + 0.4 * pump) + fx[1][n] + rvR[n] * 0.35;
  const fade = Math.min(1, (N - n) / (1.5 * SR));
  L[n] = Math.tanh(l * 1.05) * fade; R[n] = Math.tanh(r * 1.05) * fade;
  peak = Math.max(peak, Math.abs(L[n]), Math.abs(R[n]));
}
const norm = 0.84 / peak;
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
console.log(`${OUT}: ${(N / SR).toFixed(1)} s, ${BPM} BPM, drop at beat ${DROP}, titles at beats ${titles.join(", ")}, end card at beat ${END}`);
