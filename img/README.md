# House pictures

One picture per house, named for its slug:

- `nghe-an.jpg` — my parents' house
- `hanoi.jpg` — my brother and sister-in-law's
- `canberra.jpg` — mine
- `meeting.jpg` — the meeting house

These are stand-ins until the family takes real ones, and the caption under
each says so. The app falls back to a drawn panel when a file is missing, so
a house without a picture still renders.

## Backgrounds and crops

`scripts/build-images.sh` writes the rest of this directory from
`assets/village-assets/` — it is generated, not hand-edited. Backgrounds are
WebP at three widths (`village-760.webp`, `-1200`, `-1672`, and the same for
`room-nghe-an` and `room-meeting`); the sources are 1672x941 PNGs at about 3MB
each, which is the wrong thing to send to a phone. The crops and avatars are
single-size WebP.

Re-run the script after changing anything in `assets/`.
