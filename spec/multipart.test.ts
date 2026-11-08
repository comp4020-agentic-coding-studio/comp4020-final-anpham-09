import { describe, expect, it } from "vitest";
import { boundaryOf, fieldsOf, fileOf, parseMultipart } from "../src/multipart.ts";

// The app parses multipart bodies itself rather than taking a second runtime
// dependency, which makes this the riskiest code in the repository: it reads
// bytes a stranger sent. src/multipart.ts has no `node:http` import for the
// same reason src/events.ts has none — so it can be tested against buffers
// built by hand here, including shapes a browser would never send.

const B = "----villageBoundary";

/** A body assembled byte by byte, the way a browser assembles one. Built
 *  from Buffers rather than a template string, because the whole point of
 *  the file part is that it is not text. */
function body(parts: Array<{ name: string; filename?: string; value: Buffer | string }>): Buffer {
  const chunks: Buffer[] = [];
  for (const part of parts) {
    const disposition = part.filename === undefined
      ? `form-data; name="${part.name}"`
      : `form-data; name="${part.name}"; filename="${part.filename}"`;
    chunks.push(Buffer.from(`--${B}\r\ncontent-disposition: ${disposition}\r\n\r\n`, "latin1"));
    chunks.push(typeof part.value === "string" ? Buffer.from(part.value, "utf8") : part.value);
    chunks.push(Buffer.from("\r\n", "latin1"));
  }
  chunks.push(Buffer.from(`--${B}--\r\n`, "latin1"));
  return Buffer.concat(chunks);
}

describe("reading a form that carries a file", () => {
  it("reads the text fields back as a plain form", () => {
    const parts = parseMultipart(
      body([
        { name: "house", value: "hanoi" },
        { name: "title", value: "One candle" },
        { name: "body", value: "he looked at the candle" },
      ]),
      B,
    );
    const form = fieldsOf(parts);
    expect(form.get("house")).toBe("hanoi");
    expect(form.get("title")).toBe("One candle");
    expect(form.get("body")).toBe("he looked at the candle");
  });

  it("gives back the file's bytes exactly, with nothing added or taken off", () => {
    // The bug this exists for: the CRLF before a boundary belongs to the
    // delimiter, not to the part. Keeping it appends two bytes to every
    // upload — and a JPEG with two extra bytes still opens, so nothing
    // downstream complains and the file is quietly not the file that was
    // sent. Deliberately includes a CR, an LF and a NUL in the payload, and
    // ends on a CR, so an over-eager trim is visible.
    const bytes = Buffer.from([0xff, 0xd8, 0xff, 0x00, 0x0d, 0x0a, 0x41, 0x0a, 0x42, 0x0d]);
    const parts = parseMultipart(
      body([{ name: "body", value: "words" }, { name: "photo", filename: "a.jpg", value: bytes }]),
      B,
    );
    const file = fileOf(parts, "photo");
    expect(file, "no file part found").toBeDefined();
    expect([...file!]).toEqual([...bytes]);
  });

  it("treats a file input left empty as no file at all", () => {
    // A browser sends the part anyway, with an empty filename and no body.
    const parts = parseMultipart(
      body([{ name: "body", value: "no picture today" }, { name: "photo", filename: "", value: Buffer.alloc(0) }]),
      B,
    );
    expect(fileOf(parts, "photo")).toBeUndefined();
    expect(fieldsOf(parts).get("body")).toBe("no picture today");
  });

  it("keeps a file part out of the text fields", () => {
    // Otherwise a photograph's bytes would be read as a form value, and the
    // app would try to store a JPEG as somebody's title.
    const parts = parseMultipart(
      body([{ name: "photo", filename: "a.jpg", value: Buffer.from([0xff, 0xd8, 0xff]) }]),
      B,
    );
    expect(fieldsOf(parts).has("photo")).toBe(false);
  });

  it("returns nothing at all for a body it cannot make sense of, rather than throwing", () => {
    // A parser that throws on a stranger's bytes is a way to take the app
    // down with one request. An unreadable body becomes a request with no
    // fields, which the route refuses in words like any other blank one.
    for (const junk of [
      Buffer.alloc(0),
      Buffer.from("not multipart at all"),
      Buffer.from(`--${B}\r\nno blank line so no headers`),
      Buffer.from(`--${B}\r\ncontent-disposition: form-data\r\n\r\nno name\r\n--${B}--`),
      Buffer.from([0xff, 0xfe, 0x00, 0x01, 0x02]),
    ]) {
      expect(() => parseMultipart(junk, B)).not.toThrow();
      expect(fieldsOf(parseMultipart(junk, B)).size).toBe(0);
    }
  });

  it("finds the boundary, quoted or not, and refuses anything that is not multipart", () => {
    expect(boundaryOf(`multipart/form-data; boundary=${B}`)).toBe(B);
    expect(boundaryOf(`multipart/form-data; boundary="${B}"`)).toBe(B);
    expect(boundaryOf(`multipart/form-data; charset=utf-8; boundary=${B}`)).toBe(B);
    expect(boundaryOf("application/x-www-form-urlencoded")).toBeNull();
    expect(boundaryOf(undefined)).toBeNull();
    // An empty boundary would make every byte a delimiter.
    expect(boundaryOf("multipart/form-data; boundary=")).toBeNull();
    expect(boundaryOf('multipart/form-data; boundary=""')).toBeNull();
  });
});
