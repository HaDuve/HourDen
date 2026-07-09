#!/usr/bin/env bash
# Regenerate favicon PNGs from apps/web/public/favicon-source.png (issue #110).
# Requires ImageMagick (`magick`). JPEG sources are keyed to transparent RGBA.
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PUBLIC="$ROOT/public"
SOURCE="$PUBLIC/favicon-source.png"
PNG_OPTS=(-define "png:exclude-chunk=bKGD")

if ! command -v magick >/dev/null 2>&1; then
  echo "generate-favicons.sh: ImageMagick (magick) is required" >&2
  exit 1
fi

if [[ ! -f "$SOURCE" ]]; then
  echo "generate-favicons.sh: missing $SOURCE" >&2
  exit 1
fi

has_alpha="$(magick identify -format '%[channels]' "$SOURCE" | grep -c Alpha || true)"
tmp="$(mktemp "${TMPDIR:-/tmp}/favicon-source.XXXXXX.png")"
trap 'rm -f "$tmp"' EXIT

if [[ "$has_alpha" -eq 0 ]]; then
  magick "$SOURCE" -fuzz 18% -transparent white "${PNG_OPTS[@]}" PNG32:"$tmp"
else
  magick "$SOURCE" "${PNG_OPTS[@]}" PNG32:"$tmp"
fi

mv "$tmp" "$SOURCE"
trap - EXIT

TAB_CROP_PERCENT="$(
  node --input-type=module -e "import { TAB_FAVICON_CROP_HEIGHT_PERCENT } from './scripts/favicon-png.mjs'; console.log(TAB_FAVICON_CROP_HEIGHT_PERCENT)"
)"

# Tab icon: trim transparent margins, drop wordmark band, scale shield to fill 32×32.
magick "$SOURCE" -fuzz 5% -trim +repage \
  -crop "100%x${TAB_CROP_PERCENT}%+0+0" +repage \
  -resize 32x32^ \
  -gravity center -background none -extent 32x32 \
  "${PNG_OPTS[@]}" PNG32:"$PUBLIC/favicon-32x32.png"

# Touch icon: full trimmed badge including wordmark.
magick "$SOURCE" -fuzz 5% -trim +repage \
  -resize 180x180^ \
  -gravity center -background none -extent 180x180 \
  "${PNG_OPTS[@]}" PNG32:"$PUBLIC/apple-touch-icon.png"

echo "Wrote $SOURCE, $PUBLIC/favicon-32x32.png, $PUBLIC/apple-touch-icon.png"
