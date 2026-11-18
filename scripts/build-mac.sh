#!/bin/sh
# Builds an ad-hoc signed macOS app for Apple silicon into release/mac-arm64/ (local use, not notarized).
# The game and wiki images are gitignored, so the missing ones are fetched first.
set -e
cd "$(dirname "$0")/.."
[ "$(uname -s)" = Darwin ] || { echo "build-mac.sh must run on macOS." >&2; exit 1; }
[ -d node_modules ] || { echo "Run 'npm ci' first." >&2; exit 1; }

# npm skips install scripts for some setups, which leaves Electron without its binary.
[ -d node_modules/electron/dist ] || node node_modules/electron/install.js

# fetch-atlas.mjs rewrites tracked files (data/atlas.json, docs/atlas-license.txt): put them back.
[ -d src/renderer/public/images/atlas ] || { node scripts/fetch-atlas.mjs; git checkout -- data/atlas.json docs/atlas-license.txt; }
[ -d src/renderer/public/images/reference ] || node scripts/fetch-reference-images.mjs
if [ -z "$(ls src/renderer/public/images/items 2>/dev/null)" ]; then
  # fetch-item-images.mjs writes WebP through ffmpeg; Homebrew's default ffmpeg is built without libwebp.
  ffmpeg -hide_banner -encoders 2>/dev/null | grep -q libwebp ||
    { echo "fetch-item-images.mjs needs an ffmpeg with libwebp on PATH (check: ffmpeg -encoders | grep libwebp)." >&2; exit 1; }
  node scripts/fetch-item-images.mjs
fi

npm run build
CSC_IDENTITY_AUTO_DISCOVERY=false npx electron-builder --mac dir --arm64 -c.mac.identity=null -c.mac.icon=build/icon.png --publish never
codesign --force --deep -s - "release/mac-arm64/Hyrule Tracker.app"
