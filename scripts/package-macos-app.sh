#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
APP_NAME="${APP_NAME:-TRPG模组笔记}"
VERSION_SOURCE="${ROOT_DIR}/server/version.txt"
if [[ -z "${APP_VERSION:-}" && -f "${VERSION_SOURCE}" ]]; then
  APP_VERSION="$(tr -d '\r\n' < "${VERSION_SOURCE}")"
fi
APP_VERSION="${APP_VERSION:-0.0.0}"
APP_VERSION="${APP_VERSION#v}"
APP_IDENTIFIER="${APP_IDENTIFIER:-io.github.trpg-note.desktop}"
RELEASE_DIR="${ROOT_DIR}/server/release"
BINARY_PATH="${1:?usage: package-macos-app.sh <binary-path> <output-zip>}"
OUTPUT_ZIP="${2:?usage: package-macos-app.sh <binary-path> <output-zip>}"
GUIDE_SOURCE="${ROOT_DIR}/docs/macOS终端启动说明.txt"

APP_DIR="${RELEASE_DIR}/${APP_NAME}.app"
CONTENTS_DIR="${APP_DIR}/Contents"
MACOS_DIR="${CONTENTS_DIR}/MacOS"
RESOURCES_DIR="${CONTENTS_DIR}/Resources"
ICON_SOURCE="${ROOT_DIR}/build/icon-256.png"
ICON_BASENAME="app-icon"
MAIN_BINARY_NAME="trpg-note"
LAUNCHER_NAME="trpg-note-launcher"

rm -rf "${APP_DIR}"
mkdir -p "${MACOS_DIR}" "${RESOURCES_DIR}" "${RESOURCES_DIR}/data"

cp "${BINARY_PATH}" "${MACOS_DIR}/${MAIN_BINARY_NAME}"
chmod +x "${MACOS_DIR}/${MAIN_BINARY_NAME}"

cat > "${MACOS_DIR}/${LAUNCHER_NAME}" <<'EOF'
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
APP_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
RESOURCE_DIR="${APP_ROOT}/Resources"
DATA_DIR="${RESOURCE_DIR}/data"
mkdir -p "${DATA_DIR}"
export BTR_DB_PATH="${DATA_DIR}/storage.db"
cd "${RESOURCE_DIR}"
exec "${SCRIPT_DIR}/trpg-note" "$@"
EOF
chmod +x "${MACOS_DIR}/${LAUNCHER_NAME}"

cat > "${CONTENTS_DIR}/Info.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>zh_CN</string>
  <key>CFBundleDisplayName</key>
  <string>${APP_NAME}</string>
  <key>CFBundleExecutable</key>
  <string>${LAUNCHER_NAME}</string>
  <key>CFBundleIdentifier</key>
  <string>${APP_IDENTIFIER}</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>${APP_NAME}</string>
  <key>CFBundlePackageType</key>
  <string>APPL</string>
  <key>CFBundleShortVersionString</key>
  <string>${APP_VERSION}</string>
  <key>CFBundleVersion</key>
  <string>${APP_VERSION}</string>
  <key>LSMinimumSystemVersion</key>
  <string>11.0</string>
  <key>NSHighResolutionCapable</key>
  <true/>
 </dict>
 </plist>
EOF

if [[ -f "${ICON_SOURCE}" ]] && command -v sips >/dev/null 2>&1 && command -v iconutil >/dev/null 2>&1; then
  ICONSET_DIR="${RELEASE_DIR}/${ICON_BASENAME}.iconset"
  rm -rf "${ICONSET_DIR}"
  mkdir -p "${ICONSET_DIR}"
  sips -z 16 16     "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_16x16.png" >/dev/null
  sips -z 32 32     "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_16x16@2x.png" >/dev/null
  sips -z 32 32     "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_32x32.png" >/dev/null
  sips -z 64 64     "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_32x32@2x.png" >/dev/null
  sips -z 128 128   "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_128x128.png" >/dev/null
  sips -z 256 256   "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_128x128@2x.png" >/dev/null
  sips -z 256 256   "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_256x256.png" >/dev/null
  sips -z 512 512   "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_256x256@2x.png" >/dev/null
  sips -z 512 512   "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_512x512.png" >/dev/null
  sips -z 1024 1024 "${ICON_SOURCE}" --out "${ICONSET_DIR}/icon_512x512@2x.png" >/dev/null
  iconutil -c icns "${ICONSET_DIR}" -o "${RESOURCES_DIR}/${ICON_BASENAME}.icns"
  rm -rf "${ICONSET_DIR}"
  /usr/libexec/PlistBuddy -c "Add :CFBundleIconFile string ${ICON_BASENAME}" "${CONTENTS_DIR}/Info.plist" >/dev/null 2>&1 || \
    /usr/libexec/PlistBuddy -c "Set :CFBundleIconFile ${ICON_BASENAME}" "${CONTENTS_DIR}/Info.plist" >/dev/null 2>&1 || true
fi

# =========================================================
# 已注释：codesign 会导致 GitHub Actions 失败
# =========================================================
# if command -v codesign >/dev/null 2>&1; then
#   find "${APP_DIR}" -name ".DS_Store" -delete
#   codesign --force --deep --sign - "${APP_DIR}"
#   codesign --verify --deep --strict --verbose=2 "${APP_DIR}"
# fi
PACKAGE_ROOT="${RELEASE_DIR}/${APP_NAME}-macOS"
rm -rf "${PACKAGE_ROOT}"
mkdir -p "${PACKAGE_ROOT}"
cp -R "${APP_DIR}" "${PACKAGE_ROOT}/"
if [[ -f "${GUIDE_SOURCE}" ]]; then
  cp "${GUIDE_SOURCE}" "${PACKAGE_ROOT}/"
fi

rm -f "${OUTPUT_ZIP}"
ditto -c -k --keepParent "${PACKAGE_ROOT}" "${OUTPUT_ZIP}"
rm -rf "${PACKAGE_ROOT}"
