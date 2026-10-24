import { mkdir, writeFile } from "node:fs/promises";
import { deflateSync } from "node:zlib";

const size = 128;
const pixels = Buffer.alloc(size * (size * 4 + 1));
for (let row = 0; row < size; row += 1) for (let column = 0; column < size; column += 1) {
  const offset = row * (size * 4 + 1) + 1 + column * 4;
  pixels[offset] = pixels[offset + 1] = pixels[offset + 2] = 255;
  pixels[offset + 3] = Math.round(255 * (row + column) / (2 * (size - 1)));
}

function chunk(type, data) {
  const payload = Buffer.concat([Buffer.from(type), data]);
  let checksum = 0xffffffff;
  for (const byte of payload) {
    checksum ^= byte;
    for (let bit = 0; bit < 8; bit += 1) checksum = (checksum >>> 1) ^ ((checksum & 1) ? 0xedb88320 : 0);
  }
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE((checksum ^ 0xffffffff) >>> 0);
  return Buffer.concat([length, payload, crc]);
}

const header = Buffer.alloc(13);
header.writeUInt32BE(size);
header.writeUInt32BE(size, 4);
header[8] = 8;
header[9] = 6;
const png = Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk("IHDR", header), chunk("IDAT", deflateSync(pixels)),
  chunk("IEND", Buffer.alloc(0)),
]);
const directory = new URL("../apps/mobile/assets/", import.meta.url);
await mkdir(directory, { recursive: true });
await writeFile(new URL("diagonal-wash.png", directory), png);
console.log(`Generated 128 × 128 theme gradient mask (${png.length} bytes).`);
