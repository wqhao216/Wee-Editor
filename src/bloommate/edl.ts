// Timeline of the BloomMate demo. Every segment length is counted in BEATS of the music
// (120 BPM, 1 beat = 0.5 s = 15 frames), so every cut lands on the beat.
// Shot times (start/end/cam/callouts) are SECONDS IN THE SOURCE RECORDING.
// rect = [x, y, width, height] as 0..1 of the recording frame. All numbers match what the recording shows.
import type { ShotDef } from "./Shot";

export const BPM = 120;
export const BEAT_SEC = 60 / BPM;

type ShotIn = Omit<ShotDef, "rate">;
const S = (s: ShotIn): ShotDef => ({ ...s, rate: (s.end - s.start) / (s.beats * BEAT_SEC) });
const wide = (t: number) => ({ t, z: 1, x: 0.5, y: 0.5 });

export const SCENE_TITLES = [
  null,
  { name: "EVENING CHECK", sub: "Close the day in one sentence", color: "#C9567A" },
  { name: "RESTOCK", sub: "Buy exactly what you need", color: "#5E7F43" },
  { name: "COMBOS", sub: "Turn expiring flowers into bouquets", color: "#C98A1E" },
  { name: "PHOTO & CAPTION", sub: "Sales-ready posts in a few taps", color: "#A8436A" },
  { name: "STOCK", sub: "See what to sell first", color: "#3F7A47" },
  { name: "REPORT", sub: "Watch the waste go down", color: "#2B211E" },
];

export type Seg =
  | { kind: "intro"; beats: number }
  | { kind: "title"; scene: number; beats: number }
  | { kind: "shot"; beats: number; shot: ShotDef }
  | { kind: "before"; beats: number }
  | { kind: "end"; beats: number };

const shot = (s: ShotIn): Seg => ({ kind: "shot", beats: s.beats, shot: S(s) });
const title = (scene: number): Seg => ({ kind: "title", scene, beats: 2 });

