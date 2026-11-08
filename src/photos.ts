/** Where a photograph lives, and what the app will accept as one.
 *
 *  A memory may carry one picture. This module owns every question about
 *  it — what counts as an image, what it is called on disk, and which of
 *  the two places it is read from — so that no route can answer any of
 *  them differently.
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

/** Four megabytes. A phone photograph is well under it, and the machine
 *  this runs on has 256MB of memory for everything — the body is held
 *  whole to be parsed, so this number is a memory limit before it is a
 *  storage one. */
export const MAX_PHOTO_BYTES = 4 * 1024 * 1024;

/** Uploads go on the only durable storage there is. The fallback is an
 *  untracked directory beside the repo, same arrangement as the database. */
/** Resolved to an absolute path on purpose. The containment check in
 *  `readPhoto` compares a joined path against this one, and `join`
 *  normalises "./.data/photos" to ".data/photos" — so a relative base made
 *  that check reject every upload it was supposed to be guarding. Found by
 *  a test that asked the route for a picture it had just uploaded. */
const UPLOADS = resolve(
  process.env.PHOTOS_PATH ?? (existsSync("/data") ? "/data/photos" : "./.data/photos"),
);

/** Photographs that ship WITH the app rather than being uploaded to it.
 *  The Dockerfile copies `img/`, so anything here reaches production as
 *  part of the image, and nothing has to be re-uploaded after a deploy. */
const SHIPPED = resolve(join(dirname(dirname(fileURLToPath(import.meta.url))), "img", "family"));

export type PhotoRefusal = "photo-too-big" | "photo-not-an-image";

/** What this actually is, read from the first bytes rather than from what
 *  the browser said it was. A content-type header is a claim by whoever
 *  sent the request; the magic number is the file. */
export function kindOf(data: Buffer): "jpg" | "png" | "webp" | null {
  if (data.length < 12) return null;
  if (data[0] === 0xff && data[1] === 0xd8 && data[2] === 0xff) return "jpg";
  if (
    data[0] === 0x89 && data[1] === 0x50 && data[2] === 0x4e && data[3] === 0x47 &&
    data[4] === 0x0d && data[5] === 0x0a && data[6] === 0x1a && data[7] === 0x0a
  ) {
    return "png";
  }
  if (data.toString("latin1", 0, 4) === "RIFF" && data.toString("latin1", 8, 12) === "WEBP") {
    return "webp";
  }
  return null;
}

/** How big the picture actually is, read out of its own header.
 *
 *  Worth the forty lines: without width and height on the `<img>`, every
 *  card on a page jumps as its photograph arrives, which is the reflow the
 *  house pictures already carry fixed dimensions to avoid. An upload has
 *  no dimensions written down anywhere, so they are read from the bytes.
 *
 *  Returns null for anything it cannot read with certainty — a progressive
 *  JPEG with an unusual marker order, a WebP shape not covered here — and
 *  the renderer then omits the attributes rather than guessing a size. */
export function measure(data: Buffer): { w: number; h: number } | null {
  const kind = kindOf(data);
  if (kind === "png") {
    // IHDR is always the first chunk, and width and height are its first
    // eight bytes.
    if (data.length < 24) return null;
    return { w: data.readUInt32BE(16), h: data.readUInt32BE(20) };
  }
  if (kind === "jpg") {
    // Walk the markers to a start-of-frame, which is where the size is.
    // SOF0/1/2/3, 5-7, 9-11, 13-15 all carry it; DHT, DAC and RSTn do not.
    let at = 2;
    while (at + 9 < data.length) {
      if (data[at] !== 0xff) return null;
      const marker = data[at + 1]!;
      const length = data.readUInt16BE(at + 2);
      const isFrame =
        marker >= 0xc0 && marker <= 0xcf &&
        marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc;
      if (isFrame) return { w: data.readUInt16BE(at + 7), h: data.readUInt16BE(at + 5) };
      if (length < 2) return null;
      at += 2 + length;
    }
    return null;
  }
  if (kind === "webp") {
    const chunk = data.toString("latin1", 12, 16);
    if (chunk === "VP8X" && data.length >= 30) {
      // 24-bit little-endian, stored as one less than the real size.
      const w = 1 + (data[24]! | (data[25]! << 8) | (data[26]! << 16));
      const h = 1 + (data[27]! | (data[28]! << 8) | (data[29]! << 16));
      return { w, h };
    }
    if (chunk === "VP8 " && data.length >= 30) {
      return { w: data.readUInt16LE(26) & 0x3fff, h: data.readUInt16LE(28) & 0x3fff };
    }
    if (chunk === "VP8L" && data.length >= 25) {
      const bits = data.readUInt32LE(21);
      return { w: 1 + (bits & 0x3fff), h: 1 + ((bits >> 14) & 0x3fff) };
    }
    return null;
  }
  return null;
}

/** A name this app wrote. Lowercase, no separator of any kind, and one of
 *  three extensions — so a name can never climb out of a directory even
 *  before the resolved path is checked below.
 *
 *  The size is part of the name rather than two more columns on `things`,
 *  because it is a fact about the file and not about the memory: the file
 *  is written once and never altered, so the name cannot drift from it,
 *  and nothing has to open the picture again to lay out a page. */
const NAME = /^[a-z0-9][a-z0-9-]{0,63}\.(jpg|png|webp)$/;

/** The dimensions a stored name carries, if it carries any. */
export function sizeOfName(name: string): { w: number; h: number } | null {
  const match = /-(\d{1,5})x(\d{1,5})\.(?:jpg|png|webp)$/.exec(name);
  if (!match) return null;
  return { w: Number(match[1]), h: Number(match[2]) };
}

export function isPhotoName(name: string): boolean {
  return NAME.test(name);
}

/** Write a photograph and answer what it is called. The name is generated,
 *  never taken from the upload: a filename is the one field in a form that
 *  arrives already looking like a path. */
export function storePhoto(data: Buffer): string | PhotoRefusal {
  if (data.length > MAX_PHOTO_BYTES) return "photo-too-big";
  const kind = kindOf(data);
  if (!kind) return "photo-not-an-image";
    mkdirSync(UPLOADS, { recursive: true });
  const size = measure(data);
  const stamp = size && size.w > 0 && size.h > 0 ? `-${size.w}x${size.h}` : "";
  const name = `${randomBytes(12).toString("hex")}${stamp}.${kind}`;
  writeFileSync(join(UPLOADS, name), data);
  return name;
}

const TYPES: Record<string, string> = {
  jpg: "image/jpeg",
  png: "image/png",
  webp: "image/webp",
};

export interface StoredPhoto {
  data: Buffer;
  type: string;
}

/** Read a photograph back: an upload first, then one that shipped with the
 *  app. Two directories, one namespace, and the caller never says which —
 *  so a name cannot be used to choose where to read from.
 *
 *  Returns undefined for anything missing, unreadable or wrongly named.
 *  A missing picture is a missing picture, never a 500. */
export function readPhoto(name: string): StoredPhoto | undefined {
  if (!isPhotoName(name)) return undefined;
  const ext = name.slice(name.lastIndexOf(".") + 1);
  const type = TYPES[ext];
  if (!type) return undefined;
  for (const dir of [UPLOADS, SHIPPED]) {
    const path = join(dir, name);
    // The name cannot contain a separator, so this cannot escape; checked
    // anyway as a second line of defence, the same way the /img route does.
    if (!path.startsWith(dir)) continue;
    try {
      return { data: readFileSync(path), type };
    } catch {
      // not here; try the other place
    }
  }
  return undefined;
}
