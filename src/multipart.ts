/** A multipart/form-data reader, written out by hand.
 *
 *  There is no `node:http` import here and there must not be one, for the
 *  same reason `src/events.ts` has none: this is the riskiest code in the
 *  app — it parses bytes a stranger sent — and it has to be testable against
 *  hand-made buffers rather than only through a running server.
 *
 *  It is also the reason the app still has one runtime dependency. A form
 *  that carries a photograph is the only thing in the village that is not
 *  urlencoded, and pulling in a parser for it would cost more than the
 *  eighty lines below on a 256MB machine.
 *
 *  What it is NOT: a complete implementation of RFC 7578. It does not
 *  decode `filename*`, does not follow `content-transfer-encoding`, and
 *  keeps only the first value for a repeated field name. The app sends the
 *  form, so the app knows what comes back; anything it does not understand
 *  is dropped rather than guessed at.
 */

export interface Part {
  /** The form field's name. A part with no name is dropped. */
  name: string;
  /** Present only for a file part, and never trusted — it is used to decide
   *  that a part IS a file, never to name one on disk. */
  filename?: string;
  value: Buffer;
}

const DASH = 0x2d; // "-"
const CR = 0x0d;
const LF = 0x0a;

/** The boundary out of a content-type header, or null if this is not a
 *  multipart body. The value may be quoted, and may be followed by further
 *  parameters, so it is cut at the first `;` outside the quotes. */
export function boundaryOf(contentType: string | undefined): string | null {
  if (!contentType) return null;
  if (!/^\s*multipart\/form-data\s*;/i.test(contentType)) return null;
  const match = /;\s*boundary=("([^"]*)"|[^;]*)/i.exec(contentType);
  const raw = (match?.[2] ?? match?.[1] ?? "").trim();
  // A boundary is 1-70 characters and may not be empty. An empty one would
  // make every byte a delimiter.
  return raw.length > 0 && raw.length <= 70 ? raw : null;
}

/** Split a part's own headers from its body, and read the two things the
 *  app cares about out of `content-disposition`. */
function headersOf(part: Buffer): { name?: string; filename?: string; body: Buffer } | null {
  const gap = part.indexOf("\r\n\r\n");
  if (gap === -1) return null;
  const head = part.subarray(0, gap).toString("latin1");
  const body = part.subarray(gap + 4);
  const disposition = /^content-disposition:\s*form-data\s*;(.*)$/im.exec(head);
  if (!disposition) return null;
  const name = /;?\s*\bname="([^"]*)"/i.exec(disposition[1])?.[1];
  const filename = /;\s*\bfilename="([^"]*)"/i.exec(disposition[1])?.[1];
  return { name, filename, body };
}

/** Every part of a multipart body, in order.
 *
 *  Returns an empty list rather than throwing on anything malformed: a
 *  request this cannot understand becomes a request with no fields, which
 *  the route above refuses in words like any other blank submission. A
 *  parser that throws on a stranger's bytes is a way to take the app down. */
export function parseMultipart(body: Buffer, boundary: string): Part[] {
  const delimiter = Buffer.from(`--${boundary}`, "latin1");
  const parts: Part[] = [];
  let at = body.indexOf(delimiter);
  if (at === -1) return parts;

  while (at !== -1) {
    let start = at + delimiter.length;
    // The closing delimiter is "--boundary--". Anything after it is epilogue.
    if (body[start] === DASH && body[start + 1] === DASH) break;
    if (body[start] === CR && body[start + 1] === LF) start += 2;
    else if (body[start] === LF) start += 1;

    const next = body.indexOf(delimiter, start);
    if (next === -1) break;
    // The CRLF immediately before a delimiter belongs to the delimiter, not
    // to the part — without this every file would gain two bytes, which for
    // a JPEG is a file that still opens and is quietly wrong.
    let end = next;
    if (body[end - 1] === LF) end -= 1;
    if (body[end - 1] === CR) end -= 1;

    const parsed = headersOf(body.subarray(start, end));
    if (parsed?.name !== undefined) {
      parts.push(
        parsed.filename === undefined
          ? { name: parsed.name, value: parsed.body }
          : { name: parsed.name, filename: parsed.filename, value: parsed.body },
      );
    }
    at = next;
  }
  return parts;
}

/** The text fields, as the urlencoded path would have given them. The first
 *  value wins, which is what `URLSearchParams.get` does too. */
export function fieldsOf(parts: Part[]): URLSearchParams {
  const form = new URLSearchParams();
  for (const part of parts) {
    if (part.filename !== undefined) continue;
    if (form.has(part.name)) continue;
    form.set(part.name, part.value.toString("utf8"));
  }
  return form;
}

/** The first file part under this field name that actually carries bytes.
 *  A form submitted with the file input left empty sends a part with an
 *  empty filename and no body, and that is not a photograph. */
export function fileOf(parts: Part[], name: string): Buffer | undefined {
  for (const part of parts) {
    if (part.name !== name) continue;
    if (part.filename === undefined) continue;
    if (part.value.length === 0) continue;
    return part.value;
  }
  return undefined;
}
