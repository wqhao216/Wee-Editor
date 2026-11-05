#!/usr/bin/env bash
# Tải 2 repo làm content vào vendor/ (không commit, đã gitignore).
#   bash scripts/setup-content-repos.sh                 # clone hoặc pull
#   bash scripts/setup-content-repos.sh --update-skills # thêm: chép lại skills mới nhất vào .claude/skills
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
VENDOR="$ROOT/vendor"
mkdir -p "$VENDOR"

sync_repo() { # $1 = url, $2 = thư mục
  if [ -d "$VENDOR/$2/.git" ]; then
    git -C "$VENDOR/$2" pull --ff-only
  else
    git clone --depth 1 "$1" "$VENDOR/$2"
  fi
}
sync_repo https://github.com/ScrapeCreators/social-media-research-skills.git social-media-research-skills
sync_repo https://github.com/krillinai/OpenCreator.git OpenCreator

if [ "${1:-}" = "--update-skills" ]; then
  for d in "$VENDOR"/social-media-research-skills/skills/* "$VENDOR"/OpenCreator/skills/*; do
    rm -rf "$ROOT/.claude/skills/$(basename "$d")"
    cp -r "$d" "$ROOT/.claude/skills/"
  done
  echo "Đã cập nhật skills. Nhớ sửa commit trong .claude/skills/_licenses/SOURCES.md."
fi

echo
echo "Xong. Bước tiếp theo:"
echo "  - Skills nghiên cứu MXH: export SCRAPECREATORS_API_KEY=sk_...  (lấy key ở scrapecreators.com)"
echo "  - OpenCreator / KrillinAI CLI: cd vendor/OpenCreator && corepack enable && pnpm install && pnpm krillinai:build"
echo "    (cần Node 22+, pnpm 9.15, Codex CLI; giao diện web: pnpm web:dev; xem vendor/OpenCreator/README.md mục Quick Start)"
