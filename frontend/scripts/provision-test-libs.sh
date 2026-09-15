#!/usr/bin/env bash
# 用户态补齐 Chromium 运行所需的系统库（无需 root）。
# 原理：用 apt 下载 deb 包并解包到 ${PW_LIBS_ROOT:-~/.local/pw-libs/root}，
# 测试入口 scripts/test-e2e.mjs 会自动检测并接入该目录，无需手工改命令。
set -euo pipefail

ROOT="${PW_LIBS_ROOT:-$HOME/.local/pw-libs/root}"
WORK="$(dirname "$ROOT")/debs"
APT_LISTS="/tmp/pw-libs-apt/lists"
APT_CACHE="/tmp/pw-libs-apt/cache"

# Chromium (headless shell 与完整 chrome) 在 Debian/Ubuntu 上常见的运行库
PACKAGES=(
  libnspr4 libnss3 libxkbcommon0
  libxcomposite1 libxdamage1 libxfixes3 libxrandr2 libxi6
  libasound2 libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0
  libdbus-1-3 libgbm1 libdrm2 libwayland-server0
  libcups2 libavahi-client3 libavahi-common3
)

if ! command -v apt-get >/dev/null 2>&1; then
  echo "当前系统没有 apt-get，请用系统包管理器安装等价依赖后重跑 npm run test:e2e：" >&2
  printf '  %s\n' "${PACKAGES[@]}" >&2
  exit 1
fi

mkdir -p "$APT_LISTS/partial" "$APT_CACHE/archives/partial" "$WORK" "$ROOT"
APT_OPTS=(-o "Dir::State::Lists=$APT_LISTS" -o "Dir::Cache=$APT_CACHE" -o Debug::NoLocking=1)

echo ">> 更新软件包索引（用户态）"
apt-get update "${APT_OPTS[@]}"

echo ">> 下载依赖包"
cd "$WORK"
apt-get download "${APT_OPTS[@]}" "${PACKAGES[@]}"

echo ">> 解包到 $ROOT"
for pkg in ./*.deb; do
  dpkg-deb -x "$pkg" "$ROOT"
done

echo "完成。重跑 npm run test:e2e 即可自动接入。"
