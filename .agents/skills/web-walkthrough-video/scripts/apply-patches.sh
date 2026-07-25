#!/usr/bin/env bash
# Copy vendor-scripts into a video-docs-builder install.
# Usage:
#   bash apply-patches.sh /path/to/video-docs-builder
#   bash apply-patches.sh /path/to/video-docs-builder /custom/scripts/dir

set -euo pipefail
DEST="${1:-}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
REF="${2:-$HERE/vendor-scripts}"

if [[ -z "$DEST" || ! -d "$DEST/scripts" ]]; then
  echo "Usage: $0 /path/to/video-docs-builder [reference-scripts-dir]"
  exit 1
fi
if [[ ! -d "$REF" ]]; then
  echo "Reference scripts not found: $REF"
  exit 1
fi

for f in types.ts generate-video.ts generate-audio.ts assemble.ts; do
  if [[ ! -f "$REF/$f" ]]; then
    echo "Missing $REF/$f"
    exit 1
  fi
  cp "$REF/$f" "$DEST/scripts/$f"
  echo "patched scripts/$f"
done

# Ensure Edge TTS defaults exist in skill .env (do not overwrite secrets)
ENV_FILE="$DEST/.env"
if [[ ! -f "$ENV_FILE" ]]; then
  cat > "$ENV_FILE" <<'EOF'
TTS_PROVIDER=edge
EDGE_TTS_VOICE=zh-CN-YunyangNeural
EDGE_TTS_RATE=+8%
# EDGE_TTS_BIN=$HOME/Library/Python/3.10/bin/edge-tts
# ACCEL_SLATE_MS=2500
# SUBTITLE_FONT=PingFang SC
EOF
  echo "wrote $ENV_FILE (edit EDGE_TTS_BIN if needed)"
elif ! grep -q 'TTS_PROVIDER' "$ENV_FILE" 2>/dev/null; then
  echo "" >> "$ENV_FILE"
  echo "TTS_PROVIDER=edge" >> "$ENV_FILE"
  echo "EDGE_TTS_VOICE=zh-CN-YunyangNeural" >> "$ENV_FILE"
  echo "EDGE_TTS_RATE=+8%" >> "$ENV_FILE"
  echo "appended TTS defaults to $ENV_FILE"
fi

echo "Done. Next: ensure .bin/ffmpeg on PATH, then init-project + run-all."
