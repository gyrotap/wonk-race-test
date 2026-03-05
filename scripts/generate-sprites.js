// Generate simple placeholder horse PNG sprites as colored circles with a horse silhouette
// These are minimal PNGs - replace with custom art!

const fs = require('fs');
const path = require('path');

const colors = [
  [255, 68, 68],    // red
  [68, 136, 255],   // blue
  [68, 204, 68],    // green
  [255, 170, 0],    // orange
  [204, 68, 204],   // purple
  [0, 204, 204],    // cyan
  [255, 255, 68],   // yellow
  [255, 136, 204],  // pink
];

// Create a simple 32x32 PNG with a colored horse-like shape
// Using raw PNG encoding (no dependencies needed)

function createPNG(width, height, pixels) {
  // PNG signature
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR chunk
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8;  // bit depth
  ihdr[9] = 6;  // color type: RGBA
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdr);

  // IDAT chunk (image data)
  const rawData = Buffer.alloc(height * (1 + width * 4));
  for (let y = 0; y < height; y++) {
    rawData[y * (1 + width * 4)] = 0; // filter: none
    for (let x = 0; x < width; x++) {
      const idx = (y * width + x) * 4;
      const offset = y * (1 + width * 4) + 1 + x * 4;
      rawData[offset] = pixels[idx];
      rawData[offset + 1] = pixels[idx + 1];
      rawData[offset + 2] = pixels[idx + 2];
      rawData[offset + 3] = pixels[idx + 3];
    }
  }

  const { deflateSync } = require('zlib');
  const compressed = deflateSync(rawData);
  const idatChunk = makeChunk('IDAT', compressed);

  // IEND chunk
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

function makeChunk(type, data) {
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const typeBuffer = Buffer.from(type, 'ascii');
  const crcData = Buffer.concat([typeBuffer, data]);

  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(crcData), 0);

  return Buffer.concat([length, typeBuffer, data, crc]);
}

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i];
    for (let j = 0; j < 8; j++) {
      if (crc & 1) {
        crc = (crc >>> 1) ^ 0xEDB88320;
      } else {
        crc = crc >>> 1;
      }
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

// Simple horse-ish silhouette pattern (32x32)
// 1 = filled, 0 = transparent
const HORSE_PATTERN = [
  '00000000000001100000000000000000',
  '00000000000011110000000000000000',
  '00000000000111111000000000000000',
  '00000000001111111100000000000000',
  '00000000011111111100000000000000',
  '00000000011111111110000000000000',
  '00000000111111111110000000000000',
  '00000000111111111111000000000000',
  '00000001111111111111000000000000',
  '00000001111111111111100000000000',
  '00000011111111111111110000000000',
  '00000111111111111111111000000000',
  '00001111111111111111111100000000',
  '00011111111111111111111110000000',
  '00111111111111111111111111000000',
  '01111111111111111111111111100000',
  '01111111111111111111111111100000',
  '11111111111111111111111111110000',
  '11111111111111111111111111110000',
  '01111111111111111111111111100000',
  '00111111111111111111111111000000',
  '00011111111111111111111110000000',
  '00001111100111110011111100000000',
  '00001111100011100011111000000000',
  '00001111000011100001111000000000',
  '00001111000011100001111000000000',
  '00001111000011100001111000000000',
  '00001111000011100001111000000000',
  '00011111000011100001111100000000',
  '00011111100011110001111100000000',
  '00000000000000000000000000000000',
  '00000000000000000000000000000000',
];

const SIZE = 32;
const outDir = path.join(__dirname, '..', 'public', 'sprites');
fs.mkdirSync(outDir, { recursive: true });

for (let i = 0; i < colors.length; i++) {
  const [r, g, b] = colors[i];
  const pixels = new Uint8Array(SIZE * SIZE * 4);

  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const idx = (y * SIZE + x) * 4;
      if (HORSE_PATTERN[y]?.[x] === '1') {
        pixels[idx] = r;
        pixels[idx + 1] = g;
        pixels[idx + 2] = b;
        pixels[idx + 3] = 255;
      } else {
        pixels[idx] = 0;
        pixels[idx + 1] = 0;
        pixels[idx + 2] = 0;
        pixels[idx + 3] = 0;
      }
    }
  }

  const png = createPNG(SIZE, SIZE, pixels);
  const filePath = path.join(outDir, `wonk${i + 1}.png`);
  fs.writeFileSync(filePath, png);
  console.log(`Generated ${filePath}`);
}

console.log('Done! Replace these PNGs with your custom wonk art.');
