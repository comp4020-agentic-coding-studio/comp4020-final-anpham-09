// Who counts as a person is this app's call. Here it is a token in a cookie
// plus a name the person chose, because the family are specific people and a
// generated pseudonym would undo the point. The cookie helpers are the only
// thing here; the record itself lives in src/people.ts.
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
