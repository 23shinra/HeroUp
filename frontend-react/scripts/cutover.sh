#!/usr/bin/env bash
# Deploy frontend-react/dist to TARGET_DIR.
#
# NOT auto-run — invoke manually after parity sign-off (see docs/PARITY.md, scripts/preview-notes.md).
#
# Required:
#   CONFIRM=YES
#   TARGET_DIR=/path/to/deploy
#
# If TARGET_DIR is the production web root, also set:
#   ALLOW_PRODUCTION_ROOT=YES
#
# Example (staging):
#   CONFIRM=YES TARGET_DIR=/var/www/staging.train.esl.kz ./scripts/cutover.sh
#
# Example (production — explicit only):
#   CONFIRM=YES ALLOW_PRODUCTION_ROOT=YES TARGET_DIR=/var/www/train.esl.kz ./scripts/cutover.sh
set -euo pipefail

PRODUCTION_ROOT="/var/www/train.esl.kz"
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FRONTEND_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
DIST_DIR="$FRONTEND_DIR/dist"
STAMP="$(date +%Y%m%d-%H%M%S)"

die() { echo "cutover: $*" >&2; exit 1; }

[[ "${CONFIRM:-}" == "YES" ]] || die "Refused. Set CONFIRM=YES to run cutover."

[[ -n "${TARGET_DIR:-}" ]] || die "Refused. Set TARGET_DIR to the deployment directory."

TARGET_DIR="$(realpath -m "$TARGET_DIR")"
PRODUCTION_ROOT="$(realpath -m "$PRODUCTION_ROOT")"

if [[ "$TARGET_DIR" == "$PRODUCTION_ROOT" ]]; then
  [[ "${ALLOW_PRODUCTION_ROOT:-}" == "YES" ]] || die "Refused. TARGET_DIR is production root ($PRODUCTION_ROOT). Set ALLOW_PRODUCTION_ROOT=YES in addition to CONFIRM=YES."
fi

[[ -d "$DIST_DIR" ]] || die "Missing build output at $DIST_DIR — run npm run build in frontend-react first."

echo "cutover: TARGET_DIR=$TARGET_DIR"
echo "cutover: source=$DIST_DIR"
echo "cutover: this script is NOT run automatically — confirm deployment intent."
read -r -p "Type DEPLOY to continue: " reply
[[ "$reply" == "DEPLOY" ]] || die "Aborted."

BACKUP_DIR="$TARGET_DIR/_vanilla_backup_$STAMP"
mkdir -p "$BACKUP_DIR"

backup_if_exists() {
  local path="$1"
  if [[ -e "$TARGET_DIR/$path" ]]; then
    mkdir -p "$BACKUP_DIR/$(dirname "$path")"
    cp -a "$TARGET_DIR/$path" "$BACKUP_DIR/$path"
    echo "cutover: backed up $path"
  fi
}

for html in "$TARGET_DIR"/*.html; do
  [[ -f "$html" ]] || continue
  cp -a "$html" "$BACKUP_DIR/"
  echo "cutover: backed up $(basename "$html")"
done

for path in js css sw.js manifest.webmanifest; do
  backup_if_exists "$path"
done

mkdir -p "$TARGET_DIR"

RSYNC_EXCLUDES=(
  --exclude 'server/'
  --exclude 'frontend-react/'
  --exclude 'scripts/'
  --exclude 'docs/'
  --exclude '.env'
  --exclude 'node_modules/'
  --exclude 'package.json'
  --exclude 'package-lock.json'
  --exclude '_legacy*/'
  --exclude '_vanilla*/'
)

rsync -a "${RSYNC_EXCLUDES[@]}" "$DIST_DIR/" "$TARGET_DIR/"

echo "cutover: done."
echo "cutover: vanilla backup at $BACKUP_DIR"
echo "cutover: verify the site at TARGET_DIR before switching traffic."
