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

/** One dead socket must not stop the rest of the room being told. */
export function publish(houseSlug: string, payload: string): void {
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
