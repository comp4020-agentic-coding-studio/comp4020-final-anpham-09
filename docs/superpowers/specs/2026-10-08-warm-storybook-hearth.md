# Warm Storybook Hearth — applying the reference design

Reference: `docs/stitch_the_family_village_app/` (DESIGN.md plus five screens).
The reference is the brief. Follow its palette, type and surface language exactly.

## What is adopted

- The full token system: terracotta / sage / amber on soft cream, parchment
  card tiers, flax hairlines, soft ambient shadows, 0.5/1/1.5rem rounding.
- Merriweather headlines against Plus Jakarta Sans body.
- Three interaction ideas from the mockups, all of which are true of our data:
  - the two-state rule printed beside the compose box;
  - a consequence line before you act — who is in the house right now, and
    what will happen to the thing if they are still here when you place it;
  - the refusals stated in the interface ("no notifications, no alerts").
- The Memory Shelf as a top-level destination. `onShelf()` is already written
  and tested and wired to nothing.

## What is refused, and why

The mockups show things the app cannot know. Rendering them would break the
one rule the whole project rests on — never claim more than you can show —
on the page a marker reads first.

- **Photographs of each house.** Generated stock. A photo captioned "Hanoi
  House" that is not my brother's house is decoration lying about reality.
  Replaced with a CSS-drawn panel that announces itself as a placeholder.
- **Ambient sensory detail** — "kettle freshly brewed", "scent of dried pomelo
  peels", "Summer Breeze 28°C", "late afternoon light". No data behind any of
  it.
- **"Active 12m ago."** Presence is known to 45 seconds. Twelve minutes is a
  number the app does not have.
- **"Hearth Updates."** It is an activity feed, and refusing feeds is the
  argument.
- **The pantry inventory and the avatars.** A different app, and we collect
  only a chosen name.

## Placeholder imagery

Each house gets a CSS-drawn panel — layered gradients in the house's own tint,
no external request, no image file — under a caption reading that a real photo
belongs there. Decorative, so `aria-hidden`; the caption carries the meaning.
Swapping in a real photograph later replaces the panel and keeps the caption.

## Constraints that do not move

Colour only from custom properties, including the dark variant. One `h1` per
page. Interactive targets at least 44×44px. Status carried in text, never by
colour alone. Every action a form POST; the page works with JavaScript off.
Web fonts load with `font-display: swap` behind a metric-compatible fallback
stack, so a slow connection degrades to a readable page rather than a blank one.
