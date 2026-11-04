import { loadFont } from "@remotion/fonts";
import { staticFile } from "remotion";

export const FPS = 30;
export const W = 1920;
export const H = 1080;

// Khung "màn hình" chứa video quay (tỉ lệ đúng của bản quay 2458x1330)
export const SRC_W = 2458;
export const SRC_H = 1330;
export const CARD_W = 1760;
export const CARD_H = (CARD_W * SRC_H) / SRC_W;

// Màu lấy theo giao diện BloomMate
export const C = {
  cream: "#F7F2EB",
  creamDeep: "#EFE4D6",
  ink: "#2B211E",
  inkSoft: "#5B4C46",
  rose: "#C9567A",
  roseSoft: "#F4D7E0",
  sage: "#6E8B4E",
  sageSoft: "#E3EDD8",
  butter: "#F6ECC8",
  red: "#D2475C",
  amber: "#D99A2B",
  green: "#4F8A4B",
};

export const FONT = "Be Vietnam Pro";

// Mỗi file font chỉ chứa một phần bảng chữ, nên phải khai báo unicodeRange
// để trình duyệt ghép đúng: chữ Latin cơ bản + dấu tiếng Việt.
const RANGES = {
  vietnamese:
    "U+0102-0103,U+0110-0111,U+0128-0129,U+0168-0169,U+01A0-01A1,U+01AF-01B0,U+0300-0301,U+0303-0304,U+0308-0309,U+0323,U+0329,U+1EA0-1EF9,U+20AB",
  latin:
    "U+0000-00FF,U+0131,U+0152-0153,U+02BB-02BC,U+02C6,U+02DA,U+02DC,U+0304,U+0308,U+0329,U+2000-206F,U+20AC,U+2122,U+2191,U+2193,U+2212,U+2215,U+FEFF,U+FFFD",
};
const weights = ["400", "500", "600", "700", "800"] as const;
export const fontsReady = Promise.all(
  weights.flatMap((w) =>
    (["vietnamese", "latin"] as const).map((s) =>
      loadFont({
        family: FONT,
        url: staticFile(`fonts/be-vietnam-pro-${s}-${w}-normal.woff2`),
        weight: w,
        unicodeRange: RANGES[s],
      }),
    ),
  ),
);
