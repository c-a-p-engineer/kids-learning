#!/usr/bin/env bash
set -euo pipefail

npm run build

# Normalize hashed main bundle to public/assets/main.js for workflow checks
mkdir -p public/assets
MAIN_BUNDLE=$(ls public/assets/main-*.js 2>/dev/null | head -n 1 || true)
if [ -n "${MAIN_BUNDLE}" ]; then
  cp "${MAIN_BUNDLE}" public/assets/main.js
fi
