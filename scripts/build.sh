#!/usr/bin/env bash
set -euo pipefail

npm run test
npm run build

mkdir -p public/assets
MAIN_BUNDLE=$(ls public/assets/main-*.js 2>/dev/null | head -n 1 || true)
if [ -n "${MAIN_BUNDLE}" ]; then
  cp "${MAIN_BUNDLE}" public/assets/main.js
fi
