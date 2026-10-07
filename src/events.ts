// Server-sent events, not WebSockets: the traffic is one-directional (the
// server says what changed; every action is an ordinary form POST), SSE
// survives proxies, and when it fails it degrades to a page that simply
// doesn't update rather than to a broken one. PROCESS.md records the choice.
//
// This module knows nothing about HTTP so it can be tested without a server.

export type Listener = (payload: string) => void;

const rooms = new Map<string, Set<Listener>>();

export function subscribe(houseSlug: string, listener: Listener): () => void {
  const set = rooms.get(houseSlug) ?? new Set<Listener>();
  set.add(listener);
  rooms.set(houseSlug, set);
  return () => {
    set.delete(listener);
    if (set.size === 0) rooms.delete(houseSlug);
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
