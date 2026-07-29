#!/usr/bin/env bash
# Copy frontend-react/dist to a dedicated preview docroot (never production).
#
# Usage:
#   cd frontend-react && npm run build
#   ./scripts/prepare-preview-root.sh
#
# Optional:
#   FRONTEND_PREVIEW_ROOT=/var/www/my-preview ./scripts/prepare-preview-root.sh
#
# Requires a fresh build at frontend-react/dist/. Does not modify /var/www/train.esl.kz.
set -euo pipefail

PRODUCTION_ROOT="/var/www/train.esl.kz"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$FRONTEND_DIR/dist"
PREVIEW_ROOT="${FRONTEND_PREVIEW_ROOT:-/var/www/train-preview.esl.kz}"

die() { echo "prepare-preview-root: $*" >&2; exit 1; }

[[ -d "$DIST_DIR" ]] || die "Missing $DIST_DIR — run: cd frontend-react && npm run build"

PREVIEW_ROOT="$(realpath -m "$PREVIEW_ROOT")"
PRODUCTION_ROOT="$(realpath -m "$PRODUCTION_ROOT")"

if [[ "$PREVIEW_ROOT" == "$PRODUCTION_ROOT" ]]; then
  die "Refused. FRONTEND_PREVIEW_ROOT must not be the production web root ($PRODUCTION_ROOT)."
fi

mkdir -p "$PREVIEW_ROOT"

echo "prepare-preview-root: source=$DIST_DIR"
echo "prepare-preview-root: target=$PREVIEW_ROOT"

rsync -a --delete "$DIST_DIR/" "$PREVIEW_ROOT/"

echo "prepare-preview-root: done."
echo "prepare-preview-root: point nginx (or vite preview) at $PREVIEW_ROOT for staging QA."
