# source/

Video và tư liệu gốc dùng để dựng video trong Wee-Editor. Mọi file video (`.mp4`, `.mov`, `.webm`, `.mkv`) trong thư mục này lưu bằng Git LFS (xem `.gitattributes`).

Repo này **public**. Không đặt ở đây video có thông tin cá nhân (CCCD, số điện thoại, địa chỉ, email, tài khoản): những video đó để ở repo private [wee-editor-footage](https://github.com/wqhao216/wee-editor-footage).

## screen-recordings/

Video quay màn hình, đặt tên `YYYY-MM-DD-noi-dung.mp4`.

| File | Ngày quay | Thời lượng | Độ phân giải | Nội dung |
|------|-----------|-----------|--------------|----------|
| `2026-11-04-bloommate-demo.mp4` | 04/11/2026 20:00 | 3:47 | 2458×1330 | Demo app BloomMate (giao diện tiếng Anh): Evening check, Restock, Today và combo gợi ý, ảnh và caption, Stock với Smart view, Report |

## Dùng trong Remotion

Remotion chỉ đọc media qua `staticFile()` trong thư mục `public/`. Muốn dùng một video ở đây thì chép sang `public/`, ví dụ:

```bash
cp source/screen-recordings/2026-11-04-bloommate-demo.mp4 public/
```

```tsx
<OffthreadVideo src={staticFile("2026-11-04-bloommate-demo.mp4")} />
```

## Clone mà không tải video

```bash
GIT_LFS_SKIP_SMUDGE=1 git clone https://github.com/wqhao216/Wee-Editor.git
git lfs pull --include="source/screen-recordings/2026-11-04-bloommate-demo.mp4"   # tải riêng một video khi cần
```
