# Accounts: the person, not the browser

## The problem, demonstrated

Identity in this app is the cookie. `things.placed_by`, `perspectives.author`,
`keepings.person` and `presence.person` all store the cookie token, and none of
them is a foreign key to `people`.

So one human with two browsers is two people. Verified against a running app:

```
thing 28: An Duy walked
  placed_by: 59175206-ec4   (Mum, browser 1)
  keepers  : 1dfbd548-25f   (Mum, browser 2)
  names on it: Mum + Mum
```

Mum placed a thing and kept it together with herself. That defeats two rules
`CLAUDE.md` calls must-nevers:

- **Never let someone keep their own thing**, by any path.
- **Never show a thing on the shelf with only one name on it.** This is the
  product.

The `keepings_not_own` trigger cannot see it, because it compares tokens. And
`README.md` tells people how to do it: *"to be two of you, use a second browser
or a private window."* The instructions for using the app are instructions for
breaking its central rule.

The game has the same hole in its own form. `games.bottom` and `games.top` hold
tokens, guarded by `CHECK (top IS NULL OR top != bottom)` — the comment calls it
"the game's own keepings_not_own: a game needs two of you". Compared on tokens,
one person in two browsers can take both chairs and play themselves.

A third defect has the same root. A key proves permission but not identity, so
the display name and the member are independent:

```json
{"action":"key-accepted","who":"25fb4fa5","name":"Tester","member":"Mum"}
```

Anyone may hold Mum's key while being called anything, and whatever they place
is attributed to the invented name.

## The design

Separate the **session** from the **person**. The cookie stays a session. A new
stable `person_id` becomes identity:

- member → `m:<account name>`, the same on every device, for ever
- visitor → `v:<cookie token>`, exactly today's behaviour

Everything recording who did something stores `person_id` instead of the raw
token. Those columns are already bare `TEXT` with no foreign keys, so **no
schema change is required** — only a data migration and a change to what the
routes pass in.

```ts
export function personId(person: Person | undefined, token: string): string {
  return person?.memberName ? `m:${person.memberName}` : `v:${token}`;
}
```

What this fixes by construction, rather than by a new check:

- Mum on two devices is one `person_id`, so `keepings_not_own` finally sees her
  and the shelf rule holds. The fix lands in the schema, where the repo already
  argues such rules belong.
- A member's displayed name becomes their account name, so the `Tester`/`Mum`
  split cannot occur.
- Visitors behave exactly as today.

### What stays the same

Accounts remain the five in `MEMBER_KEYS`. There is still no sign-up, no email,
no reset and no profile. What changes is that the account **is** the identity
rather than a permission flag bolted to a cookie — which is why the rule in
`README.md` and `CLAUDE.md` has to change rather than be reworded again.

### Components

| File | Change |
| --- | --- |
| `people.ts` | `personId()`, `nameForPersonId()`; members display their account name |
| `db.ts` | one-time migration prefixing bare ids with `v:`, idempotent |
| `server.ts` | pass `personId(me, token)` wherever `token` is passed today |
| `things.ts` | `houseOfThing` unchanged; callers now hand it person ids |
| `presence.ts` | key presence on `person_id`; exclude the viewer by it |
| `games.ts` | seats, moves, concede and place key on `person_id` |
| `render.ts` | resolve display names through `nameForPersonId` |

### Migration

Existing rows hold bare tokens. One idempotent statement per table:

```sql
UPDATE things SET placed_by = 'v:' || placed_by
WHERE placed_by NOT LIKE 'v:%' AND placed_by NOT LIKE 'm:%';
```

Production is wiped instead (see below), so this exists for development
databases and for honesty about what the column holds.

### Known limitation, accepted deliberately

If someone acts as a visitor and *then* signs in, their earlier content stays
under `v:<token>` while they become `m:<name>`. They could keep their own
earlier thing.

Reclaiming that content on sign-in would mean rewriting rows across four tables
and resolving `UNIQUE (thing_id, person)` collisions — and every resolution
means dropping a keeping, which the app is not allowed to do. So v1 does not
reclaim. The window is small: production starts empty and the five sign in
before using it. Recorded here rather than left to be discovered.

## Production data

Production holds test residue, not memories: 78 people across 19 names, of
which 26 are `Alice`, 15 `Bob`, and the rest fixtures (`Player One`,
`DEPLOY CHECK A`, `No Script`). 82 keepings against **0 perspectives** — they
predate the rule requiring one, and triggers only fire on insert. 33 keepings
already have the same name on both sides of the shelf rule.

The database is therefore reset when this lands, after copying the file off the
volume first. This is not a breach of "nothing can be deleted": that rule
protects memories, and there are none here yet. Deleting one later would be.

## Testing

Each test is to be seen failing before it is trusted.

- **The headline:** a member places from one token and attempts to keep from a
  second token of the same account — refused `own-thing`. Fails today.
- The same account cannot take both chairs from two tokens — refused
  `already-seated` rather than starting a game against itself. Fails today.
- A visitor's id is still per-browser; two visitors remain two people.
- A member's displayed name is the account name, not the chosen one.
- `nameForPersonId` resolves both kinds, and an unknown id does not throw.
- The migration prefixes bare rows once and changes nothing on a second run.
- The existing 171 tests still pass.

## Out of scope

Sign-up, password reset, email, per-device session lists, reclaiming visitor
content on sign-in, and any change to what a visitor may see.

## Sequencing

C10 is complete, deployed and pushed at `442ef62`. This work happens on the
`accounts` branch and is pushed after the crit, so `main` stays at a state
known to be good.
