// Who counts as a person is this app's call, and the brief leaves it open.
// Here it's an anonymous pseudonym in a cookie: no account, no email, nothing
// that outlives the browser that made it. Enough to tell two people apart,
// which is all "multi-user" requires, and no more than that.
const ADJECTIVES = ["quiet", "bright", "steady", "amber", "wandering", "patient", "sudden", "plain"];
const NOUNS = ["lyrebird", "wattle", "currawong", "brindabella", "kurrajong", "rosella", "ibis", "gum"];

export interface Visitor {
  token: string;
  name: string;
}

/** A readable name derived from the token, so the same visitor always reads
 *  the same way without storing a profile anywhere. */
export function nameFor(token: string): string {
  let h = 0;
  for (const ch of token) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return `${ADJECTIVES[h % ADJECTIVES.length]} ${NOUNS[(h >> 8) % NOUNS.length]}`;
}

export function newToken(): string {
  return crypto.randomUUID();
}

export function readCookie(header: string | undefined, key: string): string | undefined {
  if (!header) return undefined;
  for (const part of header.split(";")) {
    const [k, ...rest] = part.trim().split("=");
    if (k === key) return decodeURIComponent(rest.join("="));
  }
  return undefined;
}
