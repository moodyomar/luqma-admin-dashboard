#!/usr/bin/env bash
# Copy shared Firestore rules from firebase-template.rules → per-tenant *.rules files.
#
# Source of truth (white-label / non-Luqma): firebase-rules/firebase-template.rules
# Luqma / QBMenu / Jeeb: ../firestore.rules only (do not duplicate; see firebase-rules/README.md)
#
# Usage:
#   ./scripts/sync-firebase-tenant-rules.sh           # apply
#   ./scripts/sync-firebase-tenant-rules.sh --dry-run   # show diff summary only
#
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
RULES_DIR="$(cd "$SCRIPT_DIR/../firebase-rules" && pwd)"
SOURCE="$RULES_DIR/firebase-template.rules"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]] || [[ "${1:-}" == "-n" ]]; then
  DRY_RUN=true
fi

if [[ ! -f "$SOURCE" ]]; then
  echo "❌ Missing source file: $SOURCE"
  exit 1
fi

# Tenant rule files that should track the template byte-for-byte.
# Do NOT list Luqma here — Jeeb paths live only in ../firestore.rules (merged manually from template when needed).
# Add/remove names to match files under firebase-rules/*.rules
TENANTS=(
  bunelo
  icon
  risto
  safaa
  refresh
)

echo "🔐 Firebase tenant rules sync"
echo "   Source: firebase-template.rules"
echo "   Targets: ${TENANTS[*]}"
echo ""

for name in "${TENANTS[@]}"; do
  dest="$RULES_DIR/${name}.rules"
  if [[ ! -f "$dest" ]]; then
    echo "⚠️  Skip (file missing): $dest — create it or remove '$name' from TENANTS in this script."
    continue
  fi

  if cmp -s "$SOURCE" "$dest"; then
    echo "✓ ${name}.rules — already identical"
    continue
  fi

  if $DRY_RUN; then
    echo "📋 Would update: ${name}.rules (diff lines: $(diff -u "$dest" "$SOURCE" | wc -l | tr -d ' '))"
  else
    cp "$SOURCE" "$dest"
    echo "✅ Updated: ${name}.rules"
  fi
done

if $DRY_RUN; then
  echo ""
  echo "Dry run only. Run without --dry-run to apply."
fi
