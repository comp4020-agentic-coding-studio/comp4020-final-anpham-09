// Who counts as a person is this app's call. Here it is a token in a cookie
// plus a name the person chose, because the family are specific people and a
// generated pseudonym would undo the point. The cookie helpers are the only
// thing here; the record itself lives in src/people.ts.
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
