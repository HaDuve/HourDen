import { readFileSync } from "node:fs";

const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

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
  return { chunks, colorType };
}

/** @param {string} filePath */
export function readPngInfoFromFile(filePath) {
  return readPngInfo(readFileSync(filePath));
}
