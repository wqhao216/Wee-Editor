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
- **Quét thêm từng khung** (`scan_all_frames.py`, 5130 khung của 3 đoạn QA): không khung nào có cờ họ tên, SĐT, số định danh, email, số nhà/đường, `sdt-mau` hay `ngay-sinh`. Các cờ còn lại chỉ thuộc 3 loại: `at`, `12-so` (ô vốn) và hai dòng blocklist ứng với trường tỉnh/phường mà mục 6.3 để lộ. Nhóm quyết định **giữ theo plan 6.3** (không che thêm trường tỉnh/phường).
- Cờ sai đã xác nhận bằng mắt:
  - `at`: email liên hệ công khai của Cục ở footer trang (y ≈ 1044–1063) và icon (nút "?" ở x ≈ 1282–1319, nút radio ở x ≈ 649–717, nút "về đầu trang" ở x ≈ 1842–1956) bị OCR đọc thành `@`.
    Ngoài ra còn nút radio ở cột trái (Cá nhân / Giống địa chỉ trụ sở…), icon lịch cạnh ô ngày, và chính các ô mosaic bị OCR đọc thành `@`.
  - `12-so` ở 251.1–251.6: ô vốn mẫu, OCR đọc dấu phẩy thập phân thành dấu chấm.

## Chặng 2 · Hệ thống thiết kế (Remotion)

```
node scripts/phan3/render_stills.mjs qa/style 1.0 13.8 49.5 87.5 150.0 168.0   # style frame + log QA
python3 -I scripts/phan3/check_stage2.py                                         # tự kiểm -> qa/style/check_report.txt
```

