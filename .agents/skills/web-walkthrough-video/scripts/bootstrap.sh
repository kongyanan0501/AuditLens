#!/usr/bin/env bash
# Bootstrap walkthrough-video capability for a target app repo.
# Usage:
#   bash bootstrap.sh /path/to/target-app [/path/to/install-video-docs-builder]
#
# If video-docs-builder path omitted, installs under target-app/.agents/skills/video-docs-builder

set -euo pipefail
TARGET="${1:-}"
HERE="$(cd "$(dirname "$0")/.." && pwd)"
ENGINE="${2:-}"

if [[ -z "$TARGET" || ! -d "$TARGET" ]]; then
  echo "Usage: $0 /path/to/target-app [video-docs-builder-dir]"
  exit 1
fi

TARGET="$(cd "$TARGET" && pwd)"

if [[ -z "$ENGINE" ]]; then
  ENGINE="$TARGET/.agents/skills/video-docs-builder"
fi

if [[ ! -d "$ENGINE/scripts" ]]; then
  echo "→ Installing video-docs-builder into $ENGINE"
  mkdir -p "$(dirname "$ENGINE")"
  npx --yes skills add https://github.com/tecnomanu/video-docs-builder --skill video-docs-builder -y
  # skills CLI may install to cwd or global; locate and copy if needed
  if [[ ! -d "$ENGINE/scripts" ]]; then
    CANDIDATES=(
      "$TARGET/.agents/skills/video-docs-builder"
      "$TARGET/.cursor/skills/video-docs-builder"
      "$HOME/.agents/skills/video-docs-builder"
    )
    FOUND=""
    for c in "${CANDIDATES[@]}"; do
      if [[ -d "$c/scripts" ]]; then FOUND="$c"; break; fi
    done
    if [[ -z "$FOUND" ]]; then
      echo "Could not find video-docs-builder after install. Pass path as 2nd arg."
      exit 1
    fi
    if [[ "$FOUND" != "$ENGINE" ]]; then
      mkdir -p "$(dirname "$ENGINE")"
      rm -rf "$ENGINE"
      cp -R "$FOUND" "$ENGINE"
    fi
  fi
fi

echo "→ Applying walkthrough patches"
bash "$HERE/scripts/apply-patches.sh" "$ENGINE"

echo "→ ffmpeg-static / playwright"
cd "$ENGINE"
npm i -D ffmpeg-static ffprobe-static 2>/dev/null || npm i ffmpeg-static ffprobe-static
mkdir -p .bin
ln -sf "$(node -p "require('ffmpeg-static')")" .bin/ffmpeg
ln -sf "$(node -p "require('ffprobe-static').path")" .bin/ffprobe
npx playwright install chromium

echo "→ init .video-docs in target app"
npx tsx scripts/init-project.ts "$TARGET" || true
mkdir -p "$TARGET/.video-docs/flows"
if [[ ! -f "$TARGET/.video-docs/config.json" ]]; then
  cp "$HERE/templates/config.example.json" "$TARGET/.video-docs/config.json"
  echo "wrote config.json — edit credentials"
fi
if [[ ! -f "$TARGET/.video-docs/flows/01-walkthrough.json" ]]; then
  cp "$HERE/templates/flow-with-llm-wait.example.json" "$TARGET/.video-docs/flows/01-walkthrough.json"
  echo "wrote flows/01-walkthrough.json — edit selectors / sample path"
fi

# gitignore secrets & bulky output
GI="$TARGET/.gitignore"
touch "$GI"
for line in '.video-docs/config.json' '.video-docs/output/' '.env.local'; do
  grep -qxF "$line" "$GI" 2>/dev/null || echo "$line" >> "$GI"
done

echo ""
echo "✅ Bootstrap done."
echo "   Engine: $ENGINE"
echo "   Edit:   $TARGET/.video-docs/config.json"
echo "   Edit:   $TARGET/.video-docs/flows/01-walkthrough.json"
echo "   Run:"
echo "     cd \"$ENGINE\" && export PATH=\"\$(pwd)/.bin:\$PATH\""
echo "     bash scripts/run-all.sh \"$TARGET/.video-docs/flows/01-walkthrough.json\""
