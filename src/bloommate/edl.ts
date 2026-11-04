// Danh sách cảnh (edit decision list). Mọi thời điểm là GIÂY TRÊN BẢN QUAY GỐC.
// rect = [x, y, rộng, cao] theo tỉ lệ 0..1 của khung quay. Số liệu trong chữ lấy đúng từ màn hình đã quay.
import type { ShotDef } from "./Shot";

export const SCENES = ["", "KIỂM TỐI", "NHẬP HÀNG", "LÀM COMBO", "ẢNH & CAPTION", "KHO HOA", "BÁO CÁO"];

const wide = (t: number) => ({ t, z: 1, x: 0.5, y: 0.5 });

export const SHOTS: ShotDef[] = [
  // ---------- 1 · KIỂM TỐI ----------
  {
    id: "1a-type", scene: 1, start: 2.3, end: 14.3, rate: 3.2,
    cam: [wide(2.3), { t: 6.5, z: 1.75, x: 0.56, y: 0.55 }],
    callouts: [{ from: 7, to: 14.3, rect: [0.29, 0.555, 0.545, 0.11] }],
    captions: [{ from: 3, to: 14.3, text: "Cuối ngày, chỉ cần một câu" }],
  },
  {
    id: "1b-table", scene: 1, start: 16.2, end: 19.6, rate: 1,
    cam: [{ t: 16.2, z: 1.6, x: 0.56, y: 0.33 }, { t: 19.6, z: 1.7, x: 0.56, y: 0.36 }],
    callouts: [{ from: 16.4, to: 19.4, rect: [0.288, 0.412, 0.555, 0.058], label: "Bảng tự điền: còn 22, bỏ 3" }],
  },
  {
    id: "1c-close", scene: 1, start: 19.6, end: 23.9, rate: 3,
    cam: [wide(19.6)],
  },
  {
    id: "1d-waste", scene: 1, start: 24.0, end: 28.6, rate: 1,
    cam: [wide(24.0), { t: 25.2, z: 1.9, x: 0.45, y: 0.45 }],
    callouts: [{ from: 25.0, to: 28.5, rect: [0.287, 0.41, 0.295, 0.165], label: "Tiền hoa bỏ hôm nay: 8.400₫" }],
    captions: [{ from: 24.3, to: 28.6, text: "Chốt ngày: biết ngay tiền hoa bỏ" }],
  },
  {
    id: "1e-buy", scene: 1, start: 28.6, end: 32.0, rate: 1,
    cam: [{ t: 28.6, z: 1.9, x: 0.45, y: 0.45 }, { t: 29.6, z: 1.55, x: 0.72, y: 0.62 }],
    callouts: [{ from: 29.4, to: 31.9, rect: [0.598, 0.37, 0.247, 0.62] }],
    captions: [{ from: 28.9, to: 32.0, text: "Danh sách mua ngày mai tự hiện ra" }],
  },

  // ---------- 2 · NHẬP HÀNG ----------
  {
    id: "2a-nextday", scene: 2, start: 33.6, end: 38.6, rate: 3.3,
    cam: [wide(33.6)],
    captions: [{ from: 33.8, to: 38.6, text: "Sáng hôm sau, ra chợ" }],
  },
  {
    id: "2b-reason", scene: 2, start: 38.6, end: 42.3, rate: 1,
    cam: [wide(38.6), { t: 39.6, z: 2.0, x: 0.5, y: 0.42 }],
    callouts: [{ from: 39.4, to: 42.2, rect: [0.288, 0.388, 0.555, 0.062], label: "Mỗi dòng đều có lý do" }],
    captions: [{ from: 39.6, to: 42.3, text: "Mức bày 50 − còn tươi 19 = cần mua 31" }],
  },
  {
    id: "2c-scroll", scene: 2, start: 42.3, end: 45.3, rate: 3,
    cam: [wide(42.3)],
  },
  {
    id: "2d-speak", scene: 2, start: 67.4, end: 74.2, rate: 1.5,
    cam: [{ t: 67.4, z: 1.3, x: 0.56, y: 0.55 }, { t: 70, z: 1.5, x: 0.56, y: 0.62 }],
    callouts: [{ from: 69.4, to: 74.2, rect: [0.29, 0.58, 0.545, 0.095] }],
    captions: [{ from: 67.6, to: 74.2, text: "Nhập hàng về: chỉ cần nói" }],
  },
  {
    id: "2e-row", scene: 2, start: 74.2, end: 77.4, rate: 1,
    cam: [{ t: 74.2, z: 1.5, x: 0.56, y: 0.62 }, { t: 75.2, z: 1.9, x: 0.56, y: 0.8 }],
    callouts: [{ from: 74.6, to: 77.3, rect: [0.288, 0.86, 0.555, 0.062], label: "Tự thêm dòng: hồng đỏ 50 cành · 140.000₫" }],
  },
  {
    id: "2f-save", scene: 2, start: 84.4, end: 87.2, rate: 1,
    cam: [{ t: 84.4, z: 1.5, x: 0.56, y: 0.75 }],
    callouts: [{ from: 84.6, to: 87.0, rect: [0.285, 0.88, 0.556, 0.055], label: "Lưu vào kho, một chạm" }],
  },

  // ---------- 3 · LÀM COMBO ----------
  {
    id: "3a-today", scene: 3, start: 95.0, end: 97.6, rate: 1,
    cam: [wide(95.0), { t: 97.4, z: 1.35, x: 0.62, y: 0.4 }],
    captions: [{ from: 95.2, to: 97.6, text: "Hoa sắp hỏng → bó bán được" }],
  },
  {
    id: "3b-combo", scene: 3, start: 98.4, end: 102.2, rate: 1,
    cam: [{ t: 98.4, z: 1.5, x: 0.68, y: 0.3 }, { t: 99.4, z: 1.9, x: 0.72, y: 0.3 }],
    callouts: [{ from: 98.7, to: 101.9, rect: [0.608, 0.312, 0.215, 0.042], label: "161.500₫ hoa sắp hư nằm trong bó" }],
    captions: [{ from: 98.4, to: 102.2, text: "Hoa sắp hỏng → bó bán được" }],
  },
  {
    id: "3c-make", scene: 3, start: 102.2, end: 104.6, rate: 1.2,
    cam: [wide(102.2)],
    captions: [{ from: 102.6, to: 104.6, text: "Làm bó: hoa tự trừ khỏi kho" }],
  },

  // ---------- 4 · ẢNH & CAPTION ---------- (thẻ "ảnh gốc" chèn trước cảnh 4b, xem BloomMateDemo)
  {
    id: "4b-studio", scene: 4, start: 115.6, end: 118.0, rate: 1,
    cam: [{ t: 115.6, z: 1.3, x: 0.49, y: 0.55 }, { t: 118.0, z: 1.45, x: 0.49, y: 0.6 }],
    callouts: [{ from: 116.2, to: 118.0, rect: [0.335, 0.36, 0.305, 0.58], label: "Tự tách nền, đổi nền studio", place: "right" }],
  },
  {
    id: "4c-bg", scene: 4, start: 145.3, end: 148.7, rate: 1,
    cam: [{ t: 145.3, z: 1.45, x: 0.49, y: 0.42 }],
    callouts: [
      { from: 145.4, to: 146.6, rect: [0.345, 0.428, 0.165, 0.052], label: "Tên bó tự in lên ảnh", place: "right" },
      { from: 146.7, to: 148.6, rect: [0.335, 0.635, 0.3, 0.085], label: "Bàn gỗ · nắng · trắng · xanh · hồng", place: "above" },
    ],
    captions: [{ from: 145.3, to: 148.7, text: "Ảnh bán hàng đẹp, vài chạm" }],
  },
  {
    id: "4d-caption", scene: 4, start: 152.6, end: 157.4, rate: 1,
    cam: [{ t: 152.6, z: 1.4, x: 0.49, y: 0.5 }, { t: 155.0, z: 1.4, x: 0.49, y: 0.6 }],
    callouts: [
      { from: 152.8, to: 154.4, rect: [0.325, 0.45, 0.325, 0.056] },
      { from: 155.2, to: 157.3, rect: [0.322, 0.48, 0.335, 0.355], label: "Caption Facebook + Zalo, một chạm", place: "above" },
    ],
  },

  // ---------- 5 · KHO HOA ----------
  {
    id: "5a-stock", scene: 5, start: 167.0, end: 172.6, rate: 1.4,
    cam: [wide(167.0), { t: 168.6, z: 1.5, x: 0.56, y: 0.62 }],
    callouts: [{ from: 168.6, to: 172.5, rect: [0.572, 0.505, 0.24, 0.495] }],
    captions: [{ from: 167.4, to: 172.6, text: "Đỏ: dùng hôm nay · Vàng: ngày mai · Xanh: còn tươi" }],
  },
  {
    id: "5b-chips", scene: 5, start: 181.8, end: 192.6, rate: 1.6,
    cam: [{ t: 181.8, z: 1.45, x: 0.5, y: 0.4 }],
    callouts: [
      { from: 182.6, to: 187.4, rect: [0.287, 0.138, 0.078, 0.04], label: "6 loại cần đẩy hôm nay", place: "below" },
      { from: 188.0, to: 189.8, rect: [0.367, 0.138, 0.066, 0.04], label: "4 loại sắp hết", place: "below" },
      { from: 190.0, to: 192.5, rect: [0.438, 0.138, 0.048, 0.04], label: "3 lô mới nhập", place: "below" },
    ],
    captions: [{ from: 182.0, to: 192.6, text: "Cần đẩy loại nào, thấy ngay" }],
  },

  // ---------- 6 · BÁO CÁO ----------
  {
    id: "6a-kpi", scene: 6, start: 195.0, end: 199.6, rate: 1,
    cam: [wide(195.0), { t: 196.2, z: 1.6, x: 0.56, y: 0.43 }],
    callouts: [
      { from: 196.4, to: 198.1, rect: [0.286, 0.405, 0.18, 0.09], label: "Tiền hoa bỏ 7 ngày: giảm 32%" },
      { from: 198.1, to: 199.6, rect: [0.473, 0.405, 0.18, 0.09], label: "336k hoa sắp hư đã bán qua combo" },
    ],
  },
  {
    id: "6b-before-after", scene: 6, start: 199.6, end: 204.0, rate: 1,
    cam: [{ t: 199.6, z: 1.6, x: 0.56, y: 0.43 }, { t: 200.4, z: 2.1, x: 0.43, y: 0.52 }],
    callouts: [{ from: 200.2, to: 201.6, rect: [0.285, 0.508, 0.265, 0.06] }],
    bigStat: { from: 201.0, to: 204.0 },
  },
  {
    id: "6c-next", scene: 6, start: 220.0, end: 222.8, rate: 1,
    cam: [{ t: 220.0, z: 1.4, x: 0.56, y: 0.75 }],
    callouts: [{ from: 221.0, to: 222.7, rect: [0.288, 0.655, 0.555, 0.29], label: "Gợi ý: giảm mức bày hồng đỏ, tăng cẩm chướng" }],
  },
];