- Mã nguồn: `src/phan3/` (tokens, data, timeline, fonts, components/*). Composition `Phan3` 1920×1080, 30 fps, 5100 khung.
- Font: Be Vietnam Pro 500/600/700/800 từ `@fontsource/be-vietnam-pro` (OFL, chạy offline), nạp đủ 3 tập con (latin, latin-ext, vietnamese) trước khi chụp khung.
- Font **không có** glyph "→" (U+2192) và "✓" (U+2713): vẽ bằng SVG theo màu chữ; chuỗi gốc giữ nguyên. "⏸" của freezeCue vẽ bằng CSS.
- Trình duyệt render: Remotion không tải được trình duyệt của nó (mạng chặn host remotion.media) nên dùng chrome-headless-shell có sẵn trên máy (`REMOTION_BROWSER` để đổi).
- `public/hai_clean.mp4` là hard link tới `work/hai_clean.mp4` (không commit; script render tự tạo lại).
- Khung gốc lấy bằng `OffthreadVideo trimBefore=<khung gốc>` trong `Freeze frame=0`. Không dùng `Freeze frame=<khung gốc>`: khung > 5100 bị Remotion kẹp về cuối composition, hiện sai trang.
- Đã kiểm bằng script: tổng 170.0 s; 4629 khung video ra, **0 khung lấy từ đoạn cấm** (kể cả lúc card trượt ra/vào); camera zoom ≤ 2.6× và vùng nhìn nằm trong `[370,150,1610,1000]`; phụ đề 35 trang, mỗi trang ≤ 2 dòng ≤ 42 ký tự, ghép lại đúng nguyên câu.

### Quyết định thiết kế (plan không nói rõ); nhóm đã chốt ngày 10/11
1. **B8 lúc 2:27.7: plan viết chưa rõ** ("Dòng trả lời của H1 đổi bằng textIn" nhưng không nói đổi thành gì). Nhóm chốt: chữ giữ nguyên "Đủ 8 dấu tích? / Chưa chắc xong."; riêng cụm "xong." textOut 150ms (2:27.55–2:27.7) rồi textIn lại đúng 2:27.7 (vạch highlight vẽ lại sau đó), cùng nhịp cắt nhạc và error_buzz (chặng âm thanh). `B8_ANSWER_REDO` trong `data.ts`.
2. Thẻ chốt R nền vàng: vạch highlight màu trắng. Tương phản WCAG: chữ ink trên nền accent 14.50:1, trên vạch trắng 18.88:1; vạch trắng so với nền accent 1.30:1 (vạch accent so với nền bg ở các bước khác: 1.18:1, nên vạch trắng nổi không kém chuẩn của plan).
3. jumpCut ở mọi chỗ nối hai đoạn gốc không liền nhau trong cùng bước (15 chỗ). Mỗi cái **120ms** (plan 2.5 ghi 200ms), **không SFX riêng**. Chỗ nhịp dày (cách jumpCut trước < 3s, hoặc trùng ±0.3s với punchIn/punchOut) để nhóm xem ở animatic: 0:15.5, 0:18.0, 0:25.5, 0:36.5, 0:47.5, 1:47.0, 2:10.5, 2:33.2 (`work/test/rhythm_test.ts`).
4. speedTag: dùng nhãn plan ghi; đoạn tua > 1.2× mà plan không ghi thì làm tròn 1 chữ số; ≤ 1.2× không hiện nhãn.
5. cardSwap bắt đầu sau punchOut (hoặc sau khi khung khoanh cuối tắt) **120ms**, không sớm hơn 0.5s trước bước mới: cũ ra 350ms, mới vào 600ms, chồng 150ms; card mới dừng ở khung đầu của bước mới cho tới lúc bước bắt đầu. Mốc: 0:39.62, 1:05.82, 1:17.72, 1:39.50, 2:01.92.
6. Nhãn khung khoanh mặc định đặt **trên** box (cách 12px); nếu đè box/nhãn khác, pill hoặc vùng phụ đề thì lần lượt thử dưới-trái, trên-phải, dưới-phải. Phía đặt chọn một lần cho mỗi khung (không nhảy khi camera chạy).
7. Khi punchIn, dãy 8 chấm tiến độ có nền trắng mờ phía sau (nếu không sẽ chìm vào ảnh trang web).
8. Chip "trái dưới"/"dưới card" giữ chỗ plan ghi; riêng lúc card phủ toàn khung mà chip đè khung khoanh đang hiện thì dời sang chỗ trống kế tiếp (đã xảy ra ở 1:59–2:01.8: chip thuế khoán che khung "CHỈ CÒN KÊ KHAI").

### Tự kiểm chặng 2 (`qa/style/check_report.txt`)
- Chữ: 182 chuỗi trên màn có nguyên văn trong plan/cues/srt, dạng NFC. Glyph: chỉ thiếu "→", "✓" (đã vẽ SVG).
- Bố cục: khối chữ 8 bước nằm trong x 96–720 (dòng trả lời B5 tự co còn 59px), sub ≤ 2 dòng, phụ đề ≤ 2 dòng; ≤ 2 khung khoanh cùng lúc, mỗi khung ≥ 2s; không chip nào che khung khoanh.
- Khung khoanh đúng chỗ: 34/34 lệch 0px so với vùng `box_src` trên khung gốc (template matching). "CHỈ GÕ TÊN RIÊNG" điểm khớp 0.80 do con trỏ gõ và viền khung ① đè mép, đã xem bằng mắt.
- OCR (tesseract vie): các dòng bị đọc lệch đều đã xem bằng mắt, dấu hiển thị đúng; lệch do tesseract nhầm "a" của Be Vietnam Pro thành "ơ/ô", "I" thành "l".

## Chặng 3 · Ghép toàn bài (animatic, chưa có giọng, chưa có nhạc)

```
npx esbuild scripts/phan3/check_timeline.ts --bundle --platform=node --format=esm \
  --outfile=work/check_timeline.mjs --alias:remotion=./scripts/phan3/remotion-stub.ts && node work/check_timeline.mjs
node scripts/phan3/render_video.mjs out/phan3_v2_animatic.mp4      # ~26 phút trên máy 4 nhân
python3 -I scripts/phan3/contact_sheet.py out/phan3_v2_animatic.mp4
python3 -I scripts/phan3/ocr_render.py out/phan3_v2_animatic.mp4
```

- `out/phan3_v2_animatic.mp4`: H.264 High, 1920×1080, 30 fps, 5100 khung = 170.000 s, không track âm thanh. Phụ đề theo `phan3_vo_draft.srt`.
- **Còn phải sửa ở bản cuối:** pixel format ra `yuvj420p` (dải màu đầy đủ, do Remotion ghép từ ảnh JPEG); plan mục 1 yêu cầu `yuv420p`.
- Tự kiểm timeline (`qa/stage3_timeline_check.txt`): đạt hết. Tổng 170 s; đoạn cảnh liền nhau; 0 khung lấy từ đoạn cấm (kể cả card đang trượt), khung gốc gần đoạn cấm nhất cách 3 khung; khung gốc muộn nhất 340.5 s (trang xác nhận, không có cảnh bấm Nộp); 34 khung khoanh đều trên đoạn có video của đúng bước, nằm trọn trong vùng video đang thấy, khớp `src_visible_at_t_in` 34/34, ngắn nhất 2.0 s, tối đa 2 cùng lúc; 20 đoạn tua > 1.2× đều có speedTag; 2 chapterWipe.

### Cú bấm (clickRipple): đo lại trên khung gốc, lệch so với plan
Mốc gốc lấy ở khung cuối con trỏ còn trên nút, trước khi giao diện đổi; mốc ra tự tính theo EDL.

| Cú bấm | Plan (gốc / ra) | Đo được (gốc / ra) | Tọa độ gốc |
|---|---|---|---|
| Bắt đầu | 23.2 / 0:17.2 (hai số này không khớp nhau) | 23.0 / 0:17.62 | (1519, 358) |
| Tích ô vuông | 117.6 / 0:52.7 | **118.45 / 0:53.55** (117.6 trang còn đang cuộn) | (697, 675) |
| Cập nhật chính | 120.5 / 0:55.6 | **119.3 / 0:54.40** (120.5 là lúc trang tải lại xong) | (769, 775) |
| Kiểm tra trùng tên | 177.0 / 1:13.9 | 176.95 / 1:13.85 | (1477, 486) |
| Giống địa chỉ trụ sở chính | 262.3 / 1:54.2 | 262.33 / 1:54.16 | (676, 468) |
| Chuẩn bị | 321.9 / 2:27.6 | 322.0 / 2:27.70 | (916, 438) |

- Dòng báo lỗi B8 hiện ở gốc 322.067 = ra **2:27.767** (plan: 2:27.7). Mốc chạy lại "xong." (và mốc cắt nhạc + error_buzz ở chặng âm thanh) dùng 2:27.767.
- pulse: B1 0:10.1 đỏ trên dòng "Đăng ký cấp lại…"; B4 1:13.6 màu accent trên nút Kiểm tra trùng tên (plan không ghi màu); B8 2:23.3 8 dấu tích lần lượt cách 120 ms (tọa độ đo ở gốc 320.8: x 396–417, y 244…439). Pulse B8 rơi vào đoạn dừng hình: theo mục 8 (mục 2.5 ghi pulse "dùng lúc video đang chạy").
- badgeCount ①…⑧ B2 0:19.3–0:22.4 tại x gốc 378 (theo plan), huy hiệu lấn mép trái card khoảng 7 px.
- Bộ đếm "8/8 ✓" B8 2:23.3–2:25.4 góc trên phải, chữ ok trên nền trắng mờ.

### OCR bản animatic (`qa/ocr_animatic_report.txt`, mỗi 3 khung, 1700 khung)
- Không có cờ họ tên, SĐT, số định danh, email, số nhà, ngày sinh.
- `at` (559 khung): cờ sai, đã xem theo cụm vị trí: dãy chấm tiến độ, nút "?", mũi tên dropdown, nút radio, số ① trong nhãn, ô vốn.
- Hai dòng blocklist tỉnh/phường: trường trụ sở và địa chỉ thuế (nhóm đã quyết giữ theo plan 6.3) và danh sách thả xuống chọn tỉnh đang mở ở 1:32.4–1:32.7, 2:11.0–2:11.2 (danh sách chung, dòng đang chọn nằm trong vùng mosaic; plan 6.3 chấp nhận).

## Chặng 4A · Âm thanh tự tổng hợp (chưa có giọng)

```
npx esbuild scripts/phan3/export_timeline.ts --bundle --platform=node --format=esm \
  --outfile=work/export_timeline.mjs --alias:remotion=./scripts/phan3/remotion-stub.ts && node work/export_timeline.mjs
python3 -I scripts/phan3/make_sfx.py      # audio/sfx/*.wav
python3 -I scripts/phan3/make_events.py   # audio/sfx_events.json
python3 -I scripts/phan3/make_music.py    # audio/music_bed.wav
python3 -I scripts/phan3/mix_audio.py     # audio/stem_*.wav, stem_ducking_map.json, mix_no_vo.wav, out/phan3_v2_animatic_audio.mp4
python3 -I scripts/phan3/audio_qa.py      # qa/audio_report.txt, qa/audio_timeline.png
```

- Không tải nhạc/SFX, không mẫu: mọi âm tổng hợp bằng numpy (bộ lọc FFT tự viết; không cài scipy/matplotlib). WAV 48 kHz 24-bit, mỗi SFX fade vào/ra 5 ms. File WAV không commit (tái tạo bằng script).
- Mọi mốc âm thanh lấy từ `work/timeline_cues.json`, do `export_timeline.ts` tính bằng CHÍNH code dựng video (edl.json + cues.json), không gõ tay.
- **Mức tham chiếu:** 0 dB = mức giọng đọc (bed nhạc chuẩn hóa -14 LUFS = 0 dB). Các mức dB của plan 4.2–4.3 hiểu là so với mức này. Mix tạm (không giọng) nhân một hệ số chung (+18.1 dB) để tổng -16 LUFS.

### Nhạc nền (`make_music.py`)
- 96 BPM (ô nhịp 2.5 s, 68 ô = 170 s), Đô trưởng. Pad (3 giọng lệch ±6 cent, 4 bội âm), bass sine mềm (phách 1, 3 và nốt dẫn), pluck kiểu dây gảy (bội âm tắt nhanh dần) ở ô lẻ, hi-hat nhiễu lọc > 7 kHz ở phách lẻ. Mức trong bed: pad -12, bass -9, pluck -15, hi-hat -27 dB.
- Cấu trúc theo mốc: intro pad + vài nốt pluck (fade vào 1 s) → B1–B7 vòng C–G–Am–F → 2:19.5 hi-hat 16 tăng dần → B8 "nhạc giảm" Am–F–Dm–E, -3 dB, bass nhịp 8 → **cắt 0.5 s ở 2:27.767** (tắt/mở 10 ms) → vào lại -20 dB, low-pass 1.5 kHz (12 dB/oct) → **2:35.7 mở low-pass trong 0.3 s**, F–G–C–C đầy đủ → 2:47.0 hợp âm Đô trưởng vào mềm (attack 0.25 s; "hit" do ding_end đảm nhận) → fade 1 s cuối.
- Master bed: limiter đỉnh -4.5 dBFS ở -14 LUFS (giảm tối đa 2.1 dB) để khi nâng cả mix lên -16 LUFS vẫn dưới -1 dBTP.

### SFX (`make_sfx.py`, `make_events.py`)
| File | Âm sắc | Dùng cho | Mức |
|---|---|---|---|
| whoosh | nhiễu quét 500→2600 Hz, 0.32 s | cardIn, cardSwap, cardOut, punchIn (plan 4.3) | -22 dB |
| whoosh_wipe | nhiễu quét 260→4200 Hz + trầm, 0.72 s | 2 chapterWipe | -18 dB |
| tick | gõ gỗ 2.4 kHz, 60 ms | textIn khối chữ (8 H1 + chương S00, B8), một lần mỗi khối | -30 dB |
| pop + tick_ok | pop trượt 900→300 Hz / ting G6 | callout ok (cặp cố ý, cùng mốc) | -26 / -22 dB (plan -24 / -20: mỗi âm -2 dB vì hai âm cộng đỉnh) |
| blip_danger | quãng 2 thứ G3/G#3 trượt nhẹ xuống, lọc < 1.4 kHz | callout danger | -20 dB |
| blip_warn | quãng 5 E5/B5 | callout warn | -22 dB |
| click | nhấn + nhả (38 ms) | 6 clickRipple | -22 dB |
| tick_ok (cao dần) | ting C→C quãng tám, cách 120 ms | 8 dấu tích B8 | -30 dB |
| pop | | 8 badge B2 (từ cái 2: -3 dB), 5 chip | -24 dB |
| tua | "rẹt" quét lên + 3 nhịp lách tách | đầu 20 đoạn tua > 1.2× | -28 dB |
| pop_node / draw_line | pop tròn cao / nhiễu 1.8–5.5 kHz rung nhẹ | FlowDiagram: 4 nút, 3 đường | -24 / -30 dB |
| riser | nhiễu quét + âm trượt A3→A5, rung nhanh dần, 1.4 s | 2:19.6 → B8 | -20 dB |
| error_buzz | 2 răng cưa 110/116.5 Hz, lọc < 1.5 kHz, rung 30 Hz | 2:27.767 | -18 dB |
| ding_end | chuông C6 (bội 1, 2.756, 5.404) + C5, tắt 2.2 s | 2:47.0 | -18 dB |

- Không SFX cho jumpCut (nhóm chốt), FreezeCue (quá dày), pill (gộp với tick khối chữ), callout trùng một chuỗi đã thiết kế ("ĐỦ 8 DẤU TÍCH" ← 8 tick; "8 PHẦN" ← 8 badge). Không dùng type_soft (không có trong danh sách của nhóm).
- Gỡ va chạm: chuỗi (cặp pop+tick_ok, 8 tick, 8 badge, sơ đồ) tính là một âm; lệch < 40 ms hoặc đã đủ 2 âm đang vang thì âm ưu tiên thấp lùi 60 ms, tối đa 150 ms, không được thì bỏ. Kết quả: 139 giữ, 1 bỏ (whoosh punchIn 2:23.0 trùng whoosh cardIn), 7 lùi (chip/tua nhường tick khối chữ ở đầu bước).
- Plan 4.3 "SFX trùng chữ quan trọng trong lời đọc thì lùi 100–200 ms": chưa áp dụng (chưa có giọng) → chặng 4B.

### Mix, ducking (`mix_audio.py`)
- Nhạc -16 dB khi không lời; dưới lời -24 dB (đoạn sau báo lỗi nền -20 dB, dưới lời vẫn -24 dB). Attack 80 ms (hạ sớm 80 ms để đủ sâu đúng lúc câu bắt đầu), release 400 ms, gộp câu cách < 0.48 s. 32 câu → 22 khoảng hạ, nhạc bị hạ 135.5 s / 170 s. `audio/stem_ducking_map.json` ghi khoảng, tham số và đường mức 100 Hz; chặng 4B thay mốc câu bằng mốc đo từ file giọng rồi chạy lại `mix_audio.py`.
- Vì chưa có giọng nên cả mix nâng +18.1 dB; để TP ≤ -1 dBTP, đỉnh chỉ được nén trên stem SFX (nhạc không bị bơm theo SFX): lookahead/giữ 6 ms, nhả 80 ms, trần đỉnh mẫu -1.8 dBFS. Bị nén > 3 dB: 10/139 sự kiện; nhiều nhất ding_end 10.2 dB (chỉ phần attack).
- Kết quả (`qa/audio_report.txt`): mix -16.02 LUFS / -1.67 dBTP; track AAC 320 kbps trong mp4 -16.03 LUFS / -1.61 dBTP. Khoảng 2:27.767–2:28.267 nhạc im hẳn. riser 0 ms, error_buzz 0 ms, ding_end +1 ms so với mốc đặt.
