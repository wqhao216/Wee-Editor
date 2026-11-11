// Chỉ bật khi render với inputProps { qa: true }. Ghi ra console (Node bắt bằng onBrowserLog):
// - QA_FRAME: hình chữ nhật thật trên màn hình của mọi phần tử có data-qa
// - QA_GLYPH: ký tự nào trong chữ trên màn hình KHÔNG có trong Be Vietnam Pro (bị rơi sang font khác)
import { useLayoutEffect } from "react";
import { continueRender, delayRender, useCurrentFrame } from "remotion";
import { allOnScreenStrings } from "../data";
import { FONT_FAMILY } from "../tokens";

/** Vùng chữ thật (kể cả phần tràn ra ngoài khối) và số dòng hiển thị. */
const textBox = (el: HTMLElement) => {
  const range = document.createRange();
  range.selectNodeContents(el);
  const rects = Array.from(range.getClientRects()).filter((r) => r.width > 0 && r.height > 0);
  if (!rects.length) return { textRect: null, textLines: 0 };
  const tops: number[] = [];
  for (const r of rects) {
    const mid = (r.top + r.bottom) / 2;
    if (!tops.some((t) => Math.abs(t - mid) < r.height * 0.5)) tops.push(mid);
  }
  return {
    textRect: {
      x1: Math.min(...rects.map((r) => r.left)), y1: Math.min(...rects.map((r) => r.top)),
      x2: Math.max(...rects.map((r) => r.right)), y2: Math.max(...rects.map((r) => r.bottom)),
    },
    textLines: tops.length,
  };
};

const collect = () =>
  Array.from(document.querySelectorAll<HTMLElement>("[data-qa]")).map((el) => {
    const r = el.getBoundingClientRect();
    const d = el.dataset;
    return {
      ...textBox(el),
      qa: d.qa, text: d.qaText ?? null, size: d.qaSize ? Number(d.qaSize) : null, side: d.qaSide ?? null,
      src: d.qaSrc ? JSON.parse(d.qaSrc) : null, srcFrame: d.qaSrcFrame ? Number(d.qaSrcFrame) : null,
      view: d.qaView ? JSON.parse(d.qaView) : null, lines: d.qaLines ? Number(d.qaLines) : null, dots: d.qaDots ?? null,
      rect: { x1: r.left, y1: r.top, x2: r.right, y2: r.bottom },
      lineHeight: parseFloat(getComputedStyle(el).lineHeight) || null,
      scrollW: el.scrollWidth, clientW: el.clientWidth,
      opacity: Number(getComputedStyle(el).opacity),
    };
  });

const glyphReport = () => {
  const chars = Array.from(new Set(allOnScreenStrings().join("").normalize("NFC"))).filter((c) => c.trim());
  const ctx = document.createElement("canvas").getContext("2d")!;
  const missing: Record<string, string[]> = {};
  // Ký tự có trong font khi: (1) đổi font dự phòng không làm đổi bề rộng, và (2) bề rộng khác bề
  // rộng của chính font dự phòng (để không bị lừa khi cả hai dự phòng cùng rơi về một font cuối).
  const width = (font: string, c: string) => { ctx.font = font; return ctx.measureText(c).width; };
  for (const w of [500, 600, 700, 800]) {
    for (const c of chars) {
      const a = width(`${w} 40px "${FONT_FAMILY}", monospace`, c);
      const b = width(`${w} 40px "${FONT_FAMILY}", serif`, c);
      const ma = width(`${w} 40px monospace`, c);
      const mb = width(`${w} 40px serif`, c);
      const fellBack = Math.abs(a - b) > 0.01 || (Math.abs(a - ma) < 0.01 && Math.abs(b - mb) < 0.01);
      if (fellBack) (missing[c] ??= []).push(String(w));
    }
  }
  const nonNFC = allOnScreenStrings().filter((s) => s !== s.normalize("NFC"));
  return { chars: chars.length, missing, nonNFC, fontsCheck: [500, 600, 700, 800].map((w) => document.fonts.check(`${w} 40px "${FONT_FAMILY}"`, "Đăng ký hộ kinh doanh")) };
};

export const QaProbe: React.FC = () => {
  const frame = useCurrentFrame();
  useLayoutEffect(() => {
    const h = delayRender("qa-probe");
    requestAnimationFrame(() => {
      console.log("QA_FRAME " + JSON.stringify({ frame, items: collect() }));
      console.log("QA_GLYPH " + JSON.stringify(glyphReport()));
      continueRender(h);
    });
  }, [frame]);
  return null;
};
