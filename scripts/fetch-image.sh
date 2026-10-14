#!/usr/bin/env bash
# Swap a single pet image. Usage:
#   ./scripts/fetch-image.sh <slot> <unsplash-photo-id>
# Example:
#   ./scripts/fetch-image.sh guide-nose 1583337130417-3346a1be7dee
#
# Valid slots: hero-dog, hero-cat, closing-pet,
#              guide-nose, guide-eye, guide-ear, guide-mouth,
#              tip-nose, tip-eye, tip-ear, tip-mouth

set -euo pipefail

SLOT="${1:-}"
ID="${2:-}"

if [ -z "$SLOT" ] || [ -z "$ID" ]; then
  echo "Usage: $0 <slot> <unsplash-photo-id>"
  exit 1
fi

DIR="$(cd "$(dirname "$0")/.." && pwd)/public"
URL="https://images.unsplash.com/photo-${ID}?ixlib=rb-4.0.3&auto=format&fit=crop&w=1280&q=85"

echo "Downloading $SLOT from $URL"
curl -sL -o "${DIR}/${SLOT}.jpg" "$URL"
SIZE=$(stat -f%z "${DIR}/${SLOT}.jpg" 2>/dev/null)

if [ "$SIZE" -lt 5000 ]; then
  echo "FAIL (got ${SIZE}b — probably a 404 HTML page). Verify the photo ID at https://unsplash.com/photos/${ID}"
  exit 1
fi
echo "OK ${DIR}/${SLOT}.jpg (${SIZE}b)"
