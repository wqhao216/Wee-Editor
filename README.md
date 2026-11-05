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

## Bộ làm content (2 repo bên ngoài)

| Repo | Dùng để | Đã cài ở đâu |
|---|---|---|
| [ScrapeCreators/social-media-research-skills](https://github.com/ScrapeCreators/social-media-research-skills) | Nghiên cứu MXH: tìm bài viral (outlier), đào comment, phân tích transcript, soi đối thủ, quảng cáo, trend, KOL, repurpose nội dung | 13 skills trong `.claude/skills/` (`outlier-post-finder`, `comment-mining`, `trend-discovery`, `content-repurposing`, ...) |
| [krillinai/OpenCreator](https://github.com/krillinai/OpenCreator) | Dịch video, phụ đề song ngữ, lồng tiếng TTS, render dọc/ngang, tạo ảnh bìa, viết kịch bản video ngắn | 7 skills `krillinai-*` trong `.claude/skills/`; mã nguồn đầy đủ tải vào `vendor/OpenCreator` |

Thiết lập:

```bash
bash scripts/setup-content-repos.sh          # tải 2 repo vào vendor/ (không commit)
export SCRAPECREATORS_API_KEY=sk_...          # skills nghiên cứu MXH cần key từ scrapecreators.com
```

Skills `krillinai-*` cần build KrillinAI CLI trong `vendor/OpenCreator` (Node 22+, pnpm 9.15, Codex CLI): `corepack enable && pnpm install && pnpm krillinai:build`. Muốn dùng giao diện thì cài app Desktop từ [trang release](https://github.com/krillinai/OpenCreator/releases/latest). Nguồn và license: `.claude/skills/_licenses/SOURCES.md`.

## Cấu trúc

- `src/index.ts`, `src/Root.tsx`: đăng ký các video (Composition) của Remotion
- `src/HelloVideo.tsx`: video mẫu 3 giây, khổ dọc 1080x1920
- `scripts/check.mjs`: kiểm tra cài đặt
- `scripts/setup-content-repos.sh`: tải/cập nhật 2 repo làm content
