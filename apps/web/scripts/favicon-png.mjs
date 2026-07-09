import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

/** Crop height for tab icons: shield + clock, omitting the "hd" wordmark (#110). */
export const TAB_FAVICON_CROP_HEIGHT_PERCENT = 78;

/** Tab favicon opaque bounds should fill most of the 32×32 canvas after trim + crop. */
export const MIN_TAB_FAVICON_BOUNDS_FILL = 0.72;

/** @param {Buffer} buffer */
export function readPngInfo(buffer) {
  if (!buffer.subarray(0, 8).equals(PNG_SIGNATURE)) {
    throw new Error("Not a PNG file");
  }

  const chunks = [];
  let offset = 8;

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    chunks.push(type);
    offset += 8 + length + 4;
  }

  if (chunks[0] !== "IHDR") {
    throw new Error("PNG missing IHDR chunk");
  }

  const colorType = buffer.readUInt8(25);
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { chunks, colorType, width, height };
}

/** @param {string} filePath */
export function readPngInfoFromFile(filePath) {
  return readPngInfo(readFileSync(filePath));
}

/**
 * @param {Uint8Array} row
 * @param {Uint8Array} out
 * @param {Uint8Array | null} prev
 * @param {number} bpp
 */
function unfilterScanline(filter, row, out, prev, bpp) {
  switch (filter) {
    case 0:
      out.set(row);
      return;
    case 1:
      for (let i = 0; i < row.length; i++) {
        const left = i >= bpp ? out[i - bpp] : 0;
        out[i] = (row[i] + left) & 0xff;
      }
      return;
    case 2:
      for (let i = 0; i < row.length; i++) {
        const up = prev ? prev[i] : 0;
        out[i] = (row[i] + up) & 0xff;
      }
      return;
    case 3:
      for (let i = 0; i < row.length; i++) {
        const left = i >= bpp ? out[i - bpp] : 0;
        const up = prev ? prev[i] : 0;
        out[i] = (row[i] + Math.floor((left + up) / 2)) & 0xff;
      }
      return;
    case 4:
      for (let i = 0; i < row.length; i++) {
        const left = i >= bpp ? out[i - bpp] : 0;
        const up = prev ? prev[i] : 0;
        const upLeft = i >= bpp && prev ? prev[i - bpp] : 0;
        out[i] = (row[i] + paethPredictor(left, up, upLeft)) & 0xff;
      }
      return;
    default:
      throw new Error(`Unsupported PNG filter ${filter}`);
  }
}

function paethPredictor(a, b, c) {
  const p = a + b - c;
  const pa = Math.abs(p - a);
  const pb = Math.abs(p - b);
  const pc = Math.abs(p - c);
  if (pa <= pb && pa <= pc) {
    return a;
  }
  if (pb <= pc) {
    return b;
  }
  return c;
}

/** @param {Buffer} buffer */
export function readPngRgba(buffer) {
  let offset = 8;
  let width = 0;
  let height = 0;
  let colorType = 0;
  const idatChunks = [];

  while (offset + 8 <= buffer.length) {
    const length = buffer.readUInt32BE(offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const data = buffer.subarray(offset + 8, offset + 8 + length);
    offset += 12 + length;

    if (type === "IHDR") {
      width = data.readUInt32BE(0);
      height = data.readUInt32BE(4);
      colorType = data[9];
    } else if (type === "IDAT") {
      idatChunks.push(data);
    } else if (type === "IEND") {
      break;
    }
  }

  if (colorType !== 6) {
    throw new Error(`Expected RGBA PNG, got color type ${colorType}`);
  }

  const inflated = inflateSync(Buffer.concat(idatChunks));
  const bytesPerPixel = 4;
  const stride = width * bytesPerPixel;
  const rgba = new Uint8Array(width * height * bytesPerPixel);
  let inOffset = 0;

  for (let y = 0; y < height; y++) {
    const filter = inflated[inOffset++];
    const row = inflated.subarray(inOffset, inOffset + stride);
    inOffset += stride;
    const prevRow = y > 0 ? rgba.subarray((y - 1) * stride, y * stride) : null;
    const outRow = rgba.subarray(y * stride, (y + 1) * stride);
    unfilterScanline(filter, row, outRow, prevRow, bytesPerPixel);
  }

  return { width, height, rgba };
}

/**
 * @param {{ width: number; height: number; rgba: Uint8Array }} image
 * @param {number} [alphaThreshold]
 */
export function computeOpaqueBoundsFill(image, alphaThreshold = 128) {
  const { width, height, rgba } = image;
  let minX = width;
  let minY = height;
  let maxX = -1;
  let maxY = -1;

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const alpha = rgba[(y * width + x) * 4 + 3];
      if (alpha < alphaThreshold) {
        continue;
      }
      minX = Math.min(minX, x);
      minY = Math.min(minY, y);
      maxX = Math.max(maxX, x);
      maxY = Math.max(maxY, y);
    }
  }

  if (maxX < 0) {
    return 0;
  }

  const boundsArea = (maxX - minX + 1) * (maxY - minY + 1);
  return boundsArea / (width * height);
}

/** @param {string} filePath */
export function readOpaqueBoundsFillFromFile(filePath) {
  const buffer = readFileSync(filePath);
  return computeOpaqueBoundsFill(readPngRgba(buffer));
}
