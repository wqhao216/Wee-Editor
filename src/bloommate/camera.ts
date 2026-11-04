import { Easing, interpolate } from "remotion";
import { CARD_H, CARD_W, H, W } from "./theme";

// Khung camera ảo: z = độ phóng, (x, y) = điểm trên bản quay (toạ độ 0..1) đặt ở giữa màn hình.
export type Cam = { t: number; z: number; x: number; y: number };
export type Rect = [x: number, y: number, w: number, h: number];

const ease = Easing.inOut(Easing.cubic);

export function cameraAt(keys: Cam[], t: number) {
  if (keys.length === 0) return { z: 1, x: 0.5, y: 0.5 };
  if (t <= keys[0].t) return keys[0];
  for (let i = 0; i < keys.length - 1; i++) {
    const a = keys[i], b = keys[i + 1];
    if (t <= b.t) {
      const p = ease(interpolate(t, [a.t, b.t], [0, 1]));
      return { z: a.z + (b.z - a.z) * p, x: a.x + (b.x - a.x) * p, y: a.y + (b.y - a.y) * p };
    }
  }
  return keys[keys.length - 1];
}

// Không để lộ mép khung khi đã phóng to
export function clampCam(c: { z: number; x: number; y: number }) {
  const hw = W / 2 / (CARD_W * c.z);
  const hh = H / 2 / (CARD_H * c.z);
  const x = hw >= 0.5 ? 0.5 : Math.min(1 - hw, Math.max(hw, c.x));
  const y = hh >= 0.5 ? 0.5 : Math.min(1 - hh, Math.max(hh, c.y));
  return { z: c.z, x, y };
}

// Đổi toạ độ trên bản quay sang toạ độ màn hình 1920x1080
export function toScreen(c: { z: number; x: number; y: number }, r: Rect) {
  const s = c.z;
  const left = W / 2 + (r[0] - c.x) * CARD_W * s;
  const top = H / 2 + (r[1] - c.y) * CARD_H * s;
  return { left, top, width: r[2] * CARD_W * s, height: r[3] * CARD_H * s };
}
