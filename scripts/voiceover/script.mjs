// Kịch bản voiceover BloomMate. Đọc nguyên văn: không sửa chữ, không bỏ dấu phẩy.
export const BLOCKS = [
  { id: "01", text: "Mỗi tối, tiệm hoa nhỏ mất tiền ở cùng một chỗ: hoa không bán kịp. Mười đến ba mươi phần trăm tiền nhập, đổ vào thùng rác." },
  { id: "02", text: "BloomMate bắt đầu từ đúng lúc đó. Cuối ngày, chủ tiệm chỉ cần nói một câu, bảng kiểm tối tự điền. Chốt ngày: tám mươi hai nghìn tiền hoa bỏ, và danh sách mua cho ngày mai tự hiện ra." },
  { id: "03", text: "Sáng ra chợ, không còn đoán. Mỗi dòng ghi rõ lý do: mức bày năm mươi, còn tươi mười chín, cần ba mươi mốt. Nhập về chỉ cần nói, bảng tự điền, và báo ngay nếu giá cao hơn thường." },
  { id: "04", text: "Hoa sắp hỏng thì không bỏ. App ghép thành bó bán được, theo công thức thật, và nói rõ trong bó có bao nhiêu tiền hoa sắp hư." },
  { id: "05", text: "Chụp bó hoa, app tự tách nền, đổi sang nền studio, ghi tên và giá lên ảnh. Một chạm nữa là có caption cho Zalo và Facebook. Từ hoa sắp bỏ thành bài đăng bán hàng." },
  { id: "06", text: "Cả kho hiện theo ba màu: đỏ phải dùng hôm nay, vàng còn một ngày, xanh còn tươi. Cần đẩy loại nào, thấy ngay." },
  { id: "07", text: "Và sau ba tuần: từ chín mươi sáu nghìn tiền hoa bỏ mỗi ngày, xuống còn tám mươi ba nghìn." },
  { id: "08", text: "BloomMate. Less Flower Power, More Flower Hours." },
];

// Các cụm số/tiền cần nghe kỹ trong từng block
export const NUMBER_PHRASES = {
  "01": ["Mười đến ba mươi phần trăm"],
  "02": ["tám mươi hai nghìn"],
  "03": ["năm mươi", "mười chín", "ba mươi mốt"],
  "06": ["ba màu", "một ngày"],
  "07": ["ba tuần", "chín mươi sáu nghìn", "tám mươi ba nghìn"],
};
