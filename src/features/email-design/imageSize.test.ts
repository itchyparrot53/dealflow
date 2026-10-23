import { describe, expect, it } from "vitest";
import { imageSize } from "./imageSize";

function pngHeader(width: number, height: number): Uint8Array {
  const bytes = new Uint8Array(33);
  bytes.set([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a], 0);
  bytes.set([0, 0, 0, 13], 8);
  bytes.set([0x49, 0x48, 0x44, 0x52], 12);
  bytes.set([(width >>> 24) & 0xff, (width >>> 16) & 0xff, (width >>> 8) & 0xff, width & 0xff], 16);
  bytes.set(
    [(height >>> 24) & 0xff, (height >>> 16) & 0xff, (height >>> 8) & 0xff, height & 0xff],
    20,
  );
  bytes.set([8, 6, 0, 0, 0], 24);
  return bytes;
}

function jpegHeader(width: number, height: number): Uint8Array {
  return new Uint8Array([
    0xff,
    0xd8, // SOI
    0xff,
    0xe0,
    0x00,
    0x10,
    0x4a,
    0x46,
    0x49,
    0x46,
    0x00,
    0x01,
    0x01,
    0x00,
    0x00,
    0x01,
    0x00,
    0x01,
    0x00,
    0x00, // APP0 segment, length 16
    0xff,
    0xc0,
    0x00,
    0x11,
    0x08, // SOF0, length 17, precision 8
    (height >>> 8) & 0xff,
    height & 0xff,
    (width >>> 8) & 0xff,
    width & 0xff,
    0x03,
    0x01,
    0x11,
    0x00,
    0x02,
    0x11,
    0x01,
    0x03,
    0x11,
    0x01,
  ]);
}

describe("imageSize", () => {
  it("reads a PNG's width and height from IHDR", () => {
    expect(imageSize(pngHeader(240, 60))).toEqual({ mime: "image/png", width: 240, height: 60 });
  });

  it("reads a JPEG's width and height from SOF0", () => {
    expect(imageSize(jpegHeader(800, 600))).toEqual({
      mime: "image/jpeg",
      width: 800,
      height: 600,
    });
  });

  it("reads a progressive JPEG's SOF2 frame", () => {
    const jpeg = jpegHeader(1200, 400);
    jpeg[21] = 0xc2;
    expect(imageSize(jpeg)).toEqual({ mime: "image/jpeg", width: 1200, height: 400 });
  });

  it("returns null for a corrupt or unsupported file", () => {
    expect(imageSize(new Uint8Array([]))).toBeNull();
    expect(imageSize(new Uint8Array([0x47, 0x49, 0x46, 0x38]))).toBeNull();
    expect(imageSize(new Uint8Array([0xff, 0xd8, 0xff]))).toBeNull();
    const truncatedPng = pngHeader(10, 10).slice(0, 18);
    expect(imageSize(truncatedPng)).toBeNull();
    const zeroPng = pngHeader(0, 10);
    expect(imageSize(zeroPng)).toBeNull();
  });
});
