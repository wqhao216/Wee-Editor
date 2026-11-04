# Wee-Editor

Bộ công cụ làm và edit video bằng code.

## Cài đặt trên máy của bạn

```bash
npm install
npm run check      # kiểm tra đủ 20 công cụ
npm run studio     # mở Remotion Studio để xem và chỉnh video
npm run render     # xuất out/hello.mp4
```

Cần Node.js 18 trở lên. Lần render đầu tiên Remotion tự tải Chrome Headless Shell.

## 20 công cụ

| Lớp | Công cụ | Đã cài ở đâu |
|---|---|---|
| Agent skills | Remotion Skills, Motion AI Kit, GSAP Skills | `.claude/skills/` (Claude Code tự đọc) |
| Design | SVGO, Satori | `svgo`, `satori` |
| Animation | GSAP, Anime.js, Motion, Rive, dotLottie | `gsap`, `animejs`, `motion`, `@rive-app/canvas` + `@rive-app/react-canvas`, `@lottiefiles/dotlottie-web` + `@lottiefiles/dotlottie-react` |
| Video | Remotion, Motion Canvas | `remotion`, `@remotion/cli`, `@remotion/renderer`; `@motion-canvas/core`, `/2d`, `/ui`, `/vite-plugin` |
| 3D | Three.js, React Three Fiber, Drei, Rapier, Postprocessing | `three`, `@react-three/fiber`, `@react-three/drei`, `@react-three/rapier`, `@react-three/postprocessing` |
| Âm thanh và xuất bản | Howler.js, Mediabunny, FFmpeg | `howler`, `mediabunny`, `ffmpeg-static` (FFmpeg dựng sẵn qua npm) |

FFmpeg dùng được từ code qua `ffmpeg-static`. Muốn gõ lệnh `ffmpeg` trực tiếp trong terminal thì cài riêng:
`winget install ffmpeg` (Windows), `brew install ffmpeg` (macOS), `sudo apt install ffmpeg` (Ubuntu).

## Cấu trúc

- `src/index.ts`, `src/Root.tsx`: đăng ký các video (Composition) của Remotion
- `src/HelloVideo.tsx`: video mẫu 3 giây, khổ dọc 1080x1920
- `scripts/check.mjs`: kiểm tra cài đặt

## Voiceover tiếng Việt (ElevenLabs)

Kịch bản nằm ở `scripts/voiceover/script.mjs`. Cần biến môi trường `ELEVENLABS_API_KEY`.

```bash
node scripts/voiceover/voiceover.mjs voices                     # liệt kê giọng hỗ trợ tiếng Việt
node scripts/voiceover/voiceover.mjs preview <voiceA> <voiceB>  # đọc thử BLOCK_08 bằng 2 giọng -> vo/preview/
node scripts/voiceover/voiceover.mjs generate <voiceId>         # vo/01..08.mp3 + vo/vo_full.mp3 + bảng thời lượng
node scripts/voiceover/voiceover.mjs check                      # nghe lại bằng speech-to-text, so với kịch bản
```

Mặc định model `eleven_multilingual_v2`, thêm `--model eleven_v3` để đổi. Tốc độ đọc giữ mặc định, không tự tăng.
Trong session cloud, chạy với `NODE_USE_ENV_PROXY=1` để Node đi qua proxy.

### Gói Free: tạo 1 lần trên web rồi tách

Gói Free không dùng giọng Voice Library qua API. Cách khác: dán cả 8 block vào web ElevenLabs một lần, tải 1 file, rồi tách.

```bash
node scripts/voiceover/voiceover.mjs paste                 # in đoạn văn bản để copy (có thẻ ngắt giữa các block)
node scripts/voiceover/voiceover.mjs split <file-da-tai.mp3>   # tách ra vo/01..08.mp3 + vo_full.mp3 + bảng thời lượng
```

## Video demo MVP BloomMate

Dựng bằng Remotion từ bản quay màn hình trong `source/`. Kết quả: `out/BloomMate_Demo_MVP.mp4` (1920×1080, khoảng 1 phút 26 giây).

### Chạy lại trên máy

```bash
git lfs pull
ffmpeg -i "source/Quay màn hình 2026-11-04 200042.mp4" -t 225 -an -c:v libx264 -preset veryfast -crf 18 -g 15 -pix_fmt yuv420p public/source.mp4
npx remotion studio src/index.ts
npx remotion render src/index.ts BloomMateDemo out/BloomMate_Demo_MVP.mp4 --crf=18
```

Lệnh `ffmpeg` tạo bản video dễ tua (`public/source.mp4`, không commit vì nặng).

### Sửa ở đâu

- `src/bloommate/edl.ts`: danh sách cảnh. Mỗi cảnh ghi đoạn cắt (giây trên bản quay), tốc độ, điểm zoom, khung chú thích và chữ dưới màn. Muốn đổi chữ hay số thì sửa ở đây.
- `src/bloommate/Cards.tsx`: thẻ mở đầu, thẻ "ảnh gốc", thẻ kết.
- `src/bloommate/theme.ts`: màu, font Be Vietnam Pro.
- `public/music.mp3`: nhạc nền, tự sáng tác bằng `scripts/music/compose.mjs`. Thay bằng bài khác thì giữ nguyên tên file.
