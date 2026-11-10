# BUILD_NOTES · Phần 3 (Hướng dẫn đăng ký HKD)

> Không chép thông tin cá nhân vào file này (plan mục 0.6, mục 10).
> Mọi giây là **giây gốc** của `hai_raw.mp4` / `hai_clean.mp4`, trừ khi ghi "ra".

## Đầu vào

| File | Trạng thái |
|---|---|
| `input/hai_raw.mp4` | Có. Bản `2026-11-10-...-che-mot-phan.mp4` từ repo footage (Git LFS). 1972×1080, H.264, CFR 30 fps, 10485 khung, start 0, 349.5 s. Khung `i` ↔ giây `i/30`. |
| `docs/phan3/MASTER_VIDEO_PLAN_v2_...md`, `edl.json`, `cues.json`, `phan3_vo_draft.srt` | Có. `cues.json` khớp mục 8 (34 khung khoanh, 12 punchIn), mục 5 và `.srt` (32 câu), mục 6.3 (masks, H4, đoạn cấm). |
| `input/blocklist.txt` | Có, chỉ nằm trên máy dựng (đã bị `.gitignore` bỏ qua), không commit. |
| `input/vo/*.wav`, nhạc, SFX | Chưa (chặng sau). |

## Môi trường (máy dựng cloud Linux)

Node 22.23.4 · npm 10.9.9 · Remotion ^4.0.540 (khai báo trong package.json, chưa `npm install`) · ffmpeg 6.1.1 · Python 3.13.18 · OpenCV 5.0.0 (headless) · numpy 2.5.3 · Tesseract 5.3.4 + `vie`.

## Bước A · Làm sạch video (`scripts/phan3/`)

```
python3 -I scripts/phan3/measure_dy.py     # đo dy (6.4) -> work/dy_measured.json
python3 -I scripts/phan3/clean_video.py    # -> work/hai_clean.mp4
python3 -I scripts/phan3/privacy_qa.py     # -> qa/privacy_sheet.png, qa/privacy_detail/, qa/ocr_report.txt
python3 -I scripts/phan3/scan_all_frames.py  # (thêm) OCR từng khung -> qa/ocr_allframes.txt
```

- Che: mosaic 18 px + lớp `#F3F6FA` độ mờ 0.35. Bỏ âm thanh. Đầu ra 1972×1080, 30 fps, 10485 khung, H.264 CRF 14, GOP 15 (để Remotion tua/dừng hình nhanh).
- Khoảng thời gian tính nửa mở `[from, to)`.
- Lỗ H4 `[920,690,1310,724]`, 214.0–216.05: giữ nguyên điểm ảnh gốc (59 khung).

### Đo lại dy (mục 6.4)

Template matching TM_CCOEFF_NORMED, dải x nhãn ± 20 px, toàn chiều cao, **mọi khung** (không chỉ mỗi 0.5 s). Độ tin < 0.8 thì giữ dy khung trước. Đỉnh khớp thứ hai ≤ 0.68 ở mọi khung, nên không có nhãn trùng gây khớp nhầm.

Ở các mốc chính, số đo khớp bảng 6.3. Lệch > 6 px chỉ xảy ra ở các khung chuyển trang/cuộn trang dưới đây. **Những khung này dùng số đo mới** (cột "Đo"):

| Khối | Giây gốc | Số khung | dy plan | dy đo | Độ tin thấp nhất |
|---|---|---|---|---|---|
| M2 | 96.033–96.267 | 8 | +0 | +37 | 0.92 |
| M4 | 204.067–204.800 | 23 | +0 | +120 → +15 (đang cuộn) | 0.98 |
| M4 | 213.833–213.967 | 5 | +147 | +124 → −2 (đang cuộn) | 0.93 |
| M4 | 233.300 | 1 | +40 | −5 | 0.94 |
| M4 | 234.300 | 1 | +184 | +40 | 1.00 |
| M5 | 279.100–279.167 | 3 | +37 | +0 | 1.00 |
| M5 | 281.633–282.667 | 32 | +37 | +212 → +123 (lớp che gốc lệch, trong đoạn cấm) | 0.95 |
| M6 | 282.700–282.733 | 2 | −162 | −89 → −132 (đang cuộn) | 0.98 |
| M6 | 291.033–291.067 | 2 | −162 | +0 | 1.00 |
| M6 | 299.367–299.567 | 7 | +0 | −11 → −162 (đang cuộn) | 0.96 |
| M6 | 313.067–313.167 | 4 | −162 | −169 → −253 (đang cuộn) | 0.94 |
| M6 | 315.600–315.733 | 5 | +64 | −273 | 0.98 |

Tóm lại: mốc đổi dy của plan sớm hoặc muộn 1–7 khung, và plan dùng bước nhảy trong khi trang cuộn mượt qua 3–23 khung. Không khung nào trong số này là khung dừng hình của EDL. Mọi khung dừng (44.5, 97.0, 211.4, 216.0, 235.0, 258.0, 278.8, 298.6, 316.5) có dy đo = dy plan.

### Chỗ chỉnh so với cues.json / plan

1. **Nới M4 tới 237.6** (cues: 237.5). QA thấy khung 237.500 và 237.533 vẫn là trang chủ hộ và lộ họ tên trong cột giá trị; trang đổi ở 237.567. Áp dụng mục 6.5 ("có một khung lộ là nới box, chạy lại"). Không ảnh hưởng EDL (B6 phát từ 237.6). Ghi trong `MASK_END_OVERRIDES` của `clean_video.py`.
2. **Đoạn cấm (`forbidden_src`) bị che kín cả khung** bằng cùng kiểu mosaic (258 khung), vì mục 6.2 nói các đoạn này "vẫn phải che (không cắt)". EDL không dùng khung nào trong đó. Muốn tắt thì chạy với `--no-forbidden-cover`.

### QA che thông tin (mục 6.5)

- `qa/privacy_sheet.png`: 345 khung, mỗi 0.5 s ở các đoạn 40–100, 200–240, 250–321, cắt vùng trang x 370–1610. Khung có cờ OCR có nhãn đỏ. `qa/privacy_detail/*.png`: cùng các khung, cắt x 600–1620 ở tỉ lệ 0.6 để soi.
- OCR: `tesseract -l vie+eng --psm 11`, ảnh xám phóng 2×, gọi qua stdin/stdout (không ghi ảnh tạm), `OMP_THREAD_LIMIT=1`.
- Tự kiểm bộ dò trên khung **gốc** đã biết lộ (`--selftest-raw`): bắt được họ tên, SĐT, email, `@`. **Không** bắt được số định danh 12 số ở 212.5 (OCR không đọc ra đủ 12 số liền). Vì vậy cờ `12-so` chỉ là lớp kiểm phụ, vẫn phải xem bằng mắt.
- Cờ sai đã xác nhận bằng mắt:
  - `at`: email liên hệ công khai của Cục ở footer trang (y ≈ 1044–1063) và icon (nút "?" ở x ≈ 1282–1319, nút radio ở x ≈ 649–717, nút "về đầu trang" ở x ≈ 1842–1956) bị OCR đọc thành `@`.
  - `12-so` ở 251.5: ô vốn mẫu, OCR đọc dấu phẩy thập phân thành dấu chấm.
