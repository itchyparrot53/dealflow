// Logo dimensions from the file header bytes (PLAN-PART13 6.3). No image library: the upload only
// accepts PNG and JPEG, and both carry the size in a fixed header, so this reads exactly what it
// needs and rejects anything malformed.

export interface ImageInfo {
  mime: "image/png" | "image/jpeg";
  width: number;
  height: number;
}

const PNG_SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

function u16(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] ?? 0) << 8) | (bytes[offset + 1] ?? 0);
}

function u32(bytes: Uint8Array, offset: number): number {
  return (
    (((bytes[offset] ?? 0) << 24) |
      ((bytes[offset + 1] ?? 0) << 16) |
      ((bytes[offset + 2] ?? 0) << 8) |
      (bytes[offset + 3] ?? 0)) >>>
    0
  );
}

function isPng(bytes: Uint8Array): boolean {
  return bytes.length >= 24 && PNG_SIGNATURE.every((value, index) => bytes[index] === value);
}

function pngSize(bytes: Uint8Array): ImageInfo | null {
  const ihdr = String.fromCharCode(...bytes.slice(12, 16));
  if (ihdr !== "IHDR") return null;
  const width = u32(bytes, 16);
  const height = u32(bytes, 20);
  if (width === 0 || height === 0) return null;
  return { mime: "image/png", width, height };
}

function skipFill(bytes: Uint8Array, offset: number): number {
  let index = offset;
  while (index + 1 < bytes.length && bytes[index + 1] === 0xff) index += 1;
  return index;
}

function standalone(marker: number): boolean {
  return marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7);
}

function sofInfo(bytes: Uint8Array, offset: number, marker: number): ImageInfo | null {
  if (marker !== 0xc0 && marker !== 0xc1 && marker !== 0xc2) return null;
  if (offset + 9 > bytes.length) return null;
  const height = u16(bytes, offset + 5);
  const width = u16(bytes, offset + 7);
  if (width === 0 || height === 0) return null;
  return { mime: "image/jpeg", width, height };
}

function jpegSize(bytes: Uint8Array): ImageInfo | null {
  let offset = 2;
  while (offset + 4 <= bytes.length) {
    if (bytes[offset] !== 0xff) {
      offset += 1;
      continue;
    }
    offset = skipFill(bytes, offset);
    const marker = bytes[offset + 1] ?? 0;
    if (standalone(marker)) {
      offset += 2;
      continue;
    }
    const length = u16(bytes, offset + 2);
    if (length < 2) return null;
    const frame = sofInfo(bytes, offset, marker);
    if (frame !== null) return frame;
    offset += 2 + length;
  }
  return null;
}

export function imageSize(bytes: Uint8Array): ImageInfo | null {
  if (isPng(bytes)) return pngSize(bytes);
  if (bytes.length >= 4 && bytes[0] === 0xff && bytes[1] === 0xd8) return jpegSize(bytes);
  return null;
}