export const TIMELINE: Seg[] = [
  { kind: "intro", beats: 16 },

  // ---------- 1 · EVENING CHECK ----------
  title(1),
  shot({
    id: "1a-type", scene: 1, start: 2.3, end: 14.3, beats: 5,
    cam: [wide(2.3), { t: 5.5, z: 1.75, x: 0.56, y: 0.55 }],
    callouts: [{ from: 6, to: 14.3, rect: [0.29, 0.555, 0.545, 0.11] }],
    captions: [{ from: 2.6, to: 14.3, text: "End of day: just one sentence" }],
  }),
  shot({
    id: "1b-table", scene: 1, start: 16.2, end: 18.6, beats: 4,
    cam: [{ t: 16.2, z: 1.6, x: 0.56, y: 0.33 }, { t: 18.6, z: 1.7, x: 0.56, y: 0.36 }],
    callouts: [{ from: 16.3, to: 18.6, rect: [0.288, 0.412, 0.555, 0.058], label: "Table fills itself: 22 left, 3 thrown out", sfx: { name: "notification-pop", vol: 0.55 } }],
  }),
  shot({ id: "1c-close", scene: 1, start: 19.6, end: 23.9, beats: 2, cam: [wide(19.6)] }),
  shot({
    id: "1d-waste", scene: 1, start: 24.1, end: 27.4, beats: 6,
    cam: [wide(24.1), { t: 24.8, z: 1.9, x: 0.45, y: 0.45 }],
    callouts: [{ from: 24.7, to: 27.4, rect: [0.287, 0.41, 0.295, 0.165], label: "Today's waste: 8,400 ₫", sfx: { name: "handle-coins-2", vol: 1 } }],
    captions: [{ from: 24.3, to: 27.4, text: "Close the day, see the waste" }],
  }),
  shot({
    id: "1e-buy", scene: 1, start: 28.6, end: 31.0, beats: 4,
    cam: [{ t: 28.6, z: 1.9, x: 0.45, y: 0.45 }, { t: 29.2, z: 1.55, x: 0.72, y: 0.62 }],
    callouts: [{ from: 29.1, to: 31.0, rect: [0.598, 0.37, 0.247, 0.62] }],
    captions: [{ from: 28.7, to: 31.0, text: "Tomorrow's buy list, ready" }],
  }),

  // ---------- 2 · RESTOCK ----------
  title(2),
  shot({ id: "2a-nextday", scene: 2, start: 33.6, end: 38.6, beats: 2, cam: [wide(33.6)] }),
  shot({
    id: "2b-reason", scene: 2, start: 38.8, end: 41.6, beats: 5,
    cam: [wide(38.8), { t: 39.4, z: 2.0, x: 0.5, y: 0.42 }],
    callouts: [{ from: 39.3, to: 41.6, rect: [0.288, 0.388, 0.555, 0.062], label: "Every line explains itself" }],
    captions: [{ from: 39.4, to: 41.6, text: "Par 50 − 19 still fresh = buy 31" }],
  }),
  shot({
    id: "2d-speak", scene: 2, start: 67.4, end: 74.2, beats: 5,
    cam: [{ t: 67.4, z: 1.3, x: 0.56, y: 0.55 }, { t: 69, z: 1.5, x: 0.56, y: 0.62 }],
    callouts: [{ from: 69.2, to: 74.2, rect: [0.29, 0.58, 0.545, 0.095] }],
    captions: [{ from: 67.6, to: 74.2, text: "Log the delivery by voice" }],
  }),
  shot({
    id: "2e-row", scene: 2, start: 74.2, end: 76.6, beats: 4,
    cam: [{ t: 74.2, z: 1.5, x: 0.56, y: 0.62 }, { t: 74.8, z: 1.9, x: 0.56, y: 0.8 }],
    callouts: [{ from: 74.5, to: 76.6, rect: [0.288, 0.86, 0.555, 0.062], label: "Auto-added: red roses · 50 stems · 140,000 ₫", sfx: { name: "confirmation-001", vol: 0.55 } }],
  }),
  shot({
    id: "2f-save", scene: 2, start: 84.6, end: 86.4, beats: 3,
    cam: [{ t: 84.6, z: 1.5, x: 0.56, y: 0.75 }],
    callouts: [{ from: 84.6, to: 86.4, rect: [0.285, 0.88, 0.556, 0.055], label: "Saved to stock in one tap" }],
  }),

  // ---------- 3 · COMBOS ----------
  title(3),
  shot({
    id: "3a-today", scene: 3, start: 95.0, end: 97.6, beats: 3,
    cam: [wide(95.0), { t: 97.0, z: 1.35, x: 0.62, y: 0.4 }],
    captions: [{ from: 95.1, to: 97.6, text: "Expiring flowers → sellable bouquets" }],
  }),
  shot({
    id: "3b-combo", scene: 3, start: 98.4, end: 101.8, beats: 6,
    cam: [{ t: 98.4, z: 1.5, x: 0.68, y: 0.3 }, { t: 99.0, z: 1.9, x: 0.72, y: 0.3 }],
    callouts: [{ from: 98.7, to: 101.8, rect: [0.608, 0.312, 0.215, 0.042], label: "161,500 ₫ of expiring flowers inside", sfx: { name: "jingles-steel-08", vol: 0.45 } }],
    captions: [{ from: 98.4, to: 101.8, text: "Expiring flowers → sellable bouquets" }],
  }),
  shot({
    id: "3c-make", scene: 3, start: 102.2, end: 104.6, beats: 3,
    cam: [wide(102.2)],
    captions: [{ from: 102.5, to: 104.6, text: "Make it: stock updates itself" }],
  }),

  // ---------- 4 · PHOTO & CAPTION ----------
  title(4),
  { kind: "before", beats: 4 },
  shot({
    id: "4b-studio", scene: 4, start: 115.6, end: 118.0, beats: 4,
    cam: [{ t: 115.6, z: 1.3, x: 0.49, y: 0.55 }, { t: 118.0, z: 1.45, x: 0.49, y: 0.6 }],
    callouts: [{ from: 116.1, to: 118.0, rect: [0.335, 0.36, 0.305, 0.58], label: "Background removed, studio look", place: "right" }],
  }),
  shot({
    id: "4c-bg", scene: 4, start: 145.3, end: 148.7, beats: 6,
    cam: [{ t: 145.3, z: 1.45, x: 0.49, y: 0.42 }],
    callouts: [
      { from: 145.4, to: 146.6, rect: [0.345, 0.428, 0.165, 0.052], label: "Bouquet name on the photo", place: "right" },
      { from: 146.7, to: 148.7, rect: [0.335, 0.635, 0.3, 0.085], label: "Wood · window light · white · sage · blush", place: "above" },
    ],
    captions: [{ from: 145.3, to: 148.7, text: "Sales-ready photos in a few taps" }],
  }),
  shot({
    id: "4d-caption", scene: 4, start: 152.6, end: 157.4, beats: 6,
    cam: [{ t: 152.6, z: 1.4, x: 0.49, y: 0.5 }, { t: 155.0, z: 1.4, x: 0.49, y: 0.6 }],
    callouts: [
      { from: 152.8, to: 154.4, rect: [0.325, 0.45, 0.325, 0.056] },
      { from: 155.1, to: 157.4, rect: [0.322, 0.48, 0.335, 0.355], label: "Facebook + Zalo captions, one tap", place: "above", sfx: { name: "notification-pop", vol: 0.55 } },
    ],
  }),

  // ---------- 5 · STOCK ----------
  title(5),
  shot({
    id: "5a-stock", scene: 5, start: 167.0, end: 172.6, beats: 6,
    cam: [wide(167.0), { t: 168.2, z: 1.5, x: 0.56, y: 0.62 }],
    callouts: [{ from: 168.3, to: 172.6, rect: [0.572, 0.505, 0.24, 0.495] }],
    captions: [{ from: 167.3, to: 172.6, text: "Red: use today · Amber: tomorrow · Green: fresh" }],
  }),
  shot({
    id: "5b-chips", scene: 5, start: 181.8, end: 192.6, beats: 8,
    cam: [{ t: 181.8, z: 1.45, x: 0.5, y: 0.4 }],
    callouts: [
      { from: 182.6, to: 187.4, rect: [0.287, 0.138, 0.078, 0.04], label: "6 to push today", place: "below", sfx: { name: "hover-tick", vol: 0.5 } },
      { from: 188.0, to: 189.8, rect: [0.367, 0.138, 0.066, 0.04], label: "4 running low", place: "below", sfx: { name: "hover-tick", vol: 0.5 } },
      { from: 190.0, to: 192.6, rect: [0.438, 0.138, 0.048, 0.04], label: "3 just in", place: "below", sfx: { name: "hover-tick", vol: 0.5 } },
    ],
    captions: [{ from: 182.0, to: 192.6, text: "Know what to push, instantly" }],
  }),

  // ---------- 6 · REPORT ----------
  title(6),
  shot({
    id: "6a-kpi", scene: 6, start: 195.0, end: 199.6, beats: 6,
    cam: [wide(195.0), { t: 195.9, z: 1.6, x: 0.56, y: 0.43 }],
    callouts: [
      { from: 196.0, to: 197.9, rect: [0.286, 0.405, 0.18, 0.09], label: "Waste down 32% in 7 days" },
      { from: 197.9, to: 199.6, rect: [0.473, 0.405, 0.18, 0.09], label: "336k ₫ of expiring flowers sold in combos" },
    ],
  }),
  shot({
    id: "6b-before-after", scene: 6, start: 199.6, end: 203.6, beats: 7,
    cam: [{ t: 199.6, z: 1.6, x: 0.56, y: 0.43 }, { t: 200.3, z: 2.1, x: 0.43, y: 0.52 }],
    callouts: [{ from: 200.1, to: 201.2, rect: [0.285, 0.508, 0.265, 0.06] }],
    bigStat: { from: 200.9, to: 203.6 },
  }),
  shot({
    id: "6c-next", scene: 6, start: 220.0, end: 222.3, beats: 4,
    cam: [{ t: 220.0, z: 1.4, x: 0.56, y: 0.75 }],
    captions: [{ from: 220.2, to: 222.3, text: "Next step: lower red-rose par, raise carnations" }],
  }),

  { kind: "end", beats: 16 },
];

// Beat at which each segment starts (used by the video and by the music composer)
export const SEG_STARTS = TIMELINE.reduce<number[]>((acc, s, i) => {
  acc.push(i === 0 ? 0 : acc[i - 1] + TIMELINE[i - 1].beats);
  return acc;
}, []);
export const TOTAL_BEATS = TIMELINE.reduce((n, s) => n + s.beats, 0);
