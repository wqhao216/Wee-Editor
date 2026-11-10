// Thay "remotion" khi chạy toán timeline bằng Node (không cần trình duyệt). Chỉ cần Easing cho tokens.ts;
// easing ở đây là tuyến tính, nên các phép kiểm chỉ dựa vào mốc thời gian, không dựa vào dáng đường cong.
const id = (x: number) => x;
export const Easing = {
  out: (f: (x: number) => number) => f,
  in: (f: (x: number) => number) => f,
  inOut: (f: (x: number) => number) => f,
  cubic: id,
  poly: () => id,
  bezier: () => id,
};
