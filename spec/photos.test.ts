import { mkdtempSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { beforeEach, describe, expect, it, vi } from "vitest";

// What the app will accept as a photograph, and what it will call it.
// Tested against a throwaway uploads directory, because src/photos.ts reads
// PHOTOS_PATH once on first import — each case sets it and then imports.

type Photos = typeof import("../src/photos.ts");

let dir: string;

async function boot(): Promise<Photos> {
  vi.resetModules();
  process.env.PHOTOS_PATH = dir;
  return (await import("../src/photos.ts")) as Photos;
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "village-photos-"));
});

/** A real JPEG that ships with the app, and the size its own file name
 *  claims. Using a real photograph rather than a hand-made header is the
 *  point: the name was written by `storePhoto` from bytes this same code
 *  measured, so this closes the loop. */
const SHIPPED = "img/family/an-duy-candle-1100x733.jpg";

/** A valid PNG, assembled here so the dimensions under test are ones this
 *  file chose. Only the signature and IHDR matter to `measure`. */
function png(w: number, h: number): Buffer {
  const sig = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
  const ihdr = Buffer.alloc(25);
  ihdr.writeUInt32BE(13, 0);
  ihdr.write("IHDR", 4, "latin1");
  ihdr.writeUInt32BE(w, 8);
  ihdr.writeUInt32BE(h, 12);
  return Buffer.concat([sig, ihdr]);
}

describe("what the app will accept as a photograph", () => {
  it("reads what a file is from its bytes, not from what it was called", () => {
    // The content-type on an upload is a claim by whoever sent it. A text
    // file named .jpg and announced as image/jpeg is still a text file.
    return boot().then((photos) => {
      expect(photos.kindOf(readFileSync(SHIPPED))).toBe("jpg");
      expect(photos.kindOf(png(10, 10))).toBe("png");
      expect(photos.kindOf(Buffer.concat([Buffer.from("RIFF0000WEBPVP8 ")]))).toBe("webp");
      expect(photos.kindOf(Buffer.from("<!doctype html><script>alert(1)</script>"))).toBeNull();
      expect(photos.kindOf(Buffer.from("GIF89a and then some"))).toBeNull();
      expect(photos.kindOf(Buffer.alloc(4))).toBeNull();
    });
  });

  it("measures a real photograph, and agrees with the name it was given", async () => {
    const photos = await boot();
    // Without this the card has no width or height and every page jumps as
    // its pictures arrive.
    expect(photos.measure(readFileSync(SHIPPED))).toEqual({ w: 1100, h: 733 });
    expect(photos.measure(png(640, 480))).toEqual({ w: 640, h: 480 });
    expect(photos.measure(Buffer.from("not a picture"))).toBeNull();
    // And the shipped name says the same thing the bytes do.
    expect(photos.sizeOfName("an-duy-candle-1100x733.jpg")).toEqual({ w: 1100, h: 733 });
  });

  it("refuses a file that is not a picture, and one that is too big, in that order", async () => {
    const photos = await boot();
    expect(photos.storePhoto(Buffer.from("<html>"))).toBe("photo-not-an-image");
    // Over the cap, and a valid JPEG header, so only the size can refuse it.
    const huge = Buffer.concat([
      Buffer.from([0xff, 0xd8, 0xff]),
      Buffer.alloc(photos.MAX_PHOTO_BYTES + 1),
    ]);
    expect(photos.storePhoto(huge)).toBe("photo-too-big");
    expect(readdirSync(dir).length, "a refused upload was written to disk anyway").toBe(0);
  });

  it("names a stored photograph itself, never after the file it came from", async () => {
    const photos = await boot();
    const name = photos.storePhoto(readFileSync(SHIPPED));
    expect(typeof name).toBe("string");
    expect(photos.isPhotoName(name as string)).toBe(true);
    // The size the bytes report rides in the name, so nothing has to open
    // the file again to lay out a page.
    expect(photos.sizeOfName(name as string)).toEqual({ w: 1100, h: 733 });
    expect(readdirSync(dir)).toContain(name);
  });

  it("will not read a name that could reach outside its own directories", async () => {
    const photos = await boot();
    // Written where a traversal would land, so a successful read is proof
    // of a real escape rather than of a missing file.
    writeFileSync(join(dir, "..", "escaped.jpg"), readFileSync(SHIPPED));
    for (const name of [
      "../escaped.jpg",
      "..%2Fescaped.jpg",
      "sub/dir.jpg",
      "sub\\dir.jpg",
      "/etc/passwd",
      "a.jpg\u0000.png",
      "A-UPPER.jpg",
      "no-extension",
      "script.svg",
      "a.jpg.exe",
    ]) {
      expect(photos.isPhotoName(name), `${name} was accepted as a name`).toBe(false);
      expect(photos.readPhoto(name), `${name} was read`).toBeUndefined();
    }
  });

  it("reads back an upload, and a photograph that ships with the app", async () => {
    const photos = await boot();
    const name = photos.storePhoto(png(3, 3)) as string;
    expect(photos.readPhoto(name)?.type).toBe("image/png");
    // One namespace, two places: the caller never says which, so a name
    // cannot be used to choose where the bytes are read from.
    const shipped = photos.readPhoto("an-duy-candle-1100x733.jpg");
    expect(shipped?.type).toBe("image/jpeg");
    expect(shipped?.data.length).toBeGreaterThan(1000);
    expect(photos.readPhoto("ffffffffffffffffffffffff.jpg")).toBeUndefined();
  });
});
