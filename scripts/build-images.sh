#!/usr/bin/env bash
# Re-encode the Figma asset PNGs into the WebP files the app serves.
#
# Run from the repo root: scripts/build-images.sh
#
# The sources in assets/ are 1672x941 PNGs at ~3MB each. A 3MB hero is the
# failure the "slow connection" band tests for, so nothing in assets/ is served
# directly: this script writes img/ and img/ is what ships in the container.
#
# Backgrounds get three widths because they are full-bleed and the width a
# phone needs is a third of the width a laptop needs. Content crops get one,
# since they render at a fixed card size.
#
# Requires cwebp (brew install webp) and magick (brew install imagemagick).
# Re-run after changing anything in assets/village-assets/.
set -euo pipefail

cd "$(dirname "$0")/.."
src="assets/village-assets"
out="img"

for tool in cwebp magick; do
  command -v "$tool" >/dev/null || { echo "missing $tool" >&2; exit 1; }
done

# A background at one width. q=72 is where these photographs stop losing
# anything visible; the foliage and the string lights are the parts that
# show compression first, so they are what to look at when changing it.
background() {
  local from="$1" name="$2" width="$3"
  magick "$src/$from.png" -resize "${width}x" -strip png:- \
    | cwebp -quiet -q 72 -m 6 -o "$out/$name-$width.webp" -- -
}

echo "backgrounds"
for pair in "background0 village" "background1 room-nghe-an" "background2 room-meeting"; do
  set -- $pair
  for width in 760 1200 1672; do
    background "$1" "$2" "$width"
    printf '  %-22s %s\n' "$2-$width.webp" "$(du -h "$out/$2-$width.webp" | cut -f1)"
  done
done

# The shelf uses the village crop as a decorative album cover, explicitly
# captioned as an illustration. Real memory cards remain text records.
# Sample portraits and memory photographs are not assigned to real people.
crops=(polaroid)
if [ ${#crops[@]} -gt 0 ]; then
  echo "crops"
  for name in "${crops[@]}"; do
    cwebp -quiet -q 80 -m 6 -o "$out/$name.webp" "$src/$name.png"
    printf '  %-22s %s\n' "$name.webp" "$(du -h "$out/$name.webp" | cut -f1)"
  done
fi

echo
echo "img/ total: $(du -sh "$out" | cut -f1)"
