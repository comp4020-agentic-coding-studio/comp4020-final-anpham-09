// Server-sent events, not WebSockets: the traffic is one-directional (the
// server says what changed; every action is an ordinary form POST), SSE
// survives proxies, and when it fails it degrades to a page that simply
// doesn't update rather than to a broken one. PROCESS.md records the choice.
//
// This module knows nothing about HTTP so it can be tested without a server.

export type Listener = (payload: string) => void;

const rooms = new Map<string, Set<Listener>>();

/** Joining the village costs nothing, so a cap keyed to identity would not
 *  stop one visitor minting cookies and opening a stream per one — this cap
 *  is global, on the one thing every stream actually holds open: a socket,
 *  a listener, and a server.ts ping interval, for as long as it's connected. */
export const MAX_LISTENERS = 500;

export function totalListenerCount(): number {
  let total = 0;
  for (const set of rooms.values()) total += set.size;
  return total;
}

/** Returns null, not a no-op unsubscribe, once the cap is reached — a caller
 *  that ignored the null and used it anyway would throw immediately, rather
 *  than silently believing it has a working subscription it doesn't. */
export function subscribe(houseSlug: string, listener: Listener): (() => void) | null {
  if (totalListenerCount() >= MAX_LISTENERS) return null;
  const set = rooms.get(houseSlug) ?? new Set<Listener>();
  set.add(listener);
  rooms.set(houseSlug, set);
  // Read the live map rather than the Set captured above. Calling an
  // unsubscribe twice must be harmless: if this closed over `set`, a second
  // call after someone else re-subscribed would see the stale empty Set, and
  // delete the *new* room out from under a live listener — a delivery lost
  // permanently, with no error and no log line.
  return () => {
    const current = rooms.get(houseSlug);
    if (!current) return;
    current.delete(listener);
    if (current.size === 0) rooms.delete(houseSlug);
  };
}

/** A payload is one SSE `data:` line, and a newline in it is not an escape
 *  sequence — it ends the line. Everything after it is parsed by the
 *  browser as further SSE, so a payload carrying a newline does not produce
 *  a mangled event, it produces an EXTRA one that the writer of that
 *  newline controls.
 *
 *  Until the typing indicator every payload was a literal from this
 *  codebase ("placed", "kept", "arrived"), so nothing could put a newline
 *  in one. Typing carries a person's name, and names are typed by people:
 *  a name of "Al\nice\n\ndata: whatever" splits one frame into two.
 *
 *  Collapsing to spaces rather than rejecting, because the caller cannot
 *  do anything useful with a refusal here and a truncated name is a
 *  cosmetic problem where a forged event is not. The cap is the same
 *  reasoning: a payload is a notification, not a channel. */
const MAX_PAYLOAD = 200;
export const safePayload = (payload: string): string =>
  payload.replace(/[\r\n]+/g, " ").slice(0, MAX_PAYLOAD);

/** One dead socket must not stop the rest of the room being told. */
export function publish(houseSlug: string, rawPayload: string): void {
  // Sanitised here, at the one place every payload passes through, rather
  // than at each call site — a new publisher should not have to know about
  // the SSE wire format to be safe.
  const payload = safePayload(rawPayload);
  for (const listener of rooms.get(houseSlug) ?? []) {
    try {
      listener(payload);
    } catch (err: unknown) {
      console.error(
        JSON.stringify({ at: new Date().toISOString(), level: "warn", msg: "listener failed", err: String(err) }),
      );
    }
  }
}

export function listenerCount(houseSlug: string): number {
  return rooms.get(houseSlug)?.size ?? 0;
}
