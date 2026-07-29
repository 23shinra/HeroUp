#!/usr/bin/env bash
# Restore vanilla static files from a cutover _vanilla_backup_* folder into TARGET_DIR.
#
# Required:
#   CONFIRM=YES
#   TARGET_DIR=/path/to/restore
#
# Backup source (one of):
#   BACKUP_DIR=/path/to/_vanilla_backup_YYYYMMDD-HHMMSS
#   VANILLA_BACKUP=name-or-path   (under TARGET_DIR, or absolute)
#   (if omitted, uses the newest TARGET_DIR/_vanilla_backup_*)
#
# Production root additionally requires:
#   ALLOW_PRODUCTION_ROOT=YES
#
# Example:
#   CONFIRM=YES TARGET_DIR=/var/www/train.esl.kz ALLOW_PRODUCTION_ROOT=YES \
#     ./scripts/rollback.sh
set -euo pipefail

PRODUCTION_ROOT="/var/www/train.esl.kz"

die() { echo "rollback: $*" >&2; exit 1; }

[[ "${CONFIRM:-}" == "YES" ]] || die "Refused. Set CONFIRM=YES to run rollback."

[[ -n "${TARGET_DIR:-}" ]] || die "Refused. Set TARGET_DIR to the directory to restore."

TARGET_DIR="$(realpath -m "$TARGET_DIR")"
PRODUCTION_ROOT="$(realpath -m "$PRODUCTION_ROOT")"

if [[ "$TARGET_DIR" == "$PRODUCTION_ROOT" ]]; then
  [[ "${ALLOW_PRODUCTION_ROOT:-}" == "YES" ]] || die "Refused. TARGET_DIR is production root ($PRODUCTION_ROOT). Set ALLOW_PRODUCTION_ROOT=YES in addition to CONFIRM=YES."
fi

resolve_backup_dir() {
  if [[ -n "${BACKUP_DIR:-}" ]]; then
    realpath -m "$BACKUP_DIR"
    return
  fi

  if [[ -n "${VANILLA_BACKUP:-}" ]]; then
    local candidate="$VANILLA_BACKUP"
    if [[ "$candidate" != /* ]]; then
      candidate="$TARGET_DIR/$candidate"
    fi
    realpath -m "$candidate"
    return
  fi

  local latest=""
  local dir
  shopt -s nullglob
  for dir in "$TARGET_DIR"/_vanilla_backup_*; do
    [[ -d "$dir" ]] || continue
    if [[ -z "$latest" || "$dir" -nt "$latest" ]]; then
      latest="$dir"
    fi
  done
  shopt -u nullglob

  [[ -n "$latest" ]] || die "No _vanilla_backup_* under $TARGET_DIR. Set BACKUP_DIR or VANILLA_BACKUP."
  realpath -m "$latest"
}

BACKUP_DIR="$(resolve_backup_dir)"

[[ -d "$BACKUP_DIR" ]] || die "BACKUP_DIR is not a directory: $BACKUP_DIR"

echo "rollback: TARGET_DIR=$TARGET_DIR"
echo "rollback: BACKUP_DIR=$BACKUP_DIR"
echo "rollback: this restores pre-cutover vanilla static files from the backup folder."
read -r -p "Type ROLLBACK to continue: " reply
[[ "$reply" == "ROLLBACK" ]] || die "Aborted."

rsync -a --delete "$BACKUP_DIR/" "$TARGET_DIR/"

echo "rollback: done."
